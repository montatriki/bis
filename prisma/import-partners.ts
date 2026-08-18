import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import fs from "node:fs";

// Complément du portefeuille clients / fournisseurs depuis la production.
//
//   npx tsx --env-file=.env prisma/import-partners.ts <clients.json> <fournisseurs.json>
//
// L'export initial s'arrêtait à 2 399 clients sur 4 517 et 43 fournisseurs sur
// 50 : près de la moitié du portefeuille manquait, avec tout ce qui en dépend
// (créances, tournées, statistiques commerciales).
//
// Rejouable : un tiers déjà connu est laissé intact — ses soldes locaux sont
// recalculés à partir des règlements et des documents, les réécrire depuis un
// export figé les ferait diverger.

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

type TiersProd = Record<string, unknown>;

const n = (v: unknown) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const s = (v: unknown) => { const t = v == null ? "" : String(v).trim(); return t || null; };
const date = (v: unknown) => {
  const t = s(v);
  if (!t || t.startsWith("0000-00-00")) return null;
  const d = new Date(t.replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d;
};

async function importer(fichier: string, nature: "C" | "F") {
  if (!fs.existsSync(fichier)) { console.log(`  ${fichier} : absent`); return 0; }
  const rows: TiersProd[] = JSON.parse(fs.readFileSync(fichier, "utf8"));

  // Le code tiers est partagé par les deux natures dans la source : on ne
  // regarde donc que ceux de la nature en cours pour décider d'un doublon.
  const connus = new Set(
    (await prisma.partner.findMany({ where: { nature }, select: { id: true } })).map((p) => p.id),
  );
  // Un identifiant déjà pris par l'autre nature interdirait la création : la
  // clé primaire est globale.
  const pris = new Set(
    (await prisma.partner.findMany({ select: { id: true } })).map((p) => p.id),
  );

  const lot: Parameters<typeof prisma.partner.create>[0]["data"][] = [];
  let collisions = 0;
  for (const r of rows) {
    const id = Number(r.Code_cli);
    if (!Number.isFinite(id) || connus.has(id)) continue;
    if (pris.has(id)) { collisions++; continue; }
    connus.add(id); pris.add(id);

    lot.push({
      id, nature,
      raisonSocial: s(r.Raison_social) ?? `Tiers ${id}`,
      adresse: s(r.adr_cli), tel: s(r.tel), ville: s(r.ville), gouvernorat: s(r.gouvernorat),
      codeTva: s(r.codetva), cletva: s(r.cletva), categorieTva: s(r.categorietva),
      matriculeF: s(r.MF),
      famille: s(r.Fam_cli), sousFamille: s(r.Sous_fam_cli),
      soldeIni: n(r.solde_ini), debit: n(r.debit), credit: n(r.credit), soldeFin: n(r.solde_fin),
      plafond: r.plafond_encour != null ? n(r.plafond_encour) : null,
      remiseDef: n(r.Remise_def),
      commercial: s(r.commercial),
      longitude: r.longitude != null && s(r.longitude) ? n(r.longitude) : null,
      latitude: r.latitude != null && s(r.latitude) ? n(r.latitude) : null,
      exo: r.exo != null ? Number(r.exo) : null,
      assuj: r.assuj != null ? Number(r.assuj) : null,
      registreCom: s(r.registre_com),
      dateCreation: date(r.date_creation),
    });
  }

  const crees = lot.length > 0
    ? (await prisma.partner.createMany({ data: lot, skipDuplicates: true })).count
    : 0;
  console.log(`  nature ${nature} : ${crees} tiers importé(s) sur ${rows.length}`);
  if (collisions > 0) {
    console.log(`    ${collisions} code(s) déjà utilisé(s) par l'autre nature, ignoré(s)`);
  }
  return crees;
}

async function main() {
  const [fc, ff] = process.argv.slice(2);
  let total = 0;
  if (fc) total += await importer(fc, "C");
  if (ff) total += await importer(ff, "F");

  console.log(`\n${total} tiers importé(s).`);
  const parNature = await prisma.partner.groupBy({ by: ["nature"], _count: { _all: true } });
  for (const g of parNature) console.log(`  ${g.nature} : ${g._count._all}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
