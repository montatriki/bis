import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import fs from "node:fs";

// Import des lignes d'articles des documents de transfert.
//
//   npx tsx --env-file=.env prisma/import-lignes-transferts.ts <token> [depuis]
//
// Sans les lignes, le formulaire de transfert s'ouvre vide : on voit l'en-tête
// (dépôt du / dépôt au, totaux) mais pas les articles déplacés. L'ERP d'origine
// les sert par `POST /documents-achats/get-articles-achat/<Ref_doc>`.
//
// L'appel se fait document par document — l'API n'expose pas de lot — donc on
// avance par vagues avec une concurrence limitée pour ne pas saturer le serveur
// de production.

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const API = "http://41.226.17.73:3050";
/** Requêtes simultanées : au-delà, la production met plusieurs secondes à répondre. */
const CONCURRENCE = 8;

const n = (v: unknown) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };

type LigneProd = {
  Num_Order?: number; Ref_art: string; des_art?: string; qte?: number;
  pu_ht?: string | number; Remise?: number; tva?: number; fodec?: number | null;
  valeur_ht?: string | number; valeur_ttc?: string | number; Mt_tva?: string | number;
};

async function lignesDe(refDoc: string, token: string): Promise<LigneProd[]> {
  const r = await fetch(`${API}/documents-achats/get-articles-achat/${encodeURIComponent(refDoc)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: token },
    body: JSON.stringify({ token }),
    signal: AbortSignal.timeout(45_000),
  });
  const d = await r.json().catch(() => ({}));
  return Array.isArray(d?.articles) ? d.articles : [];
}

async function main() {
  const token = process.argv[2];
  if (!token) {
    console.error("Usage : npx tsx --env-file=.env prisma/import-lignes-transferts.ts <token>");
    process.exit(1);
  }

  // Documents de transfert n'ayant pas encore leurs lignes : le script est
  // ainsi rejouable et reprend là où il s'est arrêté.
  const docs = await prisma.erpDocument.findMany({
    where: { typeDoc: "TR", lignes: { none: {} } },
    select: { refDoc: true },
    orderBy: { dateDoc: "desc" },
  });
  console.log(`${docs.length} transfert(s) sans lignes`);

  let traites = 0, lignesCreees = 0, echecs = 0;

  for (let i = 0; i < docs.length; i += CONCURRENCE) {
    const vague = docs.slice(i, i + CONCURRENCE);
    const resultats = await Promise.all(
      vague.map(async (d) => {
        try {
          return { refDoc: d.refDoc, lignes: await lignesDe(d.refDoc, token) };
        } catch {
          return { refDoc: d.refDoc, lignes: null };
        }
      }),
    );

    const aCreer = [];
    for (const r of resultats) {
      if (r.lignes === null) { echecs++; continue; }
      traites++;
      for (const l of r.lignes) {
        const qte = n(l.qte);
        const puHt = n(l.pu_ht);
        aCreer.push({
          refDoc: r.refDoc,
          refArt: String(l.Ref_art ?? "").trim(),
          designation: String(l.des_art ?? "").trim() || String(l.Ref_art ?? ""),
          qte, puHt,
          remise: n(l.Remise),
          tauxTva: n(l.tva),
          tauxFodec: n(l.fodec),
          thtBrut: qte * puHt,
          thtNet: n(l.valeur_ht),
          totTva: n(l.Mt_tva),
          ttcNet: n(l.valeur_ttc),
          ordre: n(l.Num_Order),
        });
      }
    }

    if (aCreer.length > 0) {
      lignesCreees += (await prisma.erpDocumentLine.createMany({ data: aCreer })).count;
    }
    process.stdout.write(`\r  ${traites}/${docs.length} documents · ${lignesCreees} lignes · ${echecs} échec(s)`);
  }

  console.log(`\n${lignesCreees} ligne(s) importée(s) sur ${traites} document(s), ${echecs} échec(s).`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
