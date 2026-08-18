import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { round3 } from "@/lib/vente-stats";
import { repartirCharge, annulerRepartition, margeParArticle } from "@/lib/charges-fixes";

// Charges fixes et marge réelle par article.
//
// GET    /api/charges?vue=liste|marge
// POST   /api/charges { vue: "charge"|"repartir"|"annuler" }
// PUT    /api/charges { id, ... }
// DELETE /api/charges?id=…

const s = (v: unknown) => (v == null ? "" : String(v).trim());
const int = (v: unknown) => {
  const x = parseInt(String(v ?? ""), 10);
  return Number.isFinite(x) ? x : null;
};
const num = (v: unknown) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};
const dateDe = (v: unknown) => {
  if (!v) return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
};

export async function GET(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.res;

  const sp = req.nextUrl.searchParams;
  const vue = sp.get("vue") ?? "liste";

  if (vue === "marge") {
    const du = dateDe(sp.get("du")) ?? new Date(new Date().getFullYear(), 0, 1);
    const au = dateDe(sp.get("au")) ?? new Date();
    au.setHours(23, 59, 59, 999);
    return NextResponse.json(await margeParArticle(du, au));
  }

  const rows = await prisma.chargeFixe.findMany({ orderBy: { du: "desc" }, take: 200 });
  return NextResponse.json({
    rows,
    total: rows.length,
    totalReparti: round3(rows.filter((r) => r.etat === "Répartie").reduce((t, r) => t + r.montant, 0)),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => ({}));
  const vue = s(body.vue) || "charge";

  if (vue === "charge") {
    const du = dateDe(body.du);
    const au = dateDe(body.au);
    if (!du || !au) return NextResponse.json({ error: "Période requise" }, { status: 400 });
    if (au < du) return NextResponse.json({ error: "La fin précède le début" }, { status: 400 });

    const montant = num(body.montant);
    if (montant <= 0) return NextResponse.json({ error: "Montant requis" }, { status: 400 });

    // `montantJr` par défaut = le montant total ; A distingue les deux pour
    // pouvoir ventiler une fraction seulement de la charge.
    const row = await prisma.chargeFixe.create({
      data: {
        libelle: s(body.libelle) || null,
        du, au,
        montant: round3(montant),
        montantJr: body.montantJr != null ? round3(num(body.montantJr)) : round3(montant),
        etat: "Brouillon",
      },
    });
    return NextResponse.json({ ok: true, row, message: "Charge enregistrée" });
  }

  if (vue === "repartir") {
    const id = int(body.id);
    if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
    const res = await repartirCharge(id);
    return NextResponse.json(res, { status: res.ok ? 200 : 409 });
  }

  if (vue === "annuler") {
    const id = int(body.id);
    if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
    const res = await annulerRepartition(id);
    return NextResponse.json(res, { status: res.ok ? 200 : 409 });
  }

  return NextResponse.json({ error: `Vue inconnue : ${vue}` }, { status: 400 });
}

export async function PUT(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => ({}));
  const id = int(body.id);
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  const actuelle = await prisma.chargeFixe.findUnique({ where: { id }, select: { etat: true } });
  if (!actuelle) return NextResponse.json({ error: "Charge introuvable" }, { status: 404 });
  // Modifier une charge déjà répartie rendrait les montants ventilés faux.
  if (actuelle.etat === "Répartie") {
    return NextResponse.json({ error: "Charge répartie — annulez la répartition avant de modifier" }, { status: 409 });
  }

  const row = await prisma.chargeFixe.update({
    where: { id },
    data: {
      ...(body.libelle != null ? { libelle: s(body.libelle) || null } : {}),
      ...(body.du != null ? { du: dateDe(body.du) ?? undefined } : {}),
      ...(body.au != null ? { au: dateDe(body.au) ?? undefined } : {}),
      ...(body.montant != null ? { montant: round3(num(body.montant)) } : {}),
      ...(body.montantJr != null ? { montantJr: round3(num(body.montantJr)) } : {}),
    },
  });
  return NextResponse.json({ ok: true, row, message: "Charge modifiée" });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireSession(["ADMIN"]);
  if (!auth.ok) return auth.res;

  const id = int(req.nextUrl.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  const charge = await prisma.chargeFixe.findUnique({ where: { id }, select: { etat: true } });
  if (!charge) return NextResponse.json({ error: "Charge introuvable" }, { status: 404 });
  if (charge.etat === "Répartie") {
    return NextResponse.json(
      { error: "Charge répartie sur des lignes de vente — annulez la répartition d'abord" },
      { status: 409 }
    );
  }

  await prisma.chargeFixe.delete({ where: { id } });
  return NextResponse.json({ ok: true, message: "Charge supprimée" });
}
