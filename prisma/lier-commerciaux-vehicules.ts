import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Rattachement de chaque commercial à son véhicule.
//
//   npx tsx --env-file=.env prisma/lier-commerciaux-vehicules.ts [--appliquer]
//
// Sans ce lien, un commercial se connecte sans camion : son « Stock véhicule »
// est vide et ses ventes ne sont imputées à aucun emplacement. Seul Mokhtar
// était rattaché ; les quatorze autres comptes n'avaient aucun véhicule.
//
// L'ERP d'origine ne stocke pas cette affectation : elle se lit dans
// l'historique des tournées (`erp_missions`), où chaque ordre de mission porte
// le couple commercial + matricule. On retient, pour chaque véhicule, son
// **dernier conducteur connu** — un camion change de main au fil des années, et
// c'est l'affectation courante qui compte.
//
// Le rapprochement se fait d'abord sur le **nom complet** normalisé, puis sur
// le prénom seul — et seulement si ce prénom ne désigne qu'une personne. La
// production compte deux commerciaux prénommés Heni (« heni rekik » et
// « HENI LAJMI ») : s'en tenir au prénom donnerait à l'un le camion de l'autre.
//
// Sans `--appliquer`, le script se contente d'afficher ce qu'il ferait.

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

/** Nom complet normalisé : sans accents, sans casse, espaces resserrés. */
const cleNom = (v: string | null | undefined) =>
  (v ?? "")
    .normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .trim().toLowerCase().replace(/\s+/g, " ");

/** Prénom seul — utilisable uniquement s'il ne désigne qu'une personne. */
const clePrenom = (v: string | null | undefined) => cleNom(v).split(" ")[0] ?? "";

async function main() {
  const appliquer = process.argv.includes("--appliquer");

  const [vehicules, users, commerciaux, missions] = await Promise.all([
    prisma.vehicle.findMany({ select: { id: true, plate: true } }),
    prisma.user.findMany({ where: { role: "COMMERCIAL" }, select: { id: true, name: true, login: true } }),
    prisma.commercial.findMany({ select: { id: true, userId: true, vehicleId: true } }),
    prisma.erpMission.findMany({
      where: { vehicule: { not: null }, commercial: { not: null } },
      select: { vehicule: true, commercial: true, dateOrdre: true },
      orderBy: { dateOrdre: "desc" },
    }),
  ]);

  const parUser = new Map(commerciaux.map((c) => [c.userId, c]));
  const parPlaque = new Map(vehicules.map((v) => [v.plate.trim().toUpperCase(), v]));

  // Prénoms portés par plusieurs commerciaux distincts : pour eux, le prénom
  // seul ne permet pas de trancher.
  const nomsSources = new Set(missions.map((m) => cleNom(m.commercial)).filter(Boolean));
  const prenomsAmbigus = new Set<string>();
  const vus = new Map<string, string>();
  for (const nom of nomsSources) {
    const p = nom.split(" ")[0];
    const deja = vus.get(p);
    if (deja && deja !== nom) prenomsAmbigus.add(p);
    else vus.set(p, nom);
  }

  // Dernier conducteur de chaque véhicule (les missions sont déjà triées).
  const dernierConducteur = new Map<string, { nom: string; date: Date | null }>();
  for (const m of missions) {
    const plaque = (m.vehicule ?? "").trim().toUpperCase();
    if (!plaque || !parPlaque.has(plaque) || dernierConducteur.has(plaque)) continue;
    if (!cleNom(m.commercial)) continue;
    dernierConducteur.set(plaque, { nom: m.commercial ?? "", date: m.dateOrdre });
  }

  // Un utilisateur ne peut conduire qu'un véhicule, et réciproquement : le lien
  // est unique des deux côtés. Quand un même commercial est le dernier
  // conducteur de plusieurs camions, on lui laisse le plus récent.
  const candidats = [...dernierConducteur.entries()]
    .map(([plaque, d]) => ({ plaque, ...d }))
    .sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0));

  // `Commercial.vehicleId` est unique : réaffecter un camion encore rattaché à
  // son ancien conducteur violerait la contrainte. On détache tout avant de
  // réécrire les liens.
  if (appliquer) {
    await prisma.commercial.updateMany({ data: { vehicleId: null } });
  }

  const prisUser = new Set<number>();
  const prisVehicule = new Set<number>();
  const plan: { login: string; nom: string; plaque: string; date: Date | null }[] = [];
  const ecartes: { plaque: string; nom: string; motif: string }[] = [];

  for (const c of candidats) {
    const nomSource = cleNom(c.nom);
    const prenom = clePrenom(c.nom);
    // Nom complet d'abord ; prénom seul uniquement s'il est sans ambiguïté.
    const user =
      users.find((u) => cleNom(u.name) === nomSource) ??
      (prenomsAmbigus.has(prenom)
        ? undefined
        : users.find((u) => clePrenom(u.name) === prenom || u.login === prenom));
    if (!user) {
      ecartes.push({
        plaque: c.plaque, nom: c.nom,
        motif: prenomsAmbigus.has(prenom)
          ? `prénom « ${prenom} » porté par plusieurs commerciaux — rapprochement impossible sans le nom complet`
          : "aucun compte utilisateur",
      });
      continue;
    }
    if (prisUser.has(user.id)) { ecartes.push({ plaque: c.plaque, nom: c.nom, motif: `${user.login} déjà affecté à un autre véhicule` }); continue; }
    const veh = parPlaque.get(c.plaque)!;
    if (prisVehicule.has(veh.id)) { ecartes.push({ plaque: c.plaque, nom: c.nom, motif: "véhicule déjà affecté" }); continue; }

    prisUser.add(user.id); prisVehicule.add(veh.id);
    plan.push({ login: user.login, nom: user.name, plaque: c.plaque, date: c.date });

    if (appliquer) {
      const existant = parUser.get(user.id);
      if (existant) {
        await prisma.commercial.update({ where: { id: existant.id }, data: { vehicleId: veh.id } });
      } else {
        await prisma.commercial.create({ data: { userId: user.id, vehicleId: veh.id } });
      }
    }
  }

  console.log(appliquer ? "Affectations appliquées :" : "Affectations proposées (essai à blanc) :");
  for (const p of plan) {
    const d = p.date ? p.date.toISOString().slice(0, 10) : "—";
    console.log(`  ${p.login.padEnd(10)} ${p.nom.padEnd(20)} -> ${p.plaque.padEnd(11)} (dernière tournée ${d})`);
  }
  if (ecartes.length > 0) {
    console.log("\nÉcartés :");
    for (const e of ecartes) console.log(`  ${e.plaque.padEnd(11)} ${e.nom.padEnd(20)} — ${e.motif}`);
  }

  const sans = users.filter((u) => !prisUser.has(u.id));
  if (sans.length > 0) {
    console.log(`\n${sans.length} commercial(aux) sans véhicule (aucune tournée récente à leur nom) :`);
    console.log("  " + sans.map((u) => u.login).join(", "));
  }
  if (!appliquer) console.log("\nRelancer avec --appliquer pour enregistrer.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
