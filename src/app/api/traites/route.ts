import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { montantEnLettres } from "@/lib/traite-montant";

// Traites bancaires (lettres de change) — module KEMBYELTY, réservé à l'ADMIN.
//
// GET    /api/traites?vue=liste|detail|stats|tiers
// POST   /api/traites { tireNom, montant, echeance, … }
// PUT    /api/traites { id, … }            — modification ou changement d'état
// PUT    /api/traites { id, action:"impression" } — trace une impression
// DELETE /api/traites?id=…

const s = (v: unknown) => (v == null ? "" : String(v).trim());
const int = (v: unknown) => {
  const x = parseInt(String(v ?? ""), 10);
  return Number.isFinite(x) ? x : null;
};
const num = (v: unknown) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
};
const date = (v: unknown) => {
  const t = s(v);
  if (!t) return null;
  const d = new Date(t);
  return isNaN(d.getTime()) ? null : d;
};

/** États du cycle de vie d'une traite, de la saisie au dénouement. */
const ETATS = ["Brouillon", "Imprimée", "Remise", "Payée", "Impayée", "Annulée"] as const;

/** Ne garde que les chiffres — les cases RIB du papier n'acceptent rien d'autre. */
const chiffres = (v: unknown, max: number) => s(v).replace(/\D/g, "").slice(0, max);

/** Sérialise le Decimal Prisma en nombre pour le client. */
function sortie(t: Record<string, unknown>) {
  return { ...t, montant: Number(t.montant) };
}

/** Référence séquentielle par année : TR-2026-0001. */
async function prochaineReference() {
  const annee = new Date().getFullYear();
  const prefixe = `TR-${annee}-`;
  const dernier = await prisma.traite.findFirst({
    where: { reference: { startsWith: prefixe } },
    orderBy: { reference: "desc" },
    select: { reference: true },
  });
  const n = dernier ? int(dernier.reference.slice(prefixe.length)) ?? 0 : 0;
  return `${prefixe}${String(n + 1).padStart(4, "0")}`;
}

