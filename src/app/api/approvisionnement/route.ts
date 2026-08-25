import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { cleCommercial } from "@/lib/perimetre-commercial";
import { round3 } from "@/lib/vente-stats";
import { creerMouvement } from "@/lib/mouvements-depot";

// Bons d'approvisionnement — tuile « BON D'APPROVISIONNEMENT » de l'app
// commerciale : le commercial constate un manque en tournée et demande au
// dépôt de recharger son camion.
//
// Le stock ne bouge **qu'au service** de la demande, via un vrai bon de sortie
// (BST dépôt → véhicule, §18). Une demande n'est qu'une intention ; la
// confondre avec un mouvement fausserait le stock du camion.
//
// GET    /api/approvisionnement?vue=liste|detail|suggestions|stats
// POST   /api/approvisionnement { vue: "bon"|"servir"|"refuser" }
// PUT    /api/approvisionnement { id, refArt, qteDemandee }
// DELETE /api/approvisionnement?vue=bon|ligne&id=…

const s = (v: unknown) => (v == null ? "" : String(v).trim());
const int = (v: unknown) => {
  const x = parseInt(String(v ?? ""), 10);
  return Number.isFinite(x) ? x : null;
};
const num = (v: unknown) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

const ETATS = ["Demandé", "Servi", "Refusé"] as const;

/** Référence séquentielle `APP-<AA><NNNN>`. */
async function prochaineReference(): Promise<string> {
  const annee = String(new Date().getFullYear()).slice(-2);
  const dernier = await prisma.bonApprovisionnement.findFirst({
    where: { reference: { startsWith: `APP-${annee}` } },
    orderBy: { reference: "desc" },
    select: { reference: true },
  });
  const n = dernier ? Number(dernier.reference.slice(-4)) || 0 : 0;
  return `APP-${annee}${String(n + 1).padStart(4, "0")}`;
}

