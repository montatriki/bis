import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import fs from "node:fs";

// Référentiels articles : familles, sous-familles, unités.
// Ces tables étaient vides, si bien que l'écran « Familles & unités » et les
// filtres de la fiche article n'avaient rien à proposer.
//
//   npx tsx --env-file=.env prisma/import-referentiels-articles.ts <dossier>
//
// Rejouable : `skipDuplicates` laisse intact ce qui existe déjà.

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const n = (v: unknown) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const s = (v: unknown) => { const t = v == null ? "" : String(v).trim(); return t || null; };

function lire(dossier: string, nom: string): Record<string, unknown>[] {
  const f = `${dossier}/${nom}`;
  if (!fs.existsSync(f)) return [];
  const d = JSON.parse(fs.readFileSync(f, "utf8"));
  return Array.isArray(d) ? d : (d.data ?? []);
}

async function main() {
  const dossier = process.argv[2];
  if (!dossier || !fs.existsSync(dossier)) {
    console.error("Usage : npx tsx --env-file=.env prisma/import-referentiels-articles.ts <dossier>");
    process.exit(1);
  }

  const familles = lire(dossier, "rf-fam_art.json");
  if (familles.length) {
    const data = familles
      .filter((f) => s(f.lib_fam))
      .map((f) => ({
        code: n(f.code_fam),
        libelle: s(f.lib_fam)!,
        charge: n(f.charge) === 1,
        image: s(f.Image),
      }));
    await prisma.familleArticle.createMany({ data, skipDuplicates: true });
    console.log(`familles      : ${data.length}`);
  }

  const sousFam = lire(dossier, "rf-sous_fam_art.json");
  if (sousFam.length) {
    const data = sousFam
      .filter((f) => s(f.lib_sou_fam))
      .map((f) => ({
        code: n(f.code_sou_fam),
        libelle: s(f.lib_sou_fam)!,
        charge: n(f.charge) === 1,
        lettreCompta: s(f.sous_fam_lettre_cpt),
        image: s(f.image_sous_fam),
      }));
    await prisma.sousFamilleArticle.createMany({ data, skipDuplicates: true });
    console.log(`sous-familles : ${data.length}`);
  }

  // Les unités ne sont pas exposées par un référentiel dédié : la production les
  // porte sur chaque article. On reconstitue la liste depuis le catalogue.
  const unites = lire(dossier, "rf-unites.json");
  if (unites.length) {
    const data = unites
      .filter((u) => s(u.unite))
      .map((u) => ({ unite: s(u.unite)!, libelle: s(u.unite) }));
    await prisma.uniteArticle.createMany({ data, skipDuplicates: true });
    console.log(`unités        : ${data.length}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
