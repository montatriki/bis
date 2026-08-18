// Seed opérationnel : objectifs commerciaux, téléphones des commerciaux et
// stock par dépôt/magasin. Ces tables sont vides après l'import ERP alors que
// les écrans admin (objectifs, relance WhatsApp, état du stock) en dépendent.
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as fs from "node:fs";

const url = process.env.DATABASE_URL
  ?? /DATABASE_URL="([^"]+)"/.exec(fs.readFileSync(".env", "utf8"))![1];
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) } as any);

async function main() {
  // 1. Téléphones des commerciaux — requis par la relance WhatsApp.
  const TELS: Record<string, string> = {
    "Mokhtar Trabelsi": "98 512 340",
  };
  for (const [name, phone] of Object.entries(TELS)) {
    await prisma.user.updateMany({ where: { name, role: "COMMERCIAL" }, data: { phone } });
  }
  console.log("téléphones commerciaux mis à jour:", Object.keys(TELS).length);

  // 2. Objectifs mensuels — calés sur les vendeurs réellement actifs, avec un
  //    objectif à 110 % du réalisé du mois (cible atteignable et parlante).
  const docs = await prisma.erpDocument.findMany({
    where: { nature: "Vente", typeDoc: { in: ["BL", "TIC", "FC", "FAC"] }, dateDoc: { not: null } },
    select: { ttcNet: true, commercial: true, utilisateur: true, dateDoc: true },
  });

  const parMois = new Map<string, Map<string, number>>();
  for (const d of docs) {
    const v = (d.commercial?.trim() || d.utilisateur?.trim() || "");
    if (!v || !d.dateDoc) continue;
    const cle = `${d.dateDoc.getFullYear()}-${d.dateDoc.getMonth() + 1}`;
    if (!parMois.has(cle)) parMois.set(cle, new Map());
    const m = parMois.get(cle)!;
    m.set(v, (m.get(v) ?? 0) + d.ttcNet);
  }

  let n = 0;
  for (const [cle, vendeurs] of parMois) {
    const [annee, mois] = cle.split("-").map(Number);
    for (const [vendeur, ca] of vendeurs) {
      if (ca <= 0) continue;
      const objectifCA = Math.round(ca * 1.1);
      await prisma.objectif.upsert({
        where: { vendeur_mois_annee: { vendeur, mois, annee } },
        create: { vendeur, mois, annee, objectifCA },
        update: { objectifCA },
      });
      n++;
    }
  }
  console.log("objectifs créés/mis à jour:", n);

  // 3. Stock par emplacement — réparti sur les dépôts du référentiel afin que
  //    « État du stock (magasin / dépôt) » et les mouvements aient une base.
  const depots = await prisma.refTable.findMany({ where: { kind: "depot" } });
  const emplacements = depots
    .map((d) => (d.label || d.code || "").trim())
    .filter(Boolean);
  if (emplacements.length === 0) emplacements.push("MAGASIN", "DEPOT");

  const articles = await prisma.article.findMany({
    where: { archiver: 0 },
    select: { refArt: true, enStock: true },
  });

  let lignes = 0;
  for (const a of articles) {
    if (a.enStock <= 0) continue;
    // Le magasin principal garde l'essentiel, le reste part en dépôt.
    const principal = emplacements[0];
    const secondaire = emplacements[1] ?? emplacements[0];
    const partDepot = Math.floor(a.enStock * 0.3);
    const partMagasin = a.enStock - partDepot;

    await prisma.stockDepot.upsert({
      where: { refArt_emplacement: { refArt: a.refArt, emplacement: principal } },
      create: { refArt: a.refArt, emplacement: principal, quantite: partMagasin },
      update: { quantite: partMagasin },
    });
    lignes++;
    if (partDepot > 0 && secondaire !== principal) {
      await prisma.stockDepot.upsert({
        where: { refArt_emplacement: { refArt: a.refArt, emplacement: secondaire } },
        create: { refArt: a.refArt, emplacement: secondaire, quantite: partDepot },
        update: { quantite: partDepot },
      });
      lignes++;
    }
  }
  console.log("lignes de stock par emplacement:", lignes, "sur", emplacements.length, "emplacements");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
