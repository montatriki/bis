import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import fs from "node:fs";

// Remise en place du commercial sur les documents de vente.
//
//   npx tsx --env-file=.env prisma/corriger-commercial-documents.ts <ventes.json> [--appliquer]
//
// 4 821 documents avaient perdu leur `Raison_social_com` lors d'un import
// antérieur : les statistiques par commercial, les fiches vendeur et le
// périmètre des tournées ne portaient plus que sur une partie de l'activité
// (« sky edition » ressortait à 58 594 TND au lieu de 544 726).
//
// Seuls les documents dont le commercial est **vide chez nous et renseigné en
// production** sont touchés : rien n'est écrasé.

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const fichier = process.argv[2];
  const appliquer = process.argv.includes("--appliquer");
  if (!fichier || !fs.existsSync(fichier)) {
    console.error("Usage : npx tsx --env-file=.env prisma/corriger-commercial-documents.ts <ventes.json> [--appliquer]");
    process.exit(1);
  }

  const docs: { Ref_doc: string; Raison_social_com?: string | null }[] =
    JSON.parse(fs.readFileSync(fichier, "utf8"));
  const parRef = new Map<string, string>();
  for (const d of docs) {
    const com = (d.Raison_social_com ?? "").trim();
    if (com) parRef.set(String(d.Ref_doc).trim(), com);
  }

  // Documents sans commercial chez nous.
  const sansCom = await prisma.erpDocument.findMany({
    where: { nature: "Vente", OR: [{ commercial: null }, { commercial: "" }] },
    select: { refDoc: true },
  });

  let corriges = 0, introuvables = 0;
  for (const d of sansCom) {
    // Nos références dédoublonnées portent un suffixe `-V` absent en source.
    const base = d.refDoc.endsWith("-V") ? d.refDoc.slice(0, -2) : d.refDoc;
    const com = parRef.get(base) ?? parRef.get(d.refDoc);
    if (!com) { introuvables++; continue; }
    if (appliquer) {
      await prisma.erpDocument.update({ where: { refDoc: d.refDoc }, data: { commercial: com } });
    }
    corriges++;
  }

  console.log(
    appliquer
      ? `${corriges} document(s) corrigé(s).`
      : `${corriges} document(s) à corriger (essai à blanc).`,
  );
  console.log(`${introuvables} sans commercial en production non plus, laissés tels quels.`);
  if (!appliquer) console.log("\nRelancer avec --appliquer pour enregistrer.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
