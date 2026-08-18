import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Import du stock par emplacement depuis la production.
//
//   npx tsx --env-file=.env prisma/import-stock-depots.ts <token>
//
// `depots_articles` porte le stock par (code_depot, reference_article) ; on le
// traduit en `StockDepot`, qui travaille par emplacement nommé.
//
// L'import est **autoritaire** : la production fait foi, et toute ligne qu'elle
// ne rapporte plus pour un emplacement est supprimée. Sans cette reprise en
// main, des lignes écrites par un import antérieur survivaient indéfiniment —
// le camion de Mokhtar affichait 222 références et 689 532 unités (496 120 TND)
// là où la production en compte 37 pour 9 662 unités (13 055 TND), avec des
// quantités absurdes comme 212 142 unités d'un même article à bord.

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const API = "http://41.226.17.73:3050";

type LigneProd = {
  code_depot: number;
  reference_article: string;
  en_stock?: number | string | null;
  pmp?: number | string | null;
  pu_achat?: number | string | null;
};

const n = (v: unknown) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };

async function main() {
  const token = process.argv[2];
  if (!token) {
    console.error("Usage : npx tsx --env-file=.env prisma/import-stock-depots.ts <token>");
    process.exit(1);
  }

  // Codes -> libellés, depuis notre référentiel : c'est lui qui porte les noms
  // enrichis (« mokhtar 206TU7140 ») utilisés partout comme emplacement.
  const depots = await prisma.refTable.findMany({ where: { kind: "depot" } });
  const parCode = new Map(depots.filter((d) => d.code).map((d) => [String(d.code).trim(), d.label]));

  // Références connues : une ligne de stock sur un article absent du catalogue
  // ne serait exploitable nulle part. Le PMP vient de la fiche article : le
  // stock par dépôt ne l'expose pas, et prendre le prix d'achat à sa place
  // valorisait chaque emplacement autrement que la production ne le fait.
  const fiches = await prisma.article.findMany({ select: { refArt: true, pmp: true } });
  const articles = new Set(fiches.map((a) => a.refArt));
  const pmpArticle = new Map(fiches.map((a) => [a.refArt, a.pmp]));

  /**
   * PMP de la fiche article, à défaut le prix d'achat porté par la ligne.
   *
   * Un PMP nul est une valeur légitime — la production en rapporte pour les
   * articles jamais entrés en stock valorisé — et non une absence : le
   * confondre avec « non renseigné » ferait basculer sur le prix d'achat et
   * valoriserait l'emplacement au-dessus de la production.
   */
  const pmpDe = (refArt: string, l: LigneProd) => {
    const fiche = pmpArticle.get(refArt);
    return fiche !== undefined ? fiche : (n(l.pmp) || n(l.pu_achat));
  };

  let total = 0, ignorees = 0;

  for (const [code, libelle] of parCode) {
    const r = await fetch(`${API}/depots/get-articles-by-depot/${encodeURIComponent(code)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: token },
      body: JSON.stringify({ token }),
      signal: AbortSignal.timeout(120_000),
    }).catch(() => null);

    const lignes: LigneProd[] = r ? await r.json().catch(() => []) : [];
    if (!Array.isArray(lignes) || lignes.length === 0) {
      console.log(`  ${libelle.padEnd(24)} — aucune ligne`);
      continue;
    }

    let ecrites = 0;
    const vues = new Set<string>();
    for (const l of lignes) {
      const brut = String(l.reference_article ?? "");
      const quantite = n(l.en_stock);
      // Les lignes à zéro n'apportent rien : elles gonfleraient la table sans
      // changer aucune valorisation ni aucun écran.
      if (!brut.trim() || quantite === 0) continue;
      // Certaines références sont stockées avec un espace final (« mah »,
      // « planche educatif ») : la forme du catalogue fait foi, sinon la ligne
      // de stock pointerait sur un article inexistant et serait perdue.
      const refArt = articles.has(brut) ? brut
        : articles.has(brut.trim()) ? brut.trim()
        : articles.has(`${brut.trim()} `) ? `${brut.trim()} `
        : brut.trim();
      if (!articles.has(refArt)) { ignorees++; continue; }

      vues.add(refArt);
      await prisma.stockDepot.upsert({
        where: { refArt_emplacement: { refArt, emplacement: libelle } },
        create: { refArt, emplacement: libelle, quantite, pmp: pmpDe(refArt, l) },
        update: { quantite, pmp: pmpDe(refArt, l) },
      });
      ecrites++;
    }

    // La production fait foi : ce qu'elle ne rapporte plus pour cet
    // emplacement n'y est plus. Conserver ces lignes laisserait un stock
    // fantôme, valorisé, dans le camion d'un commercial.
    const obsoletes = await prisma.stockDepot.deleteMany({
      where: { emplacement: libelle, refArt: { notIn: [...vues] } },
    });

    total += ecrites;
    console.log(
      `  ${libelle.padEnd(24)} ${String(ecrites).padStart(5)} référence(s) en stock` +
      (obsoletes.count > 0 ? ` · ${obsoletes.count} ligne(s) obsolète(s) supprimée(s)` : ""),
    );
  }

  console.log(`\n${total} ligne(s) de stock importée(s), ${ignorees} ignorée(s) (article inconnu).`);

  const recap = await prisma.stockDepot.groupBy({
    by: ["emplacement"], _count: { _all: true }, _sum: { quantite: true },
  });
  console.log("\nÉtat final :");
  for (const g of recap.sort((a, b) => b._count._all - a._count._all)) {
    console.log(`   ${g.emplacement.padEnd(24)} ${String(g._count._all).padStart(5)} refs · ${g._sum.quantite} unités`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
