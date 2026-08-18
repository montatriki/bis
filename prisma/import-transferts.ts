import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import fs from "node:fs";

// Import des documents de transfert de stock depuis la production.
//
//   npx tsx --env-file=.env prisma/import-transferts.ts <fichier.json>
//
// L'export initial du projet ne contenait aucun transfert : la table
// `documents_ext` ne portait que INV, BAO, FAO, CAO, BST… La liste des
// transferts était donc vide, alors que la production en compte 9 272.
//
// Un transfert n'est pas identifié par `Type_doc` (toujours « TR ») mais par
// `Cara_doc`, dont le paramétrage porte `T_stock = 'T'` :
//   TRD bon de transfert · TRV transfert véhicule · BTR bon de sortie
//   DEC bon retour déchargement · PER perte de stock · BRT inventaire véhicule
//   REM remise
//
// `transfer_from` / `transfer_to` sont des **codes** de magasin : on les
// convertit en libellés, seule forme exploitable par `StockDepot`, qui
// travaille par emplacement nommé.

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

type DocProd = {
  Type_doc: string; Ref_doc: string; Lib_doc: string | null; Date_doc: string | null;
  Cara_doc?: string; Code_cli?: number | null; Raison_social?: string | null;
  tht_brut?: string | number; tot_remise?: string | number; tht_net?: string | number;
  tot_tva?: string | number; timbre?: string | number; totfodec?: string | number;
  ttc_net?: string | number; Solde_doc?: string | number; total_regle?: string | number;
  transfer_from?: number | null; transfer_to?: number | null;
  Code_mag?: number | null; Utilisateur?: string | null; Commercial?: string | null;
  generer?: number | null; Facturer?: number | null; comptabiliser?: number | null;
  vehicule?: string | null; id_mission?: number | null;
};

const n = (v: unknown) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const s = (v: unknown) => (v == null ? null : String(v).trim() || null);
const b = (v: unknown) => Number(v) === 1;

async function main() {
  const fichier = process.argv[2];
  if (!fichier || !fs.existsSync(fichier)) {
    console.error("Usage : npx tsx --env-file=.env prisma/import-transferts.ts <fichier.json>");
    process.exit(1);
  }

  const docs: DocProd[] = JSON.parse(fs.readFileSync(fichier, "utf8"));
  console.log(`${docs.length} document(s) de transfert à importer`);

  // Codes magasin -> libellés. On privilégie le référentiel local (les noms y
  // sont enrichis du prénom du commercial : « mokhtar 206TU7140 ») et on
  // complète avec la production pour les dépôts absents localement.
  const locaux = await prisma.refTable.findMany({ where: { kind: "depot" } });
  const parCode = new Map<string, string>();
  for (const d of locaux) if (d.code) parCode.set(String(d.code).trim(), d.label);

  const fichierDepots = fichier.replace(/[^/]+$/, "depots-prod.json");
  if (fs.existsSync(fichierDepots)) {
    for (const d of JSON.parse(fs.readFileSync(fichierDepots, "utf8"))) {
      const code = String(d.Code_mag);
      if (!parCode.has(code)) parCode.set(code, String(d.Libelle_mag ?? `Dépôt ${code}`).trim());
    }
  }

  /** Libellé d'un dépôt ; les codes disparus gardent une trace lisible. */
  const depot = (code: number | null | undefined): string | null => {
    if (code == null) return null;
    return parCode.get(String(code)) ?? `Dépôt ${code}`;
  };

  const existants = new Set(
    (await prisma.erpDocument.findMany({ select: { refDoc: true } })).map((d) => d.refDoc),
  );

  let crees = 0, ignores = 0;
  type LigneImport = Parameters<typeof prisma.erpDocument.create>[0]["data"];
  const lot: LigneImport[] = [];

  for (const d of docs) {
    const refDoc = String(d.Ref_doc ?? "").trim();
    // Une référence déjà présente appartient à un autre type de document :
    // on ne l'écrase pas, un import doit rester rejouable sans dégât.
    if (!refDoc || existants.has(refDoc)) { ignores++; continue; }
    existants.add(refDoc);

    lot.push({
      refDoc,
      nature: "Achat",
      typeDoc: "TR",
      caraDoc: s(d.Cara_doc),
      libDoc: s(d.Lib_doc),
      dateDoc: d.Date_doc ? new Date(d.Date_doc) : null,
      codeCli: d.Code_cli != null ? Number(d.Code_cli) : null,
      raisonSocial: s(d.Raison_social),
      thtBrut: n(d.tht_brut), totRemise: n(d.tot_remise), thtNet: n(d.tht_net),
      totTva: n(d.tot_tva), timbre: n(d.timbre), totFodec: n(d.totfodec),
      ttcNet: n(d.ttc_net), soldeDoc: n(d.Solde_doc), totalRegle: n(d.total_regle),
      transferFrom: depot(d.transfer_from),
      transferTo: depot(d.transfer_to),
      codeMag: d.Code_mag != null ? Number(d.Code_mag) : null,
      commercial: s(d.Commercial),
      vehicule: s(d.vehicule),
      utilisateur: s(d.Utilisateur),
      generer: b(d.generer),
      facturer: b(d.Facturer),
      comptabiliser: b(d.comptabiliser),
      // Les transferts importés sont des faits accomplis : le stock qu'ils
      // décrivent est déjà celui de l'inventaire. Les marquer « à valider »
      // inviterait à rejouer des mouvements déjà comptabilisés.
      valide: true,
    });

    if (lot.length >= 500) {
      crees += (await prisma.erpDocument.createMany({ data: lot, skipDuplicates: true })).count;
      lot.length = 0;
      process.stdout.write(`\r  ${crees} importés…`);
    }
  }

  if (lot.length > 0) {
    crees += (await prisma.erpDocument.createMany({ data: lot, skipDuplicates: true })).count;
  }

  console.log(`\n${crees} transfert(s) importé(s), ${ignores} ignoré(s) (référence déjà connue).`);

  const parCara = await prisma.erpDocument.groupBy({
    by: ["caraDoc"], where: { typeDoc: "TR" }, _count: { _all: true },
  });
  console.log("Répartition :", parCara.map((c) => `${c.caraDoc}=${c._count._all}`).join(" | "));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
