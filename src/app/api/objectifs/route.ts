import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { TYPES_CA, signeCA, round3 } from "@/lib/vente-stats";
import { rapprocheur } from "@/lib/objectifs-vendeurs";

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
  // `mois=0` demande l'année entière : les douze mois sont cumulés, ce qui
  // permet de suivre un objectif annuel sans additionner à la main.
  const annuel = sp.get("mois") === "0";

  let mois: number;
  let annee: number;
  if (annuel) {
    mois = 0;
    annee = parseInt(sp.get("annee") ?? String(now.getFullYear()), 10);
  } else if (sp.get("mois") && sp.get("annee")) {
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

  const debut = annuel
    ? new Date(annee, 0, 1, 0, 0, 0, 0)
    : new Date(annee, mois - 1, 1, 0, 0, 0, 0);
  const fin = annuel
    ? new Date(annee, 11, 31, 23, 59, 59, 999)
    : new Date(annee, mois, 0, 23, 59, 59, 999);

  const [docs, objectifs] = await Promise.all([
    prisma.erpDocument.findMany({
      where: { nature: "Vente", typeDoc: { in: [...TYPES_CA] }, dateDoc: { gte: debut, lte: fin } },
      select: { typeDoc: true, ttcNet: true, commercial: true, utilisateur: true, codeCli: true },
    }),
    // En vue annuelle, les douze objectifs mensuels d'un vendeur se cumulent.
    prisma.objectif.findMany({ where: annuel ? { annee } : { mois, annee } }),
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

  // Le nom d'un vendeur n'a pas la même forme des deux côtés : les objectifs
  // portent « FOUED », « sihem », « MOKHTAR » là où les documents portent
  // « Foued Fakhfekh », « SIHEM HARABI », « mokhtar trabelsi ». Un rapprochement
  // sur le nom brut ne trouvait donc que « HENI LAJMI », identique par hasard :
  // sept vendeurs sur huit s'affichaient à 0 % alors que leur objectif existait.
  //
  // On regroupe donc par prénom normalisé (`cleCommercial`), la clé déjà
  // utilisée par le périmètre commercial et le filtre des tickets.
  // Rapprochement des deux écritures d'un même vendeur — voir
  // `src/lib/objectifs-vendeurs.ts` pour le détail des cas.
  const canon = rapprocheur([...realise.keys()], objectifs.map((o) => o.vendeur));

  const parCle = new Map<string, number>();
  for (const o of objectifs) {
    const cle = canon(o.vendeur);
    if (!cle) continue;
    parCle.set(cle, (parCle.get(cle) ?? 0) + o.objectifCA);
  }

  // Réalisé regroupé sur la même clé, en retenant le libellé le plus complet
  // pour l'affichage (« mokhtar trabelsi » plutôt que « MOKHTAR »).
  const parCleRealise = new Map<string, { ca: number; docs: number; clients: Set<number>; libelle: string }>();
  for (const [nom, r] of realise) {
    const cle = canon(nom);
    if (!cle) continue;
    const cur = parCleRealise.get(cle);
    if (cur) {
      cur.ca = round3(cur.ca + r.ca);
      cur.docs += r.docs;
      for (const c of r.clients) cur.clients.add(c);
      if (nom.length > cur.libelle.length) cur.libelle = nom;
    } else {
      parCleRealise.set(cle, { ca: r.ca, docs: r.docs, clients: new Set(r.clients), libelle: nom });
    }
  }

  // Union des vendeurs actifs sur la période et de ceux ayant un objectif fixé.
  const cles = new Set<string>([...parCleRealise.keys(), ...parCle.keys()]);
  // Libellé de repli pour un objectif sans vente sur le mois.
  const libelleObjectif = new Map<string, string>();
  for (const o of objectifs) {
    const cle = canon(o.vendeur);
    const vu = libelleObjectif.get(cle);
    if (!vu || o.vendeur.length > vu.length) libelleObjectif.set(cle, o.vendeur);
  }

  const rows = [...cles].map((cle) => {
    const r = parCleRealise.get(cle);
    const objectifCA = parCle.get(cle) ?? 0;
    const ca = r?.ca ?? 0;
    return {
      vendeur: r?.libelle ?? libelleObjectif.get(cle) ?? cle,
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
    mois, annee, annuel, rows,
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

/**
 * Répartit un objectif global entre les vendeurs.
 *
 * POST /api/objectifs
 *   { total, mois, annee, mode?: "performance" | "egale", vendeurs?: string[] }
 *
 * Deux clés de répartition, parce qu'aucune ne convient à tous les cas :
 *
 *  - `performance` (défaut) : au prorata du chiffre déjà réalisé sur la période.
 *    C'est la règle usuelle — on demande davantage à qui vend davantage, et un
 *    vendeur ne se voit pas assigner un objectif hors de portée de sa tournée.
 *  - `egale` : le même montant pour tous, utile en début d'exercice ou quand les
 *    secteurs viennent d'être redécoupés et que l'historique ne dit plus rien.
 *
 * En vue annuelle (`mois = 0`), le montant est ventilé sur les douze mois.
 */
export async function POST(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => ({}));
  const total = Number(body?.total);
  const mois = parseInt(String(body?.mois ?? ""), 10);
  const annee = parseInt(String(body?.annee ?? ""), 10);
  const mode = String(body?.mode ?? "performance") === "egale" ? "egale" : "performance";

  if (!Number.isFinite(total) || total <= 0) {
    return NextResponse.json({ error: "Montant total invalide" }, { status: 400 });
  }
  if (!Number.isFinite(mois) || mois < 0 || mois > 12) {
    return NextResponse.json({ error: "Mois invalide" }, { status: 400 });
  }
  if (!Number.isFinite(annee)) return NextResponse.json({ error: "Année invalide" }, { status: 400 });

  const annuel = mois === 0;
  const debut = annuel ? new Date(annee, 0, 1) : new Date(annee, mois - 1, 1);
  const fin = annuel
    ? new Date(annee, 11, 31, 23, 59, 59, 999)
    : new Date(annee, mois, 0, 23, 59, 59, 999);

  // Réalisé de la période : c'est lui qui donne le poids de chaque vendeur.
  const docs = await prisma.erpDocument.findMany({
    where: { nature: "Vente", typeDoc: { in: [...TYPES_CA] }, dateDoc: { gte: debut, lte: fin } },
    select: { typeDoc: true, ttcNet: true, commercial: true, utilisateur: true },
  });

  const realise = new Map<string, number>();
  for (const d of docs) {
    const v = vendeurDe(d);
    if (!v) continue;
    realise.set(v, round3((realise.get(v) ?? 0) + signeCA(d.typeDoc) * d.ttcNet));
  }

  // Le libellé le plus complet représente le vendeur (« mokhtar trabelsi »
  // plutôt que « MOKHTAR »), et les deux écritures se cumulent.
  const cle = rapprocheur([...realise.keys()], []);
  const parCle = new Map<string, { libelle: string; ca: number }>();
  for (const [nom, ca] of realise) {
    const k = cle(nom);
    if (!k) continue;
    const cur = parCle.get(k);
    if (cur) {
      cur.ca = round3(cur.ca + ca);
      if (nom.length > cur.libelle.length) cur.libelle = nom;
    } else {
      parCle.set(k, { libelle: nom, ca });
    }
  }

  // Liste explicite si elle est fournie, sinon les vendeurs actifs sur la période.
  const demandes: string[] = Array.isArray(body?.vendeurs)
    ? body.vendeurs.map((v: unknown) => String(v).trim()).filter(Boolean)
    : [];
  const cibles = demandes.length
    ? demandes.map((v) => ({ libelle: v, ca: parCle.get(cle(v))?.ca ?? 0 }))
    : [...parCle.values()];

  if (cibles.length === 0) {
    return NextResponse.json(
      { error: "Aucun vendeur actif sur cette période — précisez la liste" },
      { status: 400 },
    );
  }

  const sommeCA = cibles.reduce((s, c) => s + Math.max(0, c.ca), 0);
  // Sans historique (ou en mode « egale »), on partage à parts égales : le
  // prorata n'aurait rien sur quoi s'appuyer.
  const auProrata = mode === "performance" && sommeCA > 0;

  const parts = cibles.map((c) => ({
    vendeur: c.libelle,
    part: auProrata ? Math.max(0, c.ca) / sommeCA : 1 / cibles.length,
  }));

  // L'arrondi au dinar ferait perdre quelques unités : le reliquat va au plus
  // gros contributeur, pour que la somme des parts égale exactement le total.
  const montants = parts.map((p) => ({ ...p, montant: Math.round(total * p.part) }));
  const ecart = Math.round(total) - montants.reduce((s, m) => s + m.montant, 0);
  if (ecart !== 0 && montants.length > 0) {
    const principal = montants.reduce((a, b) => (b.part > a.part ? b : a), montants[0]);
    principal.montant += ecart;
  }

  // En vue annuelle le montant se ventile sur les douze mois ; un objectif
  // annuel ne se compare pas à un réalisé mensuel.
  const moisCibles = annuel ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] : [mois];

  let ecrits = 0;
  for (const m of montants) {
    const parMois = annuel ? Math.round(m.montant / 12) : m.montant;
    for (const mo of moisCibles) {
      await prisma.objectif.upsert({
        where: { vendeur_mois_annee: { vendeur: m.vendeur, mois: mo, annee } },
        create: { vendeur: m.vendeur, mois: mo, annee, objectifCA: round3(parMois) },
        update: { objectifCA: round3(parMois) },
      });
      ecrits += 1;
    }
  }

  return NextResponse.json({
    ok: true,
    mode,
    annuel,
    repartition: montants.map((m) => ({
      vendeur: m.vendeur,
      montant: m.montant,
      part: Math.round(m.part * 1000) / 10,
    })),
    ecrits,
    message: `${round3(total)} TND répartis entre ${montants.length} vendeur(s)`,
  });
}
