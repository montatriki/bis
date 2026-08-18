import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import fs from "node:fs";

// Import des chéquiers depuis la production.
//
//   npx tsx --env-file=.env prisma/import-chequiers.ts <all-cheque.json>
//
// La production expose les feuilles une à une (`chequiers/all-cheque`) : le
// carnet lui-même n'est pas une entité, il se déduit du couple
// (banque, champ `chequier`). On reconstitue donc un `Chequier` par couple, et
// ses bornes à partir des numéros de feuille observés.
//
// Rejouable : un chèque déjà présent (même carnet, même numéro) est laissé tel
// quel — il a pu être émis depuis.

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

type ChequeProd = {
  iD_chq: number; banque?: string | null; dechirer?: number | null;
  chequier?: number | null; montant?: string | number | null;
  Date_pay?: string | null; "Echéance"?: string | null;
  Code_cli?: number | null; Num_Doc?: string | null; "Etat_Rég"?: string | null;
};

const s = (v: unknown) => {
  const t = v == null ? "" : String(v).trim();
  return !t || t.startsWith("0000-00-00") ? null : t;
};
const date = (v: unknown) => {
  const t = s(v);
  if (!t) return null;
  const d = new Date(t.replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d;
};

async function main() {
  const fichier = process.argv[2];
  if (!fichier || !fs.existsSync(fichier)) {
    console.error("Usage : npx tsx --env-file=.env prisma/import-chequiers.ts <all-cheque.json>");
    process.exit(1);
  }

  const rows: ChequeProd[] = JSON.parse(fs.readFileSync(fichier, "utf8"));
  console.log(`${rows.length} feuille(s) de chèque en production`);

  // Regroupement par carnet.
  const carnets = new Map<string, ChequeProd[]>();
  for (const r of rows) {
    const cle = `${(r.banque ?? "").trim()}|${r.chequier ?? 0}`;
    const lot = carnets.get(cle);
    if (lot) lot.push(r);
    else carnets.set(cle, [r]);
  }

  let carnetsCrees = 0, chequesCrees = 0;
  for (const [cle, feuilles] of carnets) {
    const [banque, serie] = cle.split("|");
    const numeros = feuilles.map((f) => Number(f.iD_chq)).filter(Number.isFinite);
    const numDebut = Math.min(...numeros);
    const numFin = Math.max(...numeros);

    let carnet = await prisma.chequier.findFirst({
      where: { banque: banque || "—", serie },
    });
    if (!carnet) {
      carnet = await prisma.chequier.create({
        data: {
          banque: banque || "—", serie, numDebut, numFin,
          // Les feuilles restantes commencent au premier numéro non déchiré.
          suivant: numDebut,
          epuise: false,
        },
      });
      carnetsCrees++;
    }

    const connus = new Set(
      (await prisma.cheque.findMany({
        where: { chequierId: carnet.id }, select: { numero: true },
      })).map((c) => c.numero),
    );

    const lot = feuilles
      .filter((f) => !connus.has(Number(f.iD_chq)))
      .map((f) => ({
        chequierId: carnet.id,
        numero: Number(f.iD_chq),
        montant: Number(f.montant ?? 0) || 0,
        dateEmis: date(f.Date_pay),
        echeance: date(f["Echéance"]),
        // Une feuille déchirée est hors circuit ; sinon l'état vient du
        // règlement rattaché, et à défaut la feuille est encore vierge.
        etat: Number(f.dechirer) === 1
          ? "Déchiré"
          : s(f["Etat_Rég"]) ?? "Vierge",
        tiersCode: f.Code_cli != null ? Number(f.Code_cli) : null,
        refDoc: s(f.Num_Doc),
      }));

    if (lot.length > 0) {
      chequesCrees += (await prisma.cheque.createMany({ data: lot, skipDuplicates: true })).count;
    }
  }

  console.log(`${carnetsCrees} chéquier(s) et ${chequesCrees} chèque(s) importé(s).`);
  const parEtat = await prisma.cheque.groupBy({ by: ["etat"], _count: { _all: true } });
  console.log("Par état :", parEtat.map((e) => `${e.etat}=${e._count._all}`).join(" | "));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