export async function GET(req: NextRequest) {
  const auth = await requireSession(["ADMIN"]);
  if (!auth.ok) return auth.res;

  const sp = req.nextUrl.searchParams;
  const vue = sp.get("vue") ?? "liste";

  if (vue === "detail") {
    const id = int(sp.get("id"));
    if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
    const row = await prisma.traite.findUnique({ where: { id } });
    if (!row) return NextResponse.json({ error: "Traite introuvable" }, { status: 404 });
    return NextResponse.json({ row: sortie(row) });
  }

  // Référentiel tiers pour l'autocomplétion du tiré (nom, adresse, RIB connus).
  if (vue === "tiers") {
    const q = s(sp.get("q"));
    const rows = await prisma.partner.findMany({
      where: q
        ? { OR: [{ raisonSocial: { contains: q, mode: "insensitive" } }, { id: int(q) ?? -1 }] }
        : {},
      select: { id: true, raisonSocial: true, adresse: true, ville: true, tel: true },
      orderBy: { raisonSocial: "asc" },
      take: 30,
    });
    return NextResponse.json({ rows });
  }

  if (vue === "stats") {
    const [total, parEtat, sommes] = await Promise.all([
      prisma.traite.count(),
      prisma.traite.groupBy({ by: ["etat"], _count: { _all: true }, _sum: { montant: true } }),
      prisma.traite.aggregate({ _sum: { montant: true } }),
    ]);

    // Échéances dépassées non dénouées : ce que l'admin doit relancer.
    const enRetard = await prisma.traite.count({
      where: { echeance: { lt: new Date() }, etat: { in: ["Imprimée", "Remise", "Impayée"] } },
    });

    return NextResponse.json({
      total,
      montantTotal: Number(sommes._sum.montant ?? 0),
      enRetard,
      parEtat: parEtat.map((e) => ({
        etat: e.etat,
        nb: e._count._all,
        montant: Number(e._sum.montant ?? 0),
      })),
    });
  }

  // ── Liste, filtrable par état et par recherche libre ──
  const etat = s(sp.get("etat"));
  const q = s(sp.get("q"));

  const where: Record<string, unknown> = {};
  if (etat && etat !== "Tous") where.etat = etat;
  if (q) {
    where.OR = [
      { reference: { contains: q, mode: "insensitive" } },
      { tireNom: { contains: q, mode: "insensitive" } },
      { numeroOrdre: { contains: q, mode: "insensitive" } },
      { beneficiaire: { contains: q, mode: "insensitive" } },
    ];
  }

  const rows = await prisma.traite.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    take: 200,
  });

  return NextResponse.json({ rows: rows.map(sortie), etats: ETATS });
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(["ADMIN"]);
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => ({}));

  const tireNom = s(body.tireNom);
  const montant = num(body.montant);

  if (!tireNom) return NextResponse.json({ error: "Le nom du tiré est obligatoire" }, { status: 400 });
  if (montant == null || montant <= 0) {
    return NextResponse.json({ error: "Le montant doit être supérieur à 0" }, { status: 400 });
  }

  const echeance = date(body.echeance);
  const dateCreation = date(body.dateCreation) ?? new Date();
  if (echeance && echeance < dateCreation) {
    return NextResponse.json(
      { error: "L'échéance ne peut pas précéder la date de création" },
      { status: 400 },
    );
  }

  const row = await prisma.traite.create({
    data: {
      reference: await prochaineReference(),
      numeroOrdre: s(body.numeroOrdre) || null,
      codeTiers: int(body.codeTiers),
      tireNom,
      tireAdresse: s(body.tireAdresse) || null,
      beneficiaire: s(body.beneficiaire) || "—",
      ribBanque: chiffres(body.ribBanque, 2) || null,
      ribAgence: chiffres(body.ribAgence, 3) || null,
      ribCompte: chiffres(body.ribCompte, 13) || null,
      ribCle: chiffres(body.ribCle, 2) || null,
      domiciliation: s(body.domiciliation) || null,
      valeurEn: s(body.valeurEn) || null,
      nomCedant: s(body.nomCedant) || null,
      montant,
      montantLettres: montantEnLettres(montant),
      lieuCreation: s(body.lieuCreation) || null,
      dateCreation,
      echeance,
      etat: ETATS.includes(s(body.etat) as typeof ETATS[number]) ? s(body.etat) : "Brouillon",
      offsetX: num(body.offsetX) ?? 0,
      offsetY: num(body.offsetY) ?? 0,
      notes: s(body.notes) || null,
      utilisateur: auth.user.name,
    },
  });

  return NextResponse.json({ row: sortie(row), message: `Traite ${row.reference} enregistrée` });
}

