import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

// Création des comptes de connexion des commerciaux.
//
// Le portefeuille d'un commercial est rattaché par le **prénom** (voir
// `cleCommercial`), car l'ERP source n'a jamais normalisé le champ
// `clients.commercial` : « MOKHTAR », « mokhtar trabelsi »… désignent la même
// personne. Le `name` du compte doit donc commencer par ce prénom, sinon
// l'utilisateur se connecte sur un portefeuille vide.
//
// Lancement :  npx tsx prisma/comptes-commerciaux.ts

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

/**
 * Commerciaux disposant d'un portefeuille réel.
 *
 * `login` est volontairement le prénom : court à saisir sur une tablette, et
 * identique à la clé de rattachement, ce qui évite les erreurs.
 */
const COMMERCIAUX = [
  { login: "mokhtar", name: "Mokhtar Trabelsi", clients: 491 },
  { login: "foued", name: "Foued Fakhfekh", clients: 437 },
  { login: "jamil", name: "Jamil", clients: 207 },
  { login: "walid", name: "Walid Elloumi", clients: 290 },
  { login: "ghassen", name: "Ghassen Baweb", clients: 193 },
  { login: "ahmad", name: "Ahmad Ben Romthane", clients: 156 },
  { login: "souhaib", name: "Souhaib Najjar", clients: 129 },
  { login: "heni", name: "Heni Rekik", clients: 126 },
  { login: "brahim", name: "Brahim Rekik", clients: 112 },
  { login: "sihem", name: "Sihem Harabi", clients: 66 },
  { login: "soumaya", name: "Soumaya", clients: 47 },
  { login: "aziz", name: "Aziz Chelly", clients: 51 },
  { login: "iyed", name: "Iyed Kacem", clients: 15 },
  { login: "ilyes", name: "Ilyes Feki", clients: 11 },
  { login: "hichem", name: "Hichem Kriaa", clients: 6 },
  { login: "zied", name: "Zied", clients: 6 },
];

/** Mot de passe commun aux comptes de démonstration. */
const MOT_DE_PASSE = "007";

async function main() {
  const hash = await bcrypt.hash(MOT_DE_PASSE, 10);
  let crees = 0;
  let existants = 0;

  for (const c of COMMERCIAUX) {
    const existant = await prisma.user.findUnique({ where: { login: c.login } });
    if (existant) {
      existants++;
      console.log(`  = ${c.login.padEnd(10)} déjà présent (${existant.name})`);
      continue;
    }

    await prisma.user.create({
      data: {
        name: c.name,
        email: `${c.login}@sky.tn`,
        login: c.login,
        password: hash,
        role: "COMMERCIAL",
        isActive: true,
      },
    });
    crees++;
    console.log(`  + ${c.login.padEnd(10)} ${c.name.padEnd(24)} ~${c.clients} clients`);
  }

  console.log(`\n${crees} compte(s) créé(s), ${existants} déjà existant(s).`);
  console.log(`Mot de passe commun : ${MOT_DE_PASSE}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
