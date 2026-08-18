import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { TYPES_CA, signeCA, periode, MOIS_COURTS, round3 } from "@/lib/vente-stats";

// Données des tableaux de bord, calculées depuis la base réelle.
//
// GET /api/dashboard?scope=admin|manager|commercial[&du=&au=]
//
// Remplace les tableaux codés en dur (`dummy-data.ts`) des pages
// admin / manager / commercial.

type DocRow = {
  typeDoc: string;
  ttcNet: number;
  thtNet: number;
  dateDoc: Date | null;
  codeCli: number | null;
  raisonSocial: string | null;
  commercial: string | null;
  utilisateur: string | null;
};

/**
 * Attribution d'un document à un vendeur.
 * Dans les données importées, `commercial` est vide sur la totalité des
 * documents ; c'est `utilisateur` qui porte l'information de saisie.
 */
const vendeur = (d: { commercial: string | null; utilisateur: string | null }) =>
  d.commercial?.trim() || d.utilisateur?.trim() || "Non affecté";

/**
 * Clé de rapprochement d'un nom de vendeur. Les noms saisis dans l'ERP ne sont
 * pas normalisés — le même commercial apparaît en « MOKHTAR » et en
 * « Mokhtar Trabelsi ». On compare donc sur le prénom, sans casse ni accents.
 */
const cleVendeur = (nom: string) =>
  nom.normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .trim().toLowerCase().split(/\s+/)[0] ?? "";

/** Le document appartient-il au commercial connecté ? */
const estDeMoi = (d: { commercial: string | null; utilisateur: string | null }, moi: string) =>
  cleVendeur(vendeur(d)) === cleVendeur(moi);

/** CA signé (ventes − retours) d'un lot de documents. */
function totalCA(docs: DocRow[]): number {
  return round3(docs.reduce((s, d) => s + signeCA(d.typeDoc) * d.ttcNet, 0));
}

/** Série mensuelle du CA et des encaissements sur la période. */
function serieMensuelle(
  docs: DocRow[], debut: Date, fin: Date,
  reglements: { datePay: Date | null; montant: number }[] = [],
) {
  const buckets = new Map<string, { mois: string; ca: number; docs: number; encaissements: number }>();

  // Pré-remplit chaque mois de la période pour éviter les trous dans le graphe.
  const cur = new Date(debut.getFullYear(), debut.getMonth(), 1);
  while (cur <= fin) {
    const key = `${cur.getFullYear()}-${cur.getMonth()}`;
    buckets.set(key, { mois: `${MOIS_COURTS[cur.getMonth()]} ${String(cur.getFullYear()).slice(-2)}`, ca: 0, docs: 0, encaissements: 0 });
    cur.setMonth(cur.getMonth() + 1);
  }

  for (const d of docs) {
    if (!d.dateDoc) continue;
    const key = `${d.dateDoc.getFullYear()}-${d.dateDoc.getMonth()}`;
    const b = buckets.get(key);
    if (!b) continue;
    b.ca = round3(b.ca + signeCA(d.typeDoc) * d.ttcNet);
    b.docs += 1;
  }

  // Encaissements du mois : ce qui a été réellement collecté, à comparer au CA.
  for (const r of reglements) {
    if (!r.datePay) continue;
    const key = `${r.datePay.getFullYear()}-${r.datePay.getMonth()}`;
    const b = buckets.get(key);
    if (!b) continue;
    b.encaissements = round3(b.encaissements + r.montant);
  }

  return [...buckets.values()];
}

