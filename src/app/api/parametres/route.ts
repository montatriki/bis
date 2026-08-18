import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { COMPTES_DEFAUT } from "@/lib/compta-integration";

// Paramétrage de l'application — référentiels éditables, taux, comptes comptables.
//
// GET    /api/parametres?vue=refs|comptes|societe|taux
// POST   /api/parametres { vue: "refs", kind, label, code? }
// PUT    /api/parametres { vue: "refs"|"comptes"|"societe", ... }
// DELETE /api/parametres?vue=refs&id=...
//
// Complète l'écran Paramétrages qui n'était jusqu'ici qu'en lecture seule.

const s = (v: unknown) => (v == null ? "" : String(v).trim());
const int = (v: unknown) => {
  const x = parseInt(String(v ?? ""), 10);
  return Number.isFinite(x) ? x : null;
};

/** Référentiels éditables, par domaine. */
const KINDS: Record<string, { kind: string; titre: string }[]> = {
  vente: [
    { kind: "doctype-vente", titre: "Types de documents (Vente)" },
    { kind: "famille-cli", titre: "Familles clients" },
    { kind: "sousfamille-cli", titre: "Sous-familles clients" },
    { kind: "commercial", titre: "Commerciaux" },
  ],
  achat: [
    { kind: "doctype-achat", titre: "Types de documents (Achat)" },
    { kind: "famille-frs", titre: "Familles fournisseurs" },
    { kind: "sousfamille-frs", titre: "Sous-familles fournisseurs" },
  ],
  stock: [
    { kind: "depot", titre: "Dépôts" },
    { kind: "vehicule", titre: "Véhicules / points de stock" },
  ],
};

/** Paramètres généraux stockés dans RefTable (kind = "param"). */
const PARAMS_SOCIETE = [
  // Valeur de départ : l'en-tête des tickets et documents imprimés serait
  // vide sans elle. Modifiable dans Paramètres › Société.
  { cle: "societe.nom", libelle: "Raison sociale", defaut: "STE SKY EDITION ET DISTRIBUTION" },
  { cle: "societe.mf", libelle: "Matricule fiscale", defaut: "" },
  { cle: "societe.adresse", libelle: "Adresse", defaut: "" },
  { cle: "societe.tel", libelle: "Téléphone", defaut: "" },
  { cle: "societe.email", libelle: "Email", defaut: "" },
  { cle: "taux.tva", libelle: "Taux de TVA par défaut (%)", defaut: "19" },
  { cle: "taux.fodec", libelle: "Taux de FODEC (%)", defaut: "1" },
  { cle: "taux.timbre", libelle: "Timbre fiscal (TND)", defaut: "1" },
  { cle: "taux.retenue", libelle: "Retenue à la source (%)", defaut: "1.5" },
];

