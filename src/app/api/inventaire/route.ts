import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { round3 } from "@/lib/vente-stats";
import { creerInventaire, validerInventaire, ecartsInventaire } from "@/lib/inventaire";

// Inventaire physique — saisie du comptage, écarts, régularisation du stock.
//
// GET    /api/inventaire?vue=liste|detail|ecarts|articles|stats
// POST   /api/inventaire { vue: "inventaire"|"valider"|"ligne" }
// PUT    /api/inventaire { id, qteComptee }        (ligne d'un brouillon)
// DELETE /api/inventaire?vue=inventaire|ligne&id=…

const s = (v: unknown) => (v == null ? "" : String(v).trim());
const int = (v: unknown) => {
  const x = parseInt(String(v ?? ""), 10);
  return Number.isFinite(x) ? x : null;
};
const num = (v: unknown) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

export async function GET(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.res;

  const sp = req.nextUrl.searchParams;
  const vue = sp.get("vue") ?? "liste";

  if (vue === "liste") {
    const etat = s(sp.get("etat"));
    const where = etat && etat !== "Tous" ? { etat } : {};
    // 598 inventaires en historique : une liste plafonnée en cacherait les
    // deux tiers sans le dire. On pagine, et `total` reste le compte réel.
    const PAGE = 200;
    const page = Math.max(0, int(sp.get("page")) ?? 0);
    const [rows, total] = await Promise.all([
      prisma.inventaire.findMany({
        where,
        orderBy: { dateInv: "desc" },
        skip: page * PAGE, take: PAGE,
        include: { lignes: { select: { ecart: true, valeurEcart: true } } },
      }),
      prisma.inventaire.count({ where }),
    ]);
    return NextResponse.json({
      rows: rows.map((i) => {
        const ecarts = i.lignes.filter((l) => Math.abs(l.ecart) > 0.0001);
        return {
          id: i.id, reference: i.reference, libelle: i.libelle,
          emplacement: i.emplacement, dateInv: i.dateInv, etat: i.etat,
          utilisateur: i.utilisateur,
          nbLignes: i.lignes.length,
          nbEcarts: ecarts.length,
          valeurEcart: round3(ecarts.reduce((t, l) => t + l.valeurEcart, 0)),
        };
      }),
      total,
      page,
      pages: Math.ceil(total / PAGE),
      etats: ["Brouillon", "Validé"],
    });
  }

  if (vue === "detail" || vue === "ecarts") {
    const id = int(sp.get("id"));
    if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
    const inv = await prisma.inventaire.findUnique({ where: { id } });
    if (!inv) return NextResponse.json({ error: "Inventaire introuvable" }, { status: 404 });
    const e = await ecartsInventaire(id);
    return NextResponse.json({ inventaire: inv, ...e });
  }

  if (vue === "articles") {
    // Articles à compter, avec leur stock théorique — global ou par emplacement.
    const q = s(sp.get("q"));
    const emplacement = s(sp.get("emplacement"));

    if (emplacement) {
      const rows = await prisma.stockDepot.findMany({
        where: { emplacement, ...(q ? { refArt: { contains: q, mode: "insensitive" } } : {}) },
        orderBy: { refArt: "asc" },
        take: 300,
      });
      const refs = rows.map((r) => r.refArt);
      const arts = refs.length
        ? await prisma.article.findMany({
            where: { refArt: { in: refs } },
            select: { refArt: true, designation: true, unite: true, pmp: true, puAchat: true },
          })
        : [];
      const parRef = new Map(arts.map((a) => [a.refArt, a]));
      return NextResponse.json({
        rows: rows.map((r) => ({
          refArt: r.refArt,
          designation: parRef.get(r.refArt)?.designation ?? null,
          unite: parRef.get(r.refArt)?.unite ?? null,
          qteTheorique: r.quantite,
          pmp: parRef.get(r.refArt)?.pmp ?? 0,
        })),
        total: rows.length, emplacement,
      });
    }

    const rows = await prisma.article.findMany({
      where: {
        archiver: 0,
        ...(q
          ? {
              OR: [
                { refArt: { contains: q, mode: "insensitive" } },
                { designation: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      select: { refArt: true, designation: true, unite: true, enStock: true, pmp: true, puAchat: true },
      orderBy: { designation: "asc" },
      take: 300,
    });
    return NextResponse.json({
      rows: rows.map((a) => ({
        refArt: a.refArt, designation: a.designation, unite: a.unite,
        qteTheorique: a.enStock, pmp: a.pmp || a.puAchat,
      })),
      total: rows.length,
    });
  }

  // stats
  const [total, brouillons, valides] = await Promise.all([
    prisma.inventaire.count(),
    prisma.inventaire.count({ where: { etat: "Brouillon" } }),
    prisma.inventaire.count({ where: { etat: "Validé" } }),
  ]);
  const agg = await prisma.inventaireLigne.aggregate({ _sum: { valeurEcart: true } });
  return NextResponse.json({
    total, brouillons, valides,
    valeurEcartCumulee: round3(agg._sum.valeurEcart ?? 0),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => ({}));
  const vue = s(body.vue) || "inventaire";

  if (vue === "inventaire") {
    const lignes = Array.isArray(body.lignes)
      ? body.lignes.map((l: Record<string, unknown>) => ({
          refArt: s(l.refArt),
          qteComptee: num(l.qteComptee),
        }))
      : [];

    const res = await creerInventaire(lignes, {
      libelle: s(body.libelle) || undefined,
      emplacement: s(body.emplacement) || null,
      utilisateur: auth.user.name,
      observation: s(body.observation) || undefined,
    });
    return NextResponse.json(res, { status: res.ok ? 200 : 400 });
  }

  if (vue === "valider") {
    const id = int(body.id);
    if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
    const res = await validerInventaire(id, auth.user.name);
    // 409 sur un inventaire déjà validé : c'est un conflit d'état, pas une
    // requête malformée.
    const code = res.ok ? 200 : res.message.includes("déjà validé") ? 409 : 400;
    return NextResponse.json(res, { status: code });
  }

  if (vue === "ligne") {
    // Ajout d'une ligne à un brouillon.
    const inventaireId = int(body.inventaireId);
    const refArt = s(body.refArt);
    if (!inventaireId || !refArt) {
      return NextResponse.json({ error: "Inventaire et article requis" }, { status: 400 });
    }

    const inv = await prisma.inventaire.findUnique({ where: { id: inventaireId } });
    if (!inv) return NextResponse.json({ error: "Inventaire introuvable" }, { status: 404 });
    if (inv.etat === "Validé") {
      return NextResponse.json({ error: "Inventaire validé — non modifiable" }, { status: 409 });
    }

    const deja = await prisma.inventaireLigne.findUnique({
      where: { inventaireId_refArt: { inventaireId, refArt } },
    });
    if (deja) return NextResponse.json({ error: `${refArt} est déjà compté` }, { status: 409 });

    const art = await prisma.article.findUnique({
      where: { refArt },
      select: { designation: true, enStock: true, pmp: true, puAchat: true },
    });

    const qteTheorique = inv.emplacement
      ? (await prisma.stockDepot.findUnique({
          where: { refArt_emplacement: { refArt, emplacement: inv.emplacement } },
        }))?.quantite ?? 0
      : Number(art?.enStock ?? 0);

    const qteComptee = num(body.qteComptee);
    const ecart = round3(qteComptee - qteTheorique);
    const pmp = round3(Number(art?.pmp || art?.puAchat || 0));

    const row = await prisma.inventaireLigne.create({
      data: {
        inventaireId, refArt,
        designation: art?.designation ?? null,
        qteTheorique: round3(qteTheorique),
        qteComptee: round3(qteComptee),
        ecart, pmp,
        valeurEcart: round3(ecart * pmp),
      },
    });
    return NextResponse.json({ ok: true, row, message: `${refArt} ajouté` });
  }

  return NextResponse.json({ error: `Vue inconnue : ${vue}` }, { status: 400 });
}

export async function PUT(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => ({}));
  const id = int(body.id);
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  const ligne = await prisma.inventaireLigne.findUnique({
    where: { id },
    include: { inventaire: { select: { etat: true } } },
  });
  if (!ligne) return NextResponse.json({ error: "Ligne introuvable" }, { status: 404 });
  // Modifier un inventaire validé rendrait l'écart régularisé incohérent.
  if (ligne.inventaire.etat === "Validé") {
    return NextResponse.json({ error: "Inventaire validé — non modifiable" }, { status: 409 });
  }

  const qteComptee = round3(num(body.qteComptee));
  const ecart = round3(qteComptee - ligne.qteTheorique);

  const row = await prisma.inventaireLigne.update({
    where: { id },
    data: { qteComptee, ecart, valeurEcart: round3(ecart * ligne.pmp) },
  });
  return NextResponse.json({ ok: true, row, message: "Comptage modifié" });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.res;

  const sp = req.nextUrl.searchParams;
  const vue = s(sp.get("vue")) || "inventaire";
  const id = int(sp.get("id"));
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  if (vue === "inventaire") {
    const inv = await prisma.inventaire.findUnique({ where: { id }, select: { etat: true, reference: true } });
    if (!inv) return NextResponse.json({ error: "Inventaire introuvable" }, { status: 404 });
    // Un inventaire validé est la pièce justificative de la régularisation :
    // le supprimer laisserait un mouvement de stock sans explication.
    if (inv.etat === "Validé") {
      return NextResponse.json(
        { error: `${inv.reference} est validé — il justifie une régularisation de stock et ne peut pas être supprimé` },
        { status: 409 }
      );
    }
    await prisma.inventaire.delete({ where: { id } });
    return NextResponse.json({ ok: true, message: `${inv.reference} supprimé` });
  }

  if (vue === "ligne") {
    const ligne = await prisma.inventaireLigne.findUnique({
      where: { id },
      include: { inventaire: { select: { etat: true } } },
    });
    if (!ligne) return NextResponse.json({ error: "Ligne introuvable" }, { status: 404 });
    if (ligne.inventaire.etat === "Validé") {
      return NextResponse.json({ error: "Inventaire validé — non modifiable" }, { status: 409 });
    }
    await prisma.inventaireLigne.delete({ where: { id } });
    return NextResponse.json({ ok: true, message: "Ligne supprimée" });
  }

  return NextResponse.json({ error: `Vue inconnue : ${vue}` }, { status: 400 });
}
