import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import fs from "node:fs";

// Complément des documents de vente depuis la production.
//
//   npx tsx --env-file=.env prisma/import-ventes.ts <fichier.json>
//
// L'export initial du projet s'arrêtait à 5 008 documents alors que la
// production en compte 17 904 : les listes Tickets (3 740 au lieu de 13 698) et
// Bons de commande (1 015 au lieu de 3 360) étaient donc largement tronquées,
// et tout ce qui s'appuie dessus — chiffre d'affaires, statistiques, encours —
// sous-évalué d'autant.
//
// Le script est rejouable : un document déjà présent est laissé intact.

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

type DocProd = {
  Type_doc: string; Ref_doc: string; Lib_doc?: string | null; Date_doc?: string | null;
  Cara_doc?: string | null; Code_cli?: number | null; Raison_social?: string | null;
  adr_cli?: string | null; MF?: string | null; Num_Seq?: string | null;
  tht_brut?: string | number; tot_remise?: string | number; tht_net?: string | number;
  tot_tva?: string | number; timbre?: string | number; totfodec?: string | number;
  ttc_net?: string | number; Solde_doc?: string | number; total_regle?: string | number;
  Etat?: string | null; Mode_payement?: string | null; Code_mag?: number | null;
  Utilisateur?: string | null; vehicule?: string | null; Raison_social_com?: string | null;
  id_mission?: number | null; tiers?: string | null;
};

const n = (v: unknown) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const s = (v: unknown) => (v == null ? null : String(v).trim() || null);

/**
 * `Date_doc` arrive au format `YYYYMMDDHHMMSS` ou en ISO selon les lignes.
 * Une date invalide est laissée nulle plutôt que de produire un 1970.
 */
function date(v: unknown): Date | null {
  const t = String(v ?? "").trim();
  if (!t) return null;
  const compact = /^(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?(\d{2})?$/.exec(t);
  const d = compact
    ? new Date(`${compact[1]}-${compact[2]}-${compact[3]}T${compact[4] ?? "00"}:${compact[5] ?? "00"}:${compact[6] ?? "00"}`)
    : new Date(t);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function main() {
  const fichier = process.argv[2];
  if (!fichier || !fs.existsSync(fichier)) {
    console.error("Usage : npx tsx --env-file=.env prisma/import-ventes.ts <fichier.json>");
    process.exit(1);
  }

  const docs: DocProd[] = JSON.parse(fs.readFileSync(fichier, "utf8"));
  console.log(`${docs.length} document(s) de vente en production`);

  const existants = new Set(
    (await prisma.erpDocument.findMany({ select: { refDoc: true } })).map((d) => d.refDoc),
  );
  console.log(`${existants.size} document(s) déjà présents`);

  let crees = 0, ignores = 0;
  type Ligne = Parameters<typeof prisma.erpDocument.create>[0]["data"];
  const lot: Ligne[] = [];

  for (const d of docs) {
    const refDoc = String(d.Ref_doc ?? "").trim();
    if (!refDoc || existants.has(refDoc)) { ignores++; continue; }
    existants.add(refDoc);

    lot.push({
      refDoc, nature: "Vente", typeDoc: String(d.Type_doc ?? "").trim() || "BL",
      caraDoc: s(d.Cara_doc), libDoc: s(d.Lib_doc), dateDoc: date(d.Date_doc),
      codeCli: d.Code_cli != null ? Number(d.Code_cli) : null,
      raisonSocial: s(d.Raison_social), adrCli: s(d.adr_cli), mf: s(d.MF), numSeq: s(d.Num_Seq),
      thtBrut: n(d.tht_brut), totRemise: n(d.tot_remise), thtNet: n(d.tht_net),
      totTva: n(d.tot_tva), timbre: n(d.timbre), totFodec: n(d.totfodec),
      ttcNet: n(d.ttc_net), soldeDoc: n(d.Solde_doc), totalRegle: n(d.total_regle),
      etat: s(d.Etat), modePayement: s(d.Mode_payement),
      codeMag: d.Code_mag != null ? Number(d.Code_mag) : null,
      utilisateur: s(d.Utilisateur), vehicule: s(d.vehicule),
      commercial: s(d.Raison_social_com), tiers: s(d.tiers),
      // Documents historiques : ils reflètent déjà l'état du stock et des
      // soldes, les rejouer fausserait l'inventaire.
      valide: true,
    });

    if (lot.length >= 1000) {
      crees += (await prisma.erpDocument.createMany({ data: lot, skipDuplicates: true })).count;
      lot.length = 0;
      process.stdout.write(`\r  ${crees} importés…`);
    }
  }
  if (lot.length > 0) {
    crees += (await prisma.erpDocument.createMany({ data: lot, skipDuplicates: true })).count;
  }

  console.log(`\n${crees} document(s) importé(s), ${ignores} déjà connu(s).`);

  const parType = await prisma.erpDocument.groupBy({
    by: ["typeDoc"], where: { nature: "Vente" }, _count: { _all: true },
  });
  console.log("Vente par type :", parType.map((t) => `${t.typeDoc}=${t._count._all}`).join(" | "));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
