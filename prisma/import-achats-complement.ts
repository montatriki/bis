import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import fs from "node:fs";

// Complément des documents d'achat depuis la production (réceptions, transferts,
// factures fournisseur créés depuis notre import). Rejouable : `skipDuplicates`
// laisse intact ce qui existe déjà.

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const num = (v: unknown) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const str = (v: unknown) => { const t = v == null ? "" : String(v).trim(); return t || null; };

function date(v: unknown): Date | null {
  if (v == null) return null;
  const t = String(v).trim();
  if (!t || t.startsWith("0000")) return null;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function main() {
  const rows = JSON.parse(fs.readFileSync(process.argv[2], "utf8")) as Record<string, unknown>[];
  const connus = new Set((await prisma.erpDocument.findMany({ select: { refDoc: true } })).map((d) => d.refDoc));

  const data = rows
    .filter((r) => { const id = str(r.Ref_doc); return id && !connus.has(id); })
    .map((r) => ({
      refDoc: str(r.Ref_doc)!, nature: "Achat",
      typeDoc: str(r.Type_doc) ?? "?", caraDoc: str(r.Cara_doc), libDoc: str(r.Lib_doc),
      dateDoc: date(r.Date_doc), codeCli: r.Code_cli != null ? num(r.Code_cli) : null,
      raisonSocial: str(r.Raison_social), adrCli: str(r.adr_cli), mf: str(r.MF),
      numSeq: str(r.Num_Seq), thtBrut: num(r.tht_brut), totRemise: num(r.tot_remise),
      thtNet: num(r.tht_net), totTva: num(r.tot_tva), timbre: num(r.timbre),
      totFodec: num(r.totfodec), ttcNet: num(r.ttc_net),
      soldeDoc: num(r.Solde_doc), totalRegle: num(r.total_regle),
      etat: str(r.Etat), modePayement: str(r.Mode_payement),
      utilisateur: str(r.Utilisateur),
    }));

  for (let i = 0; i < data.length; i += 500) {
    await prisma.erpDocument.createMany({ data: data.slice(i, i + 500), skipDuplicates: true });
  }
  console.log(`documents d'achat importés : ${data.length}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
