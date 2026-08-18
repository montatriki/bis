import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import fs from "node:fs";

// Reprise des inventaires physiques depuis la production.
//
//   npx tsx --env-file=.env prisma/import-inventaires.ts <inv-lignes.json>
//
// En production un inventaire est un document d'achat de type `INV` ; chez nous
// c'est une entité à part (`Inventaire` + `InventaireLigne`) qui garde le stock
// théorique figé et l'écart valorisé. Les 598 documents historiques étaient
// bien importés comme documents, mais l'écran « Inventaire physique » lisait la
// table dédiée, restée vide.
//
// Le fichier attendu est un objet { refDoc: [lignes de la production] }.
//
// Les inventaires repris sont marqués « Validé » : ils ont déjà régularisé le
// stock en production, les rejouer le mouvementerait une seconde fois.

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

type LigneProd = {
  Ref_art?: string | null; des_art?: string | null;
  // `qte` porte l'écart signé, `qte_theorique` le stock attendu et
  // `St_physique` le comptage. `en_stock` reste à 0 sur ces documents.
  qte?: number | string | null; qte_theorique?: number | string | null;
  St_physique?: number | string | null;
  pu_ht?: number | string | null; pmp?: number | string | null;
  valeur_ht?: number | string | null;
};

const n = (v: unknown) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const s = (v: unknown) => { const t = v == null ? "" : String(v).trim(); return t || null; };
const r3 = (x: number) => Math.round(x * 1000) / 1000;

async function main() {
  const fichier = process.argv[2];
  if (!fichier || !fs.existsSync(fichier)) {
    console.error("Usage : npx tsx --env-file=.env prisma/import-inventaires.ts <inv-lignes.json>");
    process.exit(1);
  }

  const parDoc: Record<string, LigneProd[]> = JSON.parse(fs.readFileSync(fichier, "utf8"));
  const refs = Object.keys(parDoc);
  console.log(`${refs.length} inventaire(s) en production`);

  // Les entêtes sont déjà chez nous, importées comme documents d'achat INV :
  // elles portent la date, le dépôt et le libellé.
  const entetes = new Map(
    (await prisma.erpDocument.findMany({
      where: { typeDoc: "INV" },
      select: { refDoc: true, dateDoc: true, libDoc: true, codeMag: true, utilisateur: true },
    })).map((d) => [d.refDoc, d]),
  );

  const connus = new Set(
    (await prisma.inventaire.findMany({ select: { reference: true } })).map((i) => i.reference),
  );

  // Les dépôts sont désignés par un code sur le document ; l'écran affiche un
  // libellé.
  const depots = new Map(
    (await prisma.refTable.findMany({ where: { kind: "depot" } }))
      .map((d) => [String(d.code ?? "").trim(), d.label]),
  );

  let crees = 0, lignesCreees = 0, sansEntete = 0;
  for (const ref of refs) {
    if (connus.has(ref)) continue;
    const tete = entetes.get(ref);
    if (!tete) { sansEntete++; continue; }

    const lignes = parDoc[ref] ?? [];
    const inv = await prisma.inventaire.create({
      data: {
        reference: ref,
        libelle: s(tete.libDoc) ?? "INVENTAIRE",
        emplacement: depots.get(String(tete.codeMag ?? "").trim()) ?? null,
        dateInv: tete.dateDoc ?? new Date(),
        // Historique : la régularisation a déjà eu lieu en production.
        etat: "Validé",
        utilisateur: s(tete.utilisateur),
        observation: "Repris de la production",
      },
    });
    crees++;

    // La production porte les trois grandeurs : `qte_theorique` le stock
    // attendu, `St_physique` le comptage et `qte` l'écart signé. On garde
    // l'écart tel quel — c'est lui qui a régularisé le stock — et on reconstruit
    // le comptage quand il manque, pour que la fiche reste lisible.
    const vues = new Set<string>();
    const lot = [];
    for (const l of lignes) {
      const refArt = s(l.Ref_art);
      if (!refArt || vues.has(refArt)) continue;
      vues.add(refArt);
      const ecart = n(l.qte);
      const qteTheorique = n(l.qte_theorique);
      const compte = n(l.St_physique);
      const qteComptee = compte !== 0 ? compte : r3(qteTheorique + ecart);
      // `pmp` est souvent à zéro sur ces pièces : le prix unitaire du document
      // est alors la seule valorisation disponible.
      const pmp = n(l.pmp) || n(l.pu_ht);
      lot.push({
        inventaireId: inv.id, refArt, designation: s(l.des_art),
        qteTheorique, qteComptee, ecart: r3(ecart), pmp, valeurEcart: r3(ecart * pmp),
      });
    }
    if (lot.length > 0) {
      lignesCreees += (await prisma.inventaireLigne.createMany({ data: lot, skipDuplicates: true })).count;
    }
    if (crees % 100 === 0) process.stdout.write(`\r  ${crees} inventaires…`);
  }

  console.log(`\r${crees} inventaire(s) et ${lignesCreees} ligne(s) importé(s).`);
  if (sansEntete > 0) console.log(`${sansEntete} sans document d'entête, ignoré(s).`);
  console.log("Total inventaires :", await prisma.inventaire.count());
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
