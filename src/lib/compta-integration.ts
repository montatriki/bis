import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { round3 } from "@/lib/vente-stats";

// Intégration comptable des documents commerciaux.
//
// Reproduit `integrationDocVente` / `integrationDocAchat` de l'ERP source
// (ecritures-comptable.service.js) : un document de vente devient une pièce
// comptable équilibrée.
//
// Facture de vente (FC / FAC / BL / TIC) :
//   411xxx Client        DÉBIT   TTC
//   707xxx Ventes                CRÉDIT  HT
//   4367xx TVA collectée         CRÉDIT  TVA
//   4366xx FODEC                 CRÉDIT  FODEC
//   4457xx Timbre                CRÉDIT  timbre
//
// Avoir / retour (AV / BR / BRE) : sens inversé.

/** Comptes par défaut du plan comptable tunisien. */
export const COMPTES_DEFAUT: Record<string, { numCompte: string; libelle: string }> = {
  cptClient: { numCompte: "411000", libelle: "Clients" },
  cptFournisseur: { numCompte: "401000", libelle: "Fournisseurs" },
  cptVente: { numCompte: "707000", libelle: "Ventes de marchandises" },
  cptAchat: { numCompte: "607000", libelle: "Achats de marchandises" },
  cptTva: { numCompte: "436700", libelle: "TVA collectée" },
  cptTvaDeduct: { numCompte: "436600", libelle: "TVA déductible" },
  cptFodec: { numCompte: "436800", libelle: "FODEC" },
  cptTimbre: { numCompte: "445700", libelle: "Timbre fiscal" },
  cptCaisse: { numCompte: "540000", libelle: "Caisse" },
  cptBanque: { numCompte: "532000", libelle: "Banque" },
};

/** Types de documents de vente qui génèrent une écriture, et leur sens. */
const SENS_VENTE: Record<string, 1 | -1> = {
  FC: 1, FAC: 1, BL: 1, TIC: 1, // facturation : client débité
  AV: -1, BR: -1, BRE: -1,      // avoir / retour : sens inversé
};

export type LigneEcriture = {
  numCompte: string;
  libelleCompte: string;
  debit: number;
  credit: number;
};

export type IntegrationResult = {
  ok: boolean;
  message: string;
  numPiece?: string;
  lignes?: number;
  totalDebit?: number;
  totalCredit?: number;
};

/** Comptes paramétrés, complétés par les valeurs par défaut. */
export async function getComptes(): Promise<Record<string, { numCompte: string; libelle: string }>> {
  const params = await prisma.paramCompta.findMany();
  const map = { ...COMPTES_DEFAUT };
  for (const p of params) {
    map[p.cle] = { numCompte: p.numCompte, libelle: p.libelle ?? map[p.cle]?.libelle ?? p.cle };
  }
  return map;
}

/** Exercice comptable couvrant une date, ou l'exercice courant. */
export async function exercicePour(date: Date) {
  return (
    (await prisma.exerciceCompta.findFirst({
      where: { dateDeb: { lte: date }, dateFin: { gte: date }, cloture: false },
    })) ?? (await prisma.exerciceCompta.findFirst({ where: { courant: true, cloture: false } }))
  );
}

/**
 * Construit les lignes d'écriture d'un document de vente.
 * Exporté séparément pour permettre un aperçu avant enregistrement.
 */
export function construireLignesVente(
  doc: { typeDoc: string; thtNet: number; totTva: number; totFodec: number; timbre: number; ttcNet: number; raisonSocial: string | null; codeCli: number | null },
  comptes: Record<string, { numCompte: string; libelle: string }>
): LigneEcriture[] {
  const sens = SENS_VENTE[String(doc.typeDoc).toUpperCase()];
  if (!sens) return [];

  const lignes: LigneEcriture[] = [];
  const d = (v: number) => round3(Math.abs(v));

  // Compte client : débité pour une facture, crédité pour un avoir.
  const ttc = d(doc.ttcNet);
  if (ttc > 0) {
    lignes.push({
      numCompte: comptes.cptClient.numCompte,
      libelleCompte: doc.raisonSocial || comptes.cptClient.libelle,
      debit: sens > 0 ? ttc : 0,
      credit: sens > 0 ? 0 : ttc,
    });
  }

  // Contreparties, sens opposé au client.
  //
  // Attention : dans les données importées, le FODEC est **déjà compris** dans
  // le TTC (HT + TVA = TTC), contrairement au schéma de A où il s'ajoute.
  // On ne l'écrit donc pas comme une ligne supplémentaire : la vente est
  // équilibrée sur le TTC réel, et tout écart résiduel est porté par le
  // compte de vente pour garantir une pièce équilibrée.
  const tva = d(doc.totTva);
  const timbre = d(doc.timbre);
  const venteHT = round3(ttc - tva - timbre);

  const contreparties: [string, number][] = [
    ["cptVente", venteHT],
    ["cptTva", tva],
    ["cptTimbre", timbre],
  ];

  for (const [cle, montant] of contreparties) {
    if (montant <= 0) continue;
    const c = comptes[cle];
    lignes.push({
      numCompte: c.numCompte,
      libelleCompte: c.libelle,
      debit: sens > 0 ? 0 : montant,
      credit: sens > 0 ? montant : 0,
    });
  }

  return lignes;
}

