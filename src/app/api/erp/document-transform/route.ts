import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { transformerDocuments, allowedTargets } from "@/lib/document-transform";

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

  const result = await transformerDocuments(refDocs, typeTarget);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
