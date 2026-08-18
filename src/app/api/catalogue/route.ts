import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { cleCommercial, emplacementVehicule } from "@/lib/perimetre-commercial";

// Catalogue articles pour les écrans commerciaux / client.
//
// GET /api/catalogue?search=&famille=&enStock=1&limit=
//
// Ne remonte que les articles vendables et non archivés, comme le catalogue de A.
//
// Pour un COMMERCIAL, le stock affiché est celui de son **camion**, pas le
// stock global de la société : il ne peut vendre que ce qu'il a chargé. Voir
// aussi `document-validation.ts`, qui décrémente le même emplacement.

export async function GET(req: NextRequest) {
  const auth = await requireSession();
  if (!auth.ok) return auth.res;

  const sp = req.nextUrl.searchParams;
  const search = (sp.get("search") ?? "").trim();
  // Les articles importés portent un code famille numérique sans table de
  // libellés : on filtre donc sur la disponibilité, pas sur un nom de famille.
  const dispo = sp.get("dispo") ?? "toutes"; // toutes | stock | rupture
  const limit = Math.min(500, Math.max(1, parseInt(sp.get("limit") ?? "120", 10)));

  // Camion du commercial connecté : le stock affiché en découle.
  let emplacement: string | null = null;
  if (auth.user.role === "COMMERCIAL") {
    const jour = new Date();
    jour.setHours(0, 0, 0, 0);
    const mission = await prisma.erpMission.findFirst({
      where: {
        commercial: { startsWith: cleCommercial(auth.user.name), mode: "insensitive" },
        dateOrdre: { gte: jour, lt: new Date(jour.getTime() + 86_400_000) },
        etat: { notIn: ["Annulée"] },
      },
      select: { vehicule: true },
      orderBy: { id: "desc" },
    });
    emplacement = await emplacementVehicule(auth.user.name, mission?.vehicule);
  }

  // ── Vue commerciale : le catalogue se limite au contenu du camion ──
  if (emplacement) {
    const [enCamion, panier] = await Promise.all([
      prisma.stockDepot.findMany({
        where: { emplacement },
        select: { refArt: true, quantite: true },
      }),
      // Ce qui est déjà dans le panier est réservé : ces unités ne sont plus
      // disponibles à la vente tant que le ticket n'est pas émis. Sans cette
      // déduction, le commercial voit 11 à bord alors qu'il en a déjà mis 5
      // de côté, et croit pouvoir en vendre 11 de plus.
      prisma.panier.findFirst({
        where: { utilisateur: auth.user.name, etat: "Ouvert" },
        include: { lignes: { select: { refArt: true, qte: true } } },
        orderBy: { id: "desc" },
      }),
    ]);

    const reserve = new Map<string, number>();
    for (const l of panier?.lignes ?? []) {
      reserve.set(l.refArt, (reserve.get(l.refArt) ?? 0) + l.qte);
    }

    const qteParRef = new Map(
      enCamion.map((r) => [
        r.refArt,
        Math.round((r.quantite - (reserve.get(r.refArt) ?? 0)) * 1000) / 1000,
      ]),
    );

    const refsFiltrees = [...qteParRef.entries()]
      .filter(([, q]) => (dispo === "stock" ? q > 0 : dispo === "rupture" ? q <= 0 : true))
      .map(([ref]) => ref);

    const whereCamion = {
      archiver: 0,
      vendable: 1,
      refArt: { in: refsFiltrees },
      ...(search
        ? {
            OR: [
              { designation: { contains: search, mode: "insensitive" as const } },
              { refArt: { contains: search, mode: "insensitive" as const } },
              { codeBarre: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.article.findMany({
        where: whereCamion,
        orderBy: { designation: "asc" },
        take: limit,
        select: {
          refArt: true, codeBarre: true, designation: true, catalogue: true,
          unite: true, enStock: true, stMin: true,
          tarif1Ht: true, tauxTva: true, puAchat: true, pmp: true,
        },
      }),
      prisma.article.count({ where: whereCamion }),
    ]);

    const dansCamion = new Map(enCamion.map((r) => [r.refArt, r.quantite]));

    const withTtc = rows.map((a) => ({
      ...a,
      // `enStock` = disponible à la vente : ce qui reste à bord une fois
      // déduit ce que le commercial a déjà mis au panier.
      enStock: qteParRef.get(a.refArt) ?? 0,
      // Quantité physiquement chargée, panier compris (borne du sélecteur).
      stockCamion: dansCamion.get(a.refArt) ?? 0,
      stockGlobal: a.enStock,
      prixTtc: Math.round((a.tarif1Ht * (1 + a.tauxTva / 100) + Number.EPSILON) * 1000) / 1000,
    }));

    return NextResponse.json({
      rows: withTtc,
      total,
      nbEnStock: [...qteParRef.values()].filter((q) => q > 0).length,
      emplacement,
    });
  }

  const where = {
    archiver: 0,
    vendable: 1,
    ...(dispo === "stock" ? { enStock: { gt: 0 } } : dispo === "rupture" ? { enStock: { lte: 0 } } : {}),
    ...(search
      ? {
          OR: [
            { designation: { contains: search, mode: "insensitive" as const } },
            { refArt: { contains: search, mode: "insensitive" as const } },
            { codeBarre: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [rows, total, nbEnStock] = await Promise.all([
    prisma.article.findMany({
      where,
      orderBy: { designation: "asc" },
      take: limit,
      select: {
        refArt: true, codeBarre: true, designation: true, catalogue: true,
        unite: true, enStock: true, stMin: true,
        tarif1Ht: true, tauxTva: true, puAchat: true, pmp: true,
      },
    }),
    prisma.article.count({ where }),
    prisma.article.count({ where: { archiver: 0, vendable: 1, enStock: { gt: 0 } } }),
  ]);

  // Prix TTC calculé depuis le tarif HT et le taux de TVA de l'article.
  const withTtc = rows.map((a) => ({
    ...a,
    prixTtc: Math.round((a.tarif1Ht * (1 + a.tauxTva / 100) + Number.EPSILON) * 1000) / 1000,
  }));

  return NextResponse.json({ rows: withTtc, total, nbEnStock });
}
