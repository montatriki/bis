import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { round3 } from "@/lib/vente-stats";
import { integrerDocument, annulerIntegration, getComptes } from "@/lib/compta-integration";
import { construireBilan, figerBilan, initialiserModeleBilan } from "@/lib/compta-bilan";

// Comptabilité — grand livre, balance, journaux, exercices, intégration, bilan.
//
// GET /api/comptabilite?vue=exercices|journaux|grand-livre|balance|ecritures
//                          |a-integrer|plan|resultat|bilan|param-bilan|bilan-fige
// POST /api/comptabilite  { action: "integrer"|"annuler"|"exercice"|"init-plan"
//                                   |"init-bilan"|"param-bilan"|"figer-bilan", ... }
// PUT/DELETE /api/comptabilite?vue=param-bilan  (lignes du modèle de bilan)

const num = (v: string | null, d: number) => {
  const x = parseInt(v ?? "", 10);
  return Number.isFinite(x) ? x : d;
};

/** Classe comptable d'un compte = premier chiffre du numéro. */
const classeDe = (numCompte: string) => parseInt(numCompte.charAt(0), 10) || 0;

export async function GET(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.res;

  const sp = req.nextUrl.searchParams;
  const vue = sp.get("vue") ?? "balance";
  const exerciceId = sp.get("exerciceId") ? num(sp.get("exerciceId"), 0) : null;

  if (vue === "exercices") {
    const rows = await prisma.exerciceCompta.findMany({ orderBy: { annee: "desc" } });
    return NextResponse.json({ rows, total: rows.length });
  }

  if (vue === "journaux") {
    const rows = await prisma.journalCompta.findMany({ orderBy: { code: "asc" } });
    const stats = await prisma.ecritureCompta.groupBy({
      by: ["codeJournal"],
      _count: { _all: true },
      _sum: { debit: true, credit: true },
    });
    const parCode = new Map(stats.map((s) => [s.codeJournal, s]));
    return NextResponse.json({
      rows: rows.map((j) => ({
        ...j,
        nbEcritures: parCode.get(j.code)?._count._all ?? 0,
        totalDebit: round3(parCode.get(j.code)?._sum.debit ?? 0),
        totalCredit: round3(parCode.get(j.code)?._sum.credit ?? 0),
      })),
    });
  }

  if (vue === "plan") {
    const rows = await prisma.compteCompta.findMany({ orderBy: { numCompte: "asc" } });
    return NextResponse.json({ rows, total: rows.length });
  }

  // Documents validés mais pas encore comptabilisés.
  if (vue === "a-integrer") {
    const integres = await prisma.ecritureCompta.findMany({
      where: { refDoc: { not: null } },
      distinct: ["refDoc"],
      select: { refDoc: true },
    });
    const dejaFaits = integres.map((e) => e.refDoc).filter((r): r is string => r != null);

    const rows = await prisma.erpDocument.findMany({
      where: {
        nature: "Vente",
        typeDoc: { in: ["FC", "FAC", "BL", "TIC", "AV", "BR", "BRE"] },
        refDoc: { notIn: dejaFaits.length ? dejaFaits : ["__none__"] },
      },
      orderBy: { dateDoc: "desc" },
      take: 100,
      select: {
        refDoc: true, typeDoc: true, dateDoc: true, raisonSocial: true,
        thtNet: true, totTva: true, ttcNet: true, valide: true,
      },
    });
    const total = await prisma.erpDocument.count({
      where: {
        nature: "Vente",
        typeDoc: { in: ["FC", "FAC", "BL", "TIC", "AV", "BR", "BRE"] },
        refDoc: { notIn: dejaFaits.length ? dejaFaits : ["__none__"] },
      },
    });
    return NextResponse.json({ rows, total, dejaIntegres: dejaFaits.length });
  }

  // Grand livre : écritures d'un compte, avec solde progressif.
  if (vue === "grand-livre") {
    const numCompte = sp.get("compte") ?? "";
    if (!numCompte) return NextResponse.json({ error: "Compte requis" }, { status: 400 });

    const rows = await prisma.ecritureCompta.findMany({
      where: { numCompte, ...(exerciceId ? { exerciceId } : {}) },
      orderBy: [{ dateEcriture: "asc" }, { id: "asc" }],
      take: 500,
    });

    let solde = 0;
    const avecSolde = rows.map((e) => {
      solde = round3(solde + e.debit - e.credit);
      return { ...e, solde };
    });

    return NextResponse.json({
      rows: avecSolde,
      total: rows.length,
      totalDebit: round3(rows.reduce((s, e) => s + e.debit, 0)),
      totalCredit: round3(rows.reduce((s, e) => s + e.credit, 0)),
      soldeFinal: solde,
    });
  }

  if (vue === "ecritures") {
    const rows = await prisma.ecritureCompta.findMany({
      where: exerciceId ? { exerciceId } : {},
      orderBy: [{ dateEcriture: "desc" }, { numPiece: "desc" }, { numOrdre: "asc" }],
      take: 300,
    });
    return NextResponse.json({ rows, total: rows.length });
  }

  // Bilan et son paramétrage : traités avant l'agrégat de balance, qui leur est
  // inutile — le bilan a son propre calcul de soldes.
  // Plan comptable standard : modèle réutilisable d'un exercice à l'autre
  // (`plan_comptable_standard` + `insertInexistantPlanActuel` de A).
  if (vue === "plan-standard") {
    const rows = await prisma.compteStandard.findMany({ orderBy: { numCompte: "asc" } });
    const dansExercice = exerciceId
      ? await prisma.compteCompta.count()
      : 0;
    return NextResponse.json({ rows, total: rows.length, comptesExercice: dansExercice });
  }

  if (vue === "param-bilan") {
    const lignes = await prisma.paramBilan.findMany({
      orderBy: [{ type: "asc" }, { numOrdre: "asc" }],
    });
    return NextResponse.json({
      rows: lignes, total: lignes.length,
      actif: lignes.filter((l) => l.type === "ACTIF").length,
      passif: lignes.filter((l) => l.type === "PASSIF").length,
    });
  }

  if (vue === "bilan") {
    const ex = exerciceId ?? (await prisma.exerciceCompta.findFirst({ where: { courant: true } }))?.id;
    if (!ex) return NextResponse.json({ error: "Aucun exercice courant" }, { status: 400 });
    const bilan = await construireBilan(ex);
    return NextResponse.json({ exerciceId: ex, ...bilan });
  }

  if (vue === "bilan-fige") {
    const ex = exerciceId ?? (await prisma.exerciceCompta.findFirst({ where: { courant: true } }))?.id;
    if (!ex) return NextResponse.json({ error: "Aucun exercice courant" }, { status: 400 });
    const figees = await prisma.bilanComptable.findMany({
      where: { exerciceId: ex },
      orderBy: [{ type: "asc" }, { numOrdre: "asc" }],
    });
    return NextResponse.json({
      exerciceId: ex, rows: figees, total: figees.length,
      totalActif: round3(figees.filter((r) => r.type === "ACTIF").reduce((s, r) => s + r.montant, 0)),
      totalPassif: round3(figees.filter((r) => r.type === "PASSIF").reduce((s, r) => s + r.montant, 0)),
      dateArret: figees[0]?.dateArret ?? null,
    });
  }

  // Balance : agrégat débit/crédit **par numéro de compte**.
  // On ne groupe pas sur le libellé : celui-ci porte le nom du tiers sur les
  // comptes clients, ce qui éclaterait 411000 en autant de lignes que de clients.
  const agg = await prisma.ecritureCompta.groupBy({
    by: ["numCompte"],
    where: exerciceId ? { exerciceId } : {},
    _sum: { debit: true, credit: true },
    _count: { _all: true },
  });

  // Intitulé officiel depuis le plan comptable.
  const plan = await prisma.compteCompta.findMany({ select: { numCompte: true, intitule: true } });
  const intitules = new Map(plan.map((c) => [c.numCompte, c.intitule]));

  const rows = agg
    .map((a) => {
      const debit = round3(a._sum.debit ?? 0);
      const credit = round3(a._sum.credit ?? 0);
      const solde = round3(debit - credit);
      return {
        numCompte: a.numCompte,
        libelleCompte: intitules.get(a.numCompte) ?? a.numCompte,
        classe: classeDe(a.numCompte),
        debit, credit,
        soldeDebiteur: solde > 0 ? solde : 0,
        soldeCrediteur: solde < 0 ? -solde : 0,
        nbEcritures: a._count._all,
      };
    })
    .sort((a, b) => a.numCompte.localeCompare(b.numCompte));

  if (vue === "resultat") {
    // Classe 6 = charges, classe 7 = produits.
    const charges = round3(rows.filter((r) => r.classe === 6).reduce((s, r) => s + r.debit - r.credit, 0));
    const produits = round3(rows.filter((r) => r.classe === 7).reduce((s, r) => s + r.credit - r.debit, 0));
    return NextResponse.json({
      charges, produits,
      resultat: round3(produits - charges),
      detailCharges: rows.filter((r) => r.classe === 6),
      detailProduits: rows.filter((r) => r.classe === 7),
    });
  }

  return NextResponse.json({
    rows,
    total: rows.length,
    totalDebit: round3(rows.reduce((s, r) => s + r.debit, 0)),
    totalCredit: round3(rows.reduce((s, r) => s + r.credit, 0)),
    equilibre: Math.abs(rows.reduce((s, r) => s + r.debit - r.credit, 0)) < 0.001,
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => ({}));
  const action = String(body?.action ?? "");

  if (action === "integrer") {
    const refDocs: string[] = Array.isArray(body.refDocs)
      ? body.refDocs.map(String)
      : body.refDoc ? [String(body.refDoc)] : [];
    if (!refDocs.length) return NextResponse.json({ error: "refDoc requis" }, { status: 400 });

    const resultats = [];
    for (const ref of refDocs) {
      resultats.push({ refDoc: ref, ...(await integrerDocument(ref, auth.user.name)) });
    }
    const ok = resultats.filter((r) => r.ok).length;
    return NextResponse.json({
      ok: ok > 0,
      message: `${ok} document(s) comptabilisé(s)${ok < refDocs.length ? `, ${refDocs.length - ok} en échec` : ""}`,
      resultats,
    });
  }

  if (action === "annuler") {
    // Symétrique de `integrer`, qui accepte un lot : on pouvait comptabiliser
    // 50 documents d'un clic mais il fallait les décomptabiliser un par un.
    // `refDoc` (singulier) reste accepté pour les appels existants.
    const refs: string[] = Array.isArray(body?.refDocs)
      ? body.refDocs.map((r: unknown) => String(r)).filter(Boolean)
      : body?.refDoc ? [String(body.refDoc)] : [];
    if (refs.length === 0) {
      return NextResponse.json({ error: "refDoc ou refDocs requis" }, { status: 400 });
    }

    const resultats = [];
    for (const ref of refs) resultats.push({ refDoc: ref, ...(await annulerIntegration(ref)) });
    const ok = resultats.filter((r) => r.ok).length;

    return NextResponse.json(
      { ok: ok > 0, resultats, message: `${ok} document(s) décomptabilisé(s)` },
      { status: ok > 0 ? 200 : 400 },
    );
  }

  if (action === "exercice") {
    const annee = parseInt(String(body?.annee ?? ""), 10);
    if (!Number.isFinite(annee)) return NextResponse.json({ error: "Année invalide" }, { status: 400 });
    const row = await prisma.exerciceCompta.upsert({
      where: { annee },
      create: {
        annee,
        libelle: `Exercice ${annee}`,
        dateDeb: new Date(annee, 0, 1),
        dateFin: new Date(annee, 11, 31, 23, 59, 59, 999),
        courant: Boolean(body?.courant),
      },
      update: { courant: Boolean(body?.courant), cloture: Boolean(body?.cloture) },
    });
    return NextResponse.json({ ok: true, row, message: `Exercice ${annee} enregistré` });
  }

  // Crée le plan comptable minimal et les journaux à partir du paramétrage.
  if (action === "init-plan") {
    const comptes = await getComptes();
    const journaux = [
      { code: "VE", libelle: "Journal des ventes", type: "Vente" },
      { code: "AC", libelle: "Journal des achats", type: "Achat" },
      { code: "BQ", libelle: "Journal de banque", type: "Trésorerie" },
      { code: "CA", libelle: "Journal de caisse", type: "Trésorerie" },
      { code: "OD", libelle: "Opérations diverses", type: "OD" },
    ];

    for (const j of journaux) {
      await prisma.journalCompta.upsert({ where: { code: j.code }, create: j, update: {} });
    }
    for (const c of Object.values(comptes)) {
      await prisma.compteCompta.upsert({
        where: { numCompte: c.numCompte },
        create: { numCompte: c.numCompte, intitule: c.libelle, classe: classeDe(c.numCompte) },
        update: {},
      });
    }

    return NextResponse.json({
      ok: true,
      message: `${journaux.length} journaux et ${Object.keys(comptes).length} comptes initialisés`,
    });
  }

  // Copie du plan standard vers le plan de l'exercice.
  // `insertInexistantPlanActuel` de A : n'ajoute que les comptes absents, pour
  // ne pas écraser un compte déjà paramétré et utilisé par des écritures.
  if (action === "copier-plan-standard") {
    const standard = await prisma.compteStandard.findMany();
    if (standard.length === 0) {
      return NextResponse.json({ error: "Le plan standard est vide" }, { status: 400 });
    }
    const existants = await prisma.compteCompta.findMany({ select: { numCompte: true } });
    const deja = new Set(existants.map((c) => c.numCompte));
    const aCreer = standard.filter((c) => !deja.has(c.numCompte));

    if (aCreer.length > 0) {
      await prisma.compteCompta.createMany({
        data: aCreer.map((c) => ({
          numCompte: c.numCompte,
          intitule: c.intitule,
          classe: classeDe(c.numCompte),
        })),
        skipDuplicates: true,
      });
    }
    return NextResponse.json({
      ok: true, crees: aCreer.length, ignores: standard.length - aCreer.length,
      message: aCreer.length > 0
        ? `${aCreer.length} compte(s) ajouté(s) au plan de l'exercice (${standard.length - aCreer.length} déjà présent(s))`
        : `Tous les comptes du standard sont déjà dans le plan`,
    });
  }

  // Enregistre le plan de l'exercice courant comme modèle standard.
  if (action === "plan-standard") {
    const numCompte = String(body?.numCompte ?? "").trim();
    const intitule = String(body?.intitule ?? "").trim();

    // Reprise en masse depuis le plan de l'exercice.
    if (body?.depuisExercice === true) {
      const comptes = await prisma.compteCompta.findMany({ select: { numCompte: true, intitule: true } });
      const existants = await prisma.compteStandard.findMany({ select: { numCompte: true } });
      const deja = new Set(existants.map((c) => c.numCompte));
      const aCreer = comptes.filter((c) => !deja.has(c.numCompte));
      if (aCreer.length > 0) {
        await prisma.compteStandard.createMany({ data: aCreer, skipDuplicates: true });
      }
      return NextResponse.json({
        ok: true, crees: aCreer.length,
        message: `${aCreer.length} compte(s) repris dans le plan standard`,
      });
    }

    if (!/^\d{3,10}$/.test(numCompte)) {
      return NextResponse.json({ error: "Numéro de compte invalide (3 à 10 chiffres)" }, { status: 400 });
    }
    if (!intitule) return NextResponse.json({ error: "Intitulé requis" }, { status: 400 });

    const exist = await prisma.compteStandard.findUnique({ where: { numCompte } });
    if (exist) return NextResponse.json({ error: `Le compte ${numCompte} existe déjà` }, { status: 409 });

    const row = await prisma.compteStandard.create({ data: { numCompte, intitule } });
    return NextResponse.json({ ok: true, row, message: `Compte ${numCompte} ajouté au standard` });
  }

  // Modèle de bilan par défaut (plan comptable tunisien). Idempotent.
  if (action === "init-bilan") {
    const res = await initialiserModeleBilan();
    return NextResponse.json({
      ok: true, ...res,
      message: res.crees > 0
        ? `${res.crees} ligne(s) de bilan créée(s) (${res.total} au total)`
        : `Modèle de bilan déjà complet (${res.total} lignes)`,
    });
  }

  if (action === "param-bilan") {
    const libelle = String(body?.libelle ?? "").trim();
    const type = String(body?.type ?? "").toUpperCase();
    if (!libelle) return NextResponse.json({ error: "Libellé requis" }, { status: 400 });
    if (type !== "ACTIF" && type !== "PASSIF") {
      return NextResponse.json({ error: "Type attendu : ACTIF ou PASSIF" }, { status: 400 });
    }
    const row = await prisma.paramBilan.create({
      data: {
        libelle, type,
        formule: String(body?.formule ?? "").trim(),
        rubrique: body?.rubrique ? String(body.rubrique).trim() : null,
        numOrdre: num(String(body?.numOrdre ?? ""), 0),
      },
    });
    return NextResponse.json({ ok: true, row, message: `Ligne « ${libelle} » ajoutée` });
  }

  if (action === "figer-bilan") {
    const exerciceId = num(String(body?.exerciceId ?? ""), 0)
      || (await prisma.exerciceCompta.findFirst({ where: { courant: true } }))?.id;
    if (!exerciceId) return NextResponse.json({ error: "Aucun exercice courant" }, { status: 400 });
    const res = await figerBilan(exerciceId);
    return NextResponse.json(res, { status: res.ok ? 200 : 400 });
  }

  return NextResponse.json({ error: "action inconnue" }, { status: 400 });
}

export async function PUT(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => ({}));
  const id = num(String(body?.id ?? ""), 0);
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  if (String(body?.vue ?? "") === "param-bilan") {
    const row = await prisma.paramBilan.update({
      where: { id },
      data: {
        ...(body.libelle != null ? { libelle: String(body.libelle).trim() } : {}),
        ...(body.formule != null ? { formule: String(body.formule).trim() } : {}),
        ...(body.rubrique != null ? { rubrique: String(body.rubrique).trim() || null } : {}),
        ...(body.numOrdre != null ? { numOrdre: num(String(body.numOrdre), 0) } : {}),
      },
    });
    return NextResponse.json({ ok: true, row, message: "Ligne de bilan modifiée" });
  }

  return NextResponse.json({ error: "vue inconnue" }, { status: 400 });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireSession(["ADMIN"]);
  if (!auth.ok) return auth.res;

  const sp = req.nextUrl.searchParams;
  const id = num(sp.get("id"), 0);
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  if (sp.get("vue") === "param-bilan") {
    await prisma.paramBilan.delete({ where: { id } });
    return NextResponse.json({ ok: true, message: "Ligne de bilan supprimée" });
  }

  return NextResponse.json({ error: "vue inconnue" }, { status: 400 });
}
