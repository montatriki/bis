import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { prepareDocument } from "@/lib/document-numbering";
import { computeTotals, round3, type LineInput } from "@/lib/document-calc";
import { docTypeRule } from "@/lib/document-types";

// Transformation de documents — reproduit `transformDocuments` de l'ERP source.
//
// Chaîne commerciale : Devis → Commande → Bon de livraison → Facture.
// Un ou plusieurs documents sources sont fusionnés en un document cible :
//   - les lignes sont recopiées, avec `docLiee` pointant vers le document d'origine
//   - le document cible reçoit une nouvelle référence via la numérotation par souche
//   - les sources sont marquées `transformeEn`
//
// Le document cible est créé en brouillon (`valide: false`) : c'est sa validation
// qui appliquera stock et solde, jamais la transformation elle-même. Cela évite
// le double comptage quand la source était déjà validée.

/** Enchaînements autorisés, du plus amont au plus aval. */
export const TRANSFORM_CHAIN: Record<string, string[]> = {
  DEV: ["COM", "BL", "FAC"],
  COM: ["BL", "FAC"],
  BL: ["FAC"],
  BRE: ["AV"],
  CDF: ["BRC", "FACA"],
  BRC: ["FACA"],
};

export function allowedTargets(typeDoc: string): string[] {
  return TRANSFORM_CHAIN[String(typeDoc ?? "").toUpperCase()] ?? [];
}

export type TransformResult = {
  ok: boolean;
  message: string;
  refDoc?: string;
  lignes?: number;
};

/**
 * Transforme un ou plusieurs documents sources en un document cible.
 * Tous les sources doivent avoir le même type et le même client.
 */
export async function transformerDocuments(
  refDocs: string[],
  typeTarget: string
): Promise<TransformResult> {
  if (!refDocs.length) return { ok: false, message: "Aucun document source" };

  const sources = await prisma.erpDocument.findMany({
    where: { refDoc: { in: refDocs } },
    include: { lignes: { orderBy: { ordre: "asc" } } },
  });

  if (sources.length !== refDocs.length) {
    return { ok: false, message: "Document source introuvable" };
  }

  const first = sources[0];

  // Homogénéité : même type et même client, comme dans A.
  if (sources.some((d) => d.typeDoc !== first.typeDoc)) {
    return { ok: false, message: "Les documents sources doivent être du même type" };
  }
  if (sources.some((d) => d.codeCli !== first.codeCli)) {
    return { ok: false, message: "Les documents sources doivent concerner le même client" };
  }

  const targets = allowedTargets(first.typeDoc);
  if (!targets.includes(String(typeTarget).toUpperCase())) {
    return {
      ok: false,
      message: `Transformation ${first.typeDoc} → ${typeTarget} non autorisée${
        targets.length ? ` (cibles possibles : ${targets.join(", ")})` : ""
      }`,
    };
  }

  const dejaTransforme = sources.find((d) => d.transformeEn);
  if (dejaTransforme) {
    return {
      ok: false,
      message: `Document ${dejaTransforme.refDoc} déjà transformé en ${dejaTransforme.transformeEn}`,
    };
  }

  const toutesLignes = sources.flatMap((d) =>
    d.lignes.map((l) => ({ ...l, docLiee: d.refDoc }))
  );
  if (toutesLignes.length === 0) {
    return { ok: false, message: "Les documents sources n'ont aucune ligne" };
  }

  const type = String(typeTarget).toUpperCase();
  const prepared = await prepareDocument(type);
  const rule = docTypeRule(type);

  // Totaux recalculés depuis les lignes, jamais recopiés.
  const inputs: LineInput[] = toutesLignes.map((l) => ({
    refArt: l.refArt,
    designation: l.designation,
    unite: l.unite,
    qte: l.qte,
    puHt: l.puHt,
    remise: l.remise,
    tauxTva: l.tauxTva,
    tauxFodec: l.tauxFodec,
  }));
  const timbre = round3(first.timbre);
  const totals = computeTotals(inputs, timbre);

  const ops: Prisma.PrismaPromise<unknown>[] = [];

  ops.push(
    prisma.erpDocument.create({
      data: {
        refDoc: prepared.refDoc,
        caraDoc: prepared.caraDoc,
        numSeq: prepared.numSeq,
        nature: rule.nature,
        typeDoc: type,
        libDoc: rule.label,
        dateDoc: new Date(),
        codeCli: first.codeCli,
        raisonSocial: first.raisonSocial,
        adrCli: first.adrCli,
        mf: first.mf,
        codeMag: first.codeMag,
        commercial: first.commercial,
        modePayement: first.modePayement,
        thtBrut: totals.thtBrut,
        totRemise: totals.totRemise,
        thtNet: totals.thtNet,
        totTva: totals.totTva,
        totFodec: totals.totFodec,
        timbre: totals.timbre,
        ttcNet: totals.ttcNet,
        soldeDoc: totals.ttcNet,
        etat: "En cours",
        valide: false,
        docSource: sources.map((d) => d.refDoc).join(";"),
      },
    })
  );

  ops.push(
    prisma.erpDocumentLine.createMany({
      data: toutesLignes.map((l, i) => ({
        refDoc: prepared.refDoc,
        refArt: l.refArt,
        designation: l.designation,
        unite: l.unite,
        qte: l.qte,
        puHt: l.puHt,
        remise: l.remise,
        tauxTva: l.tauxTva,
        tauxFodec: l.tauxFodec,
        thtBrut: l.thtBrut,
        thtNet: l.thtNet,
        totTva: l.totTva,
        ttcNet: l.ttcNet,
        ordre: i,
        docLiee: l.docLiee,
      })),
    })
  );

  ops.push(
    prisma.erpDocument.updateMany({
      where: { refDoc: { in: refDocs } },
      data: { transformeEn: prepared.refDoc, etat: "Transformé" },
    })
  );

  await prisma.$transaction(ops);

  return {
    ok: true,
    message: `${sources.length} document(s) transformé(s) en ${type} ${prepared.refDoc}`,
    refDoc: prepared.refDoc,
    lignes: toutesLignes.length,
  };
}
