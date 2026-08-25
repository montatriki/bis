import prisma from "@/lib/prisma";
import { round3, TYPES_VENTE } from "@/lib/vente-stats";

// Charges fixes — répartition analytique sur les lignes de vente.
//
// Reproduit `calculateCharges` de l'ERP source (charges-fixes.service.js) :
// une charge fixe (loyer, salaires, énergie) est ventilée sur chaque ligne
// vendue, au prorata de son poids dans le chiffre d'affaires du jour.
//
//   montant journalier = montant_jr / nombre de jours AVEC des ventes
//   part de la ligne   = valeur TTC de la ligne / CA TTC de sa journée
//   charge de la ligne = montant journalier × part de la ligne
//
// C'est ce qui permet une **marge réelle** par article : sans cette ventilation,
// la marge affichée ignore les frais de structure et surestime la rentabilité.
//
// Différences assumées avec A :
//  - A divise par le nombre de jours ayant eu des ventes, pas par le nombre de
//    jours de la période. On conserve cette règle (une journée sans vente ne
//    doit rien absorber), mais on la **documente** au lieu de la subir.
//  - A écrit la charge ligne par ligne avec un UPDATE par ligne, sans
//    transaction ni possibilité d'annuler. Ici tout est transactionnel et
//    réversible.

export type ResultatRepartition = {
  ok: boolean;
  message: string;
  joursAvecVentes?: number;
  montantParJour?: number;
  lignesTouchees?: number;
  totalReparti?: number;
  alertes?: string[];
};

/** Clé de journée (AAAA-MM-JJ) d'une date, en heure locale. */
const jourDe = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.toISOString().slice(0, 10);
};

/**
 * Répartit une charge fixe sur les lignes de vente de sa période.
 *
 * Seuls les documents qui font du chiffre (BL, TIC, FC) sont concernés : une
 * charge ne se ventile pas sur un avoir, qui retire du chiffre.
 */
export async function repartirCharge(id: number): Promise<ResultatRepartition> {
  const charge = await prisma.chargeFixe.findUnique({ where: { id } });
  if (!charge) return { ok: false, message: "Charge introuvable" };
  // Garde-fou absent de A : sans lui, répartir deux fois cumulerait les
  // montants sur les mêmes lignes et fausserait toutes les marges.
  if (charge.etat === "Répartie") {
    return { ok: false, message: `Charge déjà répartie le ${charge.dateRepartition?.toLocaleDateString("fr-FR")} — annulez d'abord` };
  }

  const montantJr = charge.montantJr > 0 ? charge.montantJr : charge.montant;
  if (montantJr <= 0) {
    return { ok: false, message: "Montant à répartir nul — rien à ventiler" };
  }

  const du = new Date(charge.du);
  du.setHours(0, 0, 0, 0);
  const au = new Date(charge.au);
  au.setHours(23, 59, 59, 999);

  const documents = await prisma.erpDocument.findMany({
    where: {
      // Sans ce filtre, les factures d'achat (FAO…, rangées sous le même
      // `typeDoc` FC que les factures client) entrent dans le chiffre.
      nature: "Vente",
      dateDoc: { gte: du, lte: au },
      typeDoc: { in: [...TYPES_VENTE] },
    },
    select: { refDoc: true, dateDoc: true, ttcNet: true },
  });

  if (documents.length === 0) {
    return { ok: false, message: "Aucun document de vente sur la période" };
  }

  const lignes = await prisma.erpDocumentLine.findMany({
    where: { refDoc: { in: documents.map((d) => d.refDoc) } },
    select: { id: true, refDoc: true, refArt: true, ttcNet: true },
  });

  if (lignes.length === 0) {
    return {
      ok: false,
      message: `${documents.length} document(s) trouvé(s) mais aucune ligne — la charge ne peut pas être ventilée`,
    };
  }

  const alertes: string[] = [];

  // CA TTC par journée, calculé sur les **lignes** et non sur l'en-tête : c'est
  // la somme des lignes qui sert de base au prorata, les deux peuvent diverger
  // sur des documents importés sans détail.
  const jourDuDoc = new Map(documents.map((d) => [d.refDoc, d.dateDoc ? jourDe(d.dateDoc) : "?"]));
  const caParJour = new Map<string, number>();
  for (const l of lignes) {
    const j = jourDuDoc.get(l.refDoc) ?? "?";
    caParJour.set(j, (caParJour.get(j) ?? 0) + (l.ttcNet ?? 0));
  }
  caParJour.delete("?");

  const joursAvecVentes = caParJour.size;
  if (joursAvecVentes === 0) {
    return { ok: false, message: "Aucune journée avec des ventes valorisées" };
  }

  // Règle de A : on divise par les jours AYANT eu des ventes, pas par la durée
  // de la période. Une journée fermée n'absorbe aucune charge.
  const montantParJour = round3(montantJr / joursAvecVentes);

  const misesAJour: { id: number; charge: number }[] = [];
  let totalReparti = 0;

  for (const l of lignes) {
    const j = jourDuDoc.get(l.refDoc);
    if (!j || j === "?") continue;

    const caJour = caParJour.get(j) ?? 0;
    if (caJour <= 0) {
      // Journée dont les lignes totalisent zéro : rien à répartir dessus,
      // sinon on diviserait par zéro.
      alertes.push(`Journée ${j} : chiffre nul, charge non ventilée`);
      continue;
    }

    const part = (l.ttcNet ?? 0) / caJour;
    const c = round3(montantParJour * part);
    misesAJour.push({ id: l.id, charge: c });
    totalReparti += c;
  }

  if (misesAJour.length === 0) {
    return { ok: false, message: "Aucune ligne éligible à la répartition", alertes };
  }

  await prisma.$transaction([
    ...misesAJour.map((m) =>
      prisma.erpDocumentLine.update({ where: { id: m.id }, data: { charge: m.charge } })
    ),
    prisma.chargeFixe.update({
      where: { id },
      data: {
        etat: "Répartie",
        dateRepartition: new Date(),
        lignesTouchees: misesAJour.length,
        nbJour: joursAvecVentes,
      },
    }),
  ]);

  return {
    ok: true,
    joursAvecVentes,
    montantParJour,
    lignesTouchees: misesAJour.length,
    totalReparti: round3(totalReparti),
    alertes: [...new Set(alertes)],
    message:
      `${misesAJour.length} ligne(s) ventilée(s) sur ${joursAvecVentes} journée(s) — ` +
      `${round3(totalReparti)} TND répartis`,
  };
}

