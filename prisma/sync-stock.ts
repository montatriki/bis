import { synchroniserStock } from "../src/lib/sync-production";
import prisma from "../src/lib/prisma";

// Remise à niveau du stock depuis la production, en ligne de commande.
//
//   npm run sync:stock
//
// Même moteur que la synchronisation automatique de l'application
// (`src/lib/sync-production.ts`) : les écrans de stock se resynchronisent
// d'eux-mêmes dès que les données datent, cette commande sert pour un
// réalignement immédiat hors application.

async function main() {
  const r = await synchroniserStock();
  console.log(`${r.articlesMisAJour} article(s) remis à niveau (stock global / prix).`);
  console.log(`${r.lignesDepot} ligne(s) de stock d'emplacement écrites, ${r.lignesSupprimees} supprimée(s), sur ${r.depots} dépôt(s).`);

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
