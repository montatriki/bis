import prisma from "@/lib/prisma";
import { round3 } from "@/lib/vente-stats";

// Inventaire physique et régularisation du stock.
//
// Reprend la logique d'inventaire de `inventoryModule` : on fige le stock
// théorique, on saisit le comptage réel, puis la validation **régularise** le
// stock et journalise l'écart.
//
// Point clé, et c'est pour cela que `qteTheorique` est stockée sur la ligne :
// l'écart doit être figé au moment de la saisie. Si on le recalculait à la
// validation, un mouvement survenu entre-temps (une vente le lendemain) serait
// absorbé dans l'écart d'inventaire et l'on perdrait la trace de la vraie perte.

export type LigneComptage = {
  refArt: string;
  qteComptee: number;
};

export type ResultatInventaire = {
  ok: boolean;
  message: string;
  lignes?: number;
  ecarts?: number;
  valeurEcart?: number;
  alertes?: string[];
};

/** Génère une référence séquentielle `INV-<AA><NNNN>`. */
async function prochaineReference(): Promise<string> {
  const annee = String(new Date().getFullYear()).slice(-2);
  const dernier = await prisma.inventaire.findFirst({
    where: { reference: { startsWith: `INV-${annee}` } },
    orderBy: { reference: "desc" },
    select: { reference: true },
  });
  const n = dernier ? Number(dernier.reference.slice(-4)) || 0 : 0;
  return `INV-${annee}${String(n + 1).padStart(4, "0")}`;
}

/**
 * Crée un inventaire et fige le stock théorique des articles comptés.
 *
 * Sur un emplacement donné, le théorique est le stock **de cet emplacement**
 * (`StockDepot`) ; sinon c'est le stock global de l'article. Confondre les deux
 * fausserait l'écart de tout inventaire partiel.
 */
export async function creerInventaire(
  lignes: LigneComptage[],
  options: { libelle?: string; emplacement?: string | null; utilisateur?: string; observation?: string } = {}
): Promise<ResultatInventaire & { id?: number; reference?: string }> {
  const propres = lignes
    .map((l) => ({ refArt: String(l.refArt ?? "").trim(), qteComptee: Number(l.qteComptee) }))
    .filter((l) => l.refArt && Number.isFinite(l.qteComptee));

  if (propres.length === 0) {
    return { ok: false, message: "Aucune ligne de comptage valide" };
  }

  // Un article compté deux fois dans la même feuille : on refuse plutôt que de
  // garder arbitrairement l'un des deux comptages.
  const vus = new Set<string>();
  const doublons = new Set<string>();
  for (const l of propres) {
    if (vus.has(l.refArt)) doublons.add(l.refArt);
    vus.add(l.refArt);
  }
  if (doublons.size > 0) {
    return { ok: false, message: `Article(s) compté(s) en double : ${[...doublons].join(", ")}` };
  }

  const emplacement = options.emplacement?.trim() || null;
  const refs = [...vus];

  const articles = await prisma.article.findMany({
    where: { refArt: { in: refs } },
    select: { refArt: true, designation: true, enStock: true, pmp: true, puAchat: true },
  });
  const parArt = new Map(articles.map((a) => [a.refArt, a]));

  const parEmplacement = emplacement
    ? new Map(
        (await prisma.stockDepot.findMany({ where: { emplacement, refArt: { in: refs } } }))
          .map((s) => [s.refArt, s.quantite])
      )
    : new Map<string, number>();

  const alertes: string[] = [];
  const data = propres.map((l) => {
    const art = parArt.get(l.refArt);
    if (!art) alertes.push(`${l.refArt} : absent du référentiel articles — théorique supposé nul`);

    const qteTheorique = emplacement
      ? (parEmplacement.get(l.refArt) ?? 0)
      : Number(art?.enStock ?? 0);
    const ecart = round3(l.qteComptee - qteTheorique);
    const pmp = round3(Number(art?.pmp || art?.puAchat || 0));

    return {
      refArt: l.refArt,
      designation: art?.designation ?? null,
      qteTheorique: round3(qteTheorique),
      qteComptee: round3(l.qteComptee),
      ecart,
      pmp,
      valeurEcart: round3(ecart * pmp),
    };
  });

  const reference = await prochaineReference();
  const inv = await prisma.inventaire.create({
    data: {
      reference,
      libelle: options.libelle?.trim() || null,
      emplacement,
      utilisateur: options.utilisateur ?? null,
      observation: options.observation?.trim() || null,
      etat: "Brouillon",
      lignes: { create: data },
    },
  });

  const ecarts = data.filter((d) => Math.abs(d.ecart) > 0.0001).length;
  return {
    ok: true,
    id: inv.id,
    reference,
    lignes: data.length,
    ecarts,
    valeurEcart: round3(data.reduce((t, d) => t + d.valeurEcart, 0)),
    alertes,
    message: `Inventaire ${reference} créé : ${data.length} ligne(s), ${ecarts} écart(s)`,
  };
}

/**
 * Valide un inventaire et régularise le stock.
 *
 * Le stock est **aligné sur le comptage** (et non incrémenté de l'écart) :
 * l'inventaire physique fait foi, c'est sa raison d'être. Chaque écart produit
 * un `ErpStockMovement` d'ajustement avec stock avant/après, pour que la
 * régularisation reste traçable et non un changement silencieux.
 *
 * Tout est transactionnel : un inventaire à moitié régularisé serait pire que
 * pas régularisé du tout.
 */
