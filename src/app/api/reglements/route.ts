import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { round3 } from "@/lib/vente-stats";

// Encaissements clients / décaissements fournisseurs.
//
// POST /api/reglements { codeCli, montant, mode?, numPiece?, commentaire? }
//
// Un encaissement crédite le tiers et diminue son solde, dans la même
// transaction que la création du règlement — comme le fait l'ERP source
// via `updateSoldeClient`.

export async function POST(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER", "COMMERCIAL"]);
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => ({}));
  const codeCli = Number(body?.codeCli);
  const montant = round3(Number(body?.montant));
  const sens = body?.sens === "F" ? "F" : "C";

  if (!Number.isFinite(codeCli)) {
    return NextResponse.json({ error: "codeCli requis" }, { status: 400 });
  }
  if (!Number.isFinite(montant) || montant <= 0) {
    return NextResponse.json({ error: "Montant invalide" }, { status: 400 });
  }

  const partner = await prisma.partner.findUnique({ where: { id: codeCli } });
  if (!partner) return NextResponse.json({ error: "Tiers introuvable" }, { status: 404 });

  // Les identifiants de règlement sont numériques et non auto-incrémentés
  // dans les données importées : on prend le suivant disponible.
  const last = await prisma.erpReglement.findFirst({ orderBy: { id: "desc" }, select: { id: true } });
  const id = (last?.id ?? 0) + 1;

  const ops: Prisma.PrismaPromise<unknown>[] = [
    prisma.erpReglement.create({
      data: {
        id,
        sens,
        datePay: new Date(),
        montant,
        modePay: body?.mode ? String(body.mode) : "Espèces",
        numPiece: body?.numPiece ? String(body.numPiece) : null,
        etat: "Encaissé",
        tiersCode: codeCli,
        tiersNom: partner.raisonSocial,
        utilisateur: auth.user.name,
        commentaire: body?.commentaire ? String(body.commentaire) : null,
      },
    }),
    // Encaissement client : crédite le compte, réduit le solde dû.
    prisma.partner.update({
      where: { id: codeCli },
      data:
        sens === "C"
          ? { credit: round3(partner.credit + montant), soldeFin: round3(partner.soldeFin - montant) }
          : { debit: round3(partner.debit + montant), soldeFin: round3(partner.soldeFin + montant) },
    }),
  ];

  await prisma.$transaction(ops);

  const updated = await prisma.partner.findUnique({ where: { id: codeCli } });
  return NextResponse.json({
    ok: true,
    message: `Règlement de ${montant} TND enregistré`,
    id,
    soldeFin: updated?.soldeFin ?? 0,
  });
}
