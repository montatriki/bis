import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { round3, signeCA, TYPES_CA } from "@/lib/vente-stats";

// Module Projets — reprend la table `projets` et l'état d'avancement de l'ERP
// source (`projets-module/liste-projets` + `create-projet`).
//
// L'apport par rapport à A : l'avancement n'est plus un champ saisi à la main,
// il est **calculé depuis les jalons pondérés** dès qu'il y en a. Un projet dont
// 3 jalons sur 4 sont finis ne peut plus afficher 10 % par oubli de saisie.
//
// GET    /api/projets?vue=liste|detail|stats
// POST   /api/projets { vue: "projet"|"jalon", ... }
// PUT    /api/projets { vue, id, ... }
// DELETE /api/projets?vue=projet|jalon&id=...

const s = (v: unknown) => (v == null ? "" : String(v).trim());
const int = (v: unknown) => {
  const x = parseInt(String(v ?? ""), 10);
  return Number.isFinite(x) ? x : null;
};
const num = (v: unknown) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};
const date = (v: unknown) => {
  if (!v) return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
};
const pct = (v: unknown) => Math.max(0, Math.min(100, num(v)));

const ETATS = ["En attente", "En cours", "Terminé", "Livré", "Annulé"] as const;

type JalonLike = { poids: number; avancement: number };

/**
 * Avancement d'un projet : moyenne des jalons pondérée par leur poids.
 * Sans jalon, on garde la valeur saisie — le projet n'est pas encore découpé.
 */
// Non exportée : un fichier `route.ts` ne peut exporter que des handlers HTTP,
// Next.js rejette tout autre export au typage.
function avancementCalcule(jalons: JalonLike[], saisi: number): number {
  if (jalons.length === 0) return round3(saisi);
  const poidsTotal = jalons.reduce((t, j) => t + (j.poids > 0 ? j.poids : 0), 0);
  if (poidsTotal <= 0) {
    // Poids tous nuls : moyenne simple plutôt qu'une division par zéro.
    return round3(jalons.reduce((t, j) => t + j.avancement, 0) / jalons.length);
  }
  return round3(jalons.reduce((t, j) => t + j.avancement * (j.poids > 0 ? j.poids : 0), 0) / poidsTotal);
}

/** Retard : jalon non terminé dont la date prévue est passée. */
const enRetard = (j: { avancement: number; datePrevue: Date | null }) =>
  j.avancement < 100 && j.datePrevue != null && j.datePrevue < new Date();

