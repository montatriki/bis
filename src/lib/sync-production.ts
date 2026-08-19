import prisma from "./prisma";

// Synchronisation du stock depuis l'ERP de production — en lecture seule.
//
// Le stock de production bouge en continu (les commerciaux vendent pendant la
// journée) : un import ponctuel est juste à l'instant où il tourne, puis
// dérive. C'est ce qui faisait afficher 15 bouteilles dans un camion qui n'en
// avait plus que 13. Ici la synchronisation vit dans l'application : les
// écrans de stock la déclenchent d'eux-mêmes dès que les données datent de
// plus de `PERIME_APRES_MS`, et un rafraîchissement manuel reste possible.
//
// Elle n'écrit jamais rien en production : les endpoints appelés sont des
// lectures (le verbe POST n'y porte que le jeton).
//
// Le stock vit à deux endroits, réalignés ensemble — l'un sans l'autre rend
// l'écran incohérent avec lui-même :
//   1. `Article.enStock` : le stock global toutes localisations (second badge
//      de l'app mobile, valorisation du tableau de bord) ;
//   2. `StockDepot`      : la ventilation par dépôt / camion (premier badge,
//      « Stock camion » de chaque commercial).

const API = process.env.PROD_API_URL ?? "http://41.226.17.73:3050";
const LOGIN = process.env.PROD_LOGIN ?? "Admin";
const PASSWORD = process.env.PROD_PASSWORD ?? "0502765210";
const DB = process.env.PROD_DB ?? "bis";

/** Âge au-delà duquel les écrans de stock relancent une synchronisation. */
export const PERIME_APRES_MS = 5 * 60_000;

const n = (v: unknown) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };

type ArtProd = Record<string, unknown>;
type LigneDepot = {
  reference_article?: string | null;
  en_stock?: number | string | null;
  pu_achat?: number | string | null;
};

async function jeton(): Promise<string> {
  const r = await fetch(`${API}/users/generateToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ login: LOGIN, password: PASSWORD, db: DB }),
    signal: AbortSignal.timeout(30_000),
  });
  // Le jeton arrive en texte brut, pas en JSON.
  const t = (await r.text()).trim().replace(/^"|"$/g, "");
  if (!t.startsWith("ey")) throw new Error(`Authentification production refusée : ${t.slice(0, 80)}`);
  return t;
}

async function lire<T>(chemin: string, token: string): Promise<T> {
  const r = await fetch(`${API}/${chemin}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: token },
    body: JSON.stringify({ token }),
    signal: AbortSignal.timeout(120_000),
  });
  return (await r.json()) as T;
}

/** Horodatage persistant de la dernière synchronisation réussie. */
async function marqueur() {
  return prisma.refTable.findFirst({ where: { kind: "systeme", code: "sync-stock" } });
}

export type ResultatSync = {
  articlesMisAJour: number;
  lignesDepot: number;
  lignesSupprimees: number;
  depots: number;
};

/**
 * Réaligne le stock (global + par emplacement) sur la production.
 * Ne touche que ce qui a changé, et supprime ce que la production ne
 * rapporte plus : elle reste la seule référence.
 */
