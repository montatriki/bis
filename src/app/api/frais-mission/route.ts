import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { memeCommercial } from "@/lib/perimetre-commercial";
import { cleCommercial } from "@/lib/perimetre-commercial";
import { round3 } from "@/lib/vente-stats";

// Frais de mission — carburant, péage, repas d'une tournée (table
// `frais_mission` de l'ERP source).
//
// Corrige une affirmation du §21 : il y était écrit que « A ne stocke pas les
// frais de route ». C'est faux, la table existe et est rattachée à `id_day`.
//
// GET    /api/frais-mission?dayId=…  |  ?vue=annee&annee=2026
// POST   /api/frais-mission { dayId, libelle, montant, carburant }
// PUT    /api/frais-mission { id, ... }
// DELETE /api/frais-mission?id=…

const s = (v: unknown) => (v == null ? "" : String(v).trim());
const int = (v: unknown) => {
  const x = parseInt(String(v ?? ""), 10);
  return Number.isFinite(x) ? x : null;
};
const num = (v: unknown) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

/**
 * Les frais appartiennent à une tournée, donc à son commercial. Les handlers
 * chargeaient `mission.commercial` sans jamais le comparer : chacun pouvait
 * lire, imputer, modifier ou supprimer les frais de ses collègues.
 */
function tourneeInterdite(
  mission: { commercial: string | null },
  user: { role: string; name: string },
): boolean {
  if (user.role !== "COMMERCIAL") return false;
  return !memeCommercial(mission.commercial, user.name);
}

export async function GET(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER", "COMMERCIAL"]);
  if (!auth.ok) return auth.res;

  const sp = req.nextUrl.searchParams;

  // Récapitulatif annuel, comme `getFraisByYear` dans A.
  if (sp.get("vue") === "annee") {
    const annee = int(sp.get("annee")) ?? new Date().getFullYear();
    const rows = await prisma.fraisMission.findMany({
      where: {
        mission: {
          dateOrdre: { gte: new Date(annee, 0, 1), lt: new Date(annee + 1, 0, 1) },
          ...(auth.user.role === "COMMERCIAL"
            // Prénom : les missions portent « MOKHTAR », la session « Mokhtar Trabelsi ».
            ? { commercial: { startsWith: cleCommercial(auth.user.name), mode: "insensitive" } }
            : {}),
        },
      },
      include: { mission: { select: { id: true, commercial: true, dateOrdre: true, vehicule: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({
      rows, total: rows.length, annee,
      montantTotal: round3(rows.reduce((t, f) => t + f.montant, 0)),
      carburant: round3(rows.filter((f) => f.carburant).reduce((t, f) => t + f.montant, 0)),
    });
  }

  const dayId = int(sp.get("dayId"));
  if (!dayId) return NextResponse.json({ error: "dayId requis" }, { status: 400 });

  const laTournee = await prisma.erpMission.findUnique({
    where: { id: dayId }, select: { commercial: true },
  });
  if (!laTournee) return NextResponse.json({ error: "Tournée introuvable" }, { status: 404 });
  if (tourneeInterdite(laTournee, auth.user)) {
    return NextResponse.json({ error: "Tournée d'un autre commercial" }, { status: 403 });
  }

  const rows = await prisma.fraisMission.findMany({ where: { dayId }, orderBy: { id: "asc" } });
  return NextResponse.json({
    rows, total: rows.length,
    montantTotal: round3(rows.reduce((t, f) => t + f.montant, 0)),
    carburant: round3(rows.filter((f) => f.carburant).reduce((t, f) => t + f.montant, 0)),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER", "COMMERCIAL"]);
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => ({}));
  const dayId = int(body.dayId);
  if (!dayId) return NextResponse.json({ error: "dayId requis" }, { status: 400 });

  const mission = await prisma.erpMission.findUnique({
    where: { id: dayId }, select: { etat: true, commercial: true },
  });
  if (!mission) return NextResponse.json({ error: "Tournée introuvable" }, { status: 404 });
  if (tourneeInterdite(mission, auth.user)) {
    return NextResponse.json({ error: "Tournée d'un autre commercial" }, { status: 403 });
  }
  // Une tournée clôturée a produit son bilan de journée : y ajouter un frais
  // après coup fausserait un chiffre déjà communiqué.
  if (mission.etat === "Clôturée") {
    return NextResponse.json({ error: "Tournée clôturée — frais non modifiables" }, { status: 409 });
  }

  const montant = num(body.montant);
  if (montant <= 0) return NextResponse.json({ error: "Montant requis" }, { status: 400 });

  const row = await prisma.fraisMission.create({
    data: {
      dayId,
      refArt: s(body.refArt) || null,
      libelle: s(body.libelle) || null,
      montant: round3(montant),
      puAchat: round3(num(body.puAchat)),
      carburant: body.carburant === true || s(body.carburant) === "true",
    },
  });
  return NextResponse.json({ ok: true, row, message: "Frais enregistré" });
}

export async function PUT(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER", "COMMERCIAL"]);
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => ({}));
  const id = int(body.id);
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  const frais = await prisma.fraisMission.findUnique({
    where: { id }, include: { mission: { select: { etat: true, commercial: true } } },
  });
  if (!frais) return NextResponse.json({ error: "Frais introuvable" }, { status: 404 });
  if (tourneeInterdite(frais.mission, auth.user)) {
    return NextResponse.json({ error: "Tournée d'un autre commercial" }, { status: 403 });
  }
  if (frais.mission.etat === "Clôturée") {
    return NextResponse.json({ error: "Tournée clôturée — frais non modifiables" }, { status: 409 });
  }

  const row = await prisma.fraisMission.update({
    where: { id },
    data: {
      ...(body.libelle != null ? { libelle: s(body.libelle) || null } : {}),
      ...(body.montant != null ? { montant: round3(num(body.montant)) } : {}),
      ...(body.carburant != null ? { carburant: body.carburant === true } : {}),
    },
  });
  return NextResponse.json({ ok: true, row, message: "Frais modifié" });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER", "COMMERCIAL"]);
  if (!auth.ok) return auth.res;

  const id = int(req.nextUrl.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  const frais = await prisma.fraisMission.findUnique({
    where: { id }, include: { mission: { select: { etat: true, commercial: true } } },
  });
  if (!frais) return NextResponse.json({ error: "Frais introuvable" }, { status: 404 });
  if (tourneeInterdite(frais.mission, auth.user)) {
    return NextResponse.json({ error: "Tournée d'un autre commercial" }, { status: 403 });
  }
  if (frais.mission.etat === "Clôturée") {
    return NextResponse.json({ error: "Tournée clôturée — frais non modifiables" }, { status: 409 });
  }

  await prisma.fraisMission.delete({ where: { id } });
  return NextResponse.json({ ok: true, message: "Frais supprimé" });
}
