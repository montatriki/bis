import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { round3 } from "@/lib/vente-stats";
import { rafraichirStockSiPerime } from "@/lib/sync-production";

// État du stock par emplacement (magasin / dépôt).
//
// GET /api/etat-stock?emplacement=&search=&kind=P|MP|SF
//                     &famille=&sousFamille=&stock=positif,negatif,zero
//                     &groupBy=famille|sousfamille|famille-sousfamille
//                     &valorisation=pmp|dpa|vente
//
// Reprend les filtres de l'écran « Etat du stock » de l'ERP d'origine :
// dépôt, référence, famille, sous-famille, signe du stock, regroupement et
// base de valorisation (DPA, PMP ou prix de vente).
//
// `StockDepot` porte la quantité par (article, emplacement) ; `Article` porte
// le stock global et le prix d'achat qui sert à la valorisation.

/**
 * Nature d'un emplacement.
 *
 * Le référentiel `depot` porte `fixe` : 1 = entrepôt fixe, 0 = véhicule. Se
 * fier au libellé était faux — « mokhtar 206TU7140 » est le camion de Mokhtar
 * Trabelsi, pas un magasin, et il était classé comme tel faute de contenir le
 * mot « dépôt ».
 */
type NatureEmplacement = "depot" | "vehicule";

/** Métadonnées d'un emplacement, déduites du référentiel. */
type MetaEmplacement = {
  nature: NatureEmplacement;
  /** Immatriculation, pour un véhicule. */
  matricule: string | null;
  /** Commercial qui exploite le véhicule, si on peut le rattacher. */
  commercial: string | null;
};

