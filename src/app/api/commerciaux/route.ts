import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { TYPES_CA, signeCA, periode, round3, MOIS_COURTS } from "@/lib/vente-stats";
import { cleCommercial } from "@/lib/perimetre-commercial";

// Fiches commerciales.
//
// GET /api/commerciaux                      -> liste des commerciaux + CA
// GET /api/commerciaux?vendeur=NOM&du=&au=  -> fiche détaillée d'un commercial
//
// Le « vendeur » d'un document est `commercial` s'il est renseigné, sinon
// `utilisateur` : c'est la clé utilisée par les objectifs et les rapports.

const vendeurDe = (d: { commercial: string | null; utilisateur: string | null }) =>
  d.commercial?.trim() || d.utilisateur?.trim() || "";

/**
 * Deux noms de famille désignent-ils la même personne mal orthographiée ?
 *
 * « cheli » / « chelly » diffèrent d'un caractère : c'est une faute de saisie,
 * pas deux commerciaux. Au-delà, on considère des personnes différentes.
 */
function proches(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 2) return false;
  // Distance de Levenshtein, bornée : les noms sont courts.
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  // Tolérance proportionnelle à la longueur : « cheli » / « chelly » sont à
  // distance 2 pour 6 lettres — une même personne saisie de deux façons —
  // alors que « lajmi » / « rekik » sont à distance 5 : deux personnes.
  const max = Math.max(a.length, b.length);
  return d[a.length][b.length] <= Math.max(1, Math.floor(max / 3));
}

/** Nom complet normalisé : sans accents, sans casse, espaces resserrés. */
const cleNom = (v: string) =>
  v.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Clé de regroupement d'un vendeur.
 *
 * Un même commercial est écrit de plusieurs façons dans les documents
 * (« MOKHTAR », « mokhtar trabelsi », « Mokhtar Trabelsi ») : sans
 * regroupement, son chiffre d'affaires est réparti sur trois lignes.
 *
 * Le rapprochement se fait sur le **prénom**, mais seulement lorsqu'il ne
 * désigne qu'une personne : « HENI LAJMI » et « heni rekik » sont deux
 * commerciaux distincts, les fusionner serait pire que de les séparer. Les
 * prénoms ambigus gardent donc leur nom complet comme clé.
 */
function cleVendeur(nom: string, prenomsAmbigus: Set<string>): string {
  const complet = cleNom(nom);
  const prenom = complet.split(" ")[0] ?? "";
  if (!prenom) return complet;
  return prenomsAmbigus.has(prenom) ? complet : prenom;
}

/**
 * Prénoms portés par plusieurs personnes distinctes. Deux graphies d'un même
 * nom (« aziz cheli » / « aziz chelly ») ne rendent pas le prénom ambigu :
 * seules comptent les variantes dont le nom de famille diffère vraiment.
 */
function prenomsAmbigus(noms: Iterable<string>): Set<string> {
  const parPrenom = new Map<string, Set<string>>();
  for (const n of noms) {
    const complet = cleNom(n);
    const [prenom, ...reste] = complet.split(" ");
    if (!prenom) continue;
    const famille = reste.join(" ");
    // Un prénom seul (« MOKHTAR ») ne distingue personne : on ne le compte pas.
    if (!famille) continue;
    const set = parPrenom.get(prenom) ?? new Set<string>();
    set.add(famille);
    parPrenom.set(prenom, set);
  }
  const ambigus = new Set<string>();
  for (const [prenom, familles] of parPrenom) {
    // Familles proches (« cheli » / « chelly ») : même personne mal saisie.
    // Un simple préfixe ne suffit pas — la faute peut être au milieu du mot —
    // d'où la comparaison par distance d'édition.
    const distinctes = [...familles].filter(
      (f, i, arr) => !arr.some((g, j) => j < i && proches(f, g)),
    );
    if (distinctes.length > 1) ambigus.add(prenom);
  }
  return ambigus;
}