/**
 * Annule une répartition : remet à zéro la charge des lignes concernées.
 *
 * A n'offre aucun moyen de revenir en arrière ; une erreur de saisie de montant
 * y reste inscrite dans les marges pour toujours.
 */
export async function annulerRepartition(id: number): Promise<ResultatRepartition> {
  const charge = await prisma.chargeFixe.findUnique({ where: { id } });
  if (!charge) return { ok: false, message: "Charge introuvable" };
  if (charge.etat !== "Répartie") {
    return { ok: false, message: "Cette charge n'a pas été répartie" };
  }

  const du = new Date(charge.du);
  du.setHours(0, 0, 0, 0);
  const au = new Date(charge.au);
  au.setHours(23, 59, 59, 999);

  const documents = await prisma.erpDocument.findMany({
    where: { nature: "Vente", dateDoc: { gte: du, lte: au }, typeDoc: { in: [...TYPES_VENTE] } },
    select: { refDoc: true },
  });

  const res = await prisma.$transaction([
    prisma.erpDocumentLine.updateMany({
      where: { refDoc: { in: documents.map((d) => d.refDoc) } },
      data: { charge: 0 },
    }),
    prisma.chargeFixe.update({
      where: { id },
      data: { etat: "Brouillon", dateRepartition: null, lignesTouchees: 0 },
    }),
  ]);

  return {
    ok: true,
    lignesTouchees: res[0].count,
    message: `Répartition annulée — ${res[0].count} ligne(s) remise(s) à zéro`,
  };
}

/**
 * Marge réelle par article sur une période : chiffre − coût d'achat − charges
 * ventilées. C'est l'intérêt de tout le module.
 */
export async function margeParArticle(du: Date, au: Date) {
  const documents = await prisma.erpDocument.findMany({
    where: { nature: "Vente", dateDoc: { gte: du, lte: au }, typeDoc: { in: [...TYPES_VENTE] } },
    select: { refDoc: true },
  });

  const lignes = await prisma.erpDocumentLine.findMany({
    where: { refDoc: { in: documents.map((d) => d.refDoc) } },
    select: { refArt: true, designation: true, qte: true, thtNet: true, ttcNet: true, charge: true },
  });

  const refs = [...new Set(lignes.map((l) => l.refArt))];
  const articles = refs.length
    ? await prisma.article.findMany({
        where: { refArt: { in: refs } },
        select: { refArt: true, pmp: true, puAchat: true },
      })
    : [];
  const coutDe = new Map(articles.map((a) => [a.refArt, a.pmp || a.puAchat || 0]));

  const agrege = new Map<string, {
    designation: string; qte: number; ca: number; cout: number; charges: number;
  }>();

  for (const l of lignes) {
    const prev = agrege.get(l.refArt) ?? {
      designation: l.designation ?? l.refArt, qte: 0, ca: 0, cout: 0, charges: 0,
    };
    prev.qte += l.qte;
    prev.ca += l.thtNet;
    prev.cout += l.qte * (coutDe.get(l.refArt) ?? 0);
    prev.charges += l.charge ?? 0;
    agrege.set(l.refArt, prev);
  }

  const rows = [...agrege.entries()].map(([refArt, v]) => {
    const margeBrute = round3(v.ca - v.cout);
    const margeNette = round3(margeBrute - v.charges);
    return {
      refArt,
      designation: v.designation,
      qte: round3(v.qte),
      ca: round3(v.ca),
      cout: round3(v.cout),
      charges: round3(v.charges),
      margeBrute,
      margeNette,
      // Taux calculé sur le chiffre : null si aucun chiffre, plutôt que 0 %,
      // qui laisserait croire à une marge nulle.
      tauxMarge: v.ca > 0 ? round3((margeNette / v.ca) * 100) : null,
    };
  });

  rows.sort((a, b) => b.margeNette - a.margeNette);

  return {
    rows,
    totaux: {
      ca: round3(rows.reduce((t, r) => t + r.ca, 0)),
      cout: round3(rows.reduce((t, r) => t + r.cout, 0)),
      charges: round3(rows.reduce((t, r) => t + r.charges, 0)),
      margeNette: round3(rows.reduce((t, r) => t + r.margeNette, 0)),
    },
    // Sans charges ventilées, la marge nette est égale à la brute : on le
    // signale pour que le chiffre ne soit pas pris pour argent comptant.
    chargesVentilees: rows.some((r) => r.charges > 0),
  };
}
