import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { synchroniserOperations, etatSyncOperations, PERIME_OPERATIONS_MS } from "@/lib/sync-operations";

// Synchronisation des opérations (ventes, règlements, tournées, clients) avec
// l'ERP de production — lecture seule côté production.
//
// GET  /api/sync-operations  → âge des données et résumé de la dernière passe
// POST /api/sync-operations  → synchronisation immédiate
export async function GET() {
  const auth = await requireSession(["ADMIN", "MANAGER", "COMMERCIAL"]);
  if (!auth.ok) return auth.res;
  const e = await etatSyncOperations();
  return NextResponse.json({ ...e, perimeApresMs: PERIME_OPERATIONS_MS });
}

export async function POST() {
  const auth = await requireSession(["ADMIN", "MANAGER", "COMMERCIAL"]);
  if (!auth.ok) return auth.res;
  try {
    return NextResponse.json({ ok: true, ...(await synchroniserOperations()) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Synchronisation impossible" }, { status: 502 });
  }
}
