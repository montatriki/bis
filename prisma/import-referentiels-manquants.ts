import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import fs from "node:fs";

// Référentiels présents en production mais restés vides chez nous :
// identité de la société, types de réclamation, modèles d'impression,
// formules de nomenclature, emplacements de trésorerie.
//
//   npx tsx --env-file=.env prisma/import-referentiels-manquants.ts <dossier>
//
// Rejouable : `skipDuplicates` laisse intact ce qui existe déjà.

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const s = (v: unknown) => { const t = v == null ? "" : String(v).trim(); return t || null; };
const n = (v: unknown) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };

function lire(dossier: string, nom: string): Record<string, unknown>[] {
  const f = `${dossier}/x-${nom}.json`;
  if (!fs.existsSync(f)) return [];
  const d = JSON.parse(fs.readFileSync(f, "utf8"));
  return Array.isArray(d) ? d : (d.data ?? []);
}

async function main() {
  const dossier = process.argv[2];
  if (!dossier || !fs.existsSync(dossier)) {
    console.error("Usage : npx tsx --env-file=.env prisma/import-referentiels-manquants.ts <dossier>");
    process.exit(1);
  }

  // --- Identité de la société : elle figure sur chaque facture -------------
  const soc = lire(dossier, "societe")[0];
  if (soc) {
    const data = {
      raisonSocial: s(soc.Raison_social), activite: s(soc.Activite),
      adresse: s(soc.Adresse), codeTva: s(soc.codetva), cleTva: s(soc.cletva),
      categorieTva: s(soc.categorietva), etablissementTva: s(soc.etablisstva),
      registreCom: s(soc.registre_com), capital: n(soc.Capital),
      tel: s(soc.Tel) ?? s(soc.tel), email: s(soc.Email) ?? s(soc.email),
    };
    await prisma.refTable.upsert({
      where: { id: (await prisma.refTable.findFirst({ where: { kind: "societe" }, select: { id: true } }))?.id ?? 0 },
      create: { kind: "societe", code: "1", label: data.raisonSocial ?? "Société", data },
      update: { label: data.raisonSocial ?? "Société", data },
    });
    console.log(`societe              : ${data.raisonSocial}`);
  }

  // --- Types de réclamation : ils alimentent la liste déroulante -----------
  const types = lire(dossier, "type_reclamation");
  if (types.length) {
    const connus = new Set(
      (await prisma.refTable.findMany({ where: { kind: "type-reclamation" }, select: { label: true } }))
        .map((r) => r.label),
    );
    const lot = types
      .map((t) => ({ code: String(n(t.id_reclamation)), label: s(t.type_reclamation) ?? "" }))
      .filter((t) => t.label && !connus.has(t.label))
      .map((t) => ({ kind: "type-reclamation", code: t.code, label: t.label }));
    if (lot.length) await prisma.refTable.createMany({ data: lot, skipDuplicates: true });
    console.log(`type_reclamation     : ${lot.length}`);
  }

  // --- Modèles d'impression, par type de document -------------------------
  const modeles = lire(dossier, "modeles-impression");
  if (modeles.length) {
    const connus = new Set(
      (await prisma.refTable.findMany({ where: { kind: "modele-impression" }, select: { code: true, label: true } }))
        .map((r) => `${r.code}|${r.label}`),
    );
    const lot = modeles
      .map((m) => ({
        kind: "modele-impression",
        code: s(m.Carc_doc) ?? "?",
        label: s(m.Id_modele) ?? "Modèle",
        data: { parDefaut: n(m.par_def) === 1 },
      }))
      .filter((m) => !connus.has(`${m.code}|${m.label}`));
    if (lot.length) await prisma.refTable.createMany({ data: lot, skipDuplicates: true });
    console.log(`modeles-impression   : ${lot.length}`);
  }

  // --- Formules de nomenclature (GPAO) ------------------------------------
  const formules = lire(dossier, "formules");
  if (formules.length) {
    const connus = new Set(
      (await prisma.refTable.findMany({ where: { kind: "formule" }, select: { label: true } })).map((r) => r.label),
    );
    const lot = formules
      .map((f) => s(f.formule))
      .filter((f): f is string => !!f && !connus.has(f))
      .map((f) => ({ kind: "formule", code: f, label: f }));
    if (lot.length) await prisma.refTable.createMany({ data: lot, skipDuplicates: true });
    console.log(`formules             : ${lot.length}`);
  }

  // --- Emplacements de trésorerie (banques, caisses) ----------------------
  const empl = lire(dossier, "empla_tresor");
  if (empl.length) {
    const connus = new Set(
      (await prisma.bankAccount.findMany({ select: { label: true } })).map((b) => b.label),
    );
    const lot = empl
      .map((e) => ({
        code: String(n(e.Id_emplac) || e.RIB || e.Lib_Cpte),
        bank: s(e.Banque) ?? s(e.RIB) ?? "—",
        label: s(e.Lib_Cpte) ?? s(e.RIB) ?? "Compte",
        rib: s(e.RIB),
        // « Compte Bancaire » ou « Caisse » : la nature change le traitement
        // en trésorerie.
        type: (s(e.Type_emp) ?? "").toLowerCase().includes("caisse") ? "CAISSE" : "BANQUE",
      }))
      .filter((e) => !connus.has(e.label));
    if (lot.length) await prisma.bankAccount.createMany({ data: lot, skipDuplicates: true });
    console.log(`empla_tresor         : ${lot.length}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