export async function GET(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.res;

  const sp = req.nextUrl.searchParams;
  const vendeur = sp.get("vendeur")?.trim();
  const { debut, fin } = periode(sp.get("du"), sp.get("au"));

  const [docs, comptes] = await Promise.all([
    prisma.erpDocument.findMany({
      where: { nature: "Vente", typeDoc: { in: [...TYPES_CA] }, dateDoc: { gte: debut, lte: fin } },
      select: {
        refDoc: true, typeDoc: true, ttcNet: true, thtNet: true, soldeDoc: true,
        dateDoc: true, commercial: true, utilisateur: true,
        codeCli: true, raisonSocial: true,
      },
    }),
    // Beaucoup de documents ne portent pas de commercial : le vendeur est
    // alors l'`utilisateur`, c'est-à-dire un **login** (« heni », « aziz »).
    // Rapprocher ce login de son compte donne le nom complet, sans quoi
    // 613 tickets de Heni Rekik restent sous une ligne « heni » séparée.
    prisma.user.findMany({ select: { login: true, name: true } }),
  ]);

  const parLogin = new Map(comptes.map((u) => [u.login.trim().toLowerCase(), u.name.trim()]));
  /** Nom complet du vendeur : le libellé du document, ou le compte derrière le login. */
  const nomVendeur = (d: { commercial: string | null; utilisateur: string | null }) => {
    const brut = vendeurDe(d);
    return brut ? (parLogin.get(brut.toLowerCase()) ?? brut) : "";
  };

  // ---- Liste : un agrégat par vendeur --------------------------------------
  if (!vendeur) {
    // Un même commercial est écrit de plusieurs façons dans les documents
    // (« MOKHTAR », « mokhtar trabelsi », « Mokhtar Trabelsi ») : regrouper sur
    // la chaîne brute en faisait trois vendeurs distincts et coupait son
    // chiffre d'affaires en trois. Le regroupement se fait donc sur la clé
    // commerciale (prénom normalisé), comme partout ailleurs dans le projet.
    const ambigus = prenomsAmbigus(docs.map(nomVendeur).filter(Boolean));
    const parVendeur = new Map<string, { nom: string; ca: number; docs: number; clients: Set<number>; impaye: number }>();
    for (const d of docs) {
      const v = nomVendeur(d);
      if (!v) continue;
      const cle = cleVendeur(v, ambigus);
      const cur = parVendeur.get(cle) ?? { nom: v, ca: 0, docs: 0, clients: new Set<number>(), impaye: 0 };
      // Nom affiché : la graphie la plus complète rencontrée (« Mokhtar
      // Trabelsi » plutôt que « MOKHTAR »).
      if (v.length > cur.nom.length) cur.nom = v;
      cur.ca += signeCA(d.typeDoc) * d.ttcNet;
      cur.docs += 1;
      cur.impaye += d.soldeDoc > 0 ? d.soldeDoc : 0;
      if (d.codeCli != null) cur.clients.add(d.codeCli);
      parVendeur.set(cle, cur);
    }

    const rows = [...parVendeur.values()]
      .map((s) => ({
        vendeur: s.nom, ca: round3(s.ca), docs: s.docs,
        clients: s.clients.size, impaye: round3(s.impaye),
      }))
      .sort((a, b) => b.ca - a.ca);

    return NextResponse.json({
      periode: { du: debut, au: fin },
      rows,
      total: rows.length,
      totalCA: round3(rows.reduce((s, r) => s + r.ca, 0)),
    });
  }

  // ---- Fiche : activité détaillée d'un vendeur -----------------------------
  // La fiche rassemble toutes les graphies du même commercial, sinon elle
  // n'affiche qu'une partie de son activité.
  const ambigusFiche = prenomsAmbigus(docs.map(nomVendeur).filter(Boolean));
  // La fiche peut être demandée sous le nom complet comme sous le login.
  const cleFiche = cleVendeur(parLogin.get(vendeur.toLowerCase()) ?? vendeur, ambigusFiche);
  const siens = docs.filter((d) => {
    const v = nomVendeur(d);
    return v ? cleVendeur(v, ambigusFiche) === cleFiche : false;
  });

  let ca = 0;
  let impaye = 0;
  const clients = new Map<number, { nom: string; ca: number; docs: number }>();
  const parMois = new Map<string, { mois: string; ca: number; docs: number }>();
  const parType = new Map<string, { type: string; count: number; total: number }>();

  for (const d of siens) {
    const montant = signeCA(d.typeDoc) * d.ttcNet;
    ca += montant;
    impaye += d.soldeDoc > 0 ? d.soldeDoc : 0;

    if (d.codeCli != null) {
      const c = clients.get(d.codeCli) ?? { nom: d.raisonSocial ?? `#${d.codeCli}`, ca: 0, docs: 0 };
      c.ca += montant;
      c.docs += 1;
      clients.set(d.codeCli, c);
    }

    if (d.dateDoc) {
      const cle = `${d.dateDoc.getFullYear()}-${String(d.dateDoc.getMonth() + 1).padStart(2, "0")}`;
      const m = parMois.get(cle) ?? { mois: `${MOIS_COURTS[d.dateDoc.getMonth()]} ${String(d.dateDoc.getFullYear()).slice(2)}`, ca: 0, docs: 0 };
      m.ca += montant;
      m.docs += 1;
      parMois.set(cle, m);
    }

    const t = parType.get(d.typeDoc) ?? { type: d.typeDoc, count: 0, total: 0 };
    t.count += 1;
    t.total += d.ttcNet;
    parType.set(d.typeDoc, t);
  }

  // Objectifs fixés sur la période, pour situer le réalisé.
  const objectifs = await prisma.objectif.findMany({
    where: {
      vendeur,
      OR: monthsBetween(debut, fin).map(({ mois, annee }) => ({ mois, annee })),
    },
  });
  const objectifCA = objectifs.reduce((s, o) => s + o.objectifCA, 0);

  const topClients = [...clients.entries()]
    .map(([codeCli, c]) => ({ codeCli, nom: c.nom, ca: round3(c.ca), docs: c.docs }))
    .sort((a, b) => b.ca - a.ca)
    .slice(0, 10);

  const derniers = siens
    .filter((d) => d.dateDoc)
    .sort((a, b) => b.dateDoc!.getTime() - a.dateDoc!.getTime())
    .slice(0, 15)
    .map((d) => ({
      refDoc: d.refDoc, typeDoc: d.typeDoc, dateDoc: d.dateDoc,
      raisonSocial: d.raisonSocial, ttcNet: round3(d.ttcNet), soldeDoc: round3(d.soldeDoc),
    }));

  return NextResponse.json({
    vendeur,
    periode: { du: debut, au: fin },
    kpis: {
      ca: round3(ca),
      docs: siens.length,
      clients: clients.size,
      impaye: round3(impaye),
      panierMoyen: siens.length ? round3(ca / siens.length) : 0,
      objectifCA: round3(objectifCA),
      tauxObjectif: objectifCA > 0 ? round3((ca / objectifCA) * 100) : null,
    },
    serie: [...parMois.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, m]) => ({ ...m, ca: round3(m.ca) })),
    parType: [...parType.values()].map((t) => ({ ...t, total: round3(t.total) })).sort((a, b) => b.total - a.total),
    topClients,
    derniers,
  });
}