export async function GET(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.res;

  const sp = req.nextUrl.searchParams;
  const vue = sp.get("vue") ?? "refs";

  if (vue === "refs") {
    const scope = s(sp.get("scope")) || "vente";
    const groupes = KINDS[scope] ?? KINDS.vente;
    const rows = await prisma.refTable.findMany({
      where: { kind: { in: groupes.map((g) => g.kind) } },
      orderBy: [{ kind: "asc" }, { label: "asc" }],
    });
    return NextResponse.json({
      scope,
      sections: groupes.map((g) => ({
        kind: g.kind,
        titre: g.titre,
        rows: rows.filter((r) => r.kind === g.kind),
      })),
    });
  }

  // Comptes comptables utilisés par l'intégration.
  if (vue === "comptes") {
    const params = await prisma.paramCompta.findMany();
    const parCle = new Map(params.map((p) => [p.cle, p]));
    return NextResponse.json({
      rows: Object.entries(COMPTES_DEFAUT).map(([cle, d]) => {
        const p = parCle.get(cle);
        return {
          cle,
          numCompte: p?.numCompte ?? d.numCompte,
          libelle: p?.libelle ?? d.libelle,
          parDefaut: !p,
        };
      }),
    });
  }

  // Société + taux.
  const params = await prisma.refTable.findMany({ where: { kind: "param" } });
  const parCle = new Map(params.map((p) => [p.code ?? "", p.label]));
  return NextResponse.json({
    rows: PARAMS_SOCIETE.map((p) => ({
      ...p,
      valeur: parCle.get(p.cle) ?? p.defaut,
    })),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => ({}));
  const kind = s(body.kind);
  const label = s(body.label);

  if (!kind || !label) {
    return NextResponse.json({ error: "Type et libellé requis" }, { status: 400 });
  }

  const row = await prisma.refTable.create({
    data: { kind, label, code: s(body.code) || null },
  });
  return NextResponse.json({ ok: true, row, message: `« ${label} » ajouté` });
}

export async function PUT(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => ({}));
  const vue = s(body.vue) || "refs";

  if (vue === "comptes") {
    const cle = s(body.cle);
    const numCompte = s(body.numCompte);
    if (!cle || !numCompte) {
      return NextResponse.json({ error: "Clé et numéro de compte requis" }, { status: 400 });
    }
    // Le numéro de compte pilote l'intégration comptable : on vérifie sa forme.
    if (!/^\d{3,10}$/.test(numCompte)) {
      return NextResponse.json(
        { error: "Numéro de compte invalide (3 à 10 chiffres)" },
        { status: 400 }
      );
    }

    const row = await prisma.paramCompta.upsert({
      where: { cle },
      create: { cle, numCompte, libelle: s(body.libelle) || null },
      update: { numCompte, libelle: s(body.libelle) || null },
    });

    // Le compte doit exister au plan comptable pour apparaître à la balance.
    await prisma.compteCompta.upsert({
      where: { numCompte },
      create: {
        numCompte,
        intitule: s(body.libelle) || cle,
        classe: parseInt(numCompte.charAt(0), 10) || 0,
      },
      update: {},
    });

    return NextResponse.json({ ok: true, row, message: `Compte ${cle} → ${numCompte}` });
  }

  if (vue === "societe") {
    const cle = s(body.cle);
    const valeur = s(body.valeur);
    if (!cle) return NextResponse.json({ error: "Clé requise" }, { status: 400 });

    const existant = await prisma.refTable.findFirst({ where: { kind: "param", code: cle } });
    const row = existant
      ? await prisma.refTable.update({ where: { id: existant.id }, data: { label: valeur } })
      : await prisma.refTable.create({ data: { kind: "param", code: cle, label: valeur } });

    return NextResponse.json({ ok: true, row, message: "Paramètre enregistré" });
  }

  // Référentiel simple.
  const id = int(body.id);
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
  const row = await prisma.refTable.update({
    where: { id },
    data: { label: s(body.label), code: s(body.code) || null },
  });
  return NextResponse.json({ ok: true, row, message: "Modifié" });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireSession(["ADMIN"]);
  if (!auth.ok) return auth.res;

  const id = int(req.nextUrl.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  const ref = await prisma.refTable.findUnique({ where: { id } });
  if (!ref) return NextResponse.json({ error: "Élément introuvable" }, { status: 404 });

  // Un dépôt ou un commercial référencé ailleurs ne doit pas disparaître
  // silencieusement : on prévient plutôt que de casser les écrans.
  if (ref.kind === "commercial" && ref.label) {
    const used = await prisma.erpDocument.count({
      where: { OR: [{ commercial: ref.label }, { utilisateur: ref.label }] },
    });
    if (used > 0) {
      return NextResponse.json(
        { error: `Impossible : ${used} document(s) référencent « ${ref.label} »` },
        { status: 409 }
      );
    }
  }

  await prisma.refTable.delete({ where: { id } });
  return NextResponse.json({ ok: true, message: "Supprimé" });
}
