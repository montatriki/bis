import { NextResponse } from "next/server";
import { getSession, type SessionUser } from "./auth";

// Guard for API routes. Returns { ok, user } or { ok:false, res } (401/403).
export async function requireSession(roles?: string[]): Promise<
  { ok: true; user: SessionUser } | { ok: false; res: NextResponse }
> {
  const user = await getSession();
  if (!user) return { ok: false, res: NextResponse.json({ error: "Non authentifié" }, { status: 401 }) };
  if (roles && roles.length && !roles.includes(user.role)) {
    return { ok: false, res: NextResponse.json({ error: "Accès refusé" }, { status: 403 }) };
  }
  return { ok: true, user };
}
