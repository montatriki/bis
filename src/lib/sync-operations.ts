import prisma from "./prisma";
import { jeton, lire } from "./sync-production";

// Synchronisation continue des OPÉRATIONS depuis l'ERP de production — en
// lecture seule côté production.
//
// Les commerciaux travaillent toute la journée sur l'ancienne plateforme :
// tickets, règlements, tournées et fiches clients y naissent en continu. Une
// resynchronisation manuelle (scripts/resync-prod.py) est juste à l'instant
// où elle tourne, puis dérive. Ici, comme pour le stock (`sync-production.ts`),
// les écrans déclenchent d'eux-mêmes une mise à jour dès que les données
// datent de plus de `PERIME_OPERATIONS_MS`, et un forçage reste possible.
//
// Incrémental : seules les pièces nouvelles sont créées (avec leurs lignes,
// lues document par document), les existantes sont mises à jour si un champ
// vivant a changé (solde, réglé, état, tournée). Les mêmes règles que le
// script complet : heures de la prod (Tunis, UTC+1) ramenées en UTC, tournées
// et visites par id, règlements par (sens, ID_reg), clients par code sans
// toucher aux données locales (photo, créateur).

export const PERIME_OPERATIONS_MS = 10 * 60_000;
const DECALAGE_PROD_H = 1;
type Brut = Record<string, unknown>;

const n = (v: unknown, d = 0) => { const x = Number(v); return Number.isFinite(x) ? x : d; };
const s = (v: unknown) => { const t = v == null ? "" : String(v).trim(); return t || null; };
const b = (v: unknown) => n(v) !== 0;

/** Horodatage prod (heure locale de Tunis) → Date UTC ; « 0000-00-00 » → null. */
function dt(v: unknown): Date | null {
  if (!v) return null;
  let t = String(v).trim();
  if (t.startsWith("0000-00-00")) return null;
  if (/^\d{2}-\d{2}-\d{2}/.test(t)) t = "20" + t;
  const m = t.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0)) - DECALAGE_PROD_H * 3_600_000);
  return isNaN(d.getTime()) || d.getUTCFullYear() < 1900 ? null : d;
}
const memeDate = (a: Date | null, b2: Date | null) => (a?.getTime() ?? 0) === (b2?.getTime() ?? 0);
const proche = (a: number, b2: number) => Math.abs(a - b2) < 0.0005;

export type ResultatOperations = {
  documentsAjoutes: number; documentsMisAJour: number; lignesAjoutees: number;
  reglementsAjoutes: number; reglementsMisAJour: number;
  missionsAjoutees: number; missionsMisesAJour: number; visites: number;
  clientsAjoutes: number; clientsMisAJour: number;
  duree: number;
};

async function marqueur() {
  return prisma.refTable.findFirst({ where: { kind: "systeme", code: "sync-operations" } });
}

// ── Documents (ventes + achats) ──────────────────────────────────────────────
function enteteDoc(d: Brut, nature: "Vente" | "Achat", jours: Set<number>) {
  const day = n(d.ID_journee ?? d.dayID ?? d.id_day, 0);
  return {
    nature, typeDoc: s(d.Type_doc) ?? "", caraDoc: s(d.Cara_doc), libDoc: s(d.Lib_doc),
    dateDoc: dt(d.Date_doc), codeCli: d.Code_cli != null ? n(d.Code_cli) : null,
    raisonSocial: s(d.Raison_social), adrCli: s(d.adr_cli), mf: s(d.MF),
    numSeq: d.Num_Seq != null ? String(d.Num_Seq) : null,
    thtBrut: n(d.tht_brut), totRemise: n(d.tot_remise), thtNet: n(d.tht_net), totTva: n(d.tot_tva),
    timbre: n(d.timbre), totFodec: n(d.totfodec), ttcNet: n(d.ttc_net), soldeDoc: n(d.Solde_doc),
    totalRegle: n(d.totalRegle), etat: s(d.Etat_av) ?? s(d.etat), modePayement: s(d.ModePay),
    codeMag: d.Code_mag != null ? n(d.Code_mag) : null, utilisateur: s(d.Utilisateur),
    vehicule: s(d.matricule), commercial: s(d.Raison_social_com), echeance: dt(d.echeance),
    couleur: s(d.couleur), dateValide: dt(d.date_valide), valide: true,
    docSource: s(d.Doc_source), transformeEn: s(d.transforme_en),
    dayId: day > 0 && jours.has(day) ? day : null,
    generer: b(d.generer), facturer: b(d.Facturer), comptabiliser: b(d.comptabiliser), tiers: s(d.tiers),
  };
}

