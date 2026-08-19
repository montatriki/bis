import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { synchroniserStock, etatSync, PERIME_APRES_MS } from "@/lib/sync-production";

// Synchronisation du stock avec l'ERP de production.
//
// GET  /api/sync-stock  → âge des données (affiché sur les écrans de stock)
// POST /api/sync-stock  → resynchronisation immédiate (lecture seule côté
//                         production ; tout rôle connecté peut la demander)

export async function GET() {
  const auth = await requireSession(["ADMIN", "MANAGER", "COMMERCIAL"]);
  if (!auth.ok) return auth.res;
  const e = await etatSync();
  return NextResponse.json({
    derniere: e.derniere,
    ageMs: e.ageMs,
    enCours: e.enCours,
    perimeApresMs: PERIME_APRES_MS,
  });
}

export async function POST() {
  const auth = await requireSession(["ADMIN", "MANAGER", "COMMERCIAL"]);
  if (!auth.ok) return auth.res;
  try {
    const r = await synchroniserStock();
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    // Production injoignable : les écrans gardent les dernières données.
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Synchronisation impossible" },
      { status: 502 },
    );
  }
}