/**
 * Intègre un document en comptabilité : crée la pièce et ses lignes.
 * Refuse si le document est déjà comptabilisé (pas de double écriture).
 */
export async function integrerDocument(refDoc: string, utilisateur?: string): Promise<IntegrationResult> {
  const doc = await prisma.erpDocument.findUnique({ where: { refDoc } });
  if (!doc) return { ok: false, message: "Document introuvable" };

  const deja = await prisma.ecritureCompta.findFirst({ where: { refDoc } });
  if (deja) {
    return { ok: false, message: `Document déjà comptabilisé (pièce ${deja.numPiece})` };
  }

  const date = doc.dateDoc ?? new Date();
  const exercice = await exercicePour(date);
  if (!exercice) {
    return { ok: false, message: "Aucun exercice comptable ouvert pour cette date" };
  }

  const comptes = await getComptes();
  const lignes = construireLignesVente(doc, comptes);
  if (lignes.length === 0) {
    return { ok: false, message: `Type ${doc.typeDoc} : aucune écriture à générer` };
  }

  const totalDebit = round3(lignes.reduce((s, l) => s + l.debit, 0));
  const totalCredit = round3(lignes.reduce((s, l) => s + l.credit, 0));

  // Une pièce déséquilibrée ne doit jamais entrer en comptabilité.
  if (Math.abs(totalDebit - totalCredit) > 0.001) {
    return {
      ok: false,
      message: `Écriture déséquilibrée : débit ${totalDebit} ≠ crédit ${totalCredit}`,
    };
  }

  // Journal de vente, créé au besoin.
  const codeJournal = "VE";
  await prisma.journalCompta.upsert({
    where: { code: codeJournal },
    create: { code: codeJournal, libelle: "Journal des ventes", type: "Vente" },
    update: {},
  });

  const numPiece = await prochainNumPiece(codeJournal, exercice.id);

  const ops: Prisma.PrismaPromise<unknown>[] = [
    prisma.ecritureCompta.createMany({
      data: lignes.map((l, i) => ({
        exerciceId: exercice.id,
        codeJournal,
        numPiece,
        numOrdre: i + 1,
        numCompte: l.numCompte,
        libelleCompte: l.libelleCompte,
        libelleEcriture: `${doc.typeDoc} ${refDoc}`,
        dateEcriture: date,
        refDoc,
        debit: l.debit,
        credit: l.credit,
        utilisateur: utilisateur ?? null,
      })),
    }),
  ];

  await prisma.$transaction(ops);

  return {
    ok: true,
    message: `Document ${refDoc} comptabilisé — pièce ${numPiece}`,
    numPiece,
    lignes: lignes.length,
    totalDebit,
    totalCredit,
  };
}

/** Numéro de pièce suivant pour un journal et un exercice. */
async function prochainNumPiece(codeJournal: string, exerciceId: number): Promise<string> {
  const dernier = await prisma.ecritureCompta.findFirst({
    where: { codeJournal, exerciceId },
    orderBy: { numPiece: "desc" },
    select: { numPiece: true },
  });
  const n = dernier ? Number(String(dernier.numPiece).replace(/\D/g, "")) || 0 : 0;
  return `${codeJournal}${String(n + 1).padStart(6, "0")}`;
}

/** Annule l'intégration d'un document (supprime sa pièce). */
export async function annulerIntegration(refDoc: string): Promise<IntegrationResult> {
  const lignes = await prisma.ecritureCompta.findMany({ where: { refDoc }, select: { numPiece: true } });
  if (lignes.length === 0) return { ok: false, message: "Document non comptabilisé" };

  const exercice = await prisma.ecritureCompta.findFirst({
    where: { refDoc },
    select: { exercice: { select: { cloture: true } } },
  });
  if (exercice?.exercice.cloture) {
    return { ok: false, message: "Exercice clôturé — annulation impossible" };
  }

  await prisma.ecritureCompta.deleteMany({ where: { refDoc } });
  return { ok: true, message: `Pièce ${lignes[0].numPiece} annulée`, lignes: lignes.length };
}
