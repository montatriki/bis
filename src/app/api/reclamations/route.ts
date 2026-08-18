import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { cleCommercial } from "@/lib/perimetre-commercial";

// Réclamations client saisies en tournée — table `reclamation_client` de A.
//
// Rattachées aux **tiers réels** (`Partner.id`) et, quand elle existe, à la
// tournée du jour. Le modèle `Claim` de B pointait sur le modèle démo `Client`
// (0 enregistrement) : il reste en place, ce module ne l'utilise pas.
//
// GET    /api/reclamations?vue=liste|detail|stats
// POST   /api/reclamations { codeCli, reclamation, type, dayId? }
// PUT    /api/reclamations { id, etat, reponse }
// DELETE /api/reclamations?id=…

const s = (v: unknown) => (v == null ? "" : String(v).trim());
const int = (v: unknown) => {
  const x = parseInt(String(v ?? ""), 10);
  return Number.isFinite(x) ? x : null;
};
const num = (v: unknown) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
};

/** Motifs repris de l'écran `commercial/reclamation`. */
const TYPES_RECLAMATION = [
  "Produit endommagé", "Erreur de quantité", "Produit non conforme",
  "Retard de livraison", "Erreur de facturation", "Autre",
] as const;

const ETATS_RECLAMATION = ["Ouverte", "En cours", "Résolue", "Rejetée"] as const;

