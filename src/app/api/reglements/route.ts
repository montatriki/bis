import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { round3 } from "@/lib/vente-stats";
import { cleCommercial, memePortefeuille } from "@/lib/perimetre-commercial";

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
  // Un encaissement modifie le solde du tiers : sans ce contrôle, un
  // commercial pouvait créditer (ou débiter, avec sens "F") le client d'un
  // collègue et fausser son recouvrement.
  if (auth.user.role === "COMMERCIAL" && !memePortefeuille(partner.commercial, auth.user.name)) {
    return NextResponse.json({ error: "Ce client n'est pas dans votre portefeuille" }, { status: 403 });
  }

  const mode = body?.mode ? String(body.mode) : "Espèces";
  const echeance = body?.echeance ? String(body.echeance) : "";
  /** Effet à recouvrer : encaissement différé à la date d'échéance. */
  const aEcheance = mode === "Chèque" || mode === "Traite";

  // Les identifiants de règlement sont numériques et non auto-incrémentés
  // dans les données importées : on prend le suivant disponible.
  const last = await prisma.erpReglement.findFirst({ orderBy: { id: "desc" }, select: { id: true } });
  const id = (last?.id ?? 0) + 1;

  // Tournée du jour du commercial : elle rattache l'encaissement au journal de
  // caisse. Fournie explicitement, ou déduite de la tournée en cours.
  let dayIdTournee: number | null = body?.dayId ? Number(body.dayId) : null;
  if (!dayIdTournee && auth.user.role === "COMMERCIAL") {
    const jour = new Date();
    jour.setHours(0, 0, 0, 0);
    const mission = await prisma.erpMission.findFirst({
      where: {
        commercial: { startsWith: cleCommercial(auth.user.name), mode: "insensitive" },
        dateOrdre: { gte: jour, lt: new Date(jour.getTime() + 86_400_000) },
        etat: { notIn: ["Annulée"] },
      },
      select: { id: true },
      orderBy: { id: "desc" },
    });
    dayIdTournee = mission?.id ?? null;
  }

  const ops: Prisma.PrismaPromise<unknown>[] = [
    prisma.erpReglement.create({
      data: {
        id,
        sens,
        datePay: new Date(),
        montant,
        modePay: mode,
        numPiece: body?.numPiece ? String(body.numPiece) : null,
        // Document réglé : c'est ce lien qui permet au ticket imprimé
        // d'afficher le montant encaissé et au document de se solder.
        numDoc: body?.numDoc ? String(body.numDoc) : null,
        // Tournée du jour : sans ce lien, l'encaissement n'apparaît pas dans le
        // journal de caisse du commercial, qui compte par tournée — une vente
        // encaissée s'affichait « reste à encaisser ».
        dayId: dayIdTournee,
        echeance: echeance || null,
        // Un chèque ou une traite n'est encaissé qu'à son échéance : le
        // marquer « Encaissé » dès la remise fausserait la trésorerie et
        // l'écran des effets à recouvrer. L'espèce, elle, entre en caisse
        // immédiatement.
        etat: aEcheance ? "En cours" : "Encaissé",
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
    commercial: auth.user.name,
    datePay: new Date().toISOString(),
    soldeFin: updated?.soldeFin ?? 0,
  });
}
