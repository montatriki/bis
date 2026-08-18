import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { computeDocument, round3, type LineInput } from "@/lib/document-calc";

// Lignes d'un document ERP.
// GET  /api/erp/document-lines?refDoc=XXX          -> { rows, totals, document }
// PUT  /api/erp/document-lines  { refDoc, lines }  -> remplace les lignes + recalcule l'entête
//
// L'écriture est transactionnelle : les lignes et les totaux de l'entête
// restent toujours cohérents, comme dans le module Vente de l'ERP source.

const s = (v: unknown) => (v == null ? "" : String(v));
const num = (v: unknown) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

export async function GET(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER", "COMMERCIAL"]);
  if (!auth.ok) return auth.res;

  const refDoc = req.nextUrl.searchParams.get("refDoc");
  if (!refDoc) {
    return NextResponse.json({ error: "refDoc requis" }, { status: 400 });
  }

  const document = await prisma.erpDocument.findUnique({ where: { refDoc } });
  if (!document) {
    return NextResponse.json({ error: "Document introuvable" }, { status: 404 });
  }

  const rows = await prisma.erpDocumentLine.findMany({
    where: { refDoc },
    orderBy: [{ ordre: "asc" }, { id: "asc" }],
  });

  return NextResponse.json({ rows, total: rows.length, document });
}

export async function PUT(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER", "COMMERCIAL"]);
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => null);
  if (!body || !body.refDoc) {
    return NextResponse.json({ error: "refDoc requis" }, { status: 400 });
  }

  const refDoc = s(body.refDoc);
  const document = await prisma.erpDocument.findUnique({ where: { refDoc } });
  if (!document) {
    return NextResponse.json({ error: "Document introuvable" }, { status: 404 });
  }
  // Un document validé a déjà impacté le stock et le solde : modifier ses lignes
  // désynchroniserait la base. Il faut le dévalider d'abord.
  if (document.valide) {
    return NextResponse.json(
      { error: "Document validé — dévalidez-le avant de modifier ses lignes" },
      { status: 409 }
    );
  }

  const incoming: unknown[] = Array.isArray(body.lines) ? body.lines : [];
  const inputs: LineInput[] = incoming
    .map((raw) => {
      const l = raw as Record<string, unknown>;
      return {
        refArt: s(l.refArt),
        designation: s(l.designation),
        unite: l.unite == null ? null : s(l.unite),
        qte: num(l.qte),
        puHt: num(l.puHt),
        remise: num(l.remise),
        tauxTva: num(l.tauxTva),
        tauxFodec: num(l.tauxFodec),
      };
    })
    .filter((l) => l.refArt && l.qte > 0);

  const timbre = body.timbre != null ? num(body.timbre) : num(document.timbre);
  const { lines, totals } = computeDocument(inputs, timbre);

  // Le solde restant dû suit le TTC, déduction faite de ce qui est déjà réglé.
  // round3 évite d'écrire des artefacts de virgule flottante dans les colonnes monétaires.
  const soldeDoc = Math.max(0, round3(totals.ttcNet - num(document.totalRegle)));

  const [, , updated] = await prisma.$transaction([
    prisma.erpDocumentLine.deleteMany({ where: { refDoc } }),
    prisma.erpDocumentLine.createMany({
      data: lines.map((l, i) => ({
        refDoc,
        refArt: l.refArt,
        designation: l.designation,
        unite: l.unite ?? null,
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
      })),
    }),
    prisma.erpDocument.update({
      where: { refDoc },
      data: {
        thtBrut: totals.thtBrut,
        totRemise: totals.totRemise,
        thtNet: totals.thtNet,
        totFodec: totals.totFodec,
        totTva: totals.totTva,
        timbre: totals.timbre,
        ttcNet: totals.ttcNet,
        soldeDoc,
      },
    }),
  ]);

  const rows = await prisma.erpDocumentLine.findMany({
    where: { refDoc },
    orderBy: [{ ordre: "asc" }, { id: "asc" }],
  });

  return NextResponse.json({ ok: true, rows, totals, document: updated });
}