export async function GET(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER", "COMMERCIAL"]);
  if (!auth.ok) return auth.res;

  const sp = req.nextUrl.searchParams;
  const vue = sp.get("vue") ?? "liste";

  // Un commercial ne voit que ce qu'il a saisi.
  const impose = auth.user.role === "COMMERCIAL" ? auth.user.name : null;

  if (vue === "detail") {
    const id = int(sp.get("id"));
    if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
    const row = await prisma.reclamation.findUnique({
      where: { id },
      include: { mission: { select: { id: true, commercial: true, dateOrdre: true } } },
    });
    if (!row) return NextResponse.json({ error: "Réclamation introuvable" }, { status: 404 });
    return NextResponse.json({ row });
  }

  if (vue === "stats") {
    const where = impose ? { utilisateur: impose } : {};
    const [total, parEtat, parType] = await Promise.all([
      prisma.reclamation.count({ where }),
      prisma.reclamation.groupBy({ by: ["etat"], where, _count: { _all: true } }),
      prisma.reclamation.groupBy({ by: ["type"], where, _count: { _all: true } }),
    ]);
    return NextResponse.json({
      total,
      ouvertes: parEtat.find((e) => e.etat === "Ouverte")?._count._all ?? 0,
      parEtat: parEtat.map((e) => ({ etat: e.etat, nb: e._count._all })),
      parType: parType.map((t) => ({ type: t.type, nb: t._count._all })),
      types: TYPES_RECLAMATION,
      etats: ETATS_RECLAMATION,
    });
  }

  const etat = s(sp.get("etat"));
  const q = s(sp.get("q"));
  const dayId = int(sp.get("dayId"));

  const rows = await prisma.reclamation.findMany({
    where: {
      ...(impose ? { utilisateur: impose } : {}),
      ...(etat && etat !== "Tous" ? { etat } : {}),
      ...(dayId ? { dayId } : {}),
      ...(q
        ? {
            OR: [
              { clientNom: { contains: q, mode: "insensitive" } },
              { reclamation: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { dateReclam: "desc" },
    take: 300,
    include: { mission: { select: { id: true, dateOrdre: true } } },
  });

  return NextResponse.json({
    rows, total: rows.length,
    types: TYPES_RECLAMATION,
    etats: ETATS_RECLAMATION,
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER", "COMMERCIAL"]);
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => ({}));
  const reclamation = s(body.reclamation);
  if (!reclamation) {
    return NextResponse.json({ error: "Le détail de la réclamation est requis" }, { status: 400 });
  }

  const type = s(body.type) || "Autre";
  if (!(TYPES_RECLAMATION as readonly string[]).includes(type)) {
    return NextResponse.json({ error: `Type inconnu : ${type}` }, { status: 400 });
  }

  // Le nom du client vient du référentiel, jamais du formulaire.
  const codeCli = int(body.codeCli);
  let clientNom = s(body.clientNom) || null;
  if (codeCli != null) {
    const p = await prisma.partner.findUnique({ where: { id: codeCli }, select: { raisonSocial: true } });
    if (!p) return NextResponse.json({ error: `Tiers ${codeCli} inconnu` }, { status: 400 });
    clientNom = p.raisonSocial;
  }

  // Rattachement à la tournée : celui fourni, sinon la tournée du jour du
  // commercial — c'est ce qui fait remonter la réclamation dans le bilan de
  // journée sans que personne ait à y penser.
  let dayId = int(body.dayId);
  if (dayId == null && auth.user.role === "COMMERCIAL") {
    const jour = new Date();
    jour.setHours(0, 0, 0, 0);
    const m = await prisma.erpMission.findFirst({
      where: {
        // Prénom : les missions portent « MOKHTAR », la session « Mokhtar Trabelsi ».
        commercial: { startsWith: cleCommercial(auth.user.name), mode: "insensitive" },
        dateOrdre: { gte: jour, lt: new Date(jour.getTime() + 86_400_000) },
        etat: { notIn: ["Annulée"] },
      },
      select: { id: true },
      orderBy: { id: "desc" },
    });
    dayId = m?.id ?? null;
  }
  if (dayId != null) {
    const m = await prisma.erpMission.findUnique({ where: { id: dayId }, select: { id: true } });
    if (!m) dayId = null; // tournée inconnue : on n'invente pas un rattachement
  }

  const row = await prisma.reclamation.create({
    data: {
      codeCli, clientNom, type, reclamation, dayId,
      etat: "Ouverte",
      utilisateur: auth.user.name,
      latitude: num(body.latitude),
      longitude: num(body.longitude),
    },
  });
  return NextResponse.json({ ok: true, row, message: "Réclamation enregistrée" });
}

export async function PUT(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER", "COMMERCIAL"]);
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => ({}));
  const id = int(body.id);
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  const etat = body.etat != null ? s(body.etat) : undefined;
  if (etat != null && !(ETATS_RECLAMATION as readonly string[]).includes(etat)) {
    return NextResponse.json({ error: `État invalide : ${etat}` }, { status: 400 });
  }

  const actuelle = await prisma.reclamation.findUnique({
    where: { id }, select: { dateReponse: true, utilisateur: true },
  });
  if (!actuelle) return NextResponse.json({ error: "Réclamation introuvable" }, { status: 404 });

  // Un commercial ne clôt que ses propres réclamations.
  if (auth.user.role === "COMMERCIAL" && actuelle.utilisateur !== auth.user.name) {
    return NextResponse.json({ error: "Réclamation d'un autre commercial" }, { status: 403 });
  }

  // Résoudre ou rejeter horodate la réponse : sans date, on ne peut pas
  // mesurer le délai de traitement.
  const cloture = etat === "Résolue" || etat === "Rejetée";
  const dateReponse = cloture && !actuelle.dateReponse ? new Date() : undefined;

  const row = await prisma.reclamation.update({
    where: { id },
    data: {
      ...(etat != null ? { etat } : {}),
      ...(body.reponse != null ? { reponse: s(body.reponse) || null } : {}),
      ...(body.type != null ? { type: s(body.type) } : {}),
      ...(dateReponse !== undefined ? { dateReponse } : {}),
    },
  });
  return NextResponse.json({ ok: true, row, message: `Réclamation « ${row.etat} »` });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.res;

  const id = int(req.nextUrl.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  await prisma.reclamation.delete({ where: { id } });
  return NextResponse.json({ ok: true, message: "Réclamation supprimée" });
}
