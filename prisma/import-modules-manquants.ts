import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import fs from "node:fs";

// Reprise des modules restés vides après l'import initial : lignes de mission,
// réclamations, frais de mission, charges fixes, nomenclature GPAO, chéquiers.
//
//   npx tsx --env-file=.env prisma/import-modules-manquants.ts <dossier>
//
// Rejouable : une ligne déjà présente (même identifiant) est laissée intacte.

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

type Row = Record<string, unknown>;

const n = (v: unknown) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const s = (v: unknown) => { const t = v == null ? "" : String(v).trim(); return t || null; };
const b = (v: unknown) => Number(v) === 1 || v === true;

/** `0000-00-00` et les dates vides de MySQL doivent rester nulles, pas devenir 1970. */
function date(v: unknown): Date | null {
  if (v == null) return null;
  const t = String(v).trim();
  if (!t || t.startsWith("0000")) return null;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d;
}

function lire(dossier: string, nom: string): Row[] {
  const f = `${dossier}/p-${nom}.json`;
  if (!fs.existsSync(f)) return [];
  const d = JSON.parse(fs.readFileSync(f, "utf8"));
  return Array.isArray(d) ? d : (d.data ?? []);
}

async function main() {
  const dossier = process.argv[2];
  if (!dossier || !fs.existsSync(dossier)) {
    console.error("Usage : npx tsx --env-file=.env prisma/import-modules-manquants.ts <dossier>");
    process.exit(1);
  }

  // --- Lignes de mission (les visites planifiées de chaque tournée) ---------
  const lignes = lire(dossier, "ligne_mission");
  if (lignes.length) {
    const connus = new Set((await prisma.ligneMission.findMany({ select: { id: true } })).map((r) => r.id));
    // `dayId` référence une mission : une ligne dont la tournée n'a pas été
    // importée serait rejetée par la contrainte.
    const missions = new Set((await prisma.erpMission.findMany({ select: { id: true } })).map((m) => m.id));
    let orphelines = 0;
    const lot = lignes
      .filter((l) => !connus.has(n(l.id)))
      .filter((l) => { const ok = missions.has(n(l.id_day)); if (!ok) orphelines++; return ok; })
      .map((l) => ({
        id: n(l.id), dayId: n(l.id_day), codeCli: n(l.code_cli),
        clientNom: s(l.raison_social) ?? s(l.client), motif: s(l.motif),
        objectif: n(l.objectif), numOrdre: n(l.num_ordre),
        ...(s(l.etat) ? { etat: s(l.etat)! } : {}),
        heurePrevue: s(l.heure), dateVisite: date(l.date_visite ?? l.date),
        latitude: l.latitude != null ? n(l.latitude) : null,
        longitude: l.longitude != null ? n(l.longitude) : null,
        commentaire: s(l.commentaire),
      }));
    for (let i = 0; i < lot.length; i += 2000) {
      await prisma.ligneMission.createMany({ data: lot.slice(i, i + 2000), skipDuplicates: true });
    }
    console.log(`ligne_mission        : ${lot.length} importée(s)` +
      (orphelines ? `, ${orphelines} écartée(s) (tournée absente)` : ""));
  }

  // --- Réclamations client -------------------------------------------------
  const recl = lire(dossier, "reclamation_client");
  if (recl.length) {
    const connus = new Set((await prisma.reclamation.findMany({ select: { id: true } })).map((r: { id: number }) => r.id));
    // `dayId` est optionnel mais contraint : une tournée absente doit rester nulle
    // plutôt que de faire échouer tout le lot.
    const missionsR = new Set((await prisma.erpMission.findMany({ select: { id: true } })).map((m) => m.id));
    const lot = recl.filter((r) => !connus.has(n(r.id))).map((r) => ({
      id: n(r.id),
      dayId: missionsR.has(n(r.id_day)) ? n(r.id_day) : null,
      codeCli: n(r.Code_cli),
      clientNom: s(r.raison_social),
      ...(s(r.type_reclamation) ?? s(r.type) ? { type: (s(r.type_reclamation) ?? s(r.type))! } : {}),
      reclamation: s(r.reclamation) ?? "(sans description)",
      ...(s(r.etat) ? { etat: s(r.etat)! } : {}),
      reponse: s(r.reponse),
      utilisateur: s(r.id_user),
      ...(date(r.date) ? { dateReclam: date(r.date)! } : {}),
      latitude: r.latitude != null ? n(r.latitude) : null,
      longitude: r.longitude != null ? n(r.longitude) : null,
    }));
    await prisma.reclamation.createMany({ data: lot, skipDuplicates: true });
    console.log(`reclamation_client   : ${lot.length} importée(s)`);
  }

  // --- Frais de mission ----------------------------------------------------
  const frais = lire(dossier, "frais_mission");
  if (frais.length) {
    const connus = new Set((await prisma.fraisMission.findMany({ select: { id: true } })).map((r) => r.id));
    const lot = frais.filter((f) => !connus.has(n(f.id))).map((f) => ({
      id: n(f.id), dayId: n(f.id_day), refArt: s(f.ref_art),
      libelle: s(f.libelle) ?? s(f.des_art), montant: n(f.montant),
      puAchat: n(f.pu_achat), carburant: b(f.carburant),
    }));
    await prisma.fraisMission.createMany({ data: lot, skipDuplicates: true });
    console.log(`frais_mission        : ${lot.length} importé(s)`);
  }

  // --- Charges fixes -------------------------------------------------------
  const charges = lire(dossier, "charges_fixes");
  if (charges.length) {
    const connus = new Set((await prisma.chargeFixe.findMany({ select: { id: true } })).map((r) => r.id));
    let sansPeriode = 0;
    const lot = charges
      .filter((c) => !connus.has(n(c.id)))
      .filter((c) => { const ok = date(c.du) && date(c.au); if (!ok) sansPeriode++; return ok; })
      .map((c) => ({
        id: n(c.id), libelle: s(c.libelle) ?? `Charge ${n(c.id)}`,
        du: date(c.du)!, au: date(c.au)!, montant: n(c.montant),
        montantJr: n(c.montant_jr), nbJour: n(c.nb_jour),
        ...(s(c.etat) ? { etat: s(c.etat)! } : {}),
      }));
    await prisma.chargeFixe.createMany({ data: lot, skipDuplicates: true });
    console.log(`charges_fixes        : ${lot.length} importée(s)` +
      (sansPeriode ? `, ${sansPeriode} sans période` : ""));
  }

  // --- Chéquiers -----------------------------------------------------------
  const chq = lire(dossier, "chequiers");
  if (chq.length) {
    const connus = new Set((await prisma.chequier.findMany({ select: { id: true } })).map((r) => r.id));
    const lot = chq.filter((c) => !connus.has(n(c.iD_chq))).map((c) => ({
      id: n(c.iD_chq), banque: s(c.banque) ?? "—", numCompte: s(c.num_compte),
      serie: s(c.chequier), numDebut: n(c.num_debut), numFin: n(c.num_fin),
      suivant: n(c.suivant), epuise: b(c.dechirer),
    }));
    await prisma.chequier.createMany({ data: lot, skipDuplicates: true });
    console.log(`chequiers            : ${lot.length} importé(s)`);
  }

  // --- Nomenclature GPAO ---------------------------------------------------
  // La production renvoie les COMPOSANTS ; l'en-tête est la référence produit.
  const nom = lire(dossier, "nomenclature");
  if (nom.length) {
    const articles = new Set((await prisma.article.findMany({ select: { refArt: true } })).map((a) => a.refArt));
    const connus = new Set((await prisma.gpaoNomenclature.findMany({ select: { refArt: true } })).map((r) => r.refArt));
    const entetes = new Map<string, string | null>();
    for (const l of nom) {
      const ref = s(l["Réf_produit"]);
      if (ref && !entetes.has(ref)) entetes.set(ref, s(l.des));
    }
    const lot = [...entetes.entries()]
      .filter(([ref]) => !connus.has(ref) && (articles.has(ref) || articles.has(`${ref} `)))
      .map(([refArt, desArt]) => ({ refArt, desArt, elaboration: true, exploitation: true }));
    await prisma.gpaoNomenclature.createMany({ data: lot, skipDuplicates: true });
    console.log(`gpao_nomenclatures   : ${lot.length} en-tête(s) (${entetes.size} référencée(s) en production)`);

    // Les composants : c'est le contenu réel de la nomenclature. Sans eux,
    // l'écran affiche des produits sans leur décomposition.
    const têtes = new Set((await prisma.gpaoNomenclature.findMany({ select: { refArt: true } })).map((r) => r.refArt));
    const dejaLignes = await prisma.gpaoNomenclatureLigne.count();
    if (dejaLignes === 0) {
      const composants = nom
        .filter((l) => têtes.has(s(l["Réf_produit"]) ?? ""))
        .map((l) => ({
          refNom: s(l["Réf_produit"])!,
          refArt: s(l.Id_composant) ?? "—",
          desArt: s(l.des),
          numOrdre: n(l.id_n),
          qte: n(l.qte),
        }));
      for (let i = 0; i < composants.length; i += 1000) {
        await prisma.gpaoNomenclatureLigne.createMany({ data: composants.slice(i, i + 1000), skipDuplicates: true });
      }
      console.log(`  └ composants       : ${composants.length} ligne(s)`);
    }
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
