import prisma from "@/lib/prisma";

// Numérotation des documents par souche — reproduit `prepareDocumentVente`
// de l'ERP source (type-documents-vente.service.js).
//
// Format : Ref_doc = Cara_doc + Num_seq
//   ex. TIC + 253406 = "TIC253406"   (25 = année, 3406 = compteur)
//       CMI + 243167 = "CMI243167"
//
// Le compteur repart de <AA>0001 à chaque nouvel exercice, comme dans A où
// la séquence est préfixée par l'année en cours.

/** Souches réellement présentes dans les données, par type de document. */
export const SOUCHES: Record<string, string> = {
  TIC: "TIC", // ticket caisse
  COM: "CMI", // commande client
  INV: "INV", // inventaire
  BRE: "BAO", // bon de retour
  OF: "OFA", // ordre de fabrication
  FC: "FAO", // facture client
  BR: "RRA", // bon de réception
  DEV: "DAO", // devis
  AV: "AVC", // avoir client
  BL: "BAO", // bon de livraison
  FCH: "FCH", // facture charge
  BRT: "RAO", // bon de retour transfert
  STK: "BST", // document de stock
  DEM: "DEM", // demande
  FAC: "FAO", // facture (alias FC)
};

/** Souche d'un type de document ; à défaut, le type lui-même sert de souche. */
export function soucheFor(typeDoc: string): string {
  const t = String(typeDoc ?? "").toUpperCase();
  return SOUCHES[t] ?? t;
}

/** Deux derniers chiffres de l'année — préfixe du compteur. */
function yearPrefix(date = new Date()): string {
  return String(date.getFullYear()).slice(-2);
}

/**
 * Prochaine séquence pour une souche : MAX(numSeq) + 1 sur l'exercice courant.
 * Repart à <AA>0001 si la souche n'a encore rien sur cette année.
 *
 * Le tri se fait numériquement (les numSeq sont stockés en texte) pour éviter
 * qu'un "9999" passe devant un "10000".
 */
export async function nextSequence(souche: string, date = new Date()): Promise<string> {
  const prefix = yearPrefix(date);

  const rows = await prisma.erpDocument.findMany({
    where: { caraDoc: souche, numSeq: { startsWith: prefix } },
    select: { numSeq: true },
  });

  let max = 0;
  for (const r of rows) {
    const v = Number(r.numSeq);
    if (Number.isFinite(v) && v > max) max = v;
  }

  // Premier document de l'exercice pour cette souche.
  if (max === 0) return `${prefix}0001`;
  return String(max + 1);
}

export type PreparedDocument = {
  refDoc: string;
  caraDoc: string;
  numSeq: string;
  typeDoc: string;
};

/**
 * Prépare la référence d'un nouveau document.
 * Équivalent de `prepareDocumentVente(carc)` dans A.
 *
 * Boucle de sécurité : si la référence calculée existe déjà (création
 * concurrente), on avance jusqu'au premier numéro libre. A ne gère pas ce cas
 * et peut produire un doublon de clé.
 */
export async function prepareDocument(
  typeDoc: string,
  date = new Date()
): Promise<PreparedDocument> {
  const caraDoc = soucheFor(typeDoc);

  let numSeq = await nextSequence(caraDoc, date);
  let refDoc = `${caraDoc}${numSeq}`;

  for (let i = 0; i < 50; i++) {
    const exists = await prisma.erpDocument.findUnique({
      where: { refDoc },
      select: { refDoc: true },
    });
    if (!exists) break;
    numSeq = String(Number(numSeq) + 1);
    refDoc = `${caraDoc}${numSeq}`;
  }

  return { refDoc, caraDoc, numSeq, typeDoc: String(typeDoc).toUpperCase() };
}