async function synchroniserDocuments(token: string, jours: Set<number>, r: ResultatOperations) {
  const [ventes, achats] = await Promise.all([lire<Brut[]>("documents-ventes/", token), lire<Brut[]>("documents-achats/", token)]);
  const existants = new Map(
    (await prisma.erpDocument.findMany({ select: { refDoc: true, soldeDoc: true, totalRegle: true, etat: true, dayId: true, ttcNet: true, valide: true } }))
      .map((d) => [d.refDoc, d]),
  );
  const vus = new Set<string>();
  for (const [liste, nature, route] of [[ventes, "Vente", "documents-ventes/get-articles-vente"], [achats, "Achat", "documents-achats/get-articles-achat"]] as const) {
    if (!Array.isArray(liste)) continue;
    for (const d of liste) {
      const refDoc = s(d.Ref_doc);
      if (!refDoc || vus.has(refDoc)) continue;
      vus.add(refDoc);
      const data = enteteDoc(d, nature, jours);
      const ex = existants.get(refDoc);
      if (!ex) {
        // Nouvelle pièce : en-tête puis lignes (une requête par document).
        await prisma.erpDocument.create({ data: { refDoc, ...data } });
        const detail = await lire<{ articles?: Brut[] } | Brut[]>(`${route}/${encodeURIComponent(refDoc)}`, token).catch(() => null);
        const arts = Array.isArray(detail) ? detail : detail?.articles;
        if (Array.isArray(arts) && arts.length) {
          await prisma.erpDocumentLine.createMany({
            data: arts.map((a, i) => ({
              refDoc, refArt: s(a.Ref_art) ?? "?", designation: s(a.des_art) ?? s(a.Ref_art) ?? "?", unite: s(a.unitvente),
              qte: n(a.qte), puHt: n(a.pu_ht), remise: n(a.Remise), tauxTva: n(a.tva), tauxFodec: n(a.fodec),
              thtBrut: n(a.valeur_ht), thtNet: n(a.valeur_ht), totTva: n(a.Mt_tva), ttcNet: n(a.valeur_ttc),
              ordre: n(a.Num_Order, i + 1), docLiee: s(a.Doc_liee), charge: n(a.charge),
            })),
          });
          r.lignesAjoutees += arts.length;
        }
        r.documentsAjoutes++;
      } else if (!proche(ex.soldeDoc, data.soldeDoc) || !proche(ex.totalRegle, data.totalRegle) || !proche(ex.ttcNet, data.ttcNet)
                 || (ex.etat ?? null) !== data.etat || (ex.dayId ?? null) !== data.dayId) {
        // Pièce existante dont un champ vivant a bougé (règlement, transformation, rattachement).
        await prisma.erpDocument.update({ where: { refDoc }, data });
        r.documentsMisAJour++;
      }
    }
  }
}

// ── Règlements clients ───────────────────────────────────────────────────────
async function synchroniserReglements(token: string, jours: Set<number>, r: ResultatOperations) {
  const regs = await lire<Brut[]>("reglements-clients/", token);
  if (!Array.isArray(regs)) return;
  const existants = new Map(
    (await prisma.erpReglement.findMany({ where: { sens: "C" }, select: { id: true, idSource: true, montant: true, etat: true, dayId: true, datePay: true, numDoc: true } }))
      .map((x) => [x.idSource ?? -1, x]),
  );
  let prochainId = ((await prisma.erpReglement.aggregate({ _max: { id: true } }))._max.id ?? 0) + 1;
  for (const x of regs) {
    const src = x.ID_reg != null ? n(x.ID_reg) : null;
    if (src == null) continue;
    const day = n(x.dayID, 0);
    const data = {
      datePay: dt(x.Date_pay), montant: n(x.montant), echeance: s(x["Echéance"]), numPiece: s(x.Num_piece),
      numDoc: s(x.Num_Doc), etat: s(x["Etat_Rég"]), modePay: s(x.ModePay), tiersCode: x.Code_cli != null ? n(x.Code_cli) : null,
      utilisateur: s(x.Utilisateur), banque: s(x.banque_cli), idEmplac: x.Id_emplac != null ? n(x.Id_emplac) : null,
      commentaire: s(x.Commentaire), dayId: day > 0 && jours.has(day) ? day : null, lettrage: s(x.lettrage),
    };
    const ex = existants.get(src);
    if (!ex) {
      await prisma.erpReglement.create({ data: { id: prochainId++, sens: "C", idSource: src, ...data } });
      r.reglementsAjoutes++;
    } else if (!proche(ex.montant, data.montant) || (ex.etat ?? null) !== data.etat || (ex.dayId ?? null) !== data.dayId
               || !memeDate(ex.datePay, data.datePay) || (ex.numDoc ?? null) !== data.numDoc) {
      await prisma.erpReglement.update({ where: { id: ex.id }, data });
      r.reglementsMisAJour++;
    }
  }
}

