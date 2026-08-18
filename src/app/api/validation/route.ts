import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { validerDocument } from "@/lib/document-validation";
import { TYPES_CA, round3 } from "@/lib/vente-stats";

// File de validation des documents (écran manager).
//
// GET  /api/validation                          -> documents en attente + leurs lignes
// POST /api/validation { refDoc, action }        -> action = "approuver" | "rejeter"
//
// « Approuver » applique réellement les mouvements de stock et de solde via
// `validerDocument` ; « rejeter » marque le document sans rien mouvementer.

/** Seuil de remise au-delà duquel on signale le document au manager. */
const SEUIL_REMISE = 12;

export async function GET() {
  const auth = await requireSession(["ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.res;

  const docs = await prisma.erpDocument.findMany({
    where: {
      nature: "Vente",
      valide: false,
      typeDoc: { in: [...TYPES_CA, "COM", "DEV"] },
      etat: { not: "Rejeté" },
    },
    orderBy: { dateDoc: "desc" },
    take: 100,
    select: {
      refDoc: true, typeDoc: true, libDoc: true, dateDoc: true,
      codeCli: true, raisonSocial: true, commercial: true, utilisateur: true,
      thtBrut: true, totRemise: true, thtNet: true, totTva: true, ttcNet: true,
      etat: true,
      _count: { select: { lignes: true } },
    },
  });

  const rows = docs.map((d) => {
    // Taux de remise global du document, pour signaler les cas hors norme.
    const tauxRemise = d.thtBrut > 0 ? round3((d.totRemise / d.thtBrut) * 100) : 0;
    return {
      ...d,
      nbLignes: d._count.lignes,
      tauxRemise,
      horsNorme: tauxRemise > SEUIL_REMISE,
      sansLignes: d._count.lignes === 0,
    };
  });

  return NextResponse.json({
    rows,
    total: rows.length,
    seuilRemise: SEUIL_REMISE,
    montantTotal: round3(rows.reduce((s, r) => s + r.ttcNet, 0)),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => ({}));
  const refDoc = body?.refDoc ? String(body.refDoc) : "";
  const action = body?.action === "rejeter" ? "rejeter" : "approuver";
  if (!refDoc) return NextResponse.json({ error: "refDoc requis" }, { status: 400 });

  if (action === "rejeter") {
    const doc = await prisma.erpDocument.findUnique({ where: { refDoc }, select: { valide: true } });
    if (!doc) return NextResponse.json({ error: "Document introuvable" }, { status: 404 });
    if (doc.valide) {
      return NextResponse.json(
        { error: "Document déjà validé — dévalidez-le avant de le rejeter" },
        { status: 409 }
      );
    }
    await prisma.erpDocument.update({
      where: { refDoc },
      data: { etat: "Rejeté", libDoc: body?.motif ? String(body.motif) : undefined },
    });
    return NextResponse.json({ ok: true, message: `Document ${refDoc} rejeté` });
  }

  // Approbation : applique stock + solde selon le type de document.
  const result = await validerDocument(refDoc);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
