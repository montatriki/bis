import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { resoudreRefArt } from "@/lib/ref-article";
import { round3 } from "@/lib/vente-stats";
import { calculerBesoinsNets, cbnDepuisDocuments, eclaterNomenclature } from "@/lib/gpao-cbn";
import { chargeParPoste, genererOperationsOf, planifierOf } from "@/lib/gpao-planification";

// GPAO — données techniques, calcul des besoins nets, planification.
//
// GET    /api/gpao?vue=postes|operations|nomenclatures|nomenclature|gammes|gamme
//                      |eclatement|cbn|of-operations|plans|charge|stats|articles
// POST   /api/gpao { vue: "poste"|"operation"|"nomenclature"|"nomenclature-ligne"
//                        |"gamme"|"operation-gamme"|"cbn"|"generer-operations"|"planifier" }
// PUT    /api/gpao { vue, id, ... }
// DELETE /api/gpao?vue=...&id=...
//
// Écriture réservée ADMIN/MANAGER, suppression réservée ADMIN — même règle que
// les autres modules de paramétrage.

const s = (v: unknown) => (v == null ? "" : String(v).trim());
const int = (v: unknown) => {
  const x = parseInt(String(v ?? ""), 10);
  return Number.isFinite(x) ? x : null;
};
const num = (v: unknown) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};
const bool = (v: unknown) => v === true || v === "true" || v === 1 || v === "1";
const date = (v: unknown) => {
  if (!v) return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
};

/** "HH:MM" valide ? Un horaire mal saisi décalerait toute la planification. */
const HEURE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const heure = (v: unknown, defaut: string) => {
  const x = s(v);
  return HEURE.test(x) ? x : defaut;
};

const TYPES_COMPOSANT = ["MP", "SF", "P", "CH"] as const;