// ── Tournées et visites ──────────────────────────────────────────────────────
async function synchroniserMissions(token: string, r: ResultatOperations): Promise<Set<number>> {
  const [missions, lignes] = await Promise.all([lire<Brut[]>("ordre_mission/", token), lire<Brut[]>("ligne_mission/", token)]);
  const jours = new Set<number>();
  if (Array.isArray(missions)) {
    const existantes = new Map((await prisma.erpMission.findMany({ select: { id: true, etat: true, kmArrive: true, au: true, vehicule: true, commercial: true } })).map((m) => [m.id, m]));
    for (const m of missions) {
      const id = n(m.id_day, 0); if (!id) continue;
      jours.add(id);
      const data = {
        utilisateur: s(m.utilisateur), commercial: s(m.commercial), vehicule: s(m.vehicule), dateOrdre: dt(m.date_ordre),
        kmDepart: n(m.km_depart), kmArrive: n(m.km_arrive), etat: s(m.etat), du: dt(m.du), au: dt(m.au),
      };
      const ex = existantes.get(id);
      if (!ex) { await prisma.erpMission.create({ data: { id, ...data } }); r.missionsAjoutees++; }
      else if ((ex.etat ?? null) !== data.etat || !proche(ex.kmArrive, data.kmArrive) || !memeDate(ex.au, data.au)
               || (ex.vehicule ?? null) !== data.vehicule || (ex.commercial ?? null) !== data.commercial) {
        await prisma.erpMission.update({ where: { id }, data }); r.missionsMisesAJour++;
      }
    }
  }
  if (Array.isArray(lignes)) {
    const existantes = new Set((await prisma.ligneMission.findMany({ select: { id: true } })).map((l) => l.id));
    const nouvelles = lignes.filter((l) => n(l.id, 0) && !existantes.has(n(l.id)) && jours.has(n(l.id_day)));
    if (nouvelles.length) {
      await prisma.ligneMission.createMany({
        data: nouvelles.map((l) => ({
          id: n(l.id), dayId: n(l.id_day), codeCli: l.code_cli != null ? n(l.code_cli) : null, clientNom: s(l.client_nom),
          motif: s(l.motif), objectif: n(l.objectif), numOrdre: n(l.num_ordre), etat: s(l.etat) ?? "À visiter",
          heurePrevue: s(l.heure_prevue), dateVisite: dt(l.date_visite),
        })),
        skipDuplicates: true,
      });
      r.visites += nouvelles.length;
    }
  }
  return jours;
}

