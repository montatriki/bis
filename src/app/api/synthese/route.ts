import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { round3, signeCA, TYPES_CA, TYPES_VENTE } from "@/lib/vente-stats";

// GET /api/synthese?du=YYYY-MM-DD&au=YYYY-MM-DD
//
// Synthèse inter-modules sur les données ERP réelles (Postgres).
// Sans bornes de dates, la synthèse porte sur tout l'historique.

/** Bornes de période depuis la requête ; `null` = pas de filtre. */
function bornes(du: string | null, au: string | null) {
  const debut = du ? new Date(`${du}T00:00:00`) : null;
  const fin = au ? new Date(`${au}T23:59:59.999`) : null;
  const valide = (d: Date | null) => (d && !Number.isNaN(d.getTime()) ? d : null);
  return { debut: valide(debut), fin: valide(fin) };
}

export async function GET(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.res;

  const sp = req.nextUrl.searchParams;
  const { debut, fin } = bornes(sp.get("du"), sp.get("au"));

  // Filtre de date appliqué aux documents et règlements de la période.
  const filtreDate = debut || fin
    ? { dateDoc: { ...(debut ? { gte: debut } : {}), ...(fin ? { lte: fin } : {}) } }
    : {};
  const filtreDateReg = debut || fin
    ? { datePay: { ...(debut ? { gte: debut } : {}), ...(fin ? { lte: fin } : {}) } }
    : {};

  const [
    venteParType, achatDocs, ventesParTypeRaw,
    clientAgg, fournisseurAgg, articles,
    encaissAgg, decaissAgg, topClientsRaw,
    stockParEmplacement, lignesVente, nbComptes,
  ] = await Promise.all([
    // Chiffre d'affaires : même règle que les tableaux de bord et les rapports
    // — CA = Σ(BL, TIC, FC) − Σ(BR, AV). Les bons de commande (COM) sont des
    // engagements, pas des ventes : les inclure gonflait le CA de 1,4 MTND et
    // contredisait le tableau de bord.
    prisma.erpDocument.groupBy({
      by: ["typeDoc"],
      where: { nature: "Vente", typeDoc: { in: [...TYPES_CA] }, ...filtreDate },
      _sum: { thtNet: true, ttcNet: true }, _count: true,
    }),
    // Achats : on ne retient que les bons de réception (BRE), qui matérialisent
    // l'entrée réelle de marchandise. Additionner aussi les factures (FC)
    // comptait deux fois le même achat — 43 des 145 factures reprennent au
    // centime près le montant d'un bon de réception du même fournisseur.
    prisma.erpDocument.findMany({
      where: { nature: "Achat", typeDoc: "BRE", ...filtreDate },
      select: { thtNet: true, ttcNet: true, totTva: true },
    }),
    prisma.erpDocument.groupBy({ by: ["typeDoc"], where: { nature: "Vente", ...filtreDate }, _sum: { ttcNet: true }, _count: true }),
    prisma.partner.aggregate({ where: { nature: "C" }, _sum: { soldeFin: true }, _count: true }),
    prisma.partner.aggregate({ where: { nature: "F" }, _sum: { soldeFin: true }, _count: true }),
    prisma.article.findMany({ select: { enStock: true, puAchat: true, tarif1Ht: true, stMin: true, designation: true, refArt: true } }),
    prisma.erpReglement.aggregate({ where: { sens: "C", ...filtreDateReg }, _sum: { montant: true }, _count: true }),
    prisma.erpReglement.aggregate({ where: { sens: "F", ...filtreDateReg }, _sum: { montant: true }, _count: true }),
    prisma.erpDocument.groupBy({ by: ["codeCli", "raisonSocial"], where: { nature: "Vente", typeDoc: { in: [...TYPES_VENTE] }, ...filtreDate }, _sum: { ttcNet: true }, orderBy: { _sum: { ttcNet: "desc" } }, take: 5 }),
    // Valorisation par emplacement : distingue magasin(s) et dépôt(s).
    prisma.stockDepot.groupBy({ by: ["emplacement"], _sum: { quantite: true }, _count: true }),
    // Top articles vendus sur la période, depuis les lignes de document.
    prisma.erpDocumentLine.groupBy({
      by: ["refArt", "designation"],
      where: { document: { nature: "Vente", typeDoc: { in: [...TYPES_VENTE] }, ...filtreDate } },
      _sum: { qte: true, ttcNet: true },
      orderBy: { _sum: { ttcNet: "desc" } },
      take: 10,
    }),
    prisma.erpAccount.count(),
  ]);

  // Les retours et avoirs viennent en déduction du chiffre d'affaires.
  let ventesHT = 0;
  let ventesTTC = 0;
  let nbDocsVente = 0;
  for (const t of venteParType) {
    const signe = signeCA(t.typeDoc);
    ventesHT += signe * (t._sum.thtNet ?? 0);
    ventesTTC += signe * (t._sum.ttcNet ?? 0);
    nbDocsVente += t._count;
  }
  ventesHT = round3(ventesHT);
  ventesTTC = round3(ventesTTC);

  // Le HT importé est inexploitable sur une partie des achats : 221 documents
  // portent un HT supérieur au triple de leur TTC (saisie en devise ou en
  // unités différentes à la source). On retient donc le HT quand il est
  // cohérent, et on le reconstruit depuis le TTC sinon.
  let achatsHT = 0;
  let achatsTTC = 0;
  for (const d of achatDocs) {
    const ttc = d.ttcNet;
    const htCoherent = d.thtNet > 0 && d.thtNet <= ttc;
    // À défaut de HT fiable : TTC − TVA du document, ou TVA usuelle de 19 %.
    const htReconstruit = d.totTva > 0 && d.totTva < ttc ? ttc - d.totTva : ttc / 1.19;
    achatsHT += htCoherent ? d.thtNet : htReconstruit;
    achatsTTC += ttc;
  }
  achatsHT = round3(achatsHT);
  achatsTTC = round3(achatsTTC);

  const margeBrute = round3(ventesHT - achatsHT);
  const tauxMarge = ventesHT > 0 ? (margeBrute / ventesHT) * 100 : 0;

  // Sans bornes de dates, ventes et achats ne couvrent pas la même période :
  // l'historique d'achats démarre en 2024, celui des ventes en novembre 2025.
  // La marge globale compare alors des flux décalés — on le signale plutôt que
  // d'afficher un résultat trompeur.
  const [bornesVentes, bornesAchats] = await Promise.all([
    prisma.erpDocument.aggregate({
      where: { nature: "Vente", typeDoc: { in: [...TYPES_CA] }, dateDoc: { not: null }, ...filtreDate },
      _min: { dateDoc: true }, _max: { dateDoc: true },
    }),
    prisma.erpDocument.aggregate({
      where: { nature: "Achat", typeDoc: "BRE", dateDoc: { not: null }, ...filtreDate },
      _min: { dateDoc: true }, _max: { dateDoc: true },
    }),
  ]);
  const debutV = bornesVentes._min.dateDoc;
  const debutA = bornesAchats._min.dateDoc;
  // Plus d'un mois d'écart entre les deux débuts d'historique : périodes non
  // comparables, la marge brute perd son sens.
  const margeComparable =
    !debutV || !debutA
      ? true
      : Math.abs(debutV.getTime() - debutA.getTime()) < 31 * 86_400_000;

  const valeurStock = round3(articles.reduce((s, a) => s + a.enStock * a.puAchat, 0));
  const ruptures = articles.filter((a) => a.enStock <= (a.stMin || 0) && a.enStock <= 0);

  // Stock négatif : impossible physiquement, signe de sorties enregistrées sans
  // les entrées correspondantes. Ces articles minorent la valorisation, on les
  // compte à part pour que l'exploitant sache que le chiffre est à corriger.
  const negatifs = articles.filter((a) => a.enStock < 0);
  const valeurNegative = round3(negatifs.reduce((s, a) => s + a.enStock * a.puAchat, 0));

  // Prix d'achat par référence, pour valoriser le stock de chaque emplacement.
  const puParRef = new Map(articles.map((a) => [a.refArt, a.puAchat]));
  const lignesDepot = await prisma.stockDepot.findMany({ select: { refArt: true, emplacement: true, quantite: true } });
  const valeurParEmplacement = new Map<string, { quantite: number; valeur: number; refs: number }>();
  for (const l of lignesDepot) {
    const cur = valeurParEmplacement.get(l.emplacement) ?? { quantite: 0, valeur: 0, refs: 0 };
    cur.quantite += l.quantite;
    cur.valeur += l.quantite * (puParRef.get(l.refArt) ?? 0);
    cur.refs += 1;
    valeurParEmplacement.set(l.emplacement, cur);
  }

  // Un emplacement dont le libellé évoque un dépôt est classé comme tel ;
  // tout le reste (magasin principal, points de vente) compte comme magasin.
  const estDepot = (nom: string) => /d[ée]p[ôo]t|depot/i.test(nom);
  const emplacements = [...valeurParEmplacement.entries()]
    .map(([nom, v]) => ({
      emplacement: nom,
      type: estDepot(nom) ? ("depot" as const) : ("magasin" as const),
      quantite: round3(v.quantite),
      valeur: round3(v.valeur),
      refs: v.refs,
    }))
    .sort((a, b) => b.valeur - a.valeur);

  const valeurDepot = round3(emplacements.filter((e) => e.type === "depot").reduce((s, e) => s + e.valeur, 0));
  const valeurMagasin = round3(emplacements.filter((e) => e.type === "magasin").reduce((s, e) => s + e.valeur, 0));

  const encaissements = encaissAgg._sum.montant ?? 0;
  const decaissements = decaissAgg._sum.montant ?? 0;

  const TYPE_LABEL: Record<string, string> = { DEV: "Devis", COM: "B. Commande", TIC: "B. Livraison", BL: "B. Livraison", FC: "Factures", AV: "Avoirs", BR: "Retours" };
  // merge doc types that share a label (e.g. TIC + BL => "B. Livraison") so each label is unique
  const parTypeMap = new Map<string, { type: string; count: number; total: number }>();
  for (const v of ventesParTypeRaw) {
    const label = TYPE_LABEL[v.typeDoc] ?? v.typeDoc;
    const cur = parTypeMap.get(label) ?? { type: label, count: 0, total: 0 };
    cur.count += v._count;
    cur.total += v._sum.ttcNet ?? 0;
    parTypeMap.set(label, cur);
  }
  const ventesParType = [...parTypeMap.values()].sort((a, b) => b.total - a.total).slice(0, 8);

  const topClients = topClientsRaw.map((c) => ({ name: c.raisonSocial ?? `#${c.codeCli}`, ca: c._sum.ttcNet ?? 0, solde: 0 }));

  // Top articles. L'export ERP ne contient que les en-têtes de documents : sans
  // lignes de vente, le classement par CA est impossible. On bascule alors sur
  // la valorisation du stock, en signalant la base de calcul via `source`.
  const topArticles = lignesVente.length
    ? {
        source: "ventes" as const,
        rows: lignesVente.map((l) => ({
          refArt: l.refArt,
          designation: l.designation ?? l.refArt,
          quantite: round3(l._sum.qte ?? 0),
          valeur: round3(l._sum.ttcNet ?? 0),
        })),
      }
    : {
        source: "stock" as const,
        rows: articles
          .map((a) => ({
            refArt: a.refArt,
            designation: a.designation,
            quantite: round3(a.enStock),
            valeur: round3(a.enStock * a.puAchat),
          }))
          .filter((a) => a.valeur > 0)
          .sort((a, b) => b.valeur - a.valeur)
          .slice(0, 10),
      };

  return NextResponse.json({
    periode: { du: debut, au: fin },
    ventes: { ttc: ventesTTC, ht: ventesHT, nb: nbDocsVente },
    achats: { ttc: achatsTTC, ht: achatsHT, nb: achatDocs.length },
    marge: {
      brute: margeBrute, taux: tauxMarge,
      /** Faux quand ventes et achats ne couvrent pas la même période. */
      comparable: margeComparable,
      periodeVentes: { du: bornesVentes._min.dateDoc, au: bornesVentes._max.dateDoc },
      periodeAchats: { du: bornesAchats._min.dateDoc, au: bornesAchats._max.dateDoc },
    },
    creancesClients: clientAgg._sum.soldeFin ?? 0,
    dettesFournisseurs: fournisseurAgg._sum.soldeFin ?? 0,
    stock: {
      valeur: valeurStock,
      nbArticles: articles.length,
      nbRuptures: ruptures.length,
      // Anomalies d'inventaire à corriger à la source.
      nbStockNegatif: negatifs.length,
      valeurStockNegatif: valeurNegative,
      valeurDepot,
      valeurMagasin,
      emplacements,
      nbEmplacements: stockParEmplacement.length,
    },
    tresorerie: { solde: encaissements - decaissements, encaissements, decaissements, nbComptes },
    ventesParType,
    topClients,
    topArticles,
    ruptures: ruptures.slice(0, 20).map((r) => ({ name: r.designation, stock: r.enStock, min: r.stMin, reference: r.refArt })),
  });
}
