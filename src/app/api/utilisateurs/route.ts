import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { hashPassword } from "@/lib/auth";

// Gestion des comptes utilisateurs (écran admin).
//
// GET    /api/utilisateurs
// POST   /api/utilisateurs   { name, login, email, password, role, codeTiers? }
// PUT    /api/utilisateurs   { id, ... }  (password facultatif)
// DELETE /api/utilisateurs?id=...
//
// Réservé aux ADMIN. Le mot de passe n'est jamais renvoyé au client.

const ROLES = ["ADMIN", "MANAGER", "COMMERCIAL", "CLIENT"] as const;
type Role = (typeof ROLES)[number];

const s = (v: unknown) => (v == null ? "" : String(v).trim());
const asRole = (v: unknown): Role | null => {
  const r = s(v).toUpperCase() as Role;
  return (ROLES as readonly string[]).includes(r) ? r : null;
};

export async function GET() {
  const auth = await requireSession(["ADMIN"]);
  if (!auth.ok) return auth.res;

  const rows = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: {
      id: true, name: true, login: true, email: true, role: true,
      isActive: true, phone: true, codeTiers: true, createdAt: true, updatedAt: true,
    },
  });

  // Nombre de documents saisis par utilisateur (activité réelle).
  const parUtil = await prisma.erpDocument.groupBy({
    by: ["utilisateur"],
    // Certains documents importés ont un `utilisateur` vide : on les ignore.
    where: { utilisateur: { not: null } },
    _count: { _all: true },
  });
  const activite = new Map(
    parUtil
      .filter((u) => (u.utilisateur ?? "").trim() !== "")
      .map((u) => [(u.utilisateur ?? "").trim().toLowerCase(), u._count._all])
  );

  // Raison sociale du tiers rattaché, le cas échéant.
  const codes = rows.map((r) => r.codeTiers).filter((c): c is number => c != null);
  const tiers = codes.length
    ? await prisma.partner.findMany({ where: { id: { in: codes } }, select: { id: true, raisonSocial: true } })
    : [];
  const nomTiers = new Map(tiers.map((t) => [t.id, t.raisonSocial]));

  return NextResponse.json({
    rows: rows.map((r) => ({
      ...r,
      nbDocuments: activite.get(r.name.toLowerCase()) ?? activite.get(r.login.toLowerCase()) ?? 0,
      tiersNom: r.codeTiers != null ? (nomTiers.get(r.codeTiers) ?? null) : null,
    })),
    total: rows.length,
    roles: ROLES,
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(["ADMIN"]);
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => ({}));
  const name = s(body.name);
  const login = s(body.login);
  const email = s(body.email);
  const password = s(body.password);
  const role = asRole(body.role);

  if (!name || !login || !email) {
    return NextResponse.json({ error: "Nom, login et email sont obligatoires" }, { status: 400 });
  }
  if (!password || password.length < 4) {
    return NextResponse.json({ error: "Mot de passe requis (4 caractères minimum)" }, { status: 400 });
  }
  if (!role) return NextResponse.json({ error: "Rôle invalide" }, { status: 400 });

  try {
    const row = await prisma.user.create({
      data: {
        name, login, email, role,
        password: await hashPassword(password),
        phone: s(body.phone) || null,
        codeTiers: body.codeTiers != null && s(body.codeTiers) !== "" ? Number(body.codeTiers) : null,
        isActive: body.isActive == null ? true : Boolean(body.isActive),
      },
      select: { id: true, name: true, login: true, email: true, role: true, isActive: true },
    });
    return NextResponse.json({ ok: true, row });
  } catch (e) {
    const msg = (e as Error).message.includes("Unique")
      ? "Ce login ou cet email est déjà utilisé"
      : (e as Error).message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireSession(["ADMIN"]);
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => ({}));
  const id = Number(body.id);
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  const role = body.role != null ? asRole(body.role) : undefined;
  if (body.role != null && !role) {
    return NextResponse.json({ error: "Rôle invalide" }, { status: 400 });
  }

  const password = s(body.password);
  if (password && password.length < 4) {
    return NextResponse.json({ error: "Mot de passe trop court (4 caractères minimum)" }, { status: 400 });
  }

  try {
    const row = await prisma.user.update({
      where: { id },
      data: {
        ...(body.name != null ? { name: s(body.name) } : {}),
        ...(body.login != null ? { login: s(body.login) } : {}),
        ...(body.email != null ? { email: s(body.email) } : {}),
        ...(role ? { role } : {}),
        ...(body.phone != null ? { phone: s(body.phone) || null } : {}),
        ...(body.isActive != null ? { isActive: Boolean(body.isActive) } : {}),
        ...(body.codeTiers !== undefined
          ? { codeTiers: s(body.codeTiers) === "" ? null : Number(body.codeTiers) }
          : {}),
        // Mot de passe seulement s'il est fourni : sinon on conserve l'ancien.
        ...(password ? { password: await hashPassword(password) } : {}),
      },
      select: { id: true, name: true, login: true, email: true, role: true, isActive: true },
    });
    return NextResponse.json({ ok: true, row });
  } catch (e) {
    const msg = (e as Error).message.includes("Unique")
      ? "Ce login ou cet email est déjà utilisé"
      : (e as Error).message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireSession(["ADMIN"]);
  if (!auth.ok) return auth.res;

  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  // Un administrateur ne peut pas supprimer son propre compte.
  if (id === auth.user.id) {
    return NextResponse.json({ error: "Impossible de supprimer votre propre compte" }, { status: 400 });
  }

  // Garde-fou : conserver au moins un administrateur actif.
  const cible = await prisma.user.findUnique({ where: { id }, select: { role: true } });
  if (!cible) return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
  if (cible.role === "ADMIN") {
    const admins = await prisma.user.count({ where: { role: "ADMIN", isActive: true } });
    if (admins <= 1) {
      return NextResponse.json({ error: "Impossible de supprimer le dernier administrateur" }, { status: 400 });
    }
  }

  try {
    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