export async function PUT(req: NextRequest) {
  const auth = await requireSession(["ADMIN"]);
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => ({}));
  const id = int(body.id);
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  const actuel = await prisma.traite.findUnique({ where: { id } });
  if (!actuel) return NextResponse.json({ error: "Traite introuvable" }, { status: 404 });

  // Impression : on incrémente le compteur et on retient le calibrage utilisé.
  // Une traite encore en brouillon passe à « Imprimée ».
  if (s(body.action) === "impression") {
    const row = await prisma.traite.update({
      where: { id },
      data: {
        nbImpressions: { increment: 1 },
        derniereImpr: new Date(),
        offsetX: num(body.offsetX) ?? actuel.offsetX,
        offsetY: num(body.offsetY) ?? actuel.offsetY,
        etat: actuel.etat === "Brouillon" ? "Imprimée" : actuel.etat,
      },
    });
    return NextResponse.json({ row: sortie(row), message: "Impression enregistrée" });
  }

  // Changement d'état seul (remise en banque, paiement, impayé…).
  if (body.etat !== undefined && Object.keys(body).length <= 2) {
    const etat = s(body.etat);
    if (!ETATS.includes(etat as typeof ETATS[number])) {
      return NextResponse.json({ error: "État inconnu" }, { status: 400 });
    }
    const row = await prisma.traite.update({ where: { id }, data: { etat } });
    return NextResponse.json({ row: sortie(row), message: `Traite ${etat.toLowerCase()}` });
  }

  // ── Modification complète ──
  const montant = num(body.montant);
  if (montant != null && montant <= 0) {
    return NextResponse.json({ error: "Le montant doit être supérieur à 0" }, { status: 400 });
  }

  const echeance = body.echeance !== undefined ? date(body.echeance) : actuel.echeance;
  const dateCreation = date(body.dateCreation) ?? actuel.dateCreation;
  if (echeance && echeance < dateCreation) {
    return NextResponse.json(
      { error: "L'échéance ne peut pas précéder la date de création" },
      { status: 400 },
    );
  }

  const row = await prisma.traite.update({
    where: { id },
    data: {
      numeroOrdre: body.numeroOrdre !== undefined ? s(body.numeroOrdre) || null : undefined,
      codeTiers: body.codeTiers !== undefined ? int(body.codeTiers) : undefined,
      tireNom: body.tireNom !== undefined ? s(body.tireNom) || actuel.tireNom : undefined,
      tireAdresse: body.tireAdresse !== undefined ? s(body.tireAdresse) || null : undefined,
      beneficiaire: body.beneficiaire !== undefined ? s(body.beneficiaire) || actuel.beneficiaire : undefined,
      ribBanque: body.ribBanque !== undefined ? chiffres(body.ribBanque, 2) || null : undefined,
      ribAgence: body.ribAgence !== undefined ? chiffres(body.ribAgence, 3) || null : undefined,
      ribCompte: body.ribCompte !== undefined ? chiffres(body.ribCompte, 13) || null : undefined,
      ribCle: body.ribCle !== undefined ? chiffres(body.ribCle, 2) || null : undefined,
      domiciliation: body.domiciliation !== undefined ? s(body.domiciliation) || null : undefined,
      valeurEn: body.valeurEn !== undefined ? s(body.valeurEn) || null : undefined,
      nomCedant: body.nomCedant !== undefined ? s(body.nomCedant) || null : undefined,
      montant: montant ?? undefined,
      // Le texte en lettres suit toujours le montant.
      montantLettres: montant != null ? montantEnLettres(montant) : undefined,
      lieuCreation: body.lieuCreation !== undefined ? s(body.lieuCreation) || null : undefined,
      dateCreation: body.dateCreation !== undefined ? dateCreation : undefined,
      echeance: body.echeance !== undefined ? echeance : undefined,
      etat: body.etat !== undefined && ETATS.includes(s(body.etat) as typeof ETATS[number]) ? s(body.etat) : undefined,
      offsetX: body.offsetX !== undefined ? num(body.offsetX) ?? 0 : undefined,
      offsetY: body.offsetY !== undefined ? num(body.offsetY) ?? 0 : undefined,
      notes: body.notes !== undefined ? s(body.notes) || null : undefined,
    },
  });

  return NextResponse.json({ row: sortie(row), message: `Traite ${row.reference} mise à jour` });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireSession(["ADMIN"]);
  if (!auth.ok) return auth.res;

  const id = int(req.nextUrl.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  const row = await prisma.traite.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ error: "Traite introuvable" }, { status: 404 });

  // Une traite déjà remise en banque ou payée est une pièce justificative :
  // on l'annule plutôt que de l'effacer.
  if (["Remise", "Payée"].includes(row.etat)) {
    const annulee = await prisma.traite.update({ where: { id }, data: { etat: "Annulée" } });
    return NextResponse.json({
      row: sortie(annulee),
      message: `Traite ${row.reference} annulée (non supprimée : déjà ${row.etat.toLowerCase()})`,
    });
  }

  await prisma.traite.delete({ where: { id } });
  return NextResponse.json({ message: `Traite ${row.reference} supprimée` });
}
