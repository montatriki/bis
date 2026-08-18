import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { round3 } from "@/lib/vente-stats";

// CRM — opportunités (pipeline) et tickets SAV.
//
// GET    /api/crm?vue=opportunites|pipeline|tickets|stats
// POST   /api/crm { vue: "opportunite"|"ticket"|"evenement", ... }
// PUT    /api/crm { vue, id, ... }
// DELETE /api/crm?vue=opportunite|ticket&id=...

const s = (v: unknown) => (v == null ? "" : String(v).trim());
const int = (v: unknown) => {
  const x = parseInt(String(v ?? ""), 10);
  return Number.isFinite(x) ? x : null;
};
const num = (v: unknown) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

/** Étapes du pipeline, de la prospection à la clôture. */
const ETAPES = [
  "Prospection", "Qualification", "Proposition", "Négociation", "Gagnée", "Perdue",
] as const;

const ETATS_TICKET = ["Ouvert", "En cours", "Résolu", "Clôturé", "Rejeté"] as const;
const PRIORITES = ["Basse", "Normale", "Haute", "Urgente"] as const;

export async function GET(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.res;

  const sp = req.nextUrl.searchParams;
  const vue = sp.get("vue") ?? "stats";

  if (vue === "opportunites" || vue === "pipeline") {
    const etape = s(sp.get("etape"));
    const rows = await prisma.opportunite.findMany({
      where: { archiver: false, ...(etape && etape !== "Toutes" ? { etape } : {}) },
      orderBy: [{ montant: "desc" }, { id: "desc" }],
      take: 300,
      include: { _count: { select: { evenements: true } } },
    });

    const parEtape = ETAPES.map((e) => {
      const mes = rows.filter((r) => r.etape === e);
      return {
        etape: e,
        nb: mes.length,
        montant: round3(mes.reduce((s, r) => s + r.montant, 0)),
        // Montant pondéré par la probabilité — prévision réaliste.
        pondere: round3(mes.reduce((s, r) => s + (r.montant * r.probabilite) / 100, 0)),
      };
    });

    return NextResponse.json({
      rows: rows.map((r) => ({ ...r, nbEvenements: r._count.evenements })),
      total: rows.length,
      parEtape,
      etapes: ETAPES,
      totalMontant: round3(rows.reduce((s, r) => s + r.montant, 0)),
      totalPondere: round3(rows.reduce((s, r) => s + (r.montant * r.probabilite) / 100, 0)),
    });
  }

  if (vue === "evenements") {
    const opportuniteId = int(sp.get("opportuniteId"));
    if (!opportuniteId) return NextResponse.json({ error: "opportuniteId requis" }, { status: 400 });
    const rows = await prisma.evenementOpportunite.findMany({
      where: { opportuniteId },
      orderBy: { dateEvent: "desc" },
    });
    return NextResponse.json({ rows, total: rows.length });
  }

  if (vue === "tickets") {
    const etat = s(sp.get("etat"));
    const rows = await prisma.ticketSav.findMany({
      where: etat && etat !== "Tous" ? { etat } : {},
      orderBy: [{ dateReclamation: "desc" }],
      take: 300,
    });
    const parEtat = await prisma.ticketSav.groupBy({ by: ["etat"], _count: { _all: true } });
    return NextResponse.json({
      rows,
      total: rows.length,
      parEtat: parEtat.map((p) => ({ etat: p.etat, nb: p._count._all })),
      etats: ETATS_TICKET,
      priorites: PRIORITES,
    });
  }

  // stats
  const [nbOpp, nbTickets, aggOpp, ouverts] = await Promise.all([
    prisma.opportunite.count({ where: { archiver: false } }),
    prisma.ticketSav.count(),
    prisma.opportunite.aggregate({ where: { archiver: false }, _sum: { montant: true } }),
    prisma.ticketSav.count({ where: { etat: { in: ["Ouvert", "En cours"] } } }),
  ]);
  const gagnees = await prisma.opportunite.aggregate({
    where: { archiver: false, etape: "Gagnée" },
    _sum: { montant: true },
    _count: { _all: true },
  });

  return NextResponse.json({
    nbOpportunites: nbOpp,
    montantPipeline: round3(aggOpp._sum.montant ?? 0),
    nbGagnees: gagnees._count._all,
    montantGagne: round3(gagnees._sum.montant ?? 0),
    tauxConversion: nbOpp > 0 ? Math.round((gagnees._count._all / nbOpp) * 100) : 0,
    nbTickets,
    ticketsOuverts: ouverts,
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER", "COMMERCIAL"]);
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => ({}));
  const vue = s(body.vue);

  if (vue === "opportunite") {
    const libelle = s(body.libelle);
    if (!libelle) return NextResponse.json({ error: "Libellé requis" }, { status: 400 });

    const etape = s(body.etape) || "Prospection";
    if (!(ETAPES as readonly string[]).includes(etape)) {
      return NextResponse.json({ error: "Étape invalide" }, { status: 400 });
    }

    const codeCli = int(body.codeCli);
    // Le nom du client est repris du référentiel pour éviter les divergences.
    let clientNom = s(body.clientNom) || null;
    if (codeCli != null) {
      const p = await prisma.partner.findUnique({ where: { id: codeCli }, select: { raisonSocial: true } });
      if (p) clientNom = p.raisonSocial;
    }

    const row = await prisma.opportunite.create({
      data: {
        libelle, codeCli, clientNom, etape,
        montant: round3(num(body.montant)),
        probabilite: Math.max(0, Math.min(100, int(body.probabilite) ?? 50)),
        source: s(body.source) || null,
        suiviPar: s(body.suiviPar) || auth.user.name,
        description: s(body.description) || null,
        dateCloture: body.dateCloture ? new Date(String(body.dateCloture)) : null,
      },
    });
    return NextResponse.json({ ok: true, row, message: `Opportunité « ${libelle} » créée` });
  }

  if (vue === "evenement") {
    const opportuniteId = int(body.opportuniteId);
    const libelle = s(body.libelle);
    if (!opportuniteId || !libelle) {
      return NextResponse.json({ error: "Opportunité et libellé requis" }, { status: 400 });
    }
    const row = await prisma.evenementOpportunite.create({
      data: {
        opportuniteId,
        type: s(body.type) || "Note",
        libelle,
        auteur: auth.user.name,
        dateEvent: body.dateEvent ? new Date(String(body.dateEvent)) : new Date(),
      },
    });
    return NextResponse.json({ ok: true, row, message: "Événement ajouté" });
  }

  if (vue === "ticket") {
    const description = s(body.description);
    if (!description) return NextResponse.json({ error: "Description requise" }, { status: 400 });

    const codeCli = int(body.codeCli);
    let clientNom = s(body.clientNom) || null;
    if (codeCli != null) {
      const p = await prisma.partner.findUnique({ where: { id: codeCli }, select: { raisonSocial: true } });
      if (p) clientNom = p.raisonSocial;
    }

    // Référence séquentielle SAV-<AA><NNNN>.
    const annee = String(new Date().getFullYear()).slice(-2);
    const dernier = await prisma.ticketSav.findFirst({
      where: { reference: { startsWith: `SAV-${annee}` } },
      orderBy: { reference: "desc" },
      select: { reference: true },
    });
    const n = dernier ? Number(dernier.reference.slice(-4)) || 0 : 0;
    const reference = `SAV-${annee}${String(n + 1).padStart(4, "0")}`;

    const row = await prisma.ticketSav.create({
      data: {
        reference, codeCli, clientNom, description,
        typePanne: s(body.typePanne) || null,
        etat: s(body.etat) || "Ouvert",
        priorite: s(body.priorite) || "Normale",
        intervenant: s(body.intervenant) || null,
        refDoc: s(body.refDoc) || null,
      },
    });
    return NextResponse.json({ ok: true, row, message: `Ticket ${reference} créé` });
  }

  return NextResponse.json({ error: "vue inconnue" }, { status: 400 });
}

export async function PUT(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER", "COMMERCIAL"]);
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => ({}));
  const vue = s(body.vue);
  const id = int(body.id);
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  if (vue === "opportunite") {
    const etape = body.etape != null ? s(body.etape) : undefined;
    if (etape && !(ETAPES as readonly string[]).includes(etape)) {
      return NextResponse.json({ error: "Étape invalide" }, { status: 400 });
    }
    const row = await prisma.opportunite.update({
      where: { id },
      data: {
        ...(body.libelle != null ? { libelle: s(body.libelle) } : {}),
        ...(etape ? { etape } : {}),
        ...(body.montant != null ? { montant: round3(num(body.montant)) } : {}),
        ...(body.probabilite != null
          ? { probabilite: Math.max(0, Math.min(100, int(body.probabilite) ?? 50)) }
          : {}),
        ...(body.description != null ? { description: s(body.description) || null } : {}),
        ...(body.archiver != null ? { archiver: Boolean(body.archiver) } : {}),
      },
    });
    return NextResponse.json({ ok: true, row, message: etape ? `Déplacée en « ${etape} »` : "Modifiée" });
  }

  if (vue === "ticket") {
    const etat = body.etat != null ? s(body.etat) : undefined;
    if (etat && !(ETATS_TICKET as readonly string[]).includes(etat)) {
      return NextResponse.json({ error: "État invalide" }, { status: 400 });
    }
    // Un ticket résolu ou clôturé enregistre sa date de réparation.
    const clot = etat === "Résolu" || etat === "Clôturé";
    const row = await prisma.ticketSav.update({
      where: { id },
      data: {
        ...(etat ? { etat } : {}),
        ...(body.priorite != null ? { priorite: s(body.priorite) } : {}),
        ...(body.intervenant != null ? { intervenant: s(body.intervenant) || null } : {}),
        ...(body.solution != null ? { solution: s(body.solution) || null } : {}),
        ...(clot ? { dateReparation: new Date() } : {}),
      },
    });
    return NextResponse.json({ ok: true, row, message: etat ? `Ticket → ${etat}` : "Modifié" });
  }

  return NextResponse.json({ error: "vue inconnue" }, { status: 400 });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.res;

  const sp = req.nextUrl.searchParams;
  const vue = s(sp.get("vue"));
  const id = int(sp.get("id"));
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  if (vue === "opportunite") {
    // Archivage plutôt que suppression : l'historique commercial est conservé.
    await prisma.opportunite.update({ where: { id }, data: { archiver: true } });
    return NextResponse.json({ ok: true, message: "Opportunité archivée" });
  }
  if (vue === "ticket") {
    await prisma.ticketSav.delete({ where: { id } });
    return NextResponse.json({ ok: true, message: "Ticket supprimé" });
  }

  return NextResponse.json({ error: "vue inconnue" }, { status: 400 });
}
