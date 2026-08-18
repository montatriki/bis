import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import fs from "node:fs";

// Reprise du parc roulant depuis la production.
//
//   npx tsx --env-file=.env prisma/import-vehicules.ts <vehicules.json>
//
// La base ne contenait que 3 véhicules sur les 7 de la production, et deux
// d'entre eux portaient une marque erronée (206TU7140 était enregistré
// « Peugeot 206 » alors que c'est un Citroën Jumpy). Le parc alimente la fiche
// véhicule, les échéances (assurance, visite, taxe), le stock camion et le
// rapprochement des tournées : un matricule manquant y laisse un trou.
//
// Rejouable : un véhicule connu est mis à jour sur ses caractéristiques
// d'identité et ses échéances — ce sont les données de référence, détenues par
// la production. Le kilométrage courant, lui, est calculé chez nous à partir
// des tournées : il n'est jamais écrasé.

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

type VehProd = Record<string, unknown>;

const s = (v: unknown) => { const t = v == null ? "" : String(v).trim(); return t || null; };
const num = (v: unknown) => { const x = Number(v); return Number.isFinite(x) && x !== 0 ? x : null; };
const date = (v: unknown) => {
  const t = s(v);
  if (!t || t.startsWith("0000-00-00")) return null;
  const d = new Date(t.replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d;
};

/** « CITROEN » → « Citroën » n'est pas notre rôle : on garde la casse source
 *  mais on normalise les espaces, seuls porteurs de faux doublons. */
const propre = (v: unknown) => s(v)?.replace(/\s+/g, " ") ?? null;

async function main() {
  const fichier = process.argv[2];
  if (!fichier || !fs.existsSync(fichier)) {
    console.error("Usage : npx tsx --env-file=.env prisma/import-vehicules.ts <vehicules.json>");
    process.exit(1);
  }

  const rows: VehProd[] = JSON.parse(fs.readFileSync(fichier, "utf8"));
  console.log(`${rows.length} véhicule(s) en production`);

  let crees = 0, majs = 0;
  for (const v of rows) {
    const plate = s(v.Matricule);
    if (!plate) continue;

    const identite = {
      brand: propre(v.Marque) ?? "—",
      model: propre(v.Type),
      year: num(v.AnneModel) ?? num(v.AnModel),
      chassis: s(v.NChassis),
      typeVehicule: propre(v.Type),
      couleur: propre(v.Couleur),
      assureur: propre(v.assureur),
      insuranceStart: date(v.date_debut_assurance),
      insuranceExpiry: date(v.date_fin_assurance),
      controlStart: date(v.date_liv_visite),
      controlExpiry: date(v.date_fin_visite),
      taxPaidAt: date(v.date_pay_taxe),
      taxExpiry: date(v.date_fin_taxe),
      kmMoyen: num(v.MoyKM),
      consoMoyenneJour: num(v.consom_moy_j),
      consoCarburant: num(v.consom_carbur),
    };

    const existe = await prisma.vehicle.findUnique({ where: { plate } });
    if (existe) {
      await prisma.vehicle.update({ where: { plate }, data: identite });
      majs++;
    } else {
      await prisma.vehicle.create({ data: { plate, ...identite } });
      crees++;
    }
  }

  console.log(`${crees} véhicule(s) créé(s), ${majs} mis à jour.`);

  // Un matricule cité par une tournée mais absent du parc laisse la fiche
  // véhicule, le stock camion et les échéances sans support : on le signale.
  const missions = await prisma.erpMission.findMany({
    where: { vehicule: { not: null } }, select: { vehicule: true },
  });
  const parc = new Set(
    (await prisma.vehicle.findMany({ select: { plate: true } })).map((x) => x.plate.toUpperCase()),
  );
  const orphelins = new Map<string, number>();
  for (const m of missions) {
    const p = (m.vehicule ?? "").trim().toUpperCase();
    if (!p || parc.has(p)) continue;
    orphelins.set(p, (orphelins.get(p) ?? 0) + 1);
  }
  console.log(`\nParc : ${parc.size} véhicule(s).`);
  if (orphelins.size > 0) {
    console.log("Matricules cités par des tournées mais absents du parc :");
    for (const [p, n] of [...orphelins].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${p} — ${n} tournée(s)`);
    }
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
