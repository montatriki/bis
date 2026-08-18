import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import fs from "node:fs";

// Complément des règlements depuis la production.
//
//   npx tsx --env-file=.env prisma/import-reglements.ts <clients.json> <fournisseurs.json>
//
// L'export initial ne contenait que 500 règlements clients sur 13 827 et 648
// règlements fournisseurs sur 712. Les écrans de trésorerie, les encaissements
// par mode de paiement et les soldes clients travaillaient donc sur une
// fraction de l'historique.
//
// Les deux sources sont des tables MySQL indépendantes dont les `ID_reg` se
// recouvrent (651 identifiants communs désignant des règlements différents).
// Le rapprochement se fait donc sur le couple `(sens, idSource)`, et `id` est
// une clé de substitution : identique à `ID_reg` côté client, décalée au-dessus
// de cette plage côté fournisseur. Le script reste rejouable.

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

type RegProd = {
  ID_reg: number; Date_pay?: string | null; montant?: string | number;
  "Echéance"?: string | null; Num_piece?: string | null; Commentaire?: string | null;
  "Etat_Rég"?: string | null; Utilisateur?: string | null; Code_cli?: number | null;
  ModePay?: string | null; Num_Doc?: string | null; Id_emplac?: number | null;
  banque_cli?: string | null; Raison_social?: string | null;
};

const n = (v: unknown) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const s = (v: unknown) => {
  const t = v == null ? "" : String(v).trim();
  // `0000-00-00` est la date nulle de MySQL : la garder produirait une échéance
  // absurde à l'écran.
  return !t || t.startsWith("0000-00-00") ? null : t;
};
const date = (v: unknown) => {
  const t = s(v);
  if (!t) return null;
  const d = new Date(t.replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d;
};

async function importer(fichier: string, sens: "C" | "F", nomsTiers: Map<number, string>) {
  if (!fs.existsSync(fichier)) { console.log(`  ${fichier} : absent`); return 0; }
  const rows: RegProd[] = JSON.parse(fs.readFileSync(fichier, "utf8"));

  const deja = await prisma.erpReglement.findMany({
    where: { sens }, select: { idSource: true },
  });
  const connus = new Set(deja.map((r) => r.idSource));

  // `id` reste l'`ID_reg` d'origine pour les clients — c'est la plage
  // historiquement chargée, la déplacer casserait les rattachements existants.
  // Les fournisseurs sont alloués au-dessus de tout ce qui existe déjà.
  const max = await prisma.erpReglement.aggregate({ _max: { id: true } });
  let prochainId = Math.max(max._max.id ?? 0, 0) + 1;
  // Un `id` de substitution déjà attribué à un fournisseur peut occuper une
  // valeur que la source client revendique : dans ce cas le client bascule lui
  // aussi sur un identifiant libre.
  const idsPris = new Set(
    (await prisma.erpReglement.findMany({ select: { id: true } })).map((r) => r.id),
  );

  let crees = 0;
  const lot: Parameters<typeof prisma.erpReglement.create>[0]["data"][] = [];
  for (const r of rows) {
    const idSource = Number(r.ID_reg);
    if (!Number.isFinite(idSource) || connus.has(idSource)) continue;
    connus.add(idSource);
    let id = sens === "C" && !idsPris.has(idSource) ? idSource : prochainId++;
    while (idsPris.has(id)) id = prochainId++;
    idsPris.add(id);
    const code = r.Code_cli != null ? Number(r.Code_cli) : null;
    lot.push({
      id, idSource, sens,
      datePay: date(r.Date_pay),
      montant: n(r.montant),
      echeance: s(r["Echéance"]),
      numPiece: s(r.Num_piece),
      numDoc: s(r.Num_Doc),
      etat: s(r["Etat_Rég"]),
      modePay: s(r.ModePay),
      tiersCode: code,
      // Le nom du tiers n'est pas porté par le règlement : on le reprend du
      // référentiel, sinon les listes afficheraient un simple code.
      tiersNom: s(r.Raison_social) ?? (code != null ? nomsTiers.get(code) ?? null : null),
      utilisateur: s(r.Utilisateur),
      banque: s(r.banque_cli),
      idEmplac: r.Id_emplac != null ? Number(r.Id_emplac) : null,
      commentaire: s(r.Commentaire),
    });
    if (lot.length >= 1000) {
      crees += (await prisma.erpReglement.createMany({ data: lot, skipDuplicates: true })).count;
      lot.length = 0;
      process.stdout.write(`\r  ${sens} : ${crees} importés…`);
    }
  }
  if (lot.length > 0) {
    crees += (await prisma.erpReglement.createMany({ data: lot, skipDuplicates: true })).count;
  }
  console.log(`\r  sens ${sens} : ${crees} règlement(s) importé(s) sur ${rows.length}`);
  return crees;
}

async function main() {
  const [fc, ff] = process.argv.slice(2);
  const tiers = await prisma.partner.findMany({ select: { id: true, raisonSocial: true } });
  const noms = new Map(tiers.map((t) => [t.id, t.raisonSocial]));

  let total = 0;
  if (fc) total += await importer(fc, "C", noms);
  if (ff) total += await importer(ff, "F", noms);

  console.log(`\n${total} règlement(s) importé(s).`);
  const parSens = await prisma.erpReglement.groupBy({
    by: ["sens"], _count: { _all: true }, _sum: { montant: true },
  });
  for (const g of parSens) {
    console.log(`  ${g.sens} : ${g._count._all} règlements · ${Math.round(g._sum.montant ?? 0)} TND`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
