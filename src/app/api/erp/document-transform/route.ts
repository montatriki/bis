import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { transformerDocuments, allowedTargets } from "@/lib/document-transform";
import prisma from "@/lib/prisma";
import { memeCommercial } from "@/lib/perimetre-commercial";

// Transformation de documents (Devis → Commande → BL → Facture).
//
// GET  /api/erp/document-transform?typeDoc=DEV   -> { targets: ["COM","BL","FAC"] }
// POST /api/erp/document-transform  { refDocs: string[], typeTarget }

export async function GET(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER", "COMMERCIAL"]);
  if (!auth.ok) return auth.res;

  const typeDoc = req.nextUrl.searchParams.get("typeDoc") ?? "";
  return NextResponse.json({ targets: allowedTargets(typeDoc) });
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER", "COMMERCIAL"]);
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => null);
  const refDocs: string[] = Array.isArray(body?.refDocs)
    ? body.refDocs.map(String).filter(Boolean)
    : body?.refDoc
      ? [String(body.refDoc)]
      : [];
  const typeTarget = body?.typeTarget ? String(body.typeTarget) : "";

  if (!refDocs.length) return NextResponse.json({ error: "refDocs requis" }, { status: 400 });
  if (!typeTarget) return NextResponse.json({ error: "typeTarget requis" }, { status: 400 });

  // Un commercial ne transforme que ses propres documents. Sans ce contrôle il
  // pouvait, en devinant une référence, transformer le document d'un collègue —
  // une écriture sur un portefeuille qui n'est pas le sien.
  if (auth.user.role === "COMMERCIAL") {
    const docs = await prisma.erpDocument.findMany({
      where: { refDoc: { in: refDocs } },
      select: { refDoc: true, commercial: true },
    });
    const etrangers = docs.filter((d) => !memeCommercial(d.commercial, auth.user.name));
    if (etrangers.length > 0) {
      return NextResponse.json(
        { error: `Document(s) d'un autre commercial : ${etrangers.map((d) => d.refDoc).join(", ")}` },
        { status: 403 },
      );
    }
  }

  const result = await transformerDocuments(refDocs, typeTarget);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