export async function GET(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER", "COMMERCIAL"]);
  if (!auth.ok) return auth.res;

  const sp = req.nextUrl.searchParams;
  const vue = sp.get("vue") ?? "liste";
  const impose = auth.user.role === "COMMERCIAL" ? auth.user.name : null;

  if (vue === "detail") {
    const id = int(sp.get("id"));
    if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
    const row = await prisma.bonApprovisionnement.findUnique({
      where: { id },
      include: { lignes: { orderBy: { id: "asc" } } },
    });
    if (!row) return NextResponse.json({ error: "Bon introuvable" }, { status: 404 });
    if (impose && row.utilisateur !== impose) {
      return NextResponse.json({ error: "Bon d'un autre commercial" }, { status: 403 });
    }
    return NextResponse.json({ row, etats: ETATS });
  }

  // Articles à proposer au réassort : ce que le camion a déjà (pour compléter)
  // et les articles vendables du dépôt.
  if (vue === "suggestions") {
    const vehicule = s(sp.get("vehicule"));
    const q = s(sp.get("q"));

    const enCamion = vehicule
      ? await prisma.stockDepot.findMany({ where: { emplacement: vehicule } })
      : [];
    const parRef = new Map(enCamion.map((e) => [e.refArt, e.quantite]));

    const articles = await prisma.article.findMany({
      where: {
        archiver: 0, vendable: 1,
        ...(q
          ? {
              OR: [
                { refArt: { contains: q, mode: "insensitive" } },
                { designation: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      select: { refArt: true, designation: true, unite: true, enStock: true },
      orderBy: { designation: "asc" },
      // La coupe à 200 sur 556 articles vendables arrêtait la liste à la lettre
      // « C » : le commercial ne pouvait demander que le début du catalogue.
      // Sans recherche on renvoie tout ; la recherche filtre déjà côté base.
      take: 1000,
    });

    return NextResponse.json({
      rows: articles.map((a) => ({
        ...a,
        // Ce que le commercial a encore à bord : l'information qui déclenche
        // la demande de réassort.
        enCamion: round3(parRef.get(a.refArt) ?? 0),
      })),
      total: articles.length,
      vehicule,
    });
  }

  if (vue === "stats") {
    const where = impose ? { utilisateur: impose } : {};
    const [total, demandes, servis] = await Promise.all([
      prisma.bonApprovisionnement.count({ where }),
      prisma.bonApprovisionnement.count({ where: { ...where, etat: "Demandé" } }),
      prisma.bonApprovisionnement.count({ where: { ...where, etat: "Servi" } }),
    ]);
    return NextResponse.json({ total, demandes, servis, etats: ETATS });
  }

  const etat = s(sp.get("etat"));
  const rows = await prisma.bonApprovisionnement.findMany({
    where: {
      ...(impose ? { utilisateur: impose } : {}),
      ...(etat && etat !== "Tous" ? { etat } : {}),
    },
    orderBy: { dateDemande: "desc" },
    take: 200,
    include: { lignes: { select: { qteDemandee: true, qteServie: true } } },
  });

  return NextResponse.json({
    rows: rows.map((b) => ({
      id: b.id, reference: b.reference, utilisateur: b.utilisateur,
      vehicule: b.vehicule, depot: b.depot, etat: b.etat,
      dateDemande: b.dateDemande, dateService: b.dateService,
      refMouvement: b.refMouvement, observation: b.observation,
      nbLignes: b.lignes.length,
      totalDemande: round3(b.lignes.reduce((t, l) => t + l.qteDemandee, 0)),
      totalServi: round3(b.lignes.reduce((t, l) => t + l.qteServie, 0)),
    })),
    total: rows.length,
    etats: ETATS,
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER", "COMMERCIAL"]);
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => ({}));
  const vue = s(body.vue) || "bon";

  if (vue === "bon") {
    const lignes = (Array.isArray(body.lignes) ? body.lignes : [])
      .map((l: Record<string, unknown>) => ({
        refArt: s(l.refArt),
        qteDemandee: num(l.qteDemandee),
      }))
      .filter((l: { refArt: string; qteDemandee: number }) => l.refArt && l.qteDemandee > 0);

    if (lignes.length === 0) {
      return NextResponse.json({ error: "Aucune ligne : saisissez au moins une quantité" }, { status: 400 });
    }

    // Un article demandé deux fois est une erreur de saisie : on refuse plutôt
    // que de garder arbitrairement l'une des deux quantités.
    const vus = new Set<string>();
    const doublons = new Set<string>();
    for (const l of lignes) {
      if (vus.has(l.refArt)) doublons.add(l.refArt);
      vus.add(l.refArt);
    }
    if (doublons.size > 0) {
      return NextResponse.json(
        { error: `Article(s) demandé(s) en double : ${[...doublons].join(", ")}` },
        { status: 400 }
      );
    }

    const arts = await prisma.article.findMany({
      where: { refArt: { in: [...vus] } },
      select: { refArt: true, designation: true },
    });
    const parRef = new Map(arts.map((a) => [a.refArt, a.designation]));
    const alertes = [...vus].filter((r) => !parRef.has(r)).map((r) => `${r} : absent du référentiel`);

    // Tournée du jour, pour rattacher la demande à la journée en cours.
    const jour = new Date();
    jour.setHours(0, 0, 0, 0);
    const mission = await prisma.erpMission.findFirst({
      where: {
        // Prénom : les missions portent « MOKHTAR », la session « Mokhtar Trabelsi ».
        commercial: { startsWith: cleCommercial(auth.user.name), mode: "insensitive" },
        dateOrdre: { gte: jour, lt: new Date(jour.getTime() + 86_400_000) },
        etat: { notIn: ["Annulée"] },
      },
      select: { id: true, vehicule: true },
      orderBy: { id: "desc" },
    });

    const reference = await prochaineReference();
    const row = await prisma.bonApprovisionnement.create({
      data: {
        reference,
        utilisateur: auth.user.name,
        commercial: s(body.commercial) || auth.user.name,
        vehicule: s(body.vehicule) || mission?.vehicule || null,
        depot: s(body.depot) || null,
        dayId: mission?.id ?? null,
        observation: s(body.observation) || null,
        etat: "Demandé",
        lignes: {
          create: lignes.map((l: { refArt: string; qteDemandee: number }) => ({
            refArt: l.refArt,
            designation: parRef.get(l.refArt) ?? null,
            qteDemandee: round3(l.qteDemandee),
          })),
        },
      },
      include: { lignes: true },
    });

    return NextResponse.json({
      ok: true, row, alertes,
      message: `Bon ${reference} créé — ${lignes.length} article(s) demandé(s)`,
    });
  }

  // Service de la demande : c'est ici que le stock bouge réellement.
  if (vue === "servir") {
    const auth2 = await requireSession(["ADMIN", "MANAGER"]);
    if (!auth2.ok) return auth2.res;

    const id = int(body.id);
    if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

    const bon = await prisma.bonApprovisionnement.findUnique({
      where: { id }, include: { lignes: true },
    });
    if (!bon) return NextResponse.json({ error: "Bon introuvable" }, { status: 404 });
    if (bon.etat !== "Demandé") {
      return NextResponse.json(
        { error: `Bon déjà ${bon.etat.toLowerCase()} — le stock a déjà bougé` },
        { status: 409 }
      );
    }

    const depot = s(body.depot) || bon.depot;
    const vehicule = s(body.vehicule) || bon.vehicule;
    if (!depot || !vehicule) {
      return NextResponse.json({ error: "Dépôt source et véhicule destination requis" }, { status: 400 });
    }

    // Quantités servies : celles fournies, sinon la totalité du demandé.
    const servies: Record<string, number> = {};
    if (Array.isArray(body.lignes)) {
      for (const l of body.lignes as Record<string, unknown>[]) {
        const r = s(l.refArt);
        if (r) servies[r] = num(l.qteServie);
      }
    }
    const aServir = bon.lignes
      .map((l) => ({
        refArt: l.refArt,
        designation: l.designation,
        quantite: round3(servies[l.refArt] ?? l.qteDemandee),
      }))
      .filter((l) => l.quantite > 0);

    if (aServir.length === 0) {
      return NextResponse.json({ error: "Aucune quantité à servir" }, { status: 400 });
    }

    // Bon de sortie dépôt → véhicule : c'est lui qui déplace le stock, avec
    // ses garde-fous (stock insuffisant refusé, tout transactionnel).
    const mvt = await creerMouvement("BST", depot, vehicule, aServir, auth2.user.name);
    if (!mvt.ok) return NextResponse.json({ error: mvt.message }, { status: 409 });

    await prisma.$transaction([
      ...aServir.map((l) =>
        prisma.bonApproLigne.updateMany({
          where: { bonId: id, refArt: l.refArt },
          data: { qteServie: l.quantite },
        })
      ),
      prisma.bonApprovisionnement.update({
        where: { id },
        data: {
          etat: "Servi", dateService: new Date(),
          depot, vehicule, refMouvement: mvt.refDoc ?? null,
        },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      refMouvement: mvt.refDoc,
      alertes: mvt.alertes ?? [],
      message: `${bon.reference} servi — bon de sortie ${mvt.refDoc} généré`,
    });
  }

  if (vue === "refuser") {
    const auth2 = await requireSession(["ADMIN", "MANAGER"]);
    if (!auth2.ok) return auth2.res;

    const id = int(body.id);
    if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
    const bon = await prisma.bonApprovisionnement.findUnique({ where: { id }, select: { etat: true, reference: true } });
    if (!bon) return NextResponse.json({ error: "Bon introuvable" }, { status: 404 });
    if (bon.etat === "Servi") {
      return NextResponse.json({ error: "Bon déjà servi — le stock a bougé" }, { status: 409 });
    }

    await prisma.bonApprovisionnement.update({
      where: { id },
      data: { etat: "Refusé", observation: s(body.observation) || null },
    });
    return NextResponse.json({ ok: true, message: `${bon.reference} refusé` });
  }

  return NextResponse.json({ error: `Vue inconnue : ${vue}` }, { status: 400 });
}

export async function PUT(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER", "COMMERCIAL"]);
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => ({}));
  const id = int(body.id);
  const refArt = s(body.refArt);
  if (!id || !refArt) return NextResponse.json({ error: "id et refArt requis" }, { status: 400 });

  const bon = await prisma.bonApprovisionnement.findUnique({
    where: { id }, select: { etat: true, utilisateur: true },
  });
  if (!bon) return NextResponse.json({ error: "Bon introuvable" }, { status: 404 });
  if (bon.etat !== "Demandé") {
    return NextResponse.json({ error: `Bon ${bon.etat.toLowerCase()} — non modifiable` }, { status: 409 });
  }
  if (auth.user.role === "COMMERCIAL" && bon.utilisateur !== auth.user.name) {
    return NextResponse.json({ error: "Bon d'un autre commercial" }, { status: 403 });
  }

  const qte = num(body.qteDemandee);
  if (qte <= 0) {
    await prisma.bonApproLigne.deleteMany({ where: { bonId: id, refArt } });
    return NextResponse.json({ ok: true, supprime: true, message: "Ligne retirée" });
  }

  await prisma.bonApproLigne.updateMany({
    where: { bonId: id, refArt }, data: { qteDemandee: round3(qte) },
  });
  return NextResponse.json({ ok: true, message: "Quantité mise à jour" });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER", "COMMERCIAL"]);
  if (!auth.ok) return auth.res;

  const id = int(req.nextUrl.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  const bon = await prisma.bonApprovisionnement.findUnique({
    where: { id }, select: { etat: true, utilisateur: true, reference: true },
  });
  if (!bon) return NextResponse.json({ error: "Bon introuvable" }, { status: 404 });
  // Un bon servi justifie un mouvement de stock : il ne s'efface pas.
  if (bon.etat === "Servi") {
    return NextResponse.json(
      { error: `${bon.reference} est servi — il justifie un bon de sortie et ne peut pas être supprimé` },
      { status: 409 }
    );
  }
  if (auth.user.role === "COMMERCIAL" && bon.utilisateur !== auth.user.name) {
    return NextResponse.json({ error: "Bon d'un autre commercial" }, { status: 403 });
  }

  await prisma.bonApprovisionnement.delete({ where: { id } });
  return NextResponse.json({ ok: true, message: `${bon.reference} supprimé` });
}
