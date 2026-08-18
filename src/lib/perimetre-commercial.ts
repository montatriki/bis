import prisma from "@/lib/prisma";

// Rapprochement d'un commercial entre la session et les données de l'ERP.
//
// Les noms saisis dans l'ERP ne sont pas normalisés : le même vendeur apparaît
// en « MOKHTAR » dans `documents_ext.utilisateur` et en « Mokhtar Trabelsi »
// dans `users.name`. Un `contains` sur le nom complet ne trouve alors rien, et
// le commercial se retrouve devant un écran vide alors qu'il a 332 tickets.
//
// On compare donc sur le prénom, sans casse ni accents — c'est le plus petit
// dénominateur commun entre les deux sources.

/** Prénom normalisé, servant de clé de rapprochement. */
export function cleCommercial(nom?: string | null): string {
  return String(nom ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase()
    .split(/\s+/)[0] ?? "";
}

/**
 * Condition Prisma restreignant des documents au commercial connecté.
 * `null` quand aucun périmètre ne s'applique (ADMIN, MANAGER…).
 *
 * Le filtre porte sur le **prénom** : `startsWith` couvre aussi bien
 * « MOKHTAR » que « Mokhtar Trabelsi ».
 */
export function filtreCommercial(
  user: { role: string; name: string },
  champs: string[] = ["utilisateur", "commercial"],
) {
  if (user.role !== "COMMERCIAL") return null;
  const cle = cleCommercial(user.name);
  if (!cle) return null;
  return {
    OR: champs.map((champ) => ({
      [champ]: { startsWith: cle, mode: "insensitive" as const },
    })),
  };
}

/** Le nom `valeur` désigne-t-il le même commercial que `attendu` ? */
export function memeCommercial(valeur?: string | null, attendu?: string | null): boolean {
  const a = cleCommercial(valeur);
  const b = cleCommercial(attendu);
  return a !== "" && a === b;
}

/**
 * Emplacement de stock du camion d'un commercial.
 *
 * Les emplacements de `StockDepot` sont libellés « prénom immatriculation »
 * (« mokhtar 206TU7140 ») alors que la mission ne porte que la plaque. On
 * cherche donc, parmi les emplacements réellement approvisionnés, celui qui
 * commence par le prénom du commercial — à défaut celui qui contient la plaque.
 *
 * Renvoie `null` si aucun camion n'est identifiable : la vente sortira alors
 * du stock global plutôt que d'échouer.
 */
export async function emplacementVehicule(
  nomCommercial: string,
  plaque?: string | null,
): Promise<string | null> {
  const cle = cleCommercial(nomCommercial);
  if (!cle && !plaque) return null;

  const rows = await prisma.stockDepot.findMany({
    where: { quantite: { not: 0 } },
    distinct: ["emplacement"],
    select: { emplacement: true },
  });

  const emplacements = rows.map((r) => r.emplacement);
  const norm = (v: string) =>
    v.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

  // 1) « mokhtar 206TU7140 » commence par le prénom du commercial.
  const parNom = cle ? emplacements.find((e) => norm(e).startsWith(cle)) : undefined;
  if (parNom) return parNom;

  // 2) sinon, l'emplacement portant la plaque de la mission du jour.
  if (plaque) {
    const p = norm(plaque);
    const parPlaque = emplacements.find((e) => norm(e).includes(p));
    if (parPlaque) return parPlaque;
  }

  return null;
}

/**
 * Restriction du **portefeuille client** au commercial connecté.
 *
 * Un commercial ne doit voir que ses propres clients : afficher ceux d'un
 * collègue expose son fichier commercial et ses encours. `Partner.commercial`
 * est du texte libre non normalisé (« MOKHTAR », « mokhtar trabelsi ») : on
 * compare donc sur le prénom, comme partout ailleurs.
 *
 * `null` = aucune restriction (ADMIN / MANAGER voient tout le portefeuille).
 */
export function filtrePortefeuille(user: { role: string; name: string }) {
  if (user.role !== "COMMERCIAL") return null;
  const cle = cleCommercial(user.name);
  if (!cle) return null;
  return { commercial: { startsWith: cle, mode: "insensitive" as const } };
}