export async function GET(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.res;

  const sp = req.nextUrl.searchParams;
  const vue = sp.get("vue") ?? "liste";

  if (vue === "liste") {
    const etat = s(sp.get("etat"));
    const q = s(sp.get("q"));

    const rows = await prisma.projet.findMany({
      where: {
        ...(etat && etat !== "Tous" ? { etat } : {}),
        ...(q
          ? {
              OR: [
                { projet: { contains: q, mode: "insensitive" } },
                { raisonSoc: { contains: q, mode: "insensitive" } },
                { respProjet: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }],
      take: 300,
      include: { jalons: { select: { poids: true, avancement: true, datePrevue: true } } },
    });

    const enrichis = rows.map((p) => {
      const avancement = avancementCalcule(p.jalons, p.avancement);
      const retards = p.jalons.filter(enRetard).length;
      return {
        id: p.id, projet: p.projet, codeCli: p.codeCli, raisonSoc: p.raisonSoc,
        respProjet: p.respProjet, famille: p.famille, etat: p.etat,
        budget: p.budget, periodeDu: p.periodeDu, periodeAu: p.periodeAu,
        dateLiv: p.dateLiv, dateFinReel: p.dateFinReel,
        avancement,
        avancementSaisi: p.avancement,
        // Un avancement issu des jalons est plus fiable qu'un pourcentage saisi.
        calculeDepuisJalons: p.jalons.length > 0,
        nbJalons: p.jalons.length,
        jalonsEnRetard: retards,
        // Projet en retard : échéance passée et pas terminé.
        retard: p.periodeAu != null && p.periodeAu < new Date() && avancement < 100
          && !["Terminé", "Livré", "Annulé"].includes(p.etat),
      };
    });

    return NextResponse.json({ rows: enrichis, total: enrichis.length, etats: ETATS });
  }

  if (vue === "detail") {
    const id = int(sp.get("id"));
    if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

    const row = await prisma.projet.findUnique({
      where: { id },
      include: { jalons: { orderBy: [{ numOrdre: "asc" }, { id: "asc" }] } },
    });
    if (!row) return NextResponse.json({ error: "Projet introuvable" }, { status: 404 });

    // Documents commerciaux du client — rattache le projet à son chiffre réel.
    let caClient = 0;
    let documents: { refDoc: string; typeDoc: string | null; dateDoc: Date | null; ttcNet: number }[] = [];
    if (row.codeCli != null) {
      const docs = await prisma.erpDocument.findMany({
        where: { codeCli: row.codeCli, typeDoc: { in: [...TYPES_CA] } },
        select: { refDoc: true, typeDoc: true, dateDoc: true, ttcNet: true },
        orderBy: { dateDoc: "desc" },
        take: 20,
      });
      documents = docs;
      caClient = round3(docs.reduce((t, d) => t + signeCA(d.typeDoc) * (d.ttcNet ?? 0), 0));
    }

    return NextResponse.json({
      row: {
        ...row,
        avancement: avancementCalcule(row.jalons, row.avancement),
        avancementSaisi: row.avancement,
        calculeDepuisJalons: row.jalons.length > 0,
      },
      jalons: row.jalons.map((j) => ({ ...j, retard: enRetard(j) })),
      caClient,
      documents,
      etats: ETATS,
    });
  }

  // stats
  const [total, parEtat, agg] = await Promise.all([
    prisma.projet.count(),
    prisma.projet.groupBy({ by: ["etat"], _count: { _all: true }, _sum: { budget: true } }),
    prisma.projet.aggregate({ _sum: { budget: true } }),
  ]);

  const tous = await prisma.projet.findMany({
    select: { etat: true, periodeAu: true, avancement: true, jalons: { select: { poids: true, avancement: true } } },
  });
  const maintenant = new Date();
  const retards = tous.filter(
    (p) =>
      p.periodeAu != null && p.periodeAu < maintenant &&
      avancementCalcule(p.jalons, p.avancement) < 100 &&
      !["Terminé", "Livré", "Annulé"].includes(p.etat)
  ).length;

  const avancementMoyen = tous.length
    ? round3(tous.reduce((t, p) => t + avancementCalcule(p.jalons, p.avancement), 0) / tous.length)
    : 0;

  return NextResponse.json({
    total,
    budgetTotal: round3(agg._sum.budget ?? 0),
    avancementMoyen,
    enRetard: retards,
    parEtat: parEtat.map((p) => ({
      etat: p.etat, nb: p._count._all, budget: round3(p._sum.budget ?? 0),
    })),
    etats: ETATS,
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => ({}));
  const vue = s(body.vue) || "projet";

  if (vue === "projet") {
    const projet = s(body.projet);
    if (!projet) return NextResponse.json({ error: "Nom du projet requis" }, { status: 400 });

    const etat = s(body.etat) || "En attente";
    if (!(ETATS as readonly string[]).includes(etat)) {
      return NextResponse.json({ error: `État invalide : ${etat}` }, { status: 400 });
    }

    const periodeDu = date(body.periodeDu);
    const periodeAu = date(body.periodeAu);
    if (periodeDu && periodeAu && periodeAu < periodeDu) {
      return NextResponse.json({ error: "La fin de période précède le début" }, { status: 400 });
    }

    // Le nom du client vient du référentiel, jamais du formulaire.
    const codeCli = int(body.codeCli);
    let raisonSoc = s(body.raisonSoc) || null;
    if (codeCli != null) {
      const p = await prisma.partner.findUnique({ where: { id: codeCli }, select: { raisonSocial: true, adresse: true } });
      if (!p) return NextResponse.json({ error: `Tiers ${codeCli} inconnu` }, { status: 400 });
      raisonSoc = p.raisonSocial;
    }

    const row = await prisma.projet.create({
      data: {
        projet, codeCli, raisonSoc, etat,
        respProjet: s(body.respProjet) || auth.user.name,
        famille: s(body.famille) || null,
        description: s(body.description) || null,
        adresse: s(body.adresse) || null,
        modePay: s(body.modePay) || null,
        dateAccept: date(body.dateAccept),
        periodeDu, periodeAu,
        dateLiv: date(body.dateLiv),
        avancement: pct(body.avancement),
        budget: round3(num(body.budget)),
      },
    });
    return NextResponse.json({ ok: true, row, message: `Projet « ${projet} » créé` });
  }

  if (vue === "jalon") {
    const projetId = int(body.projetId);
    const libelle = s(body.libelle);
    if (!projetId || !libelle) {
      return NextResponse.json({ error: "Projet et libellé du jalon requis" }, { status: 400 });
    }
    const p = await prisma.projet.findUnique({ where: { id: projetId }, select: { id: true } });
    if (!p) return NextResponse.json({ error: "Projet introuvable" }, { status: 404 });

    // Ordre auto : le jalon s'ajoute à la fin.
    let numOrdre = int(body.numOrdre);
    if (numOrdre == null) {
      const dernier = await prisma.projetJalon.findFirst({
        where: { projetId }, orderBy: { numOrdre: "desc" }, select: { numOrdre: true },
      });
      numOrdre = (dernier?.numOrdre ?? 0) + 1;
    }

    const row = await prisma.projetJalon.create({
      data: {
        projetId, libelle, numOrdre,
        // Un poids nul exclurait le jalon de l'avancement pondéré.
        poids: num(body.poids) > 0 ? num(body.poids) : 1,
        avancement: pct(body.avancement),
        datePrevue: date(body.datePrevue),
        dateReelle: date(body.dateReelle),
      },
    });
    return NextResponse.json({ ok: true, row, message: `Jalon « ${libelle} » ajouté` });
  }

  return NextResponse.json({ error: `Vue inconnue : ${vue}` }, { status: 400 });
}

export async function PUT(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => ({}));
  const vue = s(body.vue) || "projet";
  const id = int(body.id);
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  if (vue === "projet") {
    if (body.etat != null && !(ETATS as readonly string[]).includes(s(body.etat))) {
      return NextResponse.json({ error: `État invalide : ${s(body.etat)}` }, { status: 400 });
    }

    const codeCli = body.codeCli != null ? int(body.codeCli) : undefined;
    let raisonSoc: string | null | undefined;
    if (codeCli != null) {
      const p = await prisma.partner.findUnique({ where: { id: codeCli }, select: { raisonSocial: true } });
      if (!p) return NextResponse.json({ error: `Tiers ${codeCli} inconnu` }, { status: 400 });
      raisonSoc = p.raisonSocial;
    }

    // Passer à « Terminé » sans date de fin réelle : on la pose au jour même,
    // sinon le projet resterait sans date de clôture exploitable.
    const etat = body.etat != null ? s(body.etat) : undefined;
    const actuel = await prisma.projet.findUnique({ where: { id }, select: { dateFinReel: true } });
    const dateFinReel =
      body.dateFinReel != null
        ? date(body.dateFinReel)
        : etat && ["Terminé", "Livré"].includes(etat) && !actuel?.dateFinReel
          ? new Date()
          : undefined;

    const row = await prisma.projet.update({
      where: { id },
      data: {
        ...(body.projet != null ? { projet: s(body.projet) } : {}),
        ...(etat != null ? { etat } : {}),
        ...(codeCli !== undefined ? { codeCli } : {}),
        ...(raisonSoc !== undefined ? { raisonSoc } : {}),
        ...(body.respProjet != null ? { respProjet: s(body.respProjet) || null } : {}),
        ...(body.famille != null ? { famille: s(body.famille) || null } : {}),
        ...(body.description != null ? { description: s(body.description) || null } : {}),
        ...(body.adresse != null ? { adresse: s(body.adresse) || null } : {}),
        ...(body.modePay != null ? { modePay: s(body.modePay) || null } : {}),
        ...(body.dateAccept != null ? { dateAccept: date(body.dateAccept) } : {}),
        ...(body.periodeDu != null ? { periodeDu: date(body.periodeDu) } : {}),
        ...(body.periodeAu != null ? { periodeAu: date(body.periodeAu) } : {}),
        ...(body.dateLiv != null ? { dateLiv: date(body.dateLiv) } : {}),
        ...(dateFinReel !== undefined ? { dateFinReel } : {}),
        ...(body.avancement != null ? { avancement: pct(body.avancement) } : {}),
        ...(body.budget != null ? { budget: round3(num(body.budget)) } : {}),
      },
    });
    return NextResponse.json({ ok: true, row, message: "Projet modifié" });
  }

  if (vue === "jalon") {
    // Un jalon à 100 % sans date réelle : on l'horodate, comme pour les tickets SAV.
    const avancement = body.avancement != null ? pct(body.avancement) : undefined;
    const actuel = await prisma.projetJalon.findUnique({ where: { id }, select: { dateReelle: true } });
    const dateReelle =
      body.dateReelle != null
        ? date(body.dateReelle)
        : avancement === 100 && !actuel?.dateReelle
          ? new Date()
          : undefined;

    const row = await prisma.projetJalon.update({
      where: { id },
      data: {
        ...(body.libelle != null ? { libelle: s(body.libelle) } : {}),
        ...(body.numOrdre != null ? { numOrdre: int(body.numOrdre) ?? 0 } : {}),
        ...(body.poids != null ? { poids: num(body.poids) > 0 ? num(body.poids) : 1 } : {}),
        ...(avancement !== undefined ? { avancement } : {}),
        ...(body.datePrevue != null ? { datePrevue: date(body.datePrevue) } : {}),
        ...(dateReelle !== undefined ? { dateReelle } : {}),
      },
    });
    return NextResponse.json({ ok: true, row, message: "Jalon modifié" });
  }

  return NextResponse.json({ error: `Vue inconnue : ${vue}` }, { status: 400 });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireSession(["ADMIN"]);
  if (!auth.ok) return auth.res;

  const sp = req.nextUrl.searchParams;
  const vue = s(sp.get("vue")) || "projet";
  const id = int(sp.get("id"));
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  if (vue === "projet") {
    // Les jalons tombent en cascade.
    await prisma.projet.delete({ where: { id } });
    return NextResponse.json({ ok: true, message: "Projet supprimé" });
  }

  if (vue === "jalon") {
    await prisma.projetJalon.delete({ where: { id } });
    return NextResponse.json({ ok: true, message: "Jalon supprimé" });
  }

  return NextResponse.json({ error: `Vue inconnue : ${vue}` }, { status: 400 });
}
