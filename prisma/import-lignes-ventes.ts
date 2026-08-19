import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Import des lignes d'articles des documents de vente.
//
//   npx tsx --env-file=.env prisma/import-lignes-ventes.ts <token>
//
// Les 17 900 documents de vente avaient leurs entêtes mais pas leurs lignes :
// la statistique de vente par article n'avait que les quatre pièces saisies
// dans l'application, et la fiche d'un ticket s'ouvrait sans articles. La
// production les sert pièce par pièce (`POST
// /documents-ventes/get-articles-vente/<Ref_doc>`) — on avance donc par vagues
// à concurrence limitée, en lecture seule.
//
// Particularité : 48 références portent chez nous un suffixe `-V` (elles
// existent dans `entete_achat` **et** `entete_vente` en production, notre clé
// `refDoc` ne pouvait en garder qu'une) — la production, elle, les connaît
// sans le suffixe.
//
// Rejouable : seuls les documents encore sans lignes sont interrogés. Les
// pièces créées dans l'application (inconnues de la production) reviennent
// vides et sont laissées telles quelles.

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

async function lignesDe(refProd: string, token: string): Promise<LigneProd[]> {
  const r = await fetch(`${API}/documents-ventes/get-articles-vente/${encodeURIComponent(refProd)}`, {
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
    console.error("Usage : npx tsx --env-file=.env prisma/import-lignes-ventes.ts <token>");
    process.exit(1);
  }

  const docs = await prisma.erpDocument.findMany({
    where: { nature: "Vente", lignes: { none: {} } },
    select: { refDoc: true },
    orderBy: { dateDoc: "desc" },
  });
  console.log(`${docs.length} document(s) de vente sans lignes`);

  let traites = 0, lignesCreees = 0, vides = 0, echecs = 0;

  for (let i = 0; i < docs.length; i += CONCURRENCE) {
    const vague = docs.slice(i, i + CONCURRENCE);
    const resultats = await Promise.all(
      vague.map(async (d) => {
        // La production ne connaît pas le suffixe `-V` de nos références
        // dédoublonnées.
        const refProd = d.refDoc.endsWith("-V") ? d.refDoc.slice(0, -2) : d.refDoc;
        try {
          return { refDoc: d.refDoc, lignes: await lignesDe(refProd, token) };
        } catch {
          return { refDoc: d.refDoc, lignes: null };
        }
      }),
    );

    const aCreer = [];
    for (const r of resultats) {
      if (r.lignes === null) { echecs++; continue; }
      traites++;
      if (r.lignes.length === 0) { vides++; continue; }
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
    if ((i / CONCURRENCE) % 25 === 0 || i + CONCURRENCE >= docs.length) {
      console.log(`  ${traites}/${docs.length} documents · ${lignesCreees} lignes · ${vides} vide(s) · ${echecs} échec(s)`);
    }
  }

  console.log(`\n${lignesCreees} ligne(s) importée(s) sur ${traites} document(s) — ${vides} sans lignes en production, ${echecs} échec(s).`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
