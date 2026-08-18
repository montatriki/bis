import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import fs from "node:fs";

// Rattachement des règlements à leur bordereau de remise et reprise du
// lettrage bancaire.
//
//   npx tsx --env-file=.env prisma/import-liens-borderaux.ts <liens.json>
//
// Le fichier attendu est une liste de {sens, idSource, borderauId, lettrage} :
// c'est le couple (sens, idSource) qui identifie un règlement, `id` étant chez
// nous une clé de substitution.
//
// Rejouable : le script réécrit simplement le lien.

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

type Lien = { sens: string; idSource: number; borderauId: number | null; lettrage: string | null };

async function main() {
  const fichier = process.argv[2];
  if (!fichier || !fs.existsSync(fichier)) {
    console.error("Usage : npx tsx --env-file=.env prisma/import-liens-borderaux.ts <liens.json>");
    process.exit(1);
  }

  const liens: Lien[] = JSON.parse(fs.readFileSync(fichier, "utf8"));
  const borderaux = new Set(
    (await prisma.erpBorderau.findMany({ select: { id: true } })).map((b) => b.id),
  );

  let rattaches = 0, lettres = 0, orphelins = 0;
  for (const l of liens) {
    // Un bordereau absent de notre base laisserait une clé étrangère morte :
    // on garde alors le lettrage seul plutôt que de perdre la ligne.
    const borderauId = l.borderauId != null && borderaux.has(l.borderauId) ? l.borderauId : null;
    if (l.borderauId != null && borderauId == null) orphelins++;

    const res = await prisma.erpReglement.updateMany({
      where: { sens: l.sens, idSource: l.idSource },
      data: { borderauId, lettrage: l.lettrage },
    });
    if (res.count > 0) {
      if (borderauId != null) rattaches++;
      if (l.lettrage) lettres++;
    }
  }

  console.log(`${rattaches} règlement(s) rattaché(s) à un bordereau, ${lettres} lettré(s).`);
  if (orphelins > 0) console.log(`${orphelins} référence(s) à un bordereau inconnu ignorée(s).`);

  const parBord = await prisma.erpBorderau.findMany({
    select: { id: true, total: true, _count: { select: { reglements: true } } },
    orderBy: { id: "asc" },
  });
  for (const b of parBord) {
    console.log(`  bordereau ${b.id} : ${b._count.reglements} règlement(s) · total ${b.total}`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