export async function synchroniserStock(): Promise<ResultatSync> {
  const token = await jeton();

  // --- 1. Stock global du catalogue ------------------------------------
  const artsProd = await lire<ArtProd[]>("articles/", token);
  const locaux = await prisma.article.findMany({
    select: { refArt: true, enStock: true, pmp: true, puAchat: true, tarif1Ht: true, tauxTva: true, tauxFodec: true },
  });
  // La production stocke certaines références avec un espace final : on
  // indexe les deux formes, la fiche locale faisant foi sur la graphie.
  const parRef = new Map<string, ArtProd>();
  for (const a of artsProd) {
    const ref = String(a.ref_art ?? "");
    parRef.set(ref, a);
    if (!parRef.has(ref.trim())) parRef.set(ref.trim(), a);
  }

  let articlesMisAJour = 0;
  for (const a of locaux) {
    const p = parRef.get(a.refArt) ?? parRef.get(a.refArt.trim());
    if (!p) continue; // article supprimé côté production mais cité par nos documents
    const enStock = n(p.en_stock), pmp = n(p.pmp), puAchat = n(p.pu_achat);
    // Le prix de vente suit lui aussi la production : c'est lui qui valorise
    // le stock camion et le catalogue du commercial. Le laisser figé faisait
    // vendre et valoriser sur des tarifs périmés.
    const tarif1Ht = n(p.tarif1_ht), tauxTva = n(p.Taux_tva), tauxFodec = n(p.Taux_fodec);
    // La quantité peut être juste alors que la valorisation ne l'est pas :
    // on compare quantité, coûts et prix de vente.
    if (Math.abs(enStock - a.enStock) < 0.001 &&
        Math.abs(pmp - a.pmp) < 0.000001 &&
        Math.abs(puAchat - a.puAchat) < 0.000001 &&
        Math.abs(tarif1Ht - a.tarif1Ht) < 0.000001 &&
        Math.abs(tauxTva - a.tauxTva) < 0.000001 &&
        Math.abs(tauxFodec - a.tauxFodec) < 0.000001) continue;
    await prisma.article.update({
      where: { refArt: a.refArt },
      data: {
        enStock, pmp, puAchat, tarif1Ht, tauxTva, tauxFodec,
        entrer: n(p.entrer), sortie: n(p.sortie), stockIni: n(p.stock_ini),
      },
    });
    articlesMisAJour++;
  }

  // --- 2. Stock par dépôt / camion --------------------------------------
  const fiches = await prisma.article.findMany({ select: { refArt: true, pmp: true } });
  const connus = new Set(fiches.map((f) => f.refArt));
  const pmpArticle = new Map(fiches.map((f) => [f.refArt, f.pmp]));

  const depots = await prisma.refTable.findMany({ where: { kind: "depot" } });
  let lignesDepot = 0, lignesSupprimees = 0, nbDepots = 0;

  for (const d of depots) {
    const code = String(d.code ?? "").trim();
    if (!code) continue;
    const lignes = await lire<LigneDepot[]>(`depots/get-articles-by-depot/${encodeURIComponent(code)}`, token)
      .catch(() => null);
    if (!Array.isArray(lignes)) continue; // dépôt injoignable : on n'y touche pas
    nbDepots++;

    const existantes = new Map(
      (await prisma.stockDepot.findMany({
        where: { emplacement: d.label },
        select: { refArt: true, quantite: true, pmp: true },
      })).map((s) => [s.refArt, s]),
    );

    const vues = new Set<string>();
    for (const l of lignes) {
      const brut = String(l.reference_article ?? "");
      const quantite = n(l.en_stock);
      if (!brut.trim() || quantite === 0) continue;
      // La forme du catalogue fait foi (espace final compris).
      const refArt = connus.has(brut) ? brut
        : connus.has(brut.trim()) ? brut.trim()
        : connus.has(`${brut.trim()} `) ? `${brut.trim()} `
        : brut.trim();
      if (!connus.has(refArt) || vues.has(refArt)) continue; // réf. inconnue, ou doublon source (N43)
      vues.add(refArt);

      // Un PMP nul est une valeur, pas une absence.
      const fiche = pmpArticle.get(refArt);
      const pmp = fiche !== undefined ? fiche : n(l.pu_achat);

      const actuel = existantes.get(refArt);
      if (actuel && Math.abs(actuel.quantite - quantite) < 0.001 && Math.abs(actuel.pmp - pmp) < 0.000001) continue;
      await prisma.stockDepot.upsert({
        where: { refArt_emplacement: { refArt, emplacement: d.label } },
        create: { refArt, emplacement: d.label, quantite, pmp },
        update: { quantite, pmp },
      });
      lignesDepot++;
    }

    // Ce que la production ne rapporte plus n'existe plus : le conserver
    // laisserait un stock fantôme dans le camion d'un commercial.
    const res = await prisma.stockDepot.deleteMany({
      where: { emplacement: d.label, refArt: { notIn: [...vues] } },
    });
    lignesSupprimees += res.count;
  }

  // --- 3. Horodatage -----------------------------------------------------
  const resume = { at: new Date().toISOString(), articlesMisAJour, lignesDepot, lignesSupprimees };
  const m = await marqueur();
  if (m) await prisma.refTable.update({ where: { id: m.id }, data: { label: resume.at, data: resume } });
  else await prisma.refTable.create({ data: { kind: "systeme", code: "sync-stock", label: resume.at, data: resume } });

  return { articlesMisAJour, lignesDepot, lignesSupprimees, depots: nbDepots };
}

/** État courant, pour l'afficher à l'écran. */
export async function etatSync() {
  const m = await marqueur();
  const derniere = m?.label ? new Date(m.label) : null;
  return {
    derniere,
    ageMs: derniere ? Date.now() - derniere.getTime() : null,
    enCours,
  };
}

// Une seule synchronisation à la fois : les écrans de stock la déclenchent
// tous, il ne faut pas marteler la production.
let enCours = false;

/**
 * Déclenche une synchronisation en arrière-plan si les données datent.
 * À appeler sans `await` depuis les routes de stock : la requête courante
 * sert l'état présent, la suivante voit les données fraîches.
 */
export async function rafraichirStockSiPerime(): Promise<void> {
  if (enCours) return;
  try {
    const { ageMs } = await etatSync();
    if (ageMs !== null && ageMs < PERIME_APRES_MS) return;
    enCours = true;
    await synchroniserStock();
  } catch (e) {
    // La production peut être injoignable : l'écran continue de servir les
    // dernières données connues, et retentera au prochain passage.
    console.error("[sync-production]", e instanceof Error ? e.message : e);
  } finally {
    enCours = false;
  }
}
