import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { calculerBulletin, type Regime } from "@/lib/paie-calc";
import { paramsPaieDepuisBase, rubriquesEmploye, salaireDeGrille } from "@/lib/paie-params";

// Traitement de paie d'une session — équivalent de `traitement-paie` dans l'ERP source.
// Génère (ou régénère) un bulletin par employé pointé sur la session.
//
// Les taux CNSS, le barème IRPP, la grille de salaire et les rubriques de paie
// sont désormais lus depuis la base (voir `paie-params.ts`). Les surcharges du
// corps de requête restent prioritaires, pour pouvoir simuler un taux sans
// modifier le paramétrage.
//
// POST /api/grh/traitement { sessionId, tauxCnss?, tauxCss?, appliquerIrpp? }

export async function POST(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => ({}));
  const sessionId = parseInt(String(body?.sessionId ?? ""), 10);
  if (!Number.isFinite(sessionId)) {
    return NextResponse.json({ error: "sessionId requis" }, { status: 400 });
  }

  const session = await prisma.grhSession.findUnique({ where: { id: sessionId } });
  if (!session) return NextResponse.json({ error: "Session introuvable" }, { status: 404 });
  if (session.cloturee) {
    return NextResponse.json({ error: "Session clôturée — traitement impossible" }, { status: 409 });
  }

  // Surcharges d'appel — priment sur le paramétrage en base.
  const override = {
    ...(body.tauxCnss != null ? { tauxCnss: Number(body.tauxCnss) } : {}),
    ...(body.tauxCss != null ? { tauxCss: Number(body.tauxCss) } : {}),
    ...(body.appliquerIrpp != null ? { appliquerIrpp: Boolean(body.appliquerIrpp) } : {}),
  };

  const pointages = await prisma.grhPointage.findMany({
    where: { sessionId },
    include: { personnel: { include: { categorie: true, echelon: true } } },
  });

  if (pointages.length === 0) {
    return NextResponse.json(
      { error: "Aucun pointage sur cette session — saisissez le pointage d'abord" },
      { status: 400 }
    );
  }

  const alertes: string[] = [];
  const bulletins: {
    codeEmploye: string; sessionId: number; salaireBase: number; primes: number;
    heuresSupp: number; brutImposable: number; cnss: number; irpp: number;
    css: number; autresRet: number; netAPayer: number; jourTravailles: number;
  }[] = [];

  for (const p of pointages.filter((x) => x.personnel.actif)) {
    const emp = p.personnel;
    const regime = (emp.traitement === "H" ? "H" : "M") as Regime;
    const njRef = emp.njTraitNormal || session.nJours || 26;

    // Taux CNSS et barème IRPP selon le type CNSS de l'employé.
    const { params, alertes: aParams } = await paramsPaieDepuisBase(emp.typeCnss, override);
    for (const a of aParams) alertes.push(a);

    // Salaire de base : celui de la fiche, sinon celui de la grille. La grille
    // est une valeur de référence, elle n'écrase pas une saisie explicite.
    let salaireBase = emp.salaireBase;
    if (!salaireBase) {
      const g = await salaireDeGrille(regime, emp.categorie?.libelle, emp.echelon?.libelle);
      if (g != null) {
        salaireBase = g;
        alertes.push(`${emp.codeEmploye} : salaire pris dans la grille (${g})`);
      }
    }

    // Prorata pour les rubriques réduites en cas d'absence.
    const joursPayes = regime === "H" ? p.presenceH : p.presenceJ + p.congeJ + p.ferieJ;
    const reference = regime === "H" ? (session.nHeures || njRef * 8) : njRef;
    const prorata = reference > 0 ? Math.min(1, joursPayes / reference) : 1;

    const rub = await rubriquesEmploye(emp.codeEmploye, sessionId, prorata);

    const b = calculerBulletin(
      {
        regime,
        salaireBase,
        coutHoraire: emp.coutHoraire,
        njTraitNormal: njRef,
        presenceJ: p.presenceJ,
        presenceH: p.presenceH,
        congeJ: p.congeJ,
        ferieJ: p.ferieJ,
        hSupp: p.hSupp,
        // Rubriques de gain cotisables ajoutées au brut ; retenues déduites du net.
        primes: rub.primes,
        autresRetenues: rub.retenues,
        chefFamille: emp.chefFamille,
        nbrEnfants: emp.nbrEnfants,
      },
      params
    );

    // Les indemnités exonérées s'ajoutent au net sans passer par les assiettes
    // CNSS/IRPP — c'est précisément ce qui les distingue d'une prime.
    const net = rub.primesExonerees
      ? Math.round((b.netAPayer + rub.primesExonerees + Number.EPSILON) * 1000) / 1000
      : b.netAPayer;

    bulletins.push({
      codeEmploye: emp.codeEmploye,
      sessionId,
      ...b,
      primes: b.primes + rub.primesExonerees,
      netAPayer: net,
    });
  }

  // Régénération : on remplace les bulletins existants de la session.
  await prisma.$transaction([
    prisma.grhBulletin.deleteMany({ where: { sessionId } }),
    prisma.grhBulletin.createMany({ data: bulletins }),
  ]);

  const totaux = bulletins.reduce(
    (acc, b) => ({
      brut: acc.brut + b.brutImposable,
      cnss: acc.cnss + b.cnss,
      irpp: acc.irpp + b.irpp,
      css: acc.css + b.css,
      net: acc.net + b.netAPayer,
    }),
    { brut: 0, cnss: 0, irpp: 0, css: 0, net: 0 }
  );

  return NextResponse.json({
    ok: true,
    message: `${bulletins.length} bulletin(s) généré(s) pour ${session.libelle}`,
    count: bulletins.length,
    totaux,
    alertes: [...new Set(alertes)],
  });
}
