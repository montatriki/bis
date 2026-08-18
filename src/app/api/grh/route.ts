import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { baremeDepuisBase, initialiserBareme, initialiserTypesCnss } from "@/lib/paie-params";
import { round3 } from "@/lib/vente-stats";

// API GRH — personnel, référentiels, pointage, congés, sessions, bulletins.
//
// GET    /api/grh?resource=personnel|fonctions|grades|services|categories|echelons
//                          |sessions|pointage|conges|bulletins|stats
// POST   /api/grh?resource=...   (création)
// PUT    /api/grh?resource=...   (modification, body.id requis)
// DELETE /api/grh?resource=...&id=...

const PAGE = 50;
const ci = (v: string) => ({ contains: v, mode: "insensitive" as const });
const s = (v: unknown) => (v == null || v === "" ? null : String(v));
const sreq = (v: unknown) => (v == null ? "" : String(v));
const num = (v: unknown) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};
const int = (v: unknown) => {
  const x = parseInt(String(v ?? ""), 10);
  return Number.isFinite(x) ? x : null;
};
const bool = (v: unknown) => v === true || v === "true" || v === 1 || v === "1";
const date = (v: unknown) => (v ? new Date(String(v)) : null);

// Contrats de travail (table `grh_contrats` de l'ERP source). Le CDI est le
// seul type sans date de fin ; les autres en exigent une.
const TYPES_CONTRAT = ["CDI", "CDD", "CIVP", "SIVP", "Stage"] as const;
const ETATS_CONTRAT = ["En cours", "Expiré", "Rompu", "Renouvelé"] as const;

// Référentiels simples : même forme { id, libelle, code }
const REFS = {
  fonctions: "grhFonction",
  grades: "grhGrade",
  services: "grhService",
  categories: "grhCategorie",
  echelons: "grhEchelon",
} as const;
type RefKey = keyof typeof REFS;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const refModel = (k: RefKey) => (prisma as any)[REFS[k]];

