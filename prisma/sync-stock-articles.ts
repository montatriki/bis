import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import fs from "node:fs";

// Remise à niveau du stock global du catalogue depuis la production.
//
//   npx tsx --env-file=.env prisma/sync-stock-articles.ts <articles.json> [--appliquer]
//
// `Article.enStock` (avec `entrer`, `sortie`, `stockIni`, `pmp`, `puAchat`)
// porte le stock **toutes localisations confondues**. Il n'avait pas été
// rafraîchi depuis l'export initial : 170 références s'en écartaient, pour
// 213 853 unités au total — la valorisation du tableau de bord, le compte des
// ruptures et la liste des stocks négatifs s'appuyaient donc sur des chiffres
// périmés.
//
// À ne pas confondre avec `StockDepot`, qui ventile ce même stock par
// emplacement et qui est repris par `import-stock-depots.ts`.
//
// Sans `--appliquer`, le script se contente d'afficher les écarts.

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

type ArtProd = Record<string, unknown>;

const n = (v: unknown) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };

async function main() {
  const fichier = process.argv[2];
  const appliquer = process.argv.includes("--appliquer");
  if (!fichier || !fs.existsSync(fichier)) {
    console.error("Usage : npx tsx --env-file=.env prisma/sync-stock-articles.ts <articles.json> [--appliquer]");
    process.exit(1);
  }

  const arts: ArtProd[] = JSON.parse(fs.readFileSync(fichier, "utf8"));
  // La production stocke certaines références avec un espace final : on indexe
  // les deux formes pour retrouver la fiche quelle que soit celle du catalogue.
  const parRef = new Map<string, ArtProd>();
  for (const a of arts) {
    const ref = String(a.ref_art ?? "");
    parRef.set(ref, a);
    if (!parRef.has(ref.trim())) parRef.set(ref.trim(), a);
  }

  const locaux = await prisma.article.findMany({
    select: { refArt: true, enStock: true, entrer: true, sortie: true, stockIni: true, pmp: true, puAchat: true },
  });

  let ecarts = 0, inconnus = 0, totalEcart = 0;
  for (const a of locaux) {
    const p = parRef.get(a.refArt) ?? parRef.get(a.refArt.trim());
    if (!p) { inconnus++; continue; }

    const enStock = n(p.en_stock);
    const pmp = n(p.pmp);
    const puAchat = n(p.pu_achat);
    // La quantité peut être juste alors que la valorisation ne l'est pas :
    // quatre articles avaient le bon stock mais un PMP périmé (1,334875 contre
    // 0,909301), soit 1 404 TND d'écart sur la valeur du stock. On compare
    // donc aussi les prix.
    const memeQte = Math.abs(enStock - a.enStock) < 0.001;
    const memePrix = Math.abs(pmp - a.pmp) < 0.000001 && Math.abs(puAchat - a.puAchat) < 0.000001;
    if (memeQte && memePrix) continue;

    ecarts++;
    totalEcart += enStock - a.enStock;
    if (appliquer) {
      await prisma.article.update({
        where: { refArt: a.refArt },
        data: {
          enStock,
          entrer: n(p.entrer), sortie: n(p.sortie), stockIni: n(p.stock_ini),
          // Le PMP et le prix d'achat suivent le stock : les laisser en arrière
          // fausserait la valorisation autant que la quantité.
          pmp, puAchat,
        },
      });
    }
  }

  console.log(
    appliquer
      ? `${ecarts} article(s) remis à niveau (${totalEcart >= 0 ? "+" : ""}${Math.round(totalEcart)} unités).`
      : `${ecarts} article(s) en écart (${totalEcart >= 0 ? "+" : ""}${Math.round(totalEcart)} unités).`,
  );
  if (inconnus > 0) console.log(`${inconnus} article(s) absent(s) de la production, laissé(s) tels quels.`);

  const tot = await prisma.article.aggregate({
    where: { archiver: 0 }, _sum: { enStock: true },
  });
  console.log("Stock global :", Math.round(tot._sum.enStock ?? 0), "unités");
  if (!appliquer) console.log("\nRelancer avec --appliquer pour enregistrer.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
