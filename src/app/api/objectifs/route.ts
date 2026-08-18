import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { TYPES_CA, signeCA, round3 } from "@/lib/vente-stats";

// Objectifs commerciaux mensuels.
//
// GET /api/objectifs?mois=&annee=  -> objectif + réalisé par vendeur
// PUT /api/objectifs { vendeur, mois, annee, objectifCA }
//
// Le réalisé est calculé depuis les documents de vente ; l'objectif est saisi
// par le manager et stocké en base (modèle `Objectif`).

/** Le vendeur d'un document : `commercial` si présent, sinon `utilisateur`. */
const vendeurDe = (d: { commercial: string | null; utilisateur: string | null }) =>
  d.commercial?.trim() || d.utilisateur?.trim() || "";

export async function GET(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER", "COMMERCIAL"]);
  if (!auth.ok) return auth.res;

  const sp = req.nextUrl.searchParams;
  const now = new Date();

  // Sans mois explicite, on se cale sur le dernier mois ayant des ventes : la
  // base ERP est un import figé et le mois courant y est souvent vide — un
  // écran d'objectifs entièrement vide ne dit rien au manager.
  let mois: number;
  let annee: number;
  if (sp.get("mois") && sp.get("annee")) {
    mois = parseInt(sp.get("mois")!, 10);
    annee = parseInt(sp.get("annee")!, 10);
  } else {
    const dernier = await prisma.erpDocument.findFirst({
      where: { nature: "Vente", typeDoc: { in: [...TYPES_CA] }, dateDoc: { not: null } },
      orderBy: { dateDoc: "desc" },
      select: { dateDoc: true },
    });
    const ref = dernier?.dateDoc ?? now;
    mois = ref.getMonth() + 1;
    annee = ref.getFullYear();
  }

  const debut = new Date(annee, mois - 1, 1, 0, 0, 0, 0);
  const fin = new Date(annee, mois, 0, 23, 59, 59, 999);

  const [docs, objectifs] = await Promise.all([
    prisma.erpDocument.findMany({
      where: { nature: "Vente", typeDoc: { in: [...TYPES_CA] }, dateDoc: { gte: debut, lte: fin } },
      select: { typeDoc: true, ttcNet: true, commercial: true, utilisateur: true, codeCli: true },
    }),
    prisma.objectif.findMany({ where: { mois, annee } }),
  ]);

  // Réalisé par vendeur sur le mois.
  const realise = new Map<string, { ca: number; docs: number; clients: Set<number> }>();
  for (const d of docs) {
    const v = vendeurDe(d);
    if (!v) continue;
    const cur = realise.get(v) ?? { ca: 0, docs: 0, clients: new Set<number>() };
    cur.ca = round3(cur.ca + signeCA(d.typeDoc) * d.ttcNet);
    cur.docs += 1;
    if (d.codeCli != null) cur.clients.add(d.codeCli);
    realise.set(v, cur);
  }

  const parVendeur = new Map(objectifs.map((o) => [o.vendeur, o.objectifCA]));

  // Union des vendeurs actifs sur la période et de ceux ayant un objectif fixé.
  const noms = new Set<string>([...realise.keys(), ...parVendeur.keys()]);

  const rows = [...noms].map((vendeur) => {
    const r = realise.get(vendeur);
    const objectifCA = parVendeur.get(vendeur) ?? 0;
    const ca = r?.ca ?? 0;
    return {
      vendeur,
      objectifCA,
      ca,
      docs: r?.docs ?? 0,
      clients: r?.clients.size ?? 0,
      // Sans objectif fixé, le pourcentage n'a pas de sens : on renvoie null.
      pct: objectifCA > 0 ? Math.round((ca / objectifCA) * 100) : null,
      ecart: objectifCA > 0 ? round3(ca - objectifCA) : null,
    };
  }).sort((a, b) => b.ca - a.ca);

  return NextResponse.json({
    mois, annee, rows,
    totalCA: round3(rows.reduce((s, r) => s + r.ca, 0)),
    totalObjectif: round3(rows.reduce((s, r) => s + r.objectifCA, 0)),
    sansObjectif: rows.filter((r) => r.objectifCA <= 0).length,
  });
}

export async function PUT(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => ({}));
  const vendeur = String(body?.vendeur ?? "").trim();
  const mois = parseInt(String(body?.mois ?? ""), 10);
  const annee = parseInt(String(body?.annee ?? ""), 10);
  const objectifCA = Number(body?.objectifCA);

  if (!vendeur) return NextResponse.json({ error: "Vendeur requis" }, { status: 400 });
  if (!Number.isFinite(mois) || mois < 1 || mois > 12) {
    return NextResponse.json({ error: "Mois invalide" }, { status: 400 });
  }
  if (!Number.isFinite(annee)) return NextResponse.json({ error: "Année invalide" }, { status: 400 });
  if (!Number.isFinite(objectifCA) || objectifCA < 0) {
    return NextResponse.json({ error: "Objectif invalide" }, { status: 400 });
  }

  const row = await prisma.objectif.upsert({
    where: { vendeur_mois_annee: { vendeur, mois, annee } },
    create: { vendeur, mois, annee, objectifCA: round3(objectifCA) },
    update: { objectifCA: round3(objectifCA) },
  });

  return NextResponse.json({ ok: true, row, message: `Objectif de ${vendeur} enregistré` });
}
