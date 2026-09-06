import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { prepareDocument } from "@/lib/document-numbering";
import { computeDocument, type LineInput } from "@/lib/document-calc";
import { docTypeRule } from "@/lib/document-types";
import { validerDocument } from "@/lib/document-validation";
import { emplacementVehicule, cleCommercial, memePortefeuille } from "@/lib/perimetre-commercial";

// Création d'une commande depuis le catalogue (panier commercial / client).
//
// POST /api/commandes { codeCli, raisonSocial?, typeDoc?, lignes: [...] }
//
// Le document est créé en **brouillon** avec ses lignes : le stock et le solde
// ne bougeront qu'à la validation (`/api/erp/document-validate`), conformément
// à la chaîne mise en place pour les documents de vente.

const s = (v: unknown) => (v == null ? "" : String(v));
const num = (v: unknown) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

export async function POST(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER", "COMMERCIAL", "CLIENT"]);
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => ({}));

  // Un utilisateur CLIENT commande toujours pour son propre compte : le tiers
  // vient de la session, jamais du corps de la requête.
  const estClient = auth.user.role === "CLIENT";
  const codeCli = estClient || body?.pourMonCompte
    ? Number(auth.user.codeTiers)
    : Number(body?.codeCli);

  if (!Number.isFinite(codeCli)) {
    return NextResponse.json(
      { error: estClient ? "Aucun compte client rattaché à cet utilisateur" : "Client requis" },
      { status: estClient ? 403 : 400 }
    );
  }

  const incoming: unknown[] = Array.isArray(body?.lignes) ? body.lignes : [];
  const inputs: LineInput[] = incoming
    .map((raw) => {
      const l = raw as Record<string, unknown>;
      return {
        refArt: s(l.refArt),
        designation: s(l.designation),
        unite: l.unite == null ? null : s(l.unite),
        qte: num(l.qte),
        puHt: num(l.puHt),
        remise: num(l.remise),
        tauxTva: num(l.tauxTva),
        tauxFodec: num(l.tauxFodec),
      };
    })
    .filter((l) => l.refArt && l.qte > 0);

  if (inputs.length === 0) {
    return NextResponse.json({ error: "Aucune ligne valide" }, { status: 400 });
  }

  const partner = await prisma.partner.findUnique({ where: { id: codeCli } });
  // Le document crée une écriture au compte du tiers : un commercial ne peut
  // commander qu'au nom de ses propres clients. (Le rôle CLIENT est déjà
  // borné plus haut : son tiers vient de la session, jamais du corps.)
  if (auth.user.role === "COMMERCIAL" && !memePortefeuille(partner?.commercial, auth.user.name)) {
    return NextResponse.json({ error: "Ce client n'est pas dans votre portefeuille" }, { status: 403 });
  }
  const typeDoc = (s(body?.typeDoc) || "COM").toUpperCase();
  const rule = docTypeRule(typeDoc);
  const prepared = await prepareDocument(typeDoc);
  const { lines, totals } = computeDocument(inputs, 0);

  // Vente en tournée : la marchandise sort du camion du commercial, pas du
  // dépôt. On rattache le document à cet emplacement pour que la validation
  // décrémente le bon stock.
  let vehicule: string | null = null;
  // Tournée du jour : le document doit lui être rattaché, sinon il n'apparaît
  // ni dans le journal de tournée ni dans la réconciliation de caisse — une
  // vente encaissée restait invisible au commercial.
  let dayId: number | null = null;
  if (auth.user.role === "COMMERCIAL") {
    const jour = new Date();
    jour.setHours(0, 0, 0, 0);
    const mission = await prisma.erpMission.findFirst({
      where: {
        commercial: { startsWith: cleCommercial(auth.user.name), mode: "insensitive" },
        dateOrdre: { gte: jour, lt: new Date(jour.getTime() + 86_400_000) },
        etat: { notIn: ["Annulée"] },
      },
      select: { id: true, vehicule: true },
      orderBy: { id: "desc" },
    });
    dayId = mission?.id ?? null;
    vehicule =
      s(body?.vehicule) ||
      (await emplacementVehicule(auth.user.name, mission?.vehicule));
  }

  const ops: Prisma.PrismaPromise<unknown>[] = [
    prisma.erpDocument.create({
      data: {
        refDoc: prepared.refDoc,
        caraDoc: prepared.caraDoc,
        numSeq: prepared.numSeq,
        nature: rule.nature,
        typeDoc,
        // La remarque du client est conservée sur le document.
        libDoc: s(body?.commentaire) || rule.label,
        dateDoc: new Date(),
        codeCli,
        raisonSocial: s(body?.raisonSocial) || partner?.raisonSocial || null,
        vehicule,
        dayId,
        adrCli: partner?.adresse ?? null,
        mf: partner?.matriculeF ?? null,
        thtBrut: totals.thtBrut,
        totRemise: totals.totRemise,
        thtNet: totals.thtNet,
        totTva: totals.totTva,
        totFodec: totals.totFodec,
        timbre: totals.timbre,
        ttcNet: totals.ttcNet,
        soldeDoc: totals.ttcNet,
        etat: "En cours",
        valide: false,
        utilisateur: auth.user.name,
      },
    }),
    prisma.erpDocumentLine.createMany({
      data: lines.map((l, i) => ({
        refDoc: prepared.refDoc,
        refArt: l.refArt,
        designation: l.designation,
        unite: l.unite ?? null,
        qte: l.qte,
        puHt: l.puHt,
        remise: l.remise,
        tauxTva: l.tauxTva,
        tauxFodec: l.tauxFodec,
        thtBrut: l.thtBrut,
        thtNet: l.thtNet,
        totTva: l.totTva,
        ttcNet: l.ttcNet,
        ordre: i,
      })),
    }),
  ];

  await prisma.$transaction(ops);

  // Vente ferme (`valider: true`) : le document est immédiatement validé, donc
  // le stock sort et le solde du client est débité. C'est le cas d'une vente en
  // tournée — le client repart avec la marchandise et son ticket.
  // Un CLIENT qui commande en ligne reste en brouillon : c'est une demande,
  // pas une livraison.
  const doitValider = body?.valider === true && !estClient && docTypeRule(typeDoc).tStock !== "N";

  if (doitValider) {
    const res = await validerDocument(prepared.refDoc);
    if (!res.ok) {
      // Stock insuffisant : le document ne doit pas rester en base, sinon le
      // commercial garde un ticket fantôme qui n'a jamais été livré.
      await prisma.$transaction([
        prisma.erpDocumentLine.deleteMany({ where: { refDoc: prepared.refDoc } }),
        prisma.erpDocument.delete({ where: { refDoc: prepared.refDoc } }),
      ]);
      return NextResponse.json({ error: res.message }, { status: 409 });
    }
  }

  return NextResponse.json({
    ok: true,
    message: doitValider
      ? `${rule.label} ${prepared.refDoc} émis`
      : `Commande ${prepared.refDoc} créée`,
    refDoc: prepared.refDoc,
    typeDoc,
    valide: doitValider,
    lignes: lines.length,
    thtNet: totals.thtNet,
    ttcNet: totals.ttcNet,
  });
}