// ── Clients ──────────────────────────────────────────────────────────────────
async function synchroniserClients(token: string, r: ResultatOperations) {
  const clients = await lire<Brut[]>("clients/", token);
  if (!Array.isArray(clients)) return;
  const existants = new Map(
    (await prisma.partner.findMany({ where: { nature: "C" }, select: { id: true, raisonSocial: true, soldeFin: true, debit: true, credit: true, commercial: true, latitude: true, longitude: true, tel: true, adresse: true, plafond: true } }))
      .map((p) => [p.id, p]),
  );
  for (const c of clients) {
    const id = n(c.Code_cli, 0); if (!id) continue;
    const data = {
      raisonSocial: s(c.Raison_social) ?? `Client ${id}`, adresse: s(c.adr_cli), tel: s(c.tel), email: s(c.site_web),
      ville: s(c.ville), gouvernorat: s(c.gouvernorat), codeTva: s(c.codetva), cletva: s(c.cletva), categorieTva: s(c.categorietva),
      matriculeF: s(c.MF), famille: s(c.Fam_cli), sousFamille: s(c.Sous_fam_cli),
      soldeIni: n(c.solde_ini), debit: n(c.debit), credit: n(c.credit), soldeFin: n(c.solde_fin),
      plafond: n(c.plafond_encour) || null, remiseDef: n(c.Remise_def), commercial: s(c.commercial),
      longitude: n(c.longitude) || null, latitude: n(c.latitude) || null,
      archiver: n(c.bloq) ? 1 : 0, exo: n(c.exo) ? 1 : 0, assuj: n(c.assuj) ? 1 : 0, registreCom: s(c.registre_com),
      dateCreation: dt(c.date_creation), charge: n(c.charge) ? 1 : 0,
    };
    const ex = existants.get(id);
    if (!ex) { await prisma.partner.create({ data: { id, nature: "C", ...data } }); r.clientsAjoutes++; }
    else if (!proche(ex.soldeFin, data.soldeFin) || !proche(ex.debit, data.debit) || !proche(ex.credit, data.credit)
             || (ex.commercial ?? null) !== data.commercial || ex.raisonSocial !== data.raisonSocial
             || (ex.tel ?? null) !== data.tel || (ex.adresse ?? null) !== data.adresse
             || !proche(ex.latitude ?? 0, data.latitude ?? 0) || !proche(ex.longitude ?? 0, data.longitude ?? 0)
             || (ex.plafond ?? null) !== data.plafond) {
      // Photo et créateur (données locales) ne sont jamais écrasés.
      await prisma.partner.update({ where: { id }, data }); r.clientsMisAJour++;
    }
  }
}

/** Synchronisation complète des opérations (incrémentale). */
export async function synchroniserOperations(): Promise<ResultatOperations> {
  const debut = Date.now();
  const r: ResultatOperations = {
    documentsAjoutes: 0, documentsMisAJour: 0, lignesAjoutees: 0, reglementsAjoutes: 0, reglementsMisAJour: 0,
    missionsAjoutees: 0, missionsMisesAJour: 0, visites: 0, clientsAjoutes: 0, clientsMisAJour: 0, duree: 0,
  };
  const token = await jeton();
  await synchroniserClients(token, r);
  const jours = await synchroniserMissions(token, r);
  await synchroniserDocuments(token, jours, r);
  await synchroniserReglements(token, jours, r);
  r.duree = Date.now() - debut;

  const resume = { at: new Date().toISOString(), ...r };
  const m = await marqueur();
  if (m) await prisma.refTable.update({ where: { id: m.id }, data: { label: resume.at, data: resume } });
  else await prisma.refTable.create({ data: { kind: "systeme", code: "sync-operations", label: resume.at, data: resume } });
  return r;
}

export async function etatSyncOperations() {
  const m = await marqueur();
  const derniere = m?.label ? new Date(m.label) : null;
  return { derniere, ageMs: derniere ? Date.now() - derniere.getTime() : null, enCours, dernierResume: (m?.data as Record<string, unknown> | null) ?? null };
}

let enCours = false;

/**
 * Déclenche une synchronisation en arrière-plan si les données datent.
 * À appeler sans `await` depuis les routes métier : la requête courante sert
 * l'état connu, la suivante voit les données fraîches.
 */
export async function rafraichirOperationsSiPerime(): Promise<void> {
  if (enCours) return;
  try {
    const { ageMs } = await etatSyncOperations();
    if (ageMs !== null && ageMs < PERIME_OPERATIONS_MS) return;
    enCours = true;
    const r = await synchroniserOperations();
    if (r.documentsAjoutes || r.reglementsAjoutes || r.missionsAjoutees) {
      console.log(`[sync-operations] +${r.documentsAjoutes} docs, +${r.reglementsAjoutes} règlements, +${r.missionsAjoutees} tournées (${r.duree} ms)`);
    }
  } catch (e) {
    console.error("[sync-operations]", e instanceof Error ? e.message : e);
  } finally {
    enCours = false;
  }
}
