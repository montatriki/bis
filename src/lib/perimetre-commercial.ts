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

  // 1) La plaque fait foi — celle de la mission du jour, sinon celle du
  //    véhicule affecté au commercial.
  //
  //    Le libellé du dépôt garde souvent le prénom d'un ancien conducteur :
  //    « mokhtar 206TU7140 » désigne aujourd'hui le camion d'Aziz. S'y fier
  //    d'abord donnait à Mokhtar le catalogue d'un camion qui n'est plus le
  //    sien — et un catalogue vide, son vrai véhicule étant le 248TU6787.
  const affecte = plaque
    ? plaque
    : (await prisma.commercial.findFirst({
        where: { user: { name: { equals: nomCommercial, mode: "insensitive" } } },
        select: { vehicle: { select: { plate: true } } },
      }))?.vehicle?.plate ?? null;

  if (affecte) {
    const p = norm(affecte.trim());
    const parPlaque = emplacements.find((e) => norm(e).includes(p));
    if (parPlaque) return parPlaque;
  }

  // 2) À défaut d'affectation, le libellé qui commence par son prénom.
  const parNom = cle ? emplacements.find((e) => norm(e).startsWith(cle)) : undefined;
  if (parNom) return parNom;

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
/** Nom de commercial normalisé : accents, casse et espaces multiples ignorés. */
export function nomCommercialNormalise(nom?: string | null): string {
  return String(nom ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * Le tiers appartient-il au portefeuille du commercial ? Correspondance
 * **exacte** du nom, comme « Mes clients » de l'ERP d'origine : en
 * production, Mokhtar a 182 clients (« mokhtar trabelsi ») ; les 548 tiers
 * étiquetés « MOKHTAR » (ancienne étiquette) ne sont dans le portefeuille de
 * personne. Un rapprochement par prénom les lui attribuait — et donnait à
 * Heni Rekik les clients de HENI LAJMI.
 */
export function memePortefeuille(valeur?: string | null, attendu?: string | null): boolean {
  const a = nomCommercialNormalise(valeur);
  return a !== "" && a === nomCommercialNormalise(attendu);
}

export function filtrePortefeuille(user: { role: string; name: string }) {
  if (user.role !== "COMMERCIAL") return null;
  const nom = String(user.name ?? "").trim();
  if (!nom) return null;
  // `equals` insensible à la casse ; les valeurs de la prod n'ont ni accent
  // ni espace parasite sur les commerciaux actifs (vérifié : 5/5).
  return { commercial: { equals: nom, mode: "insensitive" as const } };
}
