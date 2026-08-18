import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import fs from "node:fs";

// Complément du catalogue articles depuis la production.
//
//   npx tsx --env-file=.env prisma/import-articles.ts <articles.json>
//
// L'export initial s'arrêtait à 523 articles alors que la production en compte
// 551 : les fiches créées depuis manquaient à la liste des articles, aux
// matières premières et à tout ce qui s'appuie dessus (ruptures, état de
// stock, saisie de document).
//
// Rejouable : une référence déjà connue est laissée intacte — les prix et les
// stocks locaux ont pu bouger depuis, les écraser serait pire que l'écart.

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

type ArtProd = Record<string, unknown>;

const n = (v: unknown) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const s = (v: unknown) => { const t = v == null ? "" : String(v).trim(); return t || null; };
const i = (v: unknown) => (Number(v) === 1 ? 1 : 0);

/**
 * Nature de l'article, telle que la production la porte : trois drapeaux
 * exclusifs plus la charge. C'est ce qui aiguille les écrans « Liste des
 * matières » et « Liste des semi-finis ».
 */
function nature(a: ArtProd): string {
  if (Number(a.charge) === 1) return "CH";
  if (Number(a.produit_semi_fini) === 1) return "SF";
  if (Number(a.Matiere_premiere) === 1) return "MP";
  return "P";
}

async function main() {
  const fichier = process.argv[2];
  if (!fichier || !fs.existsSync(fichier)) {
    console.error("Usage : npx tsx --env-file=.env prisma/import-articles.ts <articles.json>");
    process.exit(1);
  }

  const arts: ArtProd[] = JSON.parse(fs.readFileSync(fichier, "utf8"));
  console.log(`${arts.length} article(s) en production`);

  const connus = new Set(
    (await prisma.article.findMany({ select: { refArt: true } })).map((a) => a.refArt),
  );

  const lot: Parameters<typeof prisma.article.create>[0]["data"][] = [];
  for (const a of arts) {
    const refArt = String(a.ref_art ?? "").trim();
    if (!refArt || connus.has(refArt)) continue;
    connus.add(refArt);

    lot.push({
      refArt,
      codeBarre: s(a.code_barre),
      designation: s(a.des_art) ?? refArt,
      caract: s(a.caract_art),
      codeCatalogue: n(a.code_catalogue),
      famille: a.Code_fam != null ? n(a.Code_fam) : null,
      sousFamille: a.Code_sou_fam != null ? n(a.Code_sou_fam) : null,
      unite: s(a["Unité"]),
      puAchat: n(a.pu_achat), puAchatTtc: n(a.pu_achat_ttc),
      pmp: n(a.pmp), dpa: n(a.dpa), puInv: n(a.pu_inv),
      tarif1Ht: n(a.tarif1_ht), tarif2Ht: n(a.tarif2_ht), tarif3Ht: n(a.tarif3_ht),
      maTarif1: n(a.ma_tarif1),
      tauxTva: n(a.Taux_tva), tauxFodec: n(a.Taux_fodec),
      stockIni: n(a.stock_ini), entrer: n(a.entrer), sortie: n(a.sortie), enStock: n(a.en_stock),
      vendable: i(a.vendable), achetable: i(a.achetable),
      service: i(a.service), archiver: i(a.archiver),
      refOrigine: s(a.ref_origine),
      kind: nature(a),
      fab: s(a.Code_fab),
      uniteEntree: s(a.unite_entree),
      conversion: n(a.conversion) || 1,
      stMin: n(a.st_min), stMax: n(a.st_max),
      remiseMax: n(a.rem_max), commission: n(a.commission),
      remiseParQte: i(a.remise_par_qte),
      fifo: i(a.fifo), lifo: i(a.lifo),
      gerSerie: i(a.ger_serie), gesLot: i(a.ges_lot),
      cmpteVente: s(a.Compt_vte1),
      cmpteVenteExp: s(a.Compt_vte_exp),
      cmpteVenteExo: s(a.Compt_vte_exono),
      cmpteAchatLoc: s(a.Compt_achat_loc),
      cmpteAchatImp: s(a.Compt_achat_etrang),
    });
  }

  const crees = lot.length > 0
    ? (await prisma.article.createMany({ data: lot, skipDuplicates: true })).count
    : 0;
  console.log(`${crees} article(s) importé(s).`);

  const parKind = await prisma.article.groupBy({ by: ["kind"], _count: { _all: true } });
  console.log("Par nature :", parKind.map((k) => `${k.kind}=${k._count._all}`).join(" | "));
  console.log("Total :", await prisma.article.count());
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