export async function GET(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.res;

  const sp = req.nextUrl.searchParams;
  const vue = sp.get("vue") ?? "stats";

  if (vue === "postes") {
    const rows = await prisma.gpaoPosteCharge.findMany({
      orderBy: { code: "asc" },
      include: { _count: { select: { operationsGamme: true, plans: true } } },
    });
    return NextResponse.json({
      rows: rows.map((r) => ({
        ...r,
        nbOperations: r._count.operationsGamme,
        nbPlans: r._count.plans,
      })),
      total: rows.length,
    });
  }

  if (vue === "operations") {
    const rows = await prisma.gpaoOperation.findMany({ orderBy: { code: "asc" } });
    return NextResponse.json({ rows, total: rows.length });
  }

  if (vue === "jalonnements") {
    const rows = await prisma.gpaoJalonnement.findMany({ orderBy: { code: "asc" } });
    return NextResponse.json({ rows, total: rows.length });
  }

  if (vue === "nomenclatures") {
    const q = s(sp.get("q"));
    const rows = await prisma.gpaoNomenclature.findMany({
      where: q
        ? {
            OR: [
              { refArt: { contains: q, mode: "insensitive" } },
              { desArt: { contains: q, mode: "insensitive" } },
            ],
          }
        : {},
      orderBy: { refArt: "asc" },
      take: 300,
      include: { _count: { select: { lignes: true } } },
    });
    return NextResponse.json({
      rows: rows.map((r) => ({ ...r, nbLignes: r._count.lignes })),
      total: rows.length,
    });
  }

  if (vue === "nomenclature") {
    const saisie = s(sp.get("refArt"));
    if (!saisie) return NextResponse.json({ error: "refArt requis" }, { status: 400 });
    // Référence résolue : la saisie est rognée, la base peut contenir des
    // espaces de bord (11 articles concernés).
    const refArt = (await resoudreRefArt(saisie)) ?? saisie;
    const row = await prisma.gpaoNomenclature.findUnique({
      where: { refArt },
      include: { lignes: { orderBy: [{ numSequence: "asc" }, { id: "asc" }] } },
    });
    if (!row) return NextResponse.json({ error: "Nomenclature introuvable" }, { status: 404 });
    return NextResponse.json({ row });
  }

  if (vue === "eclatement") {
    const refArt = s(sp.get("refArt"));
    const quantite = num(sp.get("quantite")) || 1;
    if (!refArt) return NextResponse.json({ error: "refArt requis" }, { status: 400 });
    const res = await eclaterNomenclature(refArt, quantite);
    return NextResponse.json({ ...res, refArt, quantite });
  }

  if (vue === "cbn") {
    // CBN direct : un article + une quantité (le POST gère les listes d'OF).
    const refArt = s(sp.get("refArt"));
    const quantite = num(sp.get("quantite")) || 1;
    if (!refArt) return NextResponse.json({ error: "refArt requis" }, { status: 400 });
    const res = await calculerBesoinsNets([{ refArt, quantite }], {
      deduireStock: sp.get("deduireStock") !== "false",
    });
    return NextResponse.json(res);
  }

  if (vue === "gammes") {
    const rows = await prisma.gpaoGamme.findMany({
      orderBy: { gamme: "asc" },
      take: 300,
      include: { _count: { select: { operations: true } } },
    });
    return NextResponse.json({
      rows: rows.map((r) => ({ ...r, nbOperations: r._count.operations })),
      total: rows.length,
    });
  }

  if (vue === "gamme") {
    const id = int(sp.get("id"));
    if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
    const row = await prisma.gpaoGamme.findUnique({
      where: { id },
      include: {
        operations: {
          orderBy: [{ numSequence: "asc" }, { id: "asc" }],
          include: { posteCharge: { select: { code: true, libelle: true } } },
        },
      },
    });
    if (!row) return NextResponse.json({ error: "Gamme introuvable" }, { status: 404 });
    // Temps total de la gamme : ce qu'il faut pour produire `qteBase` unités.
    const tempsTotal = row.operations.reduce(
      (t, o) => t + o.tempsReg + o.tempsPreparation + o.tempsOperatoire, 0
    );
    return NextResponse.json({ row, tempsTotalMinutes: round3(tempsTotal) });
  }

  if (vue === "of-operations") {
    const refDoc = s(sp.get("refDoc"));
    if (!refDoc) return NextResponse.json({ error: "refDoc requis" }, { status: 400 });
    const rows = await prisma.gpaoOperationOf.findMany({
      where: { refDoc },
      orderBy: [{ numSequence: "asc" }, { id: "asc" }],
    });
    const posteIds = [...new Set(rows.map((r) => r.posteChargeId).filter((x): x is number => x != null))];
    const postes = posteIds.length
      ? await prisma.gpaoPosteCharge.findMany({ where: { id: { in: posteIds } }, select: { id: true, code: true, libelle: true } })
      : [];
    const parId = new Map(postes.map((p) => [p.id, p]));
    return NextResponse.json({
      rows: rows.map((r) => ({ ...r, posteLibelle: r.posteChargeId != null ? parId.get(r.posteChargeId)?.libelle ?? null : null })),
      total: rows.length,
      dureeTotale: round3(rows.reduce((t, r) => t + r.duree, 0)),
    });
  }

  if (vue === "plans") {
    const refDoc = s(sp.get("refDoc"));
    const du = date(sp.get("du"));
    const au = date(sp.get("au"));
    const where: Record<string, unknown> = {};
    if (refDoc) where.refDoc = refDoc;
    if (du || au) {
      where.dateDebut = { ...(du ? { gte: du } : {}), ...(au ? { lte: au } : {}) };
    }
    const rows = await prisma.gpaoPlan.findMany({
      where,
      orderBy: { dateDebut: "asc" },
      take: 1000,
      include: { posteCharge: { select: { code: true, libelle: true } } },
    });
    return NextResponse.json({
      rows,
      total: rows.length,
      conflits: rows.filter((r) => !r.disponibilite).length,
      heuresTotales: round3(rows.reduce((t, r) => t + r.duree, 0) / 60),
    });
  }

  if (vue === "charge") {
    const du = date(sp.get("du")) ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const au = date(sp.get("au")) ?? new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59);
    const rows = await chargeParPoste(du, au);
    return NextResponse.json({ rows, total: rows.length, du, au });
  }

  if (vue === "articles") {
    // Articles fabricables : produits finis et semi-finis, pour les sélecteurs.
    const q = s(sp.get("q"));
    const rows = await prisma.article.findMany({
      where: {
        archiver: 0,
        ...(q
          ? {
              OR: [
                { refArt: { contains: q, mode: "insensitive" } },
                { designation: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      select: { refArt: true, designation: true, kind: true, unite: true, enStock: true, pmp: true, puAchat: true },
      orderBy: { designation: "asc" },
      take: 200,
    });
    return NextResponse.json({ rows, total: rows.length });
  }

  if (vue === "ofs") {
    // Ordres de fabrication : les documents de type OF, avec leur état GPAO.
    const rows = await prisma.erpDocument.findMany({
      where: { typeDoc: "OF" },
      orderBy: { dateDoc: "desc" },
      take: 300,
      select: {
        refDoc: true, dateDoc: true, raisonSocial: true, etat: true,
        thtNet: true, ttcNet: true, valide: true,
        _count: { select: { lignes: true } },
      },
    });
    const refs = rows.map((r) => r.refDoc);
    const [ops, plans] = await Promise.all([
      refs.length ? prisma.gpaoOperationOf.groupBy({ by: ["refDoc"], where: { refDoc: { in: refs } }, _count: { _all: true } }) : [],
      refs.length ? prisma.gpaoPlan.groupBy({ by: ["refDoc"], where: { refDoc: { in: refs } }, _count: { _all: true } }) : [],
    ]);
    const nbOps = new Map(ops.map((o) => [o.refDoc, o._count._all]));
    const nbPlans = new Map(plans.map((p) => [p.refDoc, p._count._all]));
    return NextResponse.json({
      rows: rows.map((r) => ({
        ...r,
        nbLignes: r._count.lignes,
        nbOperations: nbOps.get(r.refDoc) ?? 0,
        nbCreneaux: nbPlans.get(r.refDoc) ?? 0,
      })),
      total: rows.length,
    });
  }

  // stats
  const [nbPostes, nbNom, nbGammes, nbOps, nbPlans, conflits, nbOf] = await Promise.all([
    prisma.gpaoPosteCharge.count(),
    prisma.gpaoNomenclature.count(),
    prisma.gpaoGamme.count(),
    prisma.gpaoOperation.count(),
    prisma.gpaoPlan.count(),
    prisma.gpaoPlan.count({ where: { disponibilite: false } }),
    prisma.erpDocument.count({ where: { typeDoc: "OF" } }),
  ]);
  const enExploitation = await prisma.gpaoNomenclature.count({ where: { exploitation: true } });

  return NextResponse.json({
    nbPostes, nbNomenclatures: nbNom, nomenclaturesExploitation: enExploitation,
    nbGammes, nbOperations: nbOps, nbCreneaux: nbPlans, conflits, nbOrdresFabrication: nbOf,
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => ({}));
  const vue = s(body.vue);

  if (vue === "poste") {
    const code = s(body.code);
    const libelle = s(body.libelle);
    if (!code || !libelle) return NextResponse.json({ error: "Code et libellé requis" }, { status: 400 });

    const exist = await prisma.gpaoPosteCharge.findUnique({ where: { code } });
    if (exist) return NextResponse.json({ error: `Le poste ${code} existe déjà` }, { status: 409 });

    const row = await prisma.gpaoPosteCharge.create({
      data: {
        code, libelle,
        centre: s(body.centre) || null,
        mainOeuvre: bool(body.mainOeuvre),
        machine: bool(body.machine),
        sousTraitance: bool(body.sousTraitance),
        nbRessources: Math.max(1, num(body.nbRessources) || 1),
        heureDebut: heure(body.heureDebut, "08:00"),
        heureFin: heure(body.heureFin, "17:00"),
        pauseDebut: heure(body.pauseDebut, "12:00"),
        pauseFin: heure(body.pauseFin, "13:00"),
        coutHoraire: round3(num(body.coutHoraire)),
      },
    });
    return NextResponse.json({ ok: true, row, message: `Poste de charge ${code} créé` });
  }

  if (vue === "operation") {
    const code = s(body.code);
    const libelle = s(body.libelle);
    if (!code || !libelle) return NextResponse.json({ error: "Code et libellé requis" }, { status: 400 });
    const exist = await prisma.gpaoOperation.findUnique({ where: { code } });
    if (exist) return NextResponse.json({ error: `L'opération ${code} existe déjà` }, { status: 409 });
    const row = await prisma.gpaoOperation.create({
      data: {
        code, libelle,
        typeJalonnement: s(body.typeJalonnement) || null,
        operationSuivante: int(body.operationSuivante),
      },
    });
    return NextResponse.json({ ok: true, row, message: `Opération ${code} créée` });
  }

  if (vue === "jalonnement") {
    const code = s(body.code);
    const libelle = s(body.libelle);
    if (!code || !libelle) return NextResponse.json({ error: "Code et libellé requis" }, { status: 400 });
    const exist = await prisma.gpaoJalonnement.findUnique({ where: { code } });
    if (exist) return NextResponse.json({ error: `Le jalonnement ${code} existe déjà` }, { status: 409 });
    const row = await prisma.gpaoJalonnement.create({ data: { code, libelle } });
    return NextResponse.json({ ok: true, row, message: `Jalonnement ${code} créé` });
  }

  if (vue === "nomenclature") {
    const refArt = s(body.refArt);
    if (!refArt) return NextResponse.json({ error: "Article requis" }, { status: 400 });

    // La référence est résolue telle qu'elle existe en base : 11 articles de
    // l'import portent un espace final que la saisie a nettoyé.
    const refReel = await resoudreRefArt(refArt);
    if (!refReel) return NextResponse.json({ error: `Article ${refArt} inconnu au référentiel` }, { status: 400 });

    const exist = await prisma.gpaoNomenclature.findUnique({ where: { refArt: refReel } });
    if (exist) return NextResponse.json({ error: `${refReel} a déjà une nomenclature` }, { status: 409 });

    // Le libellé est relu du référentiel : évite les divergences si l'article
    // est renommé plus tard.
    const art = await prisma.article.findUnique({ where: { refArt: refReel }, select: { designation: true, unite: true } });
    if (!art) return NextResponse.json({ error: `Article ${refArt} inconnu au référentiel` }, { status: 400 });

    const row = await prisma.gpaoNomenclature.create({
      data: {
        // Référence exacte du référentiel, espaces compris : sinon la
        // nomenclature ne serait rattachée à aucun article.
        refArt: refReel,
        desArt: art.designation,
        site: s(body.site) || null,
        alternative: s(body.alternative) || null,
        versionMaj: s(body.versionMaj) || null,
        versionMin: s(body.versionMin) || null,
        uniteStock: art.unite,
        uniteGes: s(body.uniteGes) || art.unite,
        qteBase: num(body.qteBase) > 0 ? num(body.qteBase) : 1,
        dateRef: date(body.dateRef),
        dateDebutVal: date(body.dateDebutVal),
        dateFinVal: date(body.dateFinVal),
        elaboration: body.elaboration == null ? true : bool(body.elaboration),
        exploitation: bool(body.exploitation),
      },
    });
    return NextResponse.json({ ok: true, row, message: `Nomenclature de ${refArt} créée` });
  }

  if (vue === "nomenclature-ligne") {
    const saisieNom = s(body.refNom);
    const saisieArt = s(body.refArt);
    const qte = num(body.qte);
    if (!saisieNom || !saisieArt) return NextResponse.json({ error: "Nomenclature et composant requis" }, { status: 400 });
    if (qte <= 0) return NextResponse.json({ error: "La quantité doit être supérieure à 0" }, { status: 400 });

    // Références résolues sur le référentiel réel (espaces de bord compris).
    const [refNom, refArt] = await Promise.all([
      resoudreRefArt(saisieNom),
      resoudreRefArt(saisieArt),
    ]);
    if (!refNom) return NextResponse.json({ error: `Article ${saisieNom} inconnu au référentiel` }, { status: 400 });
    if (!refArt) return NextResponse.json({ error: `Composant ${saisieArt} inconnu au référentiel` }, { status: 400 });

    // Un article composant de lui-même est un cycle immédiat.
    if (refNom === refArt) {
      return NextResponse.json({ error: "Un article ne peut pas être son propre composant" }, { status: 400 });
    }

    const nom = await prisma.gpaoNomenclature.findUnique({ where: { refArt: refNom } });
    if (!nom) return NextResponse.json({ error: "Nomenclature introuvable" }, { status: 404 });

    // Refus d'un cycle indirect : le composant contient-il déjà l'article père ?
    const { composants } = await eclaterNomenclature(refArt, 1);
    if (composants.some((c) => c.refArt === refNom)) {
      return NextResponse.json(
        { error: `Cycle refusé : ${refArt} contient déjà ${refNom} dans sa nomenclature` },
        { status: 409 }
      );
    }

    const art = await prisma.article.findUnique({ where: { refArt }, select: { designation: true, kind: true } });
    const typeComposant = s(body.typeComposant) || art?.kind || "MP";

    const row = await prisma.gpaoNomenclatureLigne.create({
      data: {
        refNom, refArt,
        desArt: art?.designation ?? null,
        typeComposant: (TYPES_COMPOSANT as readonly string[]).includes(typeComposant) ? typeComposant : "MP",
        numOrdre: int(body.numOrdre) ?? 0,
        numSequence: int(body.numSequence) ?? 0,
        qte: round3(qte),
      },
    });
    return NextResponse.json({ ok: true, row, message: `Composant ${refArt} ajouté` });
  }

  if (vue === "gamme") {
    const gamme = s(body.gamme);
    if (!gamme) return NextResponse.json({ error: "Code gamme requis" }, { status: 400 });
    const exist = await prisma.gpaoGamme.findUnique({ where: { gamme } });
    if (exist) return NextResponse.json({ error: `La gamme ${gamme} existe déjà` }, { status: 409 });

    const row = await prisma.gpaoGamme.create({
      data: {
        gamme,
        desGamme: s(body.desGamme) || null,
        refArt: s(body.refArt) || null,
        site: s(body.site) || null,
        alternative: s(body.alternative) || null,
        versionMaj: s(body.versionMaj) || null,
        versionMin: s(body.versionMin) || null,
        dateRef: date(body.dateRef),
        dateDebutVal: date(body.dateDebutVal),
        dateFinVal: date(body.dateFinVal),
        elaboration: body.elaboration == null ? true : bool(body.elaboration),
        exploitation: bool(body.exploitation),
        qteMin: num(body.qteMin),
        qteMax: num(body.qteMax),
      },
    });
    return NextResponse.json({ ok: true, row, message: `Gamme ${gamme} créée` });
  }

  if (vue === "operation-gamme") {
    const gammeId = int(body.gammeId);
    const desOperation = s(body.desOperation);
    if (!gammeId || !desOperation) {
      return NextResponse.json({ error: "Gamme et désignation d'opération requises" }, { status: 400 });
    }
    const g = await prisma.gpaoGamme.findUnique({ where: { id: gammeId } });
    if (!g) return NextResponse.json({ error: "Gamme introuvable" }, { status: 404 });

    const posteChargeId = int(body.posteChargeId);
    if (posteChargeId != null) {
      const p = await prisma.gpaoPosteCharge.findUnique({ where: { id: posteChargeId } });
      if (!p) return NextResponse.json({ error: "Poste de charge introuvable" }, { status: 400 });
    }

    // Séquence auto si non fournie : garde l'ordre d'enchaînement cohérent.
    let numSequence = int(body.numSequence);
    if (numSequence == null) {
      const dernier = await prisma.gpaoOperationGamme.findFirst({
        where: { gammeId }, orderBy: { numSequence: "desc" }, select: { numSequence: true },
      });
      numSequence = (dernier?.numSequence ?? 0) + 1;
    }

    const row = await prisma.gpaoOperationGamme.create({
      data: {
        gammeId,
        operationId: int(body.operationId),
        desOperation, numSequence,
        posteChargeId,
        nbPosteCharge: int(body.nbPosteCharge) ?? 1,
        posteMo: s(body.posteMo) || null,
        nbPosteMo: int(body.nbPosteMo) ?? 0,
        tempsReg: round3(num(body.tempsReg)),
        tempsPreparation: round3(num(body.tempsPreparation)),
        tempsOperatoire: round3(num(body.tempsOperatoire)),
        qteBase: num(body.qteBase) > 0 ? num(body.qteBase) : 1,
        coeffCharge: num(body.coeffCharge) > 0 ? num(body.coeffCharge) : 1,
        // Efficience 0 diviserait par zéro dans le calcul du temps.
        efficience: num(body.efficience) > 0 ? num(body.efficience) : 100,
      },
    });
    return NextResponse.json({ ok: true, row, message: `Opération « ${desOperation} » ajoutée` });
  }

  if (vue === "cbn") {
    // CBN sur une liste de demandes, ou sur des ordres de fabrication.
    const deduireStock = body.deduireStock !== false;
    const refDocs: string[] = Array.isArray(body.refDocs) ? body.refDocs.map(s).filter(Boolean) : [];

    if (refDocs.length) {
      const res = await cbnDepuisDocuments(refDocs, { deduireStock });
      return NextResponse.json(res);
    }

    const demandes = Array.isArray(body.demandes)
      ? body.demandes
          .map((d: Record<string, unknown>) => ({ refArt: s(d.refArt), quantite: num(d.quantite) }))
          .filter((d: { refArt: string }) => Boolean(d.refArt))
      : [];
    if (demandes.length === 0) {
      return NextResponse.json({ error: "Aucune demande : fournissez `demandes` ou `refDocs`" }, { status: 400 });
    }
    const res = await calculerBesoinsNets(demandes, { deduireStock });
    return NextResponse.json(res);
  }

  if (vue === "generer-operations") {
    const refDoc = s(body.refDoc);
    const refArt = s(body.refArt);
    const quantite = num(body.quantite) || 1;
    if (!refDoc || !refArt) return NextResponse.json({ error: "refDoc et refArt requis" }, { status: 400 });

    const res = await genererOperationsOf(refDoc, refArt, quantite);
    return NextResponse.json(res, { status: res.ok ? 200 : 400 });
  }

  if (vue === "planifier") {
    const refDoc = s(body.refDoc);
    if (!refDoc) return NextResponse.json({ error: "refDoc requis" }, { status: 400 });

    const debut = date(body.dateDebut) ?? new Date();
    const limite = date(body.dateLimite);
    if (limite && limite < debut) {
      return NextResponse.json({ error: "La date limite précède la date de début" }, { status: 400 });
    }

    const res = await planifierOf(refDoc, debut, limite);
    return NextResponse.json(res, { status: res.ok ? 200 : 400 });
  }

  return NextResponse.json({ error: `Vue inconnue : ${vue}` }, { status: 400 });
}

export async function PUT(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => ({}));
  const vue = s(body.vue);
  const id = int(body.id);

  if (vue === "poste") {
    if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
    const row = await prisma.gpaoPosteCharge.update({
      where: { id },
      data: {
        ...(body.libelle != null ? { libelle: s(body.libelle) } : {}),
        ...(body.centre != null ? { centre: s(body.centre) || null } : {}),
        ...(body.mainOeuvre != null ? { mainOeuvre: bool(body.mainOeuvre) } : {}),
        ...(body.machine != null ? { machine: bool(body.machine) } : {}),
        ...(body.sousTraitance != null ? { sousTraitance: bool(body.sousTraitance) } : {}),
        ...(body.nbRessources != null ? { nbRessources: Math.max(1, num(body.nbRessources) || 1) } : {}),
        ...(body.heureDebut != null ? { heureDebut: heure(body.heureDebut, "08:00") } : {}),
        ...(body.heureFin != null ? { heureFin: heure(body.heureFin, "17:00") } : {}),
        ...(body.pauseDebut != null ? { pauseDebut: heure(body.pauseDebut, "12:00") } : {}),
        ...(body.pauseFin != null ? { pauseFin: heure(body.pauseFin, "13:00") } : {}),
        ...(body.coutHoraire != null ? { coutHoraire: round3(num(body.coutHoraire)) } : {}),
      },
    });
    return NextResponse.json({ ok: true, row, message: "Poste de charge modifié" });
  }

  if (vue === "operation") {
    if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
    const row = await prisma.gpaoOperation.update({
      where: { id },
      data: {
        ...(body.libelle != null ? { libelle: s(body.libelle) } : {}),
        ...(body.typeJalonnement != null ? { typeJalonnement: s(body.typeJalonnement) || null } : {}),
        ...(body.operationSuivante != null ? { operationSuivante: int(body.operationSuivante) } : {}),
      },
    });
    return NextResponse.json({ ok: true, row, message: "Opération modifiée" });
  }

  if (vue === "nomenclature") {
    const refArt = s(body.refArt);
    if (!refArt) return NextResponse.json({ error: "refArt requis" }, { status: 400 });

    // Passer en exploitation n'a de sens qu'avec au moins un composant.
    if (bool(body.exploitation)) {
      const nb = await prisma.gpaoNomenclatureLigne.count({ where: { refNom: refArt } });
      if (nb === 0) {
        return NextResponse.json(
          { error: "Une nomenclature sans composant ne peut pas passer en exploitation" },
          { status: 409 }
        );
      }
    }

    const row = await prisma.gpaoNomenclature.update({
      where: { refArt },
      data: {
        ...(body.site != null ? { site: s(body.site) || null } : {}),
        ...(body.alternative != null ? { alternative: s(body.alternative) || null } : {}),
        ...(body.versionMaj != null ? { versionMaj: s(body.versionMaj) || null } : {}),
        ...(body.versionMin != null ? { versionMin: s(body.versionMin) || null } : {}),
        ...(body.uniteGes != null ? { uniteGes: s(body.uniteGes) || null } : {}),
        ...(body.qteBase != null ? { qteBase: num(body.qteBase) > 0 ? num(body.qteBase) : 1 } : {}),
        ...(body.dateDebutVal != null ? { dateDebutVal: date(body.dateDebutVal) } : {}),
        ...(body.dateFinVal != null ? { dateFinVal: date(body.dateFinVal) } : {}),
        ...(body.elaboration != null ? { elaboration: bool(body.elaboration) } : {}),
        ...(body.exploitation != null ? { exploitation: bool(body.exploitation) } : {}),
      },
    });
    return NextResponse.json({ ok: true, row, message: "Nomenclature modifiée" });
  }

  if (vue === "nomenclature-ligne") {
    if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
    const qte = num(body.qte);
    if (body.qte != null && qte <= 0) {
      return NextResponse.json({ error: "La quantité doit être supérieure à 0" }, { status: 400 });
    }
    const row = await prisma.gpaoNomenclatureLigne.update({
      where: { id },
      data: {
        ...(body.qte != null ? { qte: round3(qte) } : {}),
        ...(body.typeComposant != null ? { typeComposant: s(body.typeComposant) } : {}),
        ...(body.numSequence != null ? { numSequence: int(body.numSequence) ?? 0 } : {}),
        ...(body.numOrdre != null ? { numOrdre: int(body.numOrdre) ?? 0 } : {}),
      },
    });
    return NextResponse.json({ ok: true, row, message: "Composant modifié" });
  }

  if (vue === "gamme") {
    if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
    if (bool(body.exploitation)) {
      const nb = await prisma.gpaoOperationGamme.count({ where: { gammeId: id } });
      if (nb === 0) {
        return NextResponse.json(
          { error: "Une gamme sans opération ne peut pas passer en exploitation" },
          { status: 409 }
        );
      }
    }
    const row = await prisma.gpaoGamme.update({
      where: { id },
      data: {
        ...(body.desGamme != null ? { desGamme: s(body.desGamme) || null } : {}),
        ...(body.refArt != null ? { refArt: s(body.refArt) || null } : {}),
        ...(body.qteMin != null ? { qteMin: num(body.qteMin) } : {}),
        ...(body.qteMax != null ? { qteMax: num(body.qteMax) } : {}),
        ...(body.elaboration != null ? { elaboration: bool(body.elaboration) } : {}),
        ...(body.exploitation != null ? { exploitation: bool(body.exploitation) } : {}),
        ...(body.dateDebutVal != null ? { dateDebutVal: date(body.dateDebutVal) } : {}),
        ...(body.dateFinVal != null ? { dateFinVal: date(body.dateFinVal) } : {}),
      },
    });
    return NextResponse.json({ ok: true, row, message: "Gamme modifiée" });
  }

  if (vue === "operation-gamme") {
    if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
    const row = await prisma.gpaoOperationGamme.update({
      where: { id },
      data: {
        ...(body.desOperation != null ? { desOperation: s(body.desOperation) } : {}),
        ...(body.numSequence != null ? { numSequence: int(body.numSequence) ?? 0 } : {}),
        ...(body.posteChargeId != null ? { posteChargeId: int(body.posteChargeId) } : {}),
        ...(body.posteMo != null ? { posteMo: s(body.posteMo) || null } : {}),
        ...(body.tempsReg != null ? { tempsReg: round3(num(body.tempsReg)) } : {}),
        ...(body.tempsPreparation != null ? { tempsPreparation: round3(num(body.tempsPreparation)) } : {}),
        ...(body.tempsOperatoire != null ? { tempsOperatoire: round3(num(body.tempsOperatoire)) } : {}),
        ...(body.qteBase != null ? { qteBase: num(body.qteBase) > 0 ? num(body.qteBase) : 1 } : {}),
        ...(body.coeffCharge != null ? { coeffCharge: num(body.coeffCharge) > 0 ? num(body.coeffCharge) : 1 } : {}),
        ...(body.efficience != null ? { efficience: num(body.efficience) > 0 ? num(body.efficience) : 100 } : {}),
      },
    });
    return NextResponse.json({ ok: true, row, message: "Opération modifiée" });
  }

  return NextResponse.json({ error: `Vue inconnue : ${vue}` }, { status: 400 });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireSession(["ADMIN"]);
  if (!auth.ok) return auth.res;

  const sp = req.nextUrl.searchParams;
  const vue = s(sp.get("vue"));
  const id = int(sp.get("id"));

  if (vue === "poste") {
    if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
    // Un poste référencé par une gamme ne peut pas disparaître : les temps de
    // fabrication perdraient leur ressource.
    const used = await prisma.gpaoOperationGamme.count({ where: { posteChargeId: id } });
    if (used > 0) {
      return NextResponse.json(
        { error: `Poste utilisé par ${used} opération(s) de gamme — suppression refusée` },
        { status: 409 }
      );
    }
    await prisma.gpaoPosteCharge.delete({ where: { id } });
    return NextResponse.json({ ok: true, message: "Poste de charge supprimé" });
  }

  if (vue === "operation") {
    if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
    const used = await prisma.gpaoOperationGamme.count({ where: { operationId: id } });
    if (used > 0) {
      return NextResponse.json(
        { error: `Opération utilisée par ${used} gamme(s) — suppression refusée` },
        { status: 409 }
      );
    }
    await prisma.gpaoOperation.delete({ where: { id } });
    return NextResponse.json({ ok: true, message: "Opération supprimée" });
  }

  if (vue === "jalonnement") {
    if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
    await prisma.gpaoJalonnement.delete({ where: { id } });
    return NextResponse.json({ ok: true, message: "Jalonnement supprimé" });
  }

  if (vue === "nomenclature") {
    const refArt = s(sp.get("refArt"));
    if (!refArt) return NextResponse.json({ error: "refArt requis" }, { status: 400 });
    // Les lignes tombent en cascade (onDelete: Cascade).
    await prisma.gpaoNomenclature.delete({ where: { refArt } });
    return NextResponse.json({ ok: true, message: `Nomenclature de ${refArt} supprimée` });
  }

  if (vue === "nomenclature-ligne") {
    if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
    await prisma.gpaoNomenclatureLigne.delete({ where: { id } });
    return NextResponse.json({ ok: true, message: "Composant supprimé" });
  }

  if (vue === "gamme") {
    if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
    await prisma.gpaoGamme.delete({ where: { id } });
    return NextResponse.json({ ok: true, message: "Gamme supprimée" });
  }

  if (vue === "operation-gamme") {
    if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
    await prisma.gpaoOperationGamme.delete({ where: { id } });
    return NextResponse.json({ ok: true, message: "Opération supprimée" });
  }

  if (vue === "plans") {
    // Dé-planifier un OF : retire tous ses créneaux.
    const refDoc = s(sp.get("refDoc"));
    if (!refDoc) return NextResponse.json({ error: "refDoc requis" }, { status: 400 });
    const res = await prisma.gpaoPlan.deleteMany({ where: { refDoc } });
    return NextResponse.json({ ok: true, message: `${res.count} créneau(x) supprimé(s)` });
  }

  return NextResponse.json({ error: `Vue inconnue : ${vue}` }, { status: 400 });
}
