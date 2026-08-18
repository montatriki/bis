import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import fs from "node:fs";
import path from "node:path";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any);
const DIR = path.join(process.cwd(), "prisma", "external-data");
const load = (f: string) => JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8"));
const num = (v: any) => (v == null || v === "" ? 0 : Number(v)) || 0;
const str = (v: any) => (v == null ? null : String(v));
const date = (v: any) => { if (!v) return null; const d = new Date(v); return isNaN(+d) ? null : d; };

async function importPartners(file: string, nature: string) {
  const rows = load(file);
  const seen = new Set<number>();
  const data: any[] = [];
  for (const r of rows) {
    const id = Number(r.Code_cli);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    data.push({
      id, nature,
      raisonSocial: str(r.Raison_social) ?? "—",
      adresse: str(r.adr_cli), tel: str(r.tel), fax: str(r.fax), email: str(r.email),
      ville: str(r.ville), gouvernorat: str(r.gouvernorat),
      codeTva: str(r.codetva), cletva: str(r.cletva), categorieTva: str(r.categorietva),
      matriculeF: str(r.MF), famille: str(r.Fam_cli), sousFamille: str(r.Sous_fam_cli),
      soldeIni: num(r.solde_ini), debit: num(r.debit), credit: num(r.credit), soldeFin: num(r.solde_fin),
      plafond: r.plafond_encour == null ? null : num(r.plafond_encour),
      remiseDef: num(r.Remise_def), commercial: str(r.commercial),
      longitude: r.longitude == null ? null : num(r.longitude), latitude: r.latitude == null ? null : num(r.latitude),
      archiver: num(r.archiver), exo: r.exo == null ? null : num(r.exo), assuj: r.assuj == null ? null : num(r.assuj),
      isEmploye: num(r.is_employe), registreCom: str(r.registre_com), dateCreation: date(r.date_creation),
    });
  }
  // chunked upsert via createMany (skipDuplicates)
  for (let i = 0; i < data.length; i += 500) {
    await prisma.partner.createMany({ data: data.slice(i, i + 500), skipDuplicates: true });
  }
  console.log(`  partners[${nature}]: ${data.length}`);
}

async function importArticles() {
  const rows = load("articles.json");
  const seen = new Set<string>();
  const data: any[] = [];
  for (const r of rows) {
    const id = str(r.ref_art); if (!id || seen.has(id)) continue; seen.add(id);
    const kind = r.produit_semi_fini ? "SF" : r.Matiere_premiere ? "MP" : r.charge ? "CH" : "P";
    data.push({
      kind,
      refArt: id, codeBarre: str(r.code_barre), designation: str(r.des_art) ?? "—", caract: str(r.caract_art),
      catalogue: str(r.catalogue), codeCatalogue: num(r.code_catalogue),
      famille: r.Code_fam == null ? null : num(r.Code_fam), sousFamille: r.Code_sou_fam == null ? null : num(r.Code_sou_fam),
      unite: str(r["Unité"]), puAchat: num(r.pu_achat), puAchatTtc: num(r.pu_achat_ttc), pmp: num(r.pmp), dpa: num(r.dpa), puInv: num(r.pu_inv),
      tarif1Ht: num(r.tarif1_ht), tarif2Ht: num(r.tarif2_ht), tarif3Ht: num(r.tarif3_ht), maTarif1: num(r.ma_tarif1),
      tauxTva: num(r.Taux_tva), tauxFodec: num(r.Taux_fodec),
      stockIni: num(r.stock_ini), entrer: num(r.entrer), sortie: num(r.sortie), enStock: num(r.en_stock),
      vendable: num(r.vendable), achetable: num(r.achetable), service: num(r.service), archiver: num(r.archiver), refOrigine: str(r.ref_origine),
    });
  }
  for (let i = 0; i < data.length; i += 500) await prisma.article.createMany({ data: data.slice(i, i + 500), skipDuplicates: true });
  console.log(`  articles: ${data.length}`);
}

async function importDocs(file: string, nature: string) {
  const raw = load(file);
  const rows = Array.isArray(raw) ? raw : (raw.documents ?? raw.data ?? []);
  const seen = new Set<string>();
  const data: any[] = [];
  for (const r of rows) {
    const id = str(r.Ref_doc); if (!id || seen.has(id)) continue; seen.add(id);
    data.push({
      refDoc: id, nature, typeDoc: str(r.Type_doc) ?? "?", caraDoc: str(r.Cara_doc), libDoc: str(r.Lib_doc),
      dateDoc: date(r.Date_doc), codeCli: r.Code_cli == null ? null : num(r.Code_cli), raisonSocial: str(r.Raison_social),
      adrCli: str(r.adr_cli), mf: str(r.MF), numSeq: str(r.Num_Seq),
      thtBrut: num(r.tht_brut), totRemise: num(r.tot_remise), thtNet: num(r.tht_net), totTva: num(r.tot_tva),
      timbre: num(r.timbre), totFodec: num(r.totfodec), ttcNet: num(r.ttc_net), soldeDoc: num(r.Solde_doc), totalRegle: num(r.total_regle),
      etat: str(r.etat), modePayement: str(r.mode_payement), codeMag: r.Code_mag == null ? null : num(r.Code_mag),
      utilisateur: str(r.Utilisateur), vehicule: str(r.vehicule), commercial: str(r.commercial), echeance: date(r.echeance), couleur: str(r.couleur),
    });
  }
  for (let i = 0; i < data.length; i += 500) await prisma.erpDocument.createMany({ data: data.slice(i, i + 500), skipDuplicates: true });
  console.log(`  documents[${nature}]: ${data.length}`);
}