export async function GET(req: NextRequest) {
  // Les chiffres de cet écran n'ont de valeur que frais : déclenche une
  // resynchronisation en arrière-plan si les données datent.
  void rafraichirStockSiPerime();
  // Back-office : cette route expose tous les emplacements avec puAchat, pmp
  // et la valorisation totale — donc les marges. Le commercial a /api/catalogue,
  // restreint à son camion.
  const auth = await requireSession(["ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.res;

  const sp = req.nextUrl.searchParams;
  const emplacement = sp.get("emplacement")?.trim() || null;
  const search = (sp.get("search") ?? "").trim();
  const kind = sp.get("kind")?.trim() || null;
  const famille = sp.get("famille")?.trim() || null;
  const sousFamille = sp.get("sousFamille")?.trim() || null;
  const groupBy = sp.get("groupBy")?.trim() || null;

  // Signe du stock : plusieurs cases peuvent être cochées ensemble, comme
  // dans l'écran d'origine (Positif / Négatif / = 0 / Tous).
  const signes = new Set((sp.get("stock") ?? "").split(",").map((x) => x.trim()).filter(Boolean));

  // Base de valorisation. L'ERP d'origine laisse choisir : le DPA (dernier prix
  // d'achat), le PMP (coût moyen pondéré) ou le prix de vente — les trois
  // donnent des totaux très différents, d'où le choix explicite.
  const valorisation = sp.get("valorisation")?.trim() || "pmp";

  const [lignes, articles, depots] = await Promise.all([
    prisma.stockDepot.findMany({
      where: emplacement ? { emplacement } : undefined,
      select: { refArt: true, emplacement: true, quantite: true },
    }),
    prisma.article.findMany({
      where: {
        archiver: 0,
        ...(kind ? { kind } : {}),
        ...(famille ? { famille: Number(famille) } : {}),
        ...(sousFamille ? { sousFamille: Number(sousFamille) } : {}),
        ...(search
          ? { OR: [{ designation: { contains: search, mode: "insensitive" as const } }, { refArt: { contains: search, mode: "insensitive" as const } }] }
          : {}),
      },
      select: {
        refArt: true, designation: true, enStock: true, stMin: true,
        puAchat: true, pmp: true, tarif1Ht: true, kind: true, unite: true,
        famille: true, sousFamille: true,
      },
    }),
    prisma.refTable.findMany({ where: { kind: "depot" } }),
  ]);

  /** Prix unitaire retenu pour valoriser, selon la base demandée. */
  const prixDe = (a: { puAchat: number; pmp: number; tarif1Ht: number }) =>
    valorisation === "dpa" ? a.puAchat
    : valorisation === "vente" ? a.tarif1Ht
    // Le PMP vaut 0 sur les articles jamais réceptionnés : on retombe alors
    // sur le prix d'achat plutôt que de valoriser le stock à zéro.
    : (a.pmp || a.puAchat);

  // Nature réelle de chaque emplacement, d'après `fixe` du référentiel, et
  // commercial rattaché au véhicule via son emplacement de stock.
  const commerciaux = await prisma.partner.findMany({
    where: { nature: "C", commercial: { not: null } },
    distinct: ["commercial"], select: { commercial: true },
  });
  const nomsCommerciaux = commerciaux.map((c) => (c.commercial ?? "").trim()).filter(Boolean);

  // Certains véhicules n'ont pas de prénom dans leur libellé (« 243TU7638 ») :
  // on retrouve alors leur commercial par les tournées qu'ils ont effectuées,
  // en retenant celui qui l'a le plus conduit.
  const parPlaque = await prisma.erpMission.groupBy({
    by: ["vehicule", "commercial"],
    where: { vehicule: { not: null }, commercial: { not: null } },
    _count: { _all: true },
  });
  const conducteur = new Map<string, { nom: string; nb: number }>();
  for (const m of parPlaque) {
    const plaque = (m.vehicule ?? "").trim();
    const nom = (m.commercial ?? "").trim();
    if (!plaque || !nom) continue;
    const actuel = conducteur.get(plaque);
    if (!actuel || m._count._all > actuel.nb) conducteur.set(plaque, { nom, nb: m._count._all });
  }

  // Affectation courante : c'est elle qui fait foi. Le libellé du dépôt garde
  // souvent le prénom d'un ancien conducteur (« mokhtar 206TU7140 » alors que
  // le camion est passé à Aziz), et le conducteur le plus fréquent est un
  // cumul historique, pas la situation d'aujourd'hui.
  const affectes = await prisma.commercial.findMany({
    select: { vehicle: { select: { plate: true } }, user: { select: { name: true } } },
  });
  const affectation = new Map(
    affectes
      .filter((c) => c.vehicle?.plate)
      .map((c) => [c.vehicle!.plate.trim().toUpperCase(), c.user.name]),
  );

  const meta = new Map<string, MetaEmplacement>();
  for (const d of depots) {
    const j = (d.data ?? {}) as { fixe?: number; matricule?: string };
    const matricule = String(j.matricule ?? "").trim() || null;
    const nature: NatureEmplacement = Number(j.fixe) === 1 ? "depot" : "vehicule";
    const prefixe = d.label.replace(matricule ?? "", "").trim().toLowerCase();
    const commercial =
      // 1. Le commercial réellement rattaché au véhicule.
      (matricule ? affectation.get(matricule.toUpperCase()) ?? null : null)
      // 2. À défaut, le prénom porté par le libellé du dépôt.
      ?? (prefixe
        ? nomsCommerciaux.find((c) => c.toLowerCase().startsWith(prefixe.split(/\s+/)[0])) ?? null
        : null)
      // 3. En dernier recours, le conducteur habituel du véhicule.
      ?? (matricule ? conducteur.get(matricule)?.nom ?? null : null);
    meta.set(d.label, { nature, matricule, commercial });
  }

  /** Métadonnées d'un emplacement, avec repli si absent du référentiel. */
  const metaDe = (nom: string): MetaEmplacement =>
    meta.get(nom) ?? {
      // Sans fiche, on retombe sur le libellé : une immatriculation ressemble
      // à « 206TU7140 ».
      nature: /\d{3}TU\d{4}/i.test(nom) ? "vehicule" : "depot",
      matricule: (nom.match(/\d{3}TU\d{4}/i) ?? [null])[0],
      commercial: null,
    };

  const parArticle = new Map(articles.map((a) => [a.refArt, a]));

  // Regroupement par emplacement : quantités et valorisation.
  const parEmplacement = new Map<string, { quantite: number; valeur: number; refs: number }>();
  for (const l of lignes) {
    const a = parArticle.get(l.refArt);
    if (!a) continue; // article filtré ou archivé
    const cur = parEmplacement.get(l.emplacement) ?? { quantite: 0, valeur: 0, refs: 0 };
    cur.quantite += l.quantite;
    cur.valeur += l.quantite * prixDe(a);
    cur.refs += 1;
    parEmplacement.set(l.emplacement, cur);
  }

  const emplacements = [...parEmplacement.entries()]
    .map(([nom, v]) => ({
      emplacement: nom,
      type: metaDe(nom).nature,
      matricule: metaDe(nom).matricule,
      commercial: metaDe(nom).commercial,
      quantite: round3(v.quantite),
      valeur: round3(v.valeur),
      refs: v.refs,
    }))
    .sort((a, b) => b.valeur - a.valeur);

  // Détail article par article, avec sa ventilation par emplacement.
  const ventilation = new Map<string, { emplacement: string; quantite: number }[]>();
  for (const l of lignes) {
    if (!parArticle.has(l.refArt)) continue;
    const arr = ventilation.get(l.refArt) ?? [];
    arr.push({ emplacement: l.emplacement, quantite: round3(l.quantite) });
    ventilation.set(l.refArt, arr);
  }

  const rows = articles
    .map((a) => {
      const parts = ventilation.get(a.refArt) ?? [];
      const enEmplacement = parts.reduce((s, p) => s + p.quantite, 0);
      return {
        refArt: a.refArt,
        designation: a.designation,
        kind: a.kind,
        unite: a.unite,
        enStock: round3(a.enStock),
        stMin: round3(a.stMin),
        puAchat: round3(a.puAchat),
        pmp: round3(a.pmp),
        tarif1Ht: round3(a.tarif1Ht),
        prixValorisation: round3(prixDe(a)),
        valeur: round3(a.enStock * prixDe(a)),
        famille: a.famille,
        sousFamille: a.sousFamille,
        // Répartition magasin / dépôt de cet article.
        // Réparti entre les camions et les entrepôts fixes.
        magasin: round3(parts.filter((p) => metaDe(p.emplacement).nature === "vehicule").reduce((s, p) => s + p.quantite, 0)),
        depot: round3(parts.filter((p) => metaDe(p.emplacement).nature === "depot").reduce((s, p) => s + p.quantite, 0)),
        emplacements: parts.sort((x, y) => y.quantite - x.quantite),
        // Un article sous son seuil est signalé pour le réapprovisionnement.
        alerte: a.enStock <= 0 ? "rupture" : a.stMin > 0 && a.enStock <= a.stMin ? "sous-seuil" : null,
        nonVentile: round3(a.enStock - enEmplacement),
      };
    })
    .filter((r) => (emplacement ? r.emplacements.length > 0 : true))
    // Signe du stock. Quand un dépôt est sélectionné, le filtre porte sur la
    // quantité de ce dépôt et non sur le stock global — sinon un article à
    // zéro dans le dépôt mais positif ailleurs serait considéré positif.
    .filter((r) => {
      if (signes.size === 0 || signes.has("tous")) return true;
      const q = emplacement
        ? r.emplacements.reduce((t, e) => t + e.quantite, 0)
        : r.enStock;
      return (signes.has("positif") && q > 0)
        || (signes.has("negatif") && q < 0)
        || (signes.has("zero") && q === 0);
    })
    .sort((a, b) => b.valeur - a.valeur);

  // Libellés des familles et sous-familles : les articles ne portent qu'un
  // code numérique, illisible tel quel dans un état imprimé.
  const refs = await prisma.refTable.findMany({
    where: { kind: { in: ["famille-art", "sousfamille-art"] } },
    select: { kind: true, code: true, label: true },
  });
  const nomFam = new Map(refs.filter((r) => r.kind === "famille-art").map((r) => [r.code, r.label]));
  const nomSFam = new Map(refs.filter((r) => r.kind === "sousfamille-art").map((r) => [r.code, r.label]));

  /** Regroupe les lignes et calcule les sous-totaux, comme l'état d'origine. */
  const grouper = (cle: "famille" | "sousFamille") => {
    const noms = cle === "famille" ? nomFam : nomSFam;
    const paquets = new Map<string, { code: string; libelle: string; articles: typeof rows; quantite: number; valeur: number }>();
    for (const r of rows) {
      const code = r[cle] != null ? String(r[cle]) : "";
      const g = paquets.get(code) ?? {
        code,
        libelle: noms.get(code) ?? (code ? `Code ${code}` : "Sans classement"),
        articles: [] as typeof rows, quantite: 0, valeur: 0,
      };
      g.articles.push(r);
      g.quantite += r.enStock;
      g.valeur += r.valeur;
      paquets.set(code, g);
    }
    return [...paquets.values()]
      .map((g) => ({ ...g, quantite: round3(g.quantite), valeur: round3(g.valeur), nb: g.articles.length }))
      .sort((a, b) => b.valeur - a.valeur);
  };

  const groupes =
    groupBy === "famille" ? grouper("famille")
    : groupBy === "sousfamille" ? grouper("sousFamille")
    : null;

  return NextResponse.json({
    emplacements,
    valorisation,
    groupBy,
    groupes,
    // Listes pour les sélecteurs de l'écran.
    familles: [...nomFam.entries()].map(([code, label]) => ({ code, label })).sort((a, b) => a.label.localeCompare(b.label)),
    sousFamilles: [...nomSFam.entries()].map(([code, label]) => ({ code, label })).sort((a, b) => a.label.localeCompare(b.label)),
    depotsConnus: depots.map((d) => (d.label || d.code || "").trim()).filter(Boolean),
    totaux: {
      valeurVehicules: round3(emplacements.filter((e) => e.type === "vehicule").reduce((s, e) => s + e.valeur, 0)),
      valeurDepot: round3(emplacements.filter((e) => e.type === "depot").reduce((s, e) => s + e.valeur, 0)),
      valeurTotale: round3(rows.reduce((s, r) => s + r.valeur, 0)),
      nbArticles: rows.length,
      nbRuptures: rows.filter((r) => r.alerte === "rupture").length,
      nbSousSeuil: rows.filter((r) => r.alerte === "sous-seuil").length,
    },
    rows: rows.slice(0, 300),
    total: rows.length,
  });
}