export async function GET(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.res;

  const sp = req.nextUrl.searchParams;
  const resource = sp.get("resource") ?? "personnel";
  const page = Math.max(0, parseInt(sp.get("page") ?? "0", 10));
  const search = (sp.get("search") ?? "").trim();

  if (resource in REFS) {
    const rows = await refModel(resource as RefKey).findMany({ orderBy: { libelle: "asc" } });
    return NextResponse.json({ rows, total: rows.length, pages: 1 });
  }

  if (resource === "personnel") {
    const actif = sp.get("actif");
    const where = {
      ...(actif === "1" ? { actif: true } : actif === "0" ? { actif: false } : {}),
      ...(search
        ? { OR: [{ nom: ci(search) }, { prenom: ci(search) }, { codeEmploye: ci(search) }, { cin: ci(search) }] }
        : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.grhPersonnel.findMany({
        where,
        orderBy: { nom: "asc" },
        skip: page * PAGE,
        take: PAGE,
        include: { fonction: true, grade: true, service: true, categorie: true, echelon: true },
      }),
      prisma.grhPersonnel.count({ where }),
    ]);
    return NextResponse.json({ rows, total, page, pages: Math.ceil(total / PAGE) });
  }

  if (resource === "sessions") {
    const rows = await prisma.grhSession.findMany({ orderBy: [{ annee: "desc" }, { mois: "desc" }] });
    return NextResponse.json({ rows, total: rows.length, pages: 1 });
  }

  if (resource === "pointage") {
    const sessionId = int(sp.get("sessionId"));
    if (!sessionId) return NextResponse.json({ error: "sessionId requis" }, { status: 400 });
    const lignes = await prisma.grhPointage.findMany({
      where: { sessionId },
      include: { personnel: { select: { nom: true, prenom: true, traitement: true } } },
      orderBy: { codeEmploye: "asc" },
    });
    // Le nom de l'employé vit sur la relation : à plat, sinon la grille
    // affiche une colonne « Employé » vide en face de chaque pointage.
    const rows = lignes.map(({ personnel, ...p }) => ({
      ...p,
      nom: personnel?.nom ?? null,
      prenom: personnel?.prenom ?? null,
      traitement: personnel?.traitement ?? p.regime,
    }));
    return NextResponse.json({ rows, total: rows.length, pages: 1 });
  }

  // Crédits employés : avance versée à un salarié, remboursée en N échéances
  // mensuelles. Chaque échéance est un règlement `modePay = "Crédit"`, comme
  // dans l'ERP d'origine (`grh-module/create-credit`) — pas de table dédiée.
  // Les employés au sens « crédit » sont des tiers du plan comptable marqués
  // `isEmploye` (comptes 415…), et non des fiches `GrhPersonnel` : c'est sur
  // eux que l'ERP d'origine impute les avances, via leur compte tiers.
  if (resource === "employes-liste") {
    const rows = await prisma.partner.findMany({
      where: { isEmploye: { not: 0 }, archiver: 0 },
      orderBy: { raisonSocial: "asc" },
      select: { id: true, raisonSocial: true, soldeFin: true },
    });
    return NextResponse.json({
      rows: rows.map((e) => ({ id: e.id, nom: e.raisonSocial, soldeFin: e.soldeFin })),
      total: rows.length,
    });
  }

  if (resource === "credits") {
    const codeEmploye = sp.get("codeEmploye");
    const rows = await prisma.erpReglement.findMany({
      where: {
        modePay: "Crédit",
        ...(codeEmploye ? { tiersCode: Number(codeEmploye) } : {}),
      },
      orderBy: [{ tiersCode: "asc" }, { echeance: "asc" }],
      take: 500,
    });

    // Regroupement par employé : l'exploitant raisonne en « crédit accordé »,
    // pas en échéance isolée.
    const parEmploye = new Map<string, {
      tiersCode: number | null; tiersNom: string | null;
      total: number; regle: number; reste: number; nbEcheances: number; nbReglees: number;
      echeances: typeof rows;
    }>();
    for (const r of rows) {
      const cle = String(r.tiersCode ?? r.tiersNom ?? "?");
      const g = parEmploye.get(cle) ?? {
        tiersCode: r.tiersCode, tiersNom: r.tiersNom,
        total: 0, regle: 0, reste: 0, nbEcheances: 0, nbReglees: 0, echeances: [],
      };
      g.total += r.montant;
      g.nbEcheances += 1;
      // « Encaissé » marque une échéance déjà retenue sur salaire.
      if ((r.etat ?? "").toLowerCase().startsWith("encaiss")) { g.regle += r.montant; g.nbReglees += 1; }
      g.echeances.push(r);
      parEmploye.set(cle, g);
    }

    const credits = [...parEmploye.values()].map((g) => ({
      ...g,
      total: round3(g.total),
      regle: round3(g.regle),
      reste: round3(g.total - g.regle),
    }));

    return NextResponse.json({
      rows: credits,
      total: credits.length,
      montantTotal: round3(credits.reduce((t, c) => t + c.total, 0)),
      resteTotal: round3(credits.reduce((t, c) => t + c.reste, 0)),
    });
  }

  if (resource === "conges") {
    const codeEmploye = sp.get("codeEmploye");
    const rows = await prisma.grhConge.findMany({
      where: codeEmploye ? { codeEmploye } : undefined,
      include: { personnel: { select: { nom: true, prenom: true } } },
      orderBy: { dateDebut: "desc" },
      take: 200,
    });
    return NextResponse.json({ rows, total: rows.length, pages: 1 });
  }

  if (resource === "bulletins") {
    const sessionId = int(sp.get("sessionId"));
    const rows = await prisma.grhBulletin.findMany({
      where: sessionId ? { sessionId } : undefined,
      include: { personnel: { select: { nom: true, prenom: true, codeEmploye: true } } },
      orderBy: { codeEmploye: "asc" },
    });
    const agg = await prisma.grhBulletin.aggregate({
      where: sessionId ? { sessionId } : undefined,
      _sum: { brutImposable: true, cnss: true, irpp: true, css: true, netAPayer: true },
    });
    return NextResponse.json({ rows, total: rows.length, pages: 1, sum: agg._sum });
  }

  if (resource === "contrats") {
    const personnelId = int(sp.get("personnelId"));
    const etat = (sp.get("etat") ?? "").trim();
    const rows = await prisma.grhContrat.findMany({
      where: {
        ...(personnelId ? { personnelId } : {}),
        ...(etat && etat !== "Tous" ? { etat } : {}),
      },
      include: { personnel: { select: { nom: true, prenom: true, codeEmploye: true } } },
      orderBy: [{ dateDebut: "desc" }],
    });

    // Un CDD dont la date de fin est passée est expiré, quel que soit l'état
    // enregistré : la base ne se met pas à jour toute seule.
    const maintenant = new Date();
    const enrichis = rows.map((c) => {
      const expire = c.dateFin != null && c.dateFin < maintenant;
      const joursRestants = c.dateFin
        ? Math.ceil((c.dateFin.getTime() - maintenant.getTime()) / 86_400_000)
        : null;
      return {
        ...c,
        expire,
        etatEffectif: expire && c.etat === "En cours" ? "Expiré" : c.etat,
        joursRestants,
        // Alerte de renouvellement : moins de 30 jours avant l'échéance.
        aRenouveler: c.etat === "En cours" && joursRestants != null && joursRestants >= 0 && joursRestants <= 30,
      };
    });

    return NextResponse.json({
      rows: enrichis,
      total: enrichis.length,
      pages: 1,
      types: TYPES_CONTRAT,
      etats: ETATS_CONTRAT,
      aRenouveler: enrichis.filter((c) => c.aRenouveler).length,
      expires: enrichis.filter((c) => c.expire && c.etat === "En cours").length,
    });
  }

  // ---- Paramétrage de paie : rubriques, grilles, types CNSS, barème IRPP ----

  if (resource === "rubriques") {
    const rows = await prisma.grhRubrique.findMany({
      orderBy: { code: "asc" },
      include: { _count: { select: { lignes: true } } },
    });
    return NextResponse.json({
      rows: rows.map((r) => ({ ...r, nbAffectations: r._count.lignes })),
      total: rows.length, pages: 1,
    });
  }

  if (resource === "rubriques-employe") {
    const codeEmploye = (sp.get("codeEmploye") ?? "").trim();
    const sessionId = int(sp.get("sessionId"));
    const rows = await prisma.grhRubriqueEmploye.findMany({
      where: {
        ...(codeEmploye ? { codeEmploye } : {}),
        // Les rubriques permanentes (sessionId nul) s'appliquent à toute session.
        ...(sessionId ? { OR: [{ sessionId }, { sessionId: null }] } : {}),
      },
      include: {
        rubrique: true,
        personnel: { select: { nom: true, prenom: true, codeEmploye: true } },
      },
      orderBy: [{ codeEmploye: "asc" }, { rubriqueId: "asc" }],
    });
    return NextResponse.json({
      rows: rows.map((r) => ({
        ...r,
        // Montant effectif : × quantité si la rubrique est « par quantité ».
        total: r.rubrique.parQuantite ? r.montant * r.quantite : r.montant,
        permanente: r.sessionId == null,
      })),
      total: rows.length, pages: 1,
    });
  }

  if (resource === "grilles") {
    const rows = await prisma.grhGrilleSalaire.findMany({
      orderBy: [{ regime: "asc" }, { categorie: "asc" }, { echelon: "asc" }],
    });
    return NextResponse.json({ rows, total: rows.length, pages: 1 });
  }

  if (resource === "types-cnss") {
    const rows = await prisma.grhTypeCnss.findMany({ orderBy: { code: "asc" } });
    return NextResponse.json({ rows, total: rows.length, pages: 1 });
  }

  if (resource === "bareme-irpp") {
    const rows = await prisma.grhTrancheIrpp.findMany({ orderBy: { du: "asc" } });
    // On renvoie le barème effectivement utilisé par le moteur, avec ses alertes :
    // un barème en base incomplet est plus dangereux qu'aucun barème.
    const { bareme, source, alerte } = await baremeDepuisBase();
    return NextResponse.json({
      rows, total: rows.length, pages: 1,
      baremeApplique: bareme.map((t) => ({ du: t.du, au: Number.isFinite(t.au) ? t.au : null, taux: t.taux })),
      source,
      ...(alerte ? { alerte } : {}),
    });
  }

  if (resource === "stats") {
    const [effectif, actifs, sessions, congesEnAttente] = await Promise.all([
      prisma.grhPersonnel.count(),
      prisma.grhPersonnel.count({ where: { actif: true } }),
      prisma.grhSession.count(),
      prisma.grhConge.count({ where: { statut: "En attente" } }),
    ]);
    const masse = await prisma.grhBulletin.aggregate({ _sum: { netAPayer: true } });

    // Contrats arrivant à échéance sous 30 jours — à renouveler ou à solder.
    const dans30j = new Date(Date.now() + 30 * 86_400_000);
    const contratsARenouveler = await prisma.grhContrat.count({
      where: { etat: "En cours", dateFin: { not: null, gte: new Date(), lte: dans30j } },
    });

    return NextResponse.json({
      effectif,
      actifs,
      sessions,
      congesEnAttente,
      masseSalariale: masse._sum.netAPayer ?? 0,
      contratsARenouveler,
    });
  }

  return NextResponse.json({ error: "resource inconnue" }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.res;

  const resource = req.nextUrl.searchParams.get("resource") ?? "";
  const body = await req.json().catch(() => ({}));

  try {
    if (resource in REFS) {
      const row = await refModel(resource as RefKey).create({
        data: { libelle: sreq(body.libelle), code: s(body.code) },
      });
      return NextResponse.json({ ok: true, row });
    }

    if (resource === "personnel") {
      const codeEmploye = sreq(body.codeEmploye);
      if (!codeEmploye) return NextResponse.json({ error: "Matricule requis" }, { status: 400 });
      const row = await prisma.grhPersonnel.create({
        data: { ...personnelData(body), codeEmploye },
      });
      return NextResponse.json({ ok: true, row });
    }

    if (resource === "sessions") {
      const row = await prisma.grhSession.create({
        data: {
          libelle: sreq(body.libelle),
          mois: int(body.mois),
          annee: int(body.annee),
          nHeures: num(body.nHeures),
          nJours: body.nJours != null ? num(body.nJours) : 26,
          dateDeb: date(body.dateDeb),
          dateFin: date(body.dateFin),
        },
      });
      return NextResponse.json({ ok: true, row });
    }

    // Accorde un crédit à un employé : le montant est réparti en `nbEcheances`
    // prélèvements mensuels, chacun enregistré comme un règlement à échoir.
    if (resource === "credits") {
      const codeEmploye = Number(body.codeEmploye);
      const nom = String(body.nom ?? "").trim();
      const montant = Number(body.montant);
      const nbEcheances = Math.floor(Number(body.nbEcheances));
      const premiere = date(body.premiereEcheance) ?? new Date();

      if (!Number.isFinite(codeEmploye)) {
        return NextResponse.json({ error: "Employé requis" }, { status: 400 });
      }
      if (!Number.isFinite(montant) || montant <= 0) {
        return NextResponse.json({ error: "Le montant doit être supérieur à 0" }, { status: 400 });
      }
      if (!Number.isFinite(nbEcheances) || nbEcheances < 1 || nbEcheances > 60) {
        return NextResponse.json({ error: "Le nombre d'échéances doit être entre 1 et 60" }, { status: 400 });
      }

      // Répartition au millime près : la division ne tombe pas juste (1000/3),
      // le reliquat est porté par la dernière échéance pour que la somme des
      // prélèvements égale exactement le crédit accordé.
      const tranche = round3(montant / nbEcheances);

      // `ErpReglement.id` reprend `ID_reg` de l'ERP et n'est pas
      // auto-incrémenté : on numérote à la suite du plus grand existant, comme
      // le fait `getMaxReglementID` dans l'application d'origine.
      const dernier = await prisma.erpReglement.findFirst({
        orderBy: { id: "desc" }, select: { id: true },
      });
      const baseId = (dernier?.id ?? 0) + 1;

      const echeances = Array.from({ length: nbEcheances }, (_, i) => {
        const dernier = i === nbEcheances - 1;
        const valeur = dernier ? round3(montant - tranche * (nbEcheances - 1)) : tranche;
        // L'ERP d'origine espace les tranches de 30 jours calendaires
        // (`getDate() + 30`), pas d'un mois calendaire : on garde ce pas pour
        // que les échéanciers restent comparables entre les deux applications.
        const d = new Date(premiere);
        d.setDate(d.getDate() + 30 * i);
        const restant = round3(montant - tranche * i);
        return {
          id: baseId + i,
          sens: "F" as const,
          modePay: "Crédit",
          etat: "En cours",
          montant: valeur,
          datePay: d,
          echeance: d.toISOString().slice(0, 10),
          tiersCode: codeEmploye,
          tiersNom: nom || null,
          commentaire: `${i + 1}/${nbEcheances} reste : ${restant.toFixed(3)} / ${montant.toFixed(3)}`,
          utilisateur: auth.user.name,
        };
      });

      const res = await prisma.erpReglement.createMany({ data: echeances });
      return NextResponse.json({
        ok: true,
        creees: res.count,
        tranche,
        message: `Crédit de ${montant.toFixed(3)} accordé — ${res.count} échéance(s) de ${tranche.toFixed(3)}`,
      });
    }

    if (resource === "conges") {
      const d1 = date(body.dateDebut);
      const d2 = date(body.dateFin);
      if (!d1 || !d2) return NextResponse.json({ error: "Dates requises" }, { status: 400 });
      // Nombre de jours calendaires, bornes incluses.
      const nbrJours =
        body.nbrJours != null
          ? num(body.nbrJours)
          : Math.max(1, Math.round((d2.getTime() - d1.getTime()) / 86400000) + 1);
      const row = await prisma.grhConge.create({
        data: {
          codeEmploye: sreq(body.codeEmploye),
          sessionId: int(body.sessionId),
          dateDebut: d1,
          dateFin: d2,
          nbrJours,
          motif: s(body.motif),
          statut: sreq(body.statut) || "En attente",
        },
      });
      return NextResponse.json({ ok: true, row });
    }

    // ---- Paramétrage de paie ----

    if (resource === "rubriques") {
      const code = sreq(body.code).trim();
      const libelle = sreq(body.libelle).trim();
      if (!code || !libelle) return NextResponse.json({ error: "Code et libellé requis" }, { status: 400 });
      const exist = await prisma.grhRubrique.findUnique({ where: { code } });
      if (exist) return NextResponse.json({ error: `La rubrique ${code} existe déjà` }, { status: 409 });

      const row = await prisma.grhRubrique.create({
        data: {
          code, libelle,
          sens: sreq(body.sens) === "Retenue" ? "Retenue" : "Gain",
          soumisCnss: body.soumisCnss == null ? true : bool(body.soumisCnss),
          soumisIrpp: body.soumisIrpp == null ? true : bool(body.soumisIrpp),
          soumisAccTravail: bool(body.soumisAccTravail),
          soumisAssGroupe: bool(body.soumisAssGroupe),
          prorataAbsence: bool(body.prorataAbsence),
          parQuantite: bool(body.parQuantite),
          actif: body.actif == null ? true : bool(body.actif),
        },
      });
      return NextResponse.json({ ok: true, row });
    }

    if (resource === "rubriques-employe") {
      const rubriqueId = int(body.rubriqueId);
      const codeEmploye = sreq(body.codeEmploye).trim();
      if (!rubriqueId || !codeEmploye) {
        return NextResponse.json({ error: "Rubrique et employé requis" }, { status: 400 });
      }
      const [rub, emp] = await Promise.all([
        prisma.grhRubrique.findUnique({ where: { id: rubriqueId } }),
        prisma.grhPersonnel.findUnique({ where: { codeEmploye } }),
      ]);
      if (!rub) return NextResponse.json({ error: "Rubrique introuvable" }, { status: 404 });
      if (!emp) return NextResponse.json({ error: "Employé introuvable" }, { status: 404 });

      // sessionId nul = rubrique permanente, appliquée à toutes les sessions.
      // `upsert` sur la contrainte composée est impossible ici : Prisma n'accepte
      // pas un NULL dans une clé unique composée. On cherche donc d'abord.
      const sessionId = int(body.sessionId);
      const valeurs = {
        montant: num(body.montant),
        quantite: body.quantite != null ? num(body.quantite) : 1,
      };

      const existant = await prisma.grhRubriqueEmploye.findFirst({
        where: { rubriqueId, codeEmploye, sessionId },
        select: { id: true },
      });

      const row = existant
        ? await prisma.grhRubriqueEmploye.update({ where: { id: existant.id }, data: valeurs })
        : await prisma.grhRubriqueEmploye.create({
            data: { rubriqueId, codeEmploye, sessionId, ...valeurs },
          });
      return NextResponse.json({ ok: true, row });
    }

    if (resource === "grilles") {
      const regime = sreq(body.regime).trim() || "M";
      const categorie = sreq(body.categorie).trim();
      const echelon = sreq(body.echelon).trim();
      if (!categorie || !echelon) {
        return NextResponse.json({ error: "Catégorie et échelon requis" }, { status: 400 });
      }
      const exist = await prisma.grhGrilleSalaire.findUnique({
        where: { regime_categorie_echelon: { regime, categorie, echelon } },
      });
      if (exist) {
        return NextResponse.json(
          { error: `Une ligne existe déjà pour ${regime} / ${categorie} / ${echelon}` },
          { status: 409 }
        );
      }
      const row = await prisma.grhGrilleSalaire.create({
        data: {
          regime, categorie, echelon,
          salaireBase: num(body.salaireBase),
          dureeEchelon: num(body.dureeEchelon),
        },
      });
      return NextResponse.json({ ok: true, row });
    }

    if (resource === "types-cnss") {
      if (bool(body.init)) {
        const res = await initialiserTypesCnss();
        return NextResponse.json({ ok: true, ...res, message: `${res.crees} type(s) créé(s), ${res.total} au total` });
      }
      const code = sreq(body.code).trim();
      const libelle = sreq(body.libelle).trim();
      if (!code || !libelle) return NextResponse.json({ error: "Code et libellé requis" }, { status: 400 });
      const exist = await prisma.grhTypeCnss.findUnique({ where: { code } });
      if (exist) return NextResponse.json({ error: `Le type ${code} existe déjà` }, { status: 409 });

      const parDefaut = bool(body.parDefaut);
      // Un seul type par défaut : sinon le choix appliqué serait arbitraire.
      if (parDefaut) await prisma.grhTypeCnss.updateMany({ data: { parDefaut: false } });

      const row = await prisma.grhTypeCnss.create({
        data: {
          code, libelle,
          retCnss: body.retCnss != null ? num(body.retCnss) : 9.18,
          chCnss: body.chCnss != null ? num(body.chCnss) : 16.57,
          retCavis: num(body.retCavis),
          chCavis: num(body.chCavis),
          retenuIrpp: body.retenuIrpp == null ? true : bool(body.retenuIrpp),
          parDefaut,
        },
      });
      return NextResponse.json({ ok: true, row });
    }

    if (resource === "bareme-irpp") {
      if (bool(body.init)) {
        const res = await initialiserBareme();
        return NextResponse.json({ ok: true, ...res, message: `${res.crees} tranche(s) créée(s)` });
      }
      const du = num(body.du);
      const exist = await prisma.grhTrancheIrpp.findUnique({ where: { du } });
      if (exist) return NextResponse.json({ error: `Une tranche démarre déjà à ${du}` }, { status: 409 });
      const row = await prisma.grhTrancheIrpp.create({
        data: {
          du,
          // `au` nul = dernière tranche, non bornée.
          au: body.au == null || body.au === "" ? null : num(body.au),
          taux: num(body.taux),
        },
      });
      return NextResponse.json({ ok: true, row });
    }

    if (resource === "contrats") {
      const personnelId = int(body.personnelId);
      if (!personnelId) return NextResponse.json({ error: "Employé requis" }, { status: 400 });

      const emp = await prisma.grhPersonnel.findUnique({
        where: { id: personnelId },
        select: { id: true, salaireBase: true },
      });
      if (!emp) return NextResponse.json({ error: "Employé introuvable" }, { status: 404 });

      const typeContrat = sreq(body.typeContrat) || "CDI";
      if (!(TYPES_CONTRAT as readonly string[]).includes(typeContrat)) {
        return NextResponse.json({ error: `Type de contrat invalide : ${typeContrat}` }, { status: 400 });
      }

      const dateDebut = date(body.dateDebut);
      if (!dateDebut) return NextResponse.json({ error: "Date de début requise" }, { status: 400 });

      const dateFin = date(body.dateFin);
      // Un contrat à durée déterminée sans terme n'en est pas un.
      if (typeContrat !== "CDI" && !dateFin) {
        return NextResponse.json(
          { error: `Un contrat ${typeContrat} exige une date de fin` },
          { status: 400 }
        );
      }
      if (dateFin && dateFin <= dateDebut) {
        return NextResponse.json({ error: "La date de fin doit suivre la date de début" }, { status: 400 });
      }

      // Deux contrats « En cours » qui se chevauchent pour le même employé
      // rendraient sa situation contractuelle indéterminée.
      const chevauche = await prisma.grhContrat.findFirst({
        where: {
          personnelId,
          etat: "En cours",
          dateDebut: { lte: dateFin ?? new Date(8640000000000000) },
          OR: [{ dateFin: null }, { dateFin: { gte: dateDebut } }],
        },
        select: { id: true, reference: true, typeContrat: true },
      });
      if (chevauche) {
        return NextResponse.json(
          {
            error: `Chevauchement avec le contrat ${chevauche.reference ?? chevauche.typeContrat} en cours`
              + " — clôturez-le (Expiré / Rompu / Renouvelé) avant d'en créer un nouveau",
          },
          { status: 409 }
        );
      }

      const row = await prisma.grhContrat.create({
        data: {
          personnelId,
          typeContrat,
          reference: s(body.reference),
          dateDebut,
          dateFin,
          essaiMois: num(body.essaiMois),
          // Sans salaire saisi, on reprend celui de la fiche employé.
          salaireBrut: body.salaireBrut != null ? num(body.salaireBrut) : emp.salaireBase,
          poste: s(body.poste),
          lieuTravail: s(body.lieuTravail),
          horaire: s(body.horaire),
          observation: s(body.observation),
          etat: sreq(body.etat) || "En cours",
        },
      });
      return NextResponse.json({ ok: true, row });
    }

    return NextResponse.json({ error: "resource inconnue" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.res;

  const resource = req.nextUrl.searchParams.get("resource") ?? "";
  const body = await req.json().catch(() => ({}));
  const id = int(body.id);

  try {
    if (resource in REFS) {
      if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
      const row = await refModel(resource as RefKey).update({
        where: { id },
        data: { libelle: sreq(body.libelle), code: s(body.code) },
      });
      return NextResponse.json({ ok: true, row });
    }

    if (resource === "personnel") {
      if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
      const row = await prisma.grhPersonnel.update({ where: { id }, data: personnelData(body) });
      return NextResponse.json({ ok: true, row });
    }

    if (resource === "sessions") {
      if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
      const row = await prisma.grhSession.update({
        where: { id },
        data: {
          libelle: sreq(body.libelle),
          nHeures: num(body.nHeures),
          nJours: num(body.nJours),
          cloturee: bool(body.cloturee),
        },
      });
      return NextResponse.json({ ok: true, row });
    }

    // Pointage : upsert par (employé, session), la grille est éditée en masse.
    if (resource === "pointage") {
      const sessionId = int(body.sessionId);
      const codeEmploye = sreq(body.codeEmploye);
      if (!sessionId || !codeEmploye)
        return NextResponse.json({ error: "sessionId et codeEmploye requis" }, { status: 400 });

      const data = {
        regime: sreq(body.regime) || "M",
        presenceJ: num(body.presenceJ),
        presenceH: num(body.presenceH),
        ferieJ: num(body.ferieJ),
        ferieH: num(body.ferieH),
        congeJ: num(body.congeJ),
        congeH: num(body.congeH),
        absenceJ: num(body.absenceJ),
        absenceH: num(body.absenceH),
        hSupp: num(body.hSupp),
      };
      const row = await prisma.grhPointage.upsert({
        where: { codeEmploye_sessionId: { codeEmploye, sessionId } },
        create: { codeEmploye, sessionId, ...data },
        update: data,
      });
      return NextResponse.json({ ok: true, row });
    }

    if (resource === "rubriques") {
      if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
      const row = await prisma.grhRubrique.update({
        where: { id },
        data: {
          ...(body.libelle != null ? { libelle: sreq(body.libelle) } : {}),
          ...(body.sens != null ? { sens: sreq(body.sens) === "Retenue" ? "Retenue" : "Gain" } : {}),
          ...(body.soumisCnss != null ? { soumisCnss: bool(body.soumisCnss) } : {}),
          ...(body.soumisIrpp != null ? { soumisIrpp: bool(body.soumisIrpp) } : {}),
          ...(body.soumisAccTravail != null ? { soumisAccTravail: bool(body.soumisAccTravail) } : {}),
          ...(body.soumisAssGroupe != null ? { soumisAssGroupe: bool(body.soumisAssGroupe) } : {}),
          ...(body.prorataAbsence != null ? { prorataAbsence: bool(body.prorataAbsence) } : {}),
          ...(body.parQuantite != null ? { parQuantite: bool(body.parQuantite) } : {}),
          ...(body.actif != null ? { actif: bool(body.actif) } : {}),
        },
      });
      return NextResponse.json({ ok: true, row });
    }

    if (resource === "rubriques-employe") {
      if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
      const row = await prisma.grhRubriqueEmploye.update({
        where: { id },
        data: {
          ...(body.montant != null ? { montant: num(body.montant) } : {}),
          ...(body.quantite != null ? { quantite: num(body.quantite) } : {}),
        },
      });
      return NextResponse.json({ ok: true, row });
    }

    if (resource === "grilles") {
      if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
      const row = await prisma.grhGrilleSalaire.update({
        where: { id },
        data: {
          ...(body.salaireBase != null ? { salaireBase: num(body.salaireBase) } : {}),
          ...(body.dureeEchelon != null ? { dureeEchelon: num(body.dureeEchelon) } : {}),
        },
      });
      return NextResponse.json({ ok: true, row });
    }

    if (resource === "types-cnss") {
      if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
      if (bool(body.parDefaut)) {
        await prisma.grhTypeCnss.updateMany({ data: { parDefaut: false } });
      }
      const row = await prisma.grhTypeCnss.update({
        where: { id },
        data: {
          ...(body.libelle != null ? { libelle: sreq(body.libelle) } : {}),
          ...(body.retCnss != null ? { retCnss: num(body.retCnss) } : {}),
          ...(body.chCnss != null ? { chCnss: num(body.chCnss) } : {}),
          ...(body.retCavis != null ? { retCavis: num(body.retCavis) } : {}),
          ...(body.chCavis != null ? { chCavis: num(body.chCavis) } : {}),
          ...(body.retenuIrpp != null ? { retenuIrpp: bool(body.retenuIrpp) } : {}),
          ...(body.parDefaut != null ? { parDefaut: bool(body.parDefaut) } : {}),
        },
      });
      return NextResponse.json({ ok: true, row });
    }

    if (resource === "bareme-irpp") {
      if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
      const row = await prisma.grhTrancheIrpp.update({
        where: { id },
        data: {
          ...(body.du != null ? { du: num(body.du) } : {}),
          ...(body.au !== undefined ? { au: body.au == null || body.au === "" ? null : num(body.au) } : {}),
          ...(body.taux != null ? { taux: num(body.taux) } : {}),
        },
      });
      return NextResponse.json({ ok: true, row });
    }

    if (resource === "contrats") {
      if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

      const etat = body.etat != null ? sreq(body.etat) : undefined;
      if (etat != null && !(ETATS_CONTRAT as readonly string[]).includes(etat)) {
        return NextResponse.json({ error: `État invalide : ${etat}` }, { status: 400 });
      }

      const actuel = await prisma.grhContrat.findUnique({
        where: { id },
        select: { typeContrat: true, dateDebut: true, dateFin: true },
      });
      if (!actuel) return NextResponse.json({ error: "Contrat introuvable" }, { status: 404 });

      const dateFin = body.dateFin != null ? date(body.dateFin) : undefined;
      const dateDebut = body.dateDebut != null ? date(body.dateDebut) : undefined;
      const debutEffectif = dateDebut ?? actuel.dateDebut;
      const finEffective = dateFin !== undefined ? dateFin : actuel.dateFin;

      const typeContrat = body.typeContrat != null ? sreq(body.typeContrat) : actuel.typeContrat;
      if (typeContrat !== "CDI" && !finEffective) {
        return NextResponse.json({ error: `Un contrat ${typeContrat} exige une date de fin` }, { status: 400 });
      }
      if (finEffective && debutEffectif && finEffective <= debutEffectif) {
        return NextResponse.json({ error: "La date de fin doit suivre la date de début" }, { status: 400 });
      }

      const row = await prisma.grhContrat.update({
        where: { id },
        data: {
          ...(body.typeContrat != null ? { typeContrat } : {}),
          ...(body.reference != null ? { reference: s(body.reference) } : {}),
          ...(dateDebut != null ? { dateDebut } : {}),
          ...(dateFin !== undefined ? { dateFin } : {}),
          ...(body.essaiMois != null ? { essaiMois: num(body.essaiMois) } : {}),
          ...(body.salaireBrut != null ? { salaireBrut: num(body.salaireBrut) } : {}),
          ...(body.poste != null ? { poste: s(body.poste) } : {}),
          ...(body.lieuTravail != null ? { lieuTravail: s(body.lieuTravail) } : {}),
          ...(body.horaire != null ? { horaire: s(body.horaire) } : {}),
          ...(body.observation != null ? { observation: s(body.observation) } : {}),
          ...(etat != null ? { etat } : {}),
        },
      });
      return NextResponse.json({ ok: true, row });
    }

    if (resource === "conges") {
      if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
      const row = await prisma.grhConge.update({
        where: { id },
        data: { statut: sreq(body.statut), motif: s(body.motif) },
      });
      return NextResponse.json({ ok: true, row });
    }

    return NextResponse.json({ error: "resource inconnue" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireSession(["ADMIN"]);
  if (!auth.ok) return auth.res;

  const sp = req.nextUrl.searchParams;
  const resource = sp.get("resource") ?? "";
  const id = int(sp.get("id"));
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  try {
    if (resource in REFS) await refModel(resource as RefKey).delete({ where: { id } });
    else if (resource === "personnel") await prisma.grhPersonnel.delete({ where: { id } });
    else if (resource === "sessions") await prisma.grhSession.delete({ where: { id } });
    else if (resource === "conges") await prisma.grhConge.delete({ where: { id } });
    else if (resource === "contrats") await prisma.grhContrat.delete({ where: { id } });
    else if (resource === "rubriques") {
      // Une rubrique affectée à des employés ne disparaît pas silencieusement :
      // ses montants sont dans des bulletins déjà édités.
      const n = await prisma.grhRubriqueEmploye.count({ where: { rubriqueId: id } });
      if (n > 0) {
        return NextResponse.json(
          { error: `Rubrique affectée à ${n} employé(s) — désactivez-la plutôt que de la supprimer` },
          { status: 409 }
        );
      }
      await prisma.grhRubrique.delete({ where: { id } });
    }
    else if (resource === "rubriques-employe") await prisma.grhRubriqueEmploye.delete({ where: { id } });
    else if (resource === "grilles") await prisma.grhGrilleSalaire.delete({ where: { id } });
    else if (resource === "types-cnss") await prisma.grhTypeCnss.delete({ where: { id } });
    else if (resource === "bareme-irpp") await prisma.grhTrancheIrpp.delete({ where: { id } });
    else return NextResponse.json({ error: "resource inconnue" }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

/** Champs communs création/modification. Le matricule est ajouté à part (immuable). */
function personnelData(body: Record<string, unknown>) {
  return {
    nom: sreq(body.nom),
    prenom: s(body.prenom),
    cin: s(body.cin),
    lieuCin: s(body.lieuCin),
    dateCin: date(body.dateCin),
    sexe: s(body.sexe),
    dateNaiss: date(body.dateNaiss),
    lieuNaiss: s(body.lieuNaiss),
    situationFamiliale: s(body.situationFamiliale),
    chefFamille: bool(body.chefFamille),
    nbrEnfants: int(body.nbrEnfants) ?? 0,
    nbrHandicape: int(body.nbrHandicape) ?? 0,
    adresse: s(body.adresse),
    tel: s(body.tel),
    email: s(body.email),
    numContrat: s(body.numContrat),
    contratDu: date(body.contratDu),
    contratAu: date(body.contratAu),
    dateEmbauche: date(body.dateEmbauche),
    dateDepart: date(body.dateDepart),
    partant: bool(body.partant),
    traitement: sreq(body.traitement) || "M",
    salaireBase: num(body.salaireBase),
    coutHoraire: num(body.coutHoraire),
    njTraitNormal: body.njTraitNormal != null ? num(body.njTraitNormal) : 26,
    smigar: bool(body.smigar),
    plafondCredit: num(body.plafondCredit),
    soldeConge: num(body.soldeConge),
    prixConge: num(body.prixConge),
    numCnss: s(body.numCnss),
    typeCnss: s(body.typeCnss),
    pourcentageAssGro: num(body.pourcentageAssGro),
    pourcentageAssAccTra: num(body.pourcentageAssAccTra),
    montExoAss: num(body.montExoAss),
    actif: body.actif == null ? true : bool(body.actif),
    fonctionId: int(body.fonctionId),
    gradeId: int(body.gradeId),
    serviceId: int(body.serviceId),
    categorieId: int(body.categorieId),
    echelonId: int(body.echelonId),
  };
}
