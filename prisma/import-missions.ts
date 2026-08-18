import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import fs from "node:fs";

// Complément des ordres de mission depuis la production.
//
//   npx tsx --env-file=.env prisma/import-missions.ts <ordre_mission.json>
//
// L'export initial s'arrêtait à 2 516 tournées sur 2 629. Les tournées portent
// les relevés kilométriques (départ/arrivée) qui alimentent le compteur des
// véhicules, et servent de repère au rapprochement commercial/véhicule.
//
// Rejouable : une tournée déjà connue est laissée intacte — son état a pu
// évoluer chez nous (clôture, relevé corrigé).

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

type MissionProd = {
  id_day: number; utilisateur?: string | null; commercial?: string | null;
  vehicule?: string | null; date_ordre?: string | null;
  km_depart?: number | string | null; km_arrive?: number | string | null;
  etat?: string | null; du?: string | null; au?: string | null;
};

const n = (v: unknown) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const s = (v: unknown) => { const t = v == null ? "" : String(v).trim(); return t || null; };
const date = (v: unknown) => {
  const t = s(v);
  if (!t || t.startsWith("0000-00-00")) return null;
  const d = new Date(t.replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d;
};

async function main() {
  const fichier = process.argv[2];
  if (!fichier || !fs.existsSync(fichier)) {
    console.error("Usage : npx tsx --env-file=.env prisma/import-missions.ts <ordre_mission.json>");
    process.exit(1);
  }

  const rows: MissionProd[] = JSON.parse(fs.readFileSync(fichier, "utf8"));
  console.log(`${rows.length} ordre(s) de mission en production`);

  const connus = new Set(
    (await prisma.erpMission.findMany({ select: { id: true } })).map((m) => m.id),
  );

  const lot: Parameters<typeof prisma.erpMission.create>[0]["data"][] = [];
  for (const m of rows) {
    const id = Number(m.id_day);
    if (!Number.isFinite(id) || connus.has(id)) continue;
    connus.add(id);
    lot.push({
      id,
      utilisateur: s(m.utilisateur),
      commercial: s(m.commercial),
      vehicule: s(m.vehicule),
      dateOrdre: date(m.date_ordre),
      kmDepart: n(m.km_depart), kmArrive: n(m.km_arrive),
      etat: s(m.etat),
      du: date(m.du), au: date(m.au),
    });
  }

  const crees = lot.length > 0
    ? (await prisma.erpMission.createMany({ data: lot, skipDuplicates: true })).count
    : 0;
  console.log(`${crees} tournée(s) importée(s).`);
  console.log("Total :", await prisma.erpMission.count());
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