export async function validerInventaire(
  id: number,
  utilisateur?: string
): Promise<ResultatInventaire> {
  const inv = await prisma.inventaire.findUnique({
    where: { id },
    include: { lignes: true },
  });

  if (!inv) return { ok: false, message: "Inventaire introuvable" };
  // Garde-fou absent de A : sans lui, revalider doublerait la régularisation.
  if (inv.etat === "Validé") {
    return { ok: false, message: `${inv.reference} est déjà validé — régularisation déjà appliquée` };
  }
  if (inv.lignes.length === 0) {
    return { ok: false, message: `${inv.reference} n'a aucune ligne` };
  }

  const aRegulariser = inv.lignes.filter((l) => Math.abs(l.ecart) > 0.0001);
  const alertes: string[] = [];

  const refs = aRegulariser.map((l) => l.refArt);
  const articles = refs.length
    ? await prisma.article.findMany({
        where: { refArt: { in: refs } },
        select: { refArt: true, enStock: true },
      })
    : [];
  const stockActuel = new Map(articles.map((a) => [a.refArt, a.enStock]));

  await prisma.$transaction(async (tx) => {
    for (const l of aRegulariser) {
      const avant = stockActuel.get(l.refArt);

      if (avant === undefined) {
        // Article hors référentiel : on garde la trace du comptage sans
        // inventer une fiche article.
        alertes.push(`${l.refArt} : hors référentiel — écart enregistré, stock non ajusté`);
        continue;
      }

      // Le stock théorique a bougé depuis la saisie : on le signale, car
      // l'écart d'inventaire n'explique alors pas tout le mouvement.
      if (Math.abs(avant - l.qteTheorique) > 0.0001) {
        alertes.push(
          `${l.refArt} : stock passé de ${l.qteTheorique} à ${avant} depuis la saisie — régularisé sur le comptage`
        );
      }

      if (inv.emplacement) {
        // Inventaire d'emplacement : on aligne l'emplacement, et on reporte
        // l'écart sur le stock global (la marchandise existe ou pas).
        await tx.stockDepot.upsert({
          where: { refArt_emplacement: { refArt: l.refArt, emplacement: inv.emplacement } },
          create: { refArt: l.refArt, emplacement: inv.emplacement, quantite: l.qteComptee },
          update: { quantite: l.qteComptee },
        });
        await tx.article.update({
          where: { refArt: l.refArt },
          data: { enStock: round3(avant + l.ecart) },
        });
      } else {
        await tx.article.update({
          where: { refArt: l.refArt },
          data: { enStock: l.qteComptee },
        });
      }

      await tx.erpStockMovement.create({
        data: {
          // `refDoc` est une clé étrangère vers ErpDocument : un inventaire
          // n'est pas un document commercial, la référence va dans `motif`.
          refDoc: null,
          typeDoc: "INV",
          refArt: l.refArt,
          sens: l.ecart > 0 ? "E" : "S",
          qte: round3(Math.abs(l.ecart)),
          stockAvant: round3(avant),
          stockApres: inv.emplacement ? round3(avant + l.ecart) : round3(l.qteComptee),
          puHt: l.pmp,
          codeMag: null,
          motif: `Régularisation ${inv.reference}`
            + (inv.emplacement ? ` (${inv.emplacement})` : "")
            + ` — ${utilisateur ?? inv.utilisateur ?? "système"}`,
        },
      });
    }

    await tx.inventaire.update({
      where: { id },
      data: { etat: "Validé", utilisateur: utilisateur ?? inv.utilisateur },
    });
  });

  return {
    ok: true,
    lignes: inv.lignes.length,
    ecarts: aRegulariser.length,
    valeurEcart: round3(inv.lignes.reduce((t, l) => t + l.valeurEcart, 0)),
    alertes,
    message: `${inv.reference} validé : ${aRegulariser.length} article(s) régularisé(s)`,
  };
}

/** Écarts d'un inventaire, du plus coûteux au moins coûteux. */
export async function ecartsInventaire(id: number) {
  const lignes = await prisma.inventaireLigne.findMany({
    where: { inventaireId: id },
    orderBy: { id: "asc" },
  });

  const avecEcart = lignes.filter((l) => Math.abs(l.ecart) > 0.0001);
  // Trié par valeur absolue : un manquant de 5 000 TND importe plus qu'un
  // excédent de 3 TND, quel que soit le sens.
  avecEcart.sort((a, b) => Math.abs(b.valeurEcart) - Math.abs(a.valeurEcart));

  return {
    lignes,
    avecEcart,
    manquants: avecEcart.filter((l) => l.ecart < 0),
    excedents: avecEcart.filter((l) => l.ecart > 0),
    valeurManquants: round3(avecEcart.filter((l) => l.ecart < 0).reduce((t, l) => t + l.valeurEcart, 0)),
    valeurExcedents: round3(avecEcart.filter((l) => l.ecart > 0).reduce((t, l) => t + l.valeurEcart, 0)),
    valeurNette: round3(avecEcart.reduce((t, l) => t + l.valeurEcart, 0)),
  };
}