async function importRef(file: string, kind: string, codeField: string, labelField: string) {
  const rows = load(file);
  const arr = Array.isArray(rows) ? rows : [];
  const data = arr.map((r: any) => ({ kind, code: str(r[codeField]), label: str(r[labelField]) ?? str(r[codeField]) ?? "—", data: r }));
  if (data.length) await prisma.refTable.createMany({ data });
  console.log(`  ref[${kind}]: ${data.length}`);
}

function loadArr(file: string): any[] {
  try {
    const d = load(file);
    return Array.isArray(d) ? d : (d.data ?? d.reglements ?? []);
  } catch { return []; }
}

async function importReglements(file: string, sens: string) {
  const rows = loadArr(file);
  const seen = new Set<number>();
  const data: any[] = [];
  for (const r of rows) {
    const id = Number(r.ID_reg);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    data.push({
      id, sens,
      datePay: date(r.Date_pay), montant: num(r.montant), echeance: str(r["Echéance"]),
      numPiece: str(r.Num_piece), numDoc: str(r.Num_Doc), etat: str(r["Etat_Rég"]), modePay: str(r.ModePay),
      tiersCode: r.Code_cli != null ? num(r.Code_cli) : null, tiersNom: str(r.client ?? r.fournisseur),
      utilisateur: str(r.Utilisateur), banque: str(r.banque_cli ?? r.Lib_Cpte), idEmplac: r.Id_emplac != null ? num(r.Id_emplac) : null,
      commentaire: str(r.Commentaire),
    });
  }
  for (let i = 0; i < data.length; i += 500) await prisma.erpReglement.createMany({ data: data.slice(i, i + 500), skipDuplicates: true });
  console.log(`  reglements[${sens}]: ${data.length}`);
}

async function importTreasury() {
  await prisma.erpReglement.deleteMany({});
  await prisma.erpAccount.deleteMany({});
  await prisma.erpBorderau.deleteMany({});
  await importReglements("reglements-clients.json", "C");
  await importReglements("reglements-fournisseurs.json", "F");

  const accts = loadArr("accounts.json");
  const accData = accts.filter((a) => a.Id_emplac != null).map((a) => ({
    id: num(a.Id_emplac), type: str(a.Type_emp), rib: str(a.RIB), libelle: str(a.Lib_Cpte),
    banque: str(a.Banque), agence: str(a.Agence), nature: str(a.Nature_cpte), codeJournal: str(a.code_journal), planComptable: str(a.plan_comptable),
  }));
  if (accData.length) await prisma.erpAccount.createMany({ data: accData, skipDuplicates: true });
  console.log(`  accounts: ${accData.length}`);

  const bords = loadArr("borderaux.json");
  const bordData = bords.filter((b) => b.ID_Bord != null).map((b) => ({
    id: num(b.ID_Bord), dateBord: date(b.Date_bord), numCompte: str(b.Num_compte), total: num(b.total_bord),
    type: str(b.Type_brd), mtEsp: num(b.MT_esp), utilisateur: str(b.utilisateur),
  }));
  if (bordData.length) await prisma.erpBorderau.createMany({ data: bordData, skipDuplicates: true });
  console.log(`  borderaux: ${bordData.length}`);
}

async function main() {
  console.log("📥 Importing external S.K.Y data…");
  // clear mirror tables first (idempotent re-import)
  await prisma.refTable.deleteMany({});
  await prisma.erpDocument.deleteMany({});
  await prisma.article.deleteMany({});
  await prisma.partner.deleteMany({});

  await importPartners("clients.json", "C");
  await importPartners("fournisseurs.json", "F");
  await importPartners("charges-tiers.json", "T");
  await importArticles();
  await importDocs("documents-ventes.json", "Vente");
  await importDocs("documents-achats.json", "Achat");
  await importRef("familles-clients.json", "famille-cli", "id_fam", "fam_cli");
  await importRef("sous-familles-clients.json", "sousfamille-cli", "id_sous_fam_cl", "sous_fam_cli");
  await importRef("familles-fournisseurs.json", "famille-frs", "fam_cli", "fam_cli");
  await importRef("sous-familles-fournisseurs.json", "sousfamille-frs", "sous_fam_cli", "sous_fam_cli");
  await importRef("depots.json", "depot", "Code_mag", "Libelle_mag");
  await importRef("commerciaux.json", "commercial", "code", "Raison_social_com");
  await importRef("vehicules.json", "vehicule", "Matricule", "Matricule");
  await importRef("type-documents-vente.json", "doctype-vente", "Type_doc", "Lib_doc");
  await importRef("type-documents-achat.json", "doctype-achat", "Type_doc", "Lib_doc");

  const counts = {
    partners: await prisma.partner.count(),
    articles: await prisma.article.count(),
    documents: await prisma.erpDocument.count(),
    ref: await prisma.refTable.count(),
  };
  console.log("✅ Import done:", counts);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