export async function GET(req: NextRequest) {
  // Le tableau de bord consolidé est réservé à l'exploitation : un client n'a
  // pas à connaître le CA de la société. Son espace dédié est `/api/espace-client`.
  const auth = await requireSession(["ADMIN", "MANAGER", "COMMERCIAL"]);
  if (!auth.ok) return auth.res;

  const sp = req.nextUrl.searchParams;
  const scope = sp.get("scope") ?? "admin";
  const { debut, fin } = periode(sp.get("du"), sp.get("au"));

  const whereCA = {
    nature: "Vente",
    typeDoc: { in: [...TYPES_CA] },
    dateDoc: { gte: debut, lte: fin },
  };

  const [docsPeriode, articles, clientsAgg, reglementsAgg, reglementsSerie, nbClients, nbFournisseurs] = await Promise.all([
    prisma.erpDocument.findMany({
      where: whereCA,
      select: { typeDoc: true, ttcNet: true, thtNet: true, dateDoc: true, codeCli: true, raisonSocial: true, commercial: true, utilisateur: true },
    }),
    prisma.article.findMany({ select: { refArt: true, designation: true, enStock: true, stMin: true, puAchat: true, tarif1Ht: true } }),
    // Créances : uniquement les clients réellement débiteurs. Additionner les
    // soldes créditeurs (72 clients en avoir) compenserait la dette et
    // minorerait le montant à recouvrer.
    prisma.partner.aggregate({ where: { nature: "C", soldeFin: { gt: 0 } }, _sum: { soldeFin: true } }),
    // Encaissements bornés à la période affichée, comme le CA auquel ils sont
    // comparés — sans cela le KPI cumulait tout l'historique.
    prisma.erpReglement.aggregate({
      where: { sens: "C", datePay: { gte: debut, lte: fin } },
      _sum: { montant: true }, _count: true,
    }),
    // Encaissements datés, pour la courbe mensuelle.
    prisma.erpReglement.findMany({
      where: { sens: "C", datePay: { gte: debut, lte: fin } },
      select: { datePay: true, montant: true },
    }),
    prisma.partner.count({ where: { nature: "C" } }),
    prisma.partner.count({ where: { nature: "F" } }),
  ]);

  // Un commercial ne voit que ses propres ventes : ses indicateurs doivent
  // refléter sa performance, pas celle de la société. Le rapprochement se fait
  // sur `utilisateur`, seul champ renseigné, et tolère les variantes de saisie.
  const docs =
    scope === "commercial" && auth.user.role === "COMMERCIAL"
      ? docsPeriode.filter((d) => estDeMoi(d, auth.user.name))
      : docsPeriode;

  const ca = totalCA(docs);
  const nbDocs = docs.length;
  // Panier moyen : rapporté aux seuls documents de vente. Les retours et avoirs
  // réduisent déjà le CA au numérateur ; les compter aussi au dénominateur
  // écraserait deux fois le panier.
  const nbDocsVente = docs.filter((d) => signeCA(d.typeDoc) > 0).length;
  const panierMoyen = nbDocsVente > 0 ? round3(ca / nbDocsVente) : 0;

  // Stock : valorisation au prix d'achat + ruptures effectives.
  // Les stocks négatifs (64 articles, anomalies d'inventaire héritées de l'ERP)
  // sont ignorés : une quantité négative n'est pas une valeur en magasin, elle
  // amputerait la valorisation de ~200 kTND. Ils restent signalés en rupture.
  const valeurStock = round3(
    articles.reduce((s, a) => s + Math.max(0, a.enStock) * a.puAchat, 0),
  );
  const ruptures = articles.filter((a) => a.enStock <= 0);
  const sousMini = articles.filter((a) => a.enStock > 0 && a.enStock <= (a.stMin || 0));
  const tauxRupture = articles.length > 0 ? round3((ruptures.length / articles.length) * 100) : 0;

  const creances = round3(clientsAgg._sum.soldeFin ?? 0);
  const encaissements = round3(reglementsAgg._sum.montant ?? 0);

  // Top clients sur la période (CA signé).
  const parClient = new Map<string, { nom: string; codeCli: number | null; ca: number; docs: number }>();
  for (const d of docs) {
    const key = String(d.codeCli ?? d.raisonSocial ?? "?");
    const cur = parClient.get(key) ?? { nom: d.raisonSocial || `Client ${d.codeCli ?? "?"}`, codeCli: d.codeCli, ca: 0, docs: 0 };
    cur.ca = round3(cur.ca + signeCA(d.typeDoc) * d.ttcNet);
    cur.docs += 1;
    parClient.set(key, cur);
  }
  const topClients = [...parClient.values()].sort((a, b) => b.ca - a.ca).slice(0, 10);

  // Répartition par type de document.
  const parType = new Map<string, { type: string; count: number; total: number }>();
  for (const d of docs) {
    const cur = parType.get(d.typeDoc) ?? { type: d.typeDoc, count: 0, total: 0 };
    cur.count += 1;
    cur.total = round3(cur.total + d.ttcNet);
    parType.set(d.typeDoc, cur);
  }

  const base = {
    periode: { du: debut.toISOString(), au: fin.toISOString() },
    kpis: {
      ca,
      nbDocs,
      panierMoyen,
      valeurStock,
      creances,
      encaissements,
      nbClients,
      nbFournisseurs,
      nbArticles: articles.length,
      ruptures: ruptures.length,
      sousMini: sousMini.length,
      tauxRupture,
    },
    serie: serieMensuelle(docs, debut, fin, reglementsSerie),
    topClients,
    parType: [...parType.values()].sort((a, b) => b.total - a.total),
  };

  if (scope === "commercial") {
    // Clients à risque : solde débiteur le plus élevé (cf. recouvrement dans A).
    // Limités au portefeuille du commercial connecté — relancer le client d'un
    // collègue n'aurait pas de sens. `Partner.commercial` est renseigné ici
    // (2 380 clients sur 2 399), mais avec les mêmes variantes de saisie.
    const tousDebiteurs = await prisma.partner.findMany({
      where: { nature: "C", soldeFin: { gt: 0 } },
      orderBy: { soldeFin: "desc" },
      select: {
        id: true, raisonSocial: true, soldeFin: true, tel: true,
        ville: true, gouvernorat: true, commercial: true,
      },
    });

    const moi = cleVendeur(auth.user.name);
    const miens = tousDebiteurs.filter((c) => cleVendeur(c.commercial ?? "") === moi);
    // Un commercial sans portefeuille identifié verrait un écran vide : on lui
    // laisse alors la vue globale plutôt qu'aucune information de recouvrement.
    const aRisque = (miens.length > 0 ? miens : tousDebiteurs).slice(0, 10);

    return NextResponse.json({ ...base, aRisque });
  }

  if (scope === "manager") {
    // Performance par commercial sur la période.
    const parCom = new Map<string, { commercial: string; ca: number; docs: number }>();
    for (const d of docs) {
      const key = vendeur(d);
      const cur = parCom.get(key) ?? { commercial: key, ca: 0, docs: 0 };
      cur.ca = round3(cur.ca + signeCA(d.typeDoc) * d.ttcNet);
      cur.docs += 1;
      parCom.set(key, cur);
    }
    const [missions, docsNonValides, aValider] = await Promise.all([
      prisma.erpMission.count(),
      prisma.erpDocument.count({ where: { nature: "Vente", valide: false } }),
      // Documents en attente de validation, les plus récents d'abord.
      prisma.erpDocument.findMany({
        where: { nature: "Vente", valide: false, typeDoc: { in: [...TYPES_CA] } },
        orderBy: { dateDoc: "desc" },
        take: 10,
        select: { refDoc: true, typeDoc: true, raisonSocial: true, ttcNet: true, dateDoc: true, commercial: true, utilisateur: true },
      }),
    ]);
    return NextResponse.json({
      ...base,
      parCommercial: [...parCom.values()].sort((a, b) => b.ca - a.ca),
      missions,
      docsNonValides,
      aValider,
    });
  }

  // scope admin : ajoute l'état du stock et les alertes.
  const topRuptures = ruptures.slice(0, 10).map((a) => ({
    refArt: a.refArt, designation: a.designation, enStock: a.enStock, stMin: a.stMin,
  }));
  const [docsNonValides, nbMissions] = await Promise.all([
    prisma.erpDocument.count({ where: { nature: "Vente", valide: false } }),
    prisma.erpMission.count(),
  ]);

  return NextResponse.json({
    ...base,
    topRuptures,
    alertes: {
      ruptures: ruptures.length,
      sousMini: sousMini.length,
      docsNonValides,
      creancesElevees: await prisma.partner.count({ where: { nature: "C", soldeFin: { gt: 1000 } } }),
    },
    nbMissions,
  });
}
