import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { validerDocument, devaliderDocument } from "@/lib/document-validation";

// Validation d'un document ERP : applique (ou annule) les mouvements de stock
// et l'impact sur le solde du tiers.
//
// POST /api/erp/document-validate  { refDoc, action?: "valider" | "devalider" }

export async function POST(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => null);
  const refDoc = body?.refDoc ? String(body.refDoc) : "";
  if (!refDoc) return NextResponse.json({ error: "refDoc requis" }, { status: 400 });

  const action = body?.action === "devalider" ? "devalider" : "valider";
  const result =
    action === "devalider" ? await devaliderDocument(refDoc) : await validerDocument(refDoc);

  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