/** Liste des couples (mois, année) couverts par la période. */
function monthsBetween(debut: Date, fin: Date): { mois: number; annee: number }[] {
  const out: { mois: number; annee: number }[] = [];
  const cur = new Date(debut.getFullYear(), debut.getMonth(), 1);
  while (cur <= fin) {
    out.push({ mois: cur.getMonth() + 1, annee: cur.getFullYear() });
    cur.setMonth(cur.getMonth() + 1);
  }
  return out;
}

/**
 * Transfert de portefeuille — réaffecte des clients d'un commercial à un autre.
 *
 * POST /api/commerciaux
 *   { vue: "transfert", source, cible, codes?: number[] }
 *
 * Sans `codes`, tout le portefeuille de `source` est transféré ; sinon
 * seulement les clients listés. Réservé à l'ADMIN : c'est une décision
 * d'organisation commerciale, pas une opération de terrain.
 *
 * Seul `Partner.commercial` est modifié. L'historique des ventes reste attaché
 * au commercial qui les a réalisées : réécrire les documents fausserait le CA
 * par vendeur et les commissions déjà calculées.
 */
export async function POST(req: NextRequest) {
  const auth = await requireSession(["ADMIN"]);
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => ({}));
  if (String(body?.vue ?? "") !== "transfert") {
    return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
  }

  const source = String(body?.source ?? "").trim();
  const cible = String(body?.cible ?? "").trim();
  if (!source || !cible) {
    return NextResponse.json({ error: "Commercial source et cible requis" }, { status: 400 });
  }
  if (cleCommercial(source) === cleCommercial(cible)) {
    return NextResponse.json({ error: "Source et cible sont le même commercial" }, { status: 400 });
  }

  const codes = Array.isArray(body?.codes)
    ? body.codes.map((c: unknown) => Number(c)).filter((c: number) => Number.isFinite(c))
    : null;

  // Rapprochement sur le prénom : `Partner.commercial` n'est pas normalisé.
  const where = {
    nature: "C",
    archiver: 0,
    commercial: { startsWith: cleCommercial(source), mode: "insensitive" as const },
    ...(codes && codes.length ? { id: { in: codes } } : {}),
  };

  const concernes = await prisma.partner.count({ where });
  if (concernes === 0) {
    return NextResponse.json(
      { error: `Aucun client à transférer depuis « ${source} »` },
      { status: 404 },
    );
  }

  const res = await prisma.partner.updateMany({ where, data: { commercial: cible } });

  return NextResponse.json({
    ok: true,
    transferes: res.count,
    source,
    cible,
    message: `${res.count} client(s) transféré(s) de « ${source} » vers « ${cible} »`,
  });
}
