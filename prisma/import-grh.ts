import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import fs from "node:fs";
import path from "node:path";

// Reprise du module GRH depuis la production.
//
//   npx tsx --env-file=.env prisma/import-grh.ts <dossier>
//
// Le dossier doit contenir les exports bruts :
//   g-grh_personnel.json, g-grh_session.json, g-grh_pointage.json,
//   g-grh_categorie.json, g-grh_echelon.json, g-grh_conge.json
//
// Les écrans Employés, Pointage et Traitements étaient vides : les tables
// existaient mais n'avaient jamais été alimentées.
//
// L'employé n'a pas de nom propre en production — il pointe par `code_cli` sur
// le référentiel des tiers, où sont stockés sa raison sociale et ses
// coordonnées. C'est de là que vient le nom affiché.
//
// Rejouable : un enregistrement déjà présent est laissé intact.

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

type Row = Record<string, unknown>;

const n = (v: unknown) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const s = (v: unknown) => { const t = v == null ? "" : String(v).trim(); return t || null; };
const b = (v: unknown) => Number(v) === 1;
const date = (v: unknown) => {
  const t = s(v);
  // `0000-00-00` est la date nulle de MySQL.
  if (!t || t.startsWith("0000-00-00")) return null;
  const d = new Date(t.replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d;
};

function lire(dossier: string, nom: string): Row[] {
  const f = path.join(dossier, nom);
  if (!fs.existsSync(f)) { console.log(`  ${nom} : absent`); return []; }
  const d = JSON.parse(fs.readFileSync(f, "utf8"));
  return Array.isArray(d) ? d : [];
}

async function main() {
  const dossier = process.argv[2];
  if (!dossier || !fs.existsSync(dossier)) {
    console.error("Usage : npx tsx --env-file=.env prisma/import-grh.ts <dossier>");
    process.exit(1);
  }

  // --- Nomenclatures ---------------------------------------------------
  const categories = lire(dossier, "g-grh_categorie.json");
  for (const c of categories) {
    const libelle = s(c.Categories);
    if (!libelle) continue;
    await prisma.grhCategorie.upsert({
      where: { id: n(c.id) },
      update: {}, create: { id: n(c.id), libelle },
    });
  }
  const echelons = lire(dossier, "g-grh_echelon.json");
  for (const e of echelons) {
    const libelle = s(e.Echelons);
    if (!libelle) continue;
    await prisma.grhEchelon.upsert({
      where: { id: n(e.id) },
      update: {}, create: { id: n(e.id), libelle },
    });
  }
  console.log(`Nomenclatures : ${categories.length} catégorie(s), ${echelons.length} échelon(s)`);

  // --- Sessions de paie ------------------------------------------------
  const sessions = lire(dossier, "g-grh_session.json");
  for (const x of sessions) {
    const id = n(x.id);
    if (!id) continue;
    await prisma.grhSession.upsert({
      where: { id },
      update: {},
      create: {
        id,
        libelle: s(x.Libelle_session) ?? `Session ${id}`,
        mois: x.Mois != null ? n(x.Mois) : null,
        annee: x["Années"] != null ? n(x["Années"]) : null,
        nJours: n(x.N_jours), nHeures: n(x.N_heures),
        // « en cours » en production ; tout autre état vaut clôturé.
        cloturee: String(x.Etat ?? "").trim().toLowerCase() !== "en cours",
        dateDeb: date(x.Du), dateFin: date(x.Au),
      },
    });
  }
  console.log(`Sessions : ${sessions.length}`);

  // --- Employés --------------------------------------------------------
  // Le nom vient du référentiel des tiers, l'employé n'en portant pas.
  const tiers = new Map(
    (await prisma.partner.findMany({ select: { id: true, raisonSocial: true, adresse: true, tel: true } }))
      .map((t) => [t.id, t]),
  );

  const personnel = lire(dossier, "g-grh_personnel.json");
  let employes = 0, sansTiers = 0;
  for (const p of personnel) {
    const code = s(p.code_cli);
    if (!code) continue;
    const t = tiers.get(Number(p.code_cli));
    if (!t) sansTiers++;

    const existe = await prisma.grhPersonnel.findUnique({ where: { codeEmploye: code } });
    if (existe) continue;

    await prisma.grhPersonnel.create({
      data: {
        codeEmploye: code,
        nom: t?.raisonSocial ?? `Employé ${code}`,
        adresse: t?.adresse ?? null,
        tel: t?.tel ?? null,
        sexe: s(p.sexe),
        lieuCin: s(p.lieu_cin), dateCin: date(p.date_cin),
        lieuNaiss: s(p.lieu_naiss),
        situationFamiliale: s(p.situation_familiale),
        chefFamille: b(p.chef_famille),
        nbrEnfants: n(p.nbr_enfants), nbrHandicape: n(p.nbr_endicape),
        numContrat: s(p.num_contrat),
        contratDu: date(p.contrat_du), contratAu: date(p.contrat_au),
        dateEmbauche: date(p.date_embauche), dateDepart: date(p.date_depart),
        titularisation: date(p.titularisation),
        partant: b(p.partant),
        traitement: s(p.traitement),
        salaireBase: n(p.s_base_h), coutHoraire: n(p.cout_horaire),
        njTraitNormal: n(p.nj_trait_normal) || 26,
        njMaxMois: n(p.nj_max_mois) || 30,
        smigar: b(p.smigar),
        plafondCredit: n(p.plafond_credit),
        soldeConge: n(p.solde_conge), prixConge: n(p.prix_conge),
        numCnss: s(p.num_CNSS),
        pourcentageAssGro: n(p.pourcentage_ass_gro),
        pourcentageAssAccTra: n(p.pourcentage_ass_acc_tra),
        montExoAss: n(p.mont_exo_ass),
        categorieId: p.id_categorie ? n(p.id_categorie) : null,
        echelonId: p.id_echelon ? n(p.id_echelon) : null,
        // L'employé encore présent est actif ; `partant` marque le départ.
        actif: !b(p.partant),
      },
    });
    employes++;
  }
  console.log(`Employés : ${employes} importé(s) sur ${personnel.length}`);
  if (sansTiers > 0) console.log(`  ${sansTiers} sans fiche tiers : nom générique`);

  // --- Pointages -------------------------------------------------------
  const pointages = lire(dossier, "g-grh_pointage.json");
  const codesConnus = new Set(
    (await prisma.grhPersonnel.findMany({ select: { codeEmploye: true } })).map((p) => p.codeEmploye),
  );
  const sessionsConnues = new Set(
    (await prisma.grhSession.findMany({ select: { id: true } })).map((x) => x.id),
  );

  let pts = 0, ptsIgnores = 0;
  for (const p of pointages) {
    const code = s(p.code_employe);
    const sessionId = n(p.id_session);
    // Une clé étrangère absente ferait échouer la création : ces lignes
    // orphelines existent en production, on les signale sans bloquer.
    if (!code || !codesConnus.has(code) || !sessionsConnues.has(sessionId)) { ptsIgnores++; continue; }

    const deja = await prisma.grhPointage.findUnique({
      where: { codeEmploye_sessionId: { codeEmploye: code, sessionId } },
    });
    if (deja) continue;

    await prisma.grhPointage.create({
      data: {
        codeEmploye: code, sessionId,
        regime: s(p.regime) ?? "M",
        presenceJ: n(p.presence_j), presenceH: n(p.presence_h),
        ferieJ: n(p.ferie_j), ferieH: n(p.ferie_h),
        ferieTrJ: n(p.ferie_tr_j), ferieTrH: n(p.ferie_tr_h),
        congeJ: n(p.conge_j), congeH: n(p.conge_h),
        hSupp: n(p.h_supp1) + n(p.h_supp2) + n(p.h_supp3) + n(p.h_supp4) + n(p.h_supp5),
      },
    });
    pts++;
  }
  console.log(`Pointages : ${pts} importé(s) sur ${pointages.length}`);
  if (ptsIgnores > 0) console.log(`  ${ptsIgnores} sans employé ou session connus, ignoré(s)`);

  // --- Congés ----------------------------------------------------------
  const conges = lire(dossier, "g-grh_conge.json");
  let cgs = 0, cgsIgnores = 0;
  for (const c of conges) {
    const code = s(c.code_employe);
    const debut = date(c.date_debut), fin = date(c.date_fin);
    // Sans dates le congé n'a pas de sens : la production en garde un, vide.
    if (!code || !codesConnus.has(code) || !debut || !fin) { cgsIgnores++; continue; }
    const sessionId = n(c.id_session);
    await prisma.grhConge.create({
      data: {
        codeEmploye: code,
        sessionId: sessionsConnues.has(sessionId) ? sessionId : null,
        dateDebut: debut, dateFin: fin,
        nbrJours: n(c.nbr_jours), motif: s(c.motif),
      },
    });
    cgs++;
  }
  console.log(`Congés : ${cgs} importé(s) sur ${conges.length}`);
  if (cgsIgnores > 0) console.log(`  ${cgsIgnores} incomplet(s) ou orphelin(s), ignoré(s)`);

  console.log("\nTotaux :");
  console.log("  employés  :", await prisma.grhPersonnel.count());
  console.log("  sessions  :", await prisma.grhSession.count());
  console.log("  pointages :", await prisma.grhPointage.count());
  console.log("  congés    :", await prisma.grhConge.count());
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
