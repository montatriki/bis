import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { round3 } from "@/lib/vente-stats";

// Trésorerie — comptes, chéquiers, chèques, bordereaux, extraits de compte.
//
// GET  /api/tresorerie?vue=comptes|chequiers|cheques|borderaux|extrait|synthese
// POST /api/tresorerie { action: "chequier"|"cheque-etat"|"borderau"|"mouvement" }
//
// Complète `/api/reglements` (encaissements) déjà en place.

const s = (v: unknown) => (v == null ? "" : String(v).trim());
const int = (v: unknown) => {
  const x = parseInt(String(v ?? ""), 10);
  return Number.isFinite(x) ? x : null;
};
const num = (v: unknown) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

/** États possibles d'un chèque, du plus amont au plus aval. */
const ETATS_CHEQUE = ["Emis", "Remis", "Encaissé", "Rejeté", "Déchiré"] as const;

export async function GET(req: NextRequest) {
  // `tresorerie` figure dans l'application mobile du commercial : il consulte
  // les encaissements. L'écriture reste réservée à l'administration.
  // Back-office : comptes bancaires, chéquiers, chèques et extraits de compte
  // n'ont aucun filtre par utilisateur — ouverte au commercial, cette route
  // exposait la trésorerie de la société. Le POST était déjà réservé.
  const auth = await requireSession(["ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.res;

  const sp = req.nextUrl.searchParams;
  const vue = sp.get("vue") ?? "synthese";

  if (vue === "comptes") {
    const rows = await prisma.erpAccount.findMany({ orderBy: { id: "asc" } });

    // Solde de chaque compte = somme de ses mouvements.
    const mvts = await prisma.mouvementCompte.groupBy({
      by: ["compteId"],
      _sum: { montant: true },
      _count: { _all: true },
    });
    const parCompte = new Map(mvts.map((m) => [m.compteId, m]));

    // Le sens décide du signe : on recalcule proprement.
    const tousMvts = await prisma.mouvementCompte.findMany({
      select: { compteId: true, sens: true, montant: true },
    });
    const soldes = new Map<number, number>();
    for (const m of tousMvts) {
      const cur = soldes.get(m.compteId) ?? 0;
      soldes.set(m.compteId, round3(cur + (m.sens === "E" ? m.montant : -m.montant)));
    }

    return NextResponse.json({
      rows: rows.map((c) => ({
        ...c,
        solde: soldes.get(c.id) ?? 0,
        nbMouvements: parCompte.get(c.id)?._count._all ?? 0,
      })),
      total: rows.length,
    });
  }

  if (vue === "chequiers") {
    const rows = await prisma.chequier.findMany({ orderBy: { id: "desc" } });
    const stats = await prisma.cheque.groupBy({
      by: ["chequierId", "etat"],
      _count: { _all: true },
    });

    return NextResponse.json({
      rows: rows.map((ch) => {
        const mes = stats.filter((s) => s.chequierId === ch.id);
        const utilises = mes.reduce((n, m) => n + m._count._all, 0);
        const total = ch.numFin - ch.numDebut + 1;
        return {
          ...ch,
          total,
          utilises,
          restants: Math.max(0, total - utilises),
          parEtat: Object.fromEntries(mes.map((m) => [m.etat, m._count._all])),
        };
      }),
      total: rows.length,
    });
  }

  if (vue === "cheques") {
    const etat = s(sp.get("etat"));
    const chequierId = int(sp.get("chequierId"));
    const where = {
      ...(etat && etat !== "Tous" ? { etat } : {}),
      ...(chequierId ? { chequierId } : {}),
    };
    const [rows, agg] = await Promise.all([
      prisma.cheque.findMany({
        where,
        orderBy: [{ echeance: "asc" }, { numero: "asc" }],
        take: 300,
        include: { chequier: { select: { banque: true, serie: true } } },
      }),
      prisma.cheque.aggregate({ where, _sum: { montant: true }, _count: { _all: true } }),
    ]);
    return NextResponse.json({
      rows,
      total: agg._count._all,
      totalMontant: round3(agg._sum.montant ?? 0),
      etats: ETATS_CHEQUE,
    });
  }

  if (vue === "borderaux") {
    const rows = await prisma.erpBorderau.findMany({ orderBy: { id: "desc" }, take: 100 });
    const lignes = await prisma.borderauLigne.groupBy({
      by: ["borderauId"],
      _count: { _all: true },
      _sum: { montant: true },
    });
    const parBord = new Map(lignes.map((l) => [l.borderauId, l]));
    return NextResponse.json({
      rows: rows.map((b) => ({
        ...b,
        nbLignes: parBord.get(b.id)?._count._all ?? 0,
        totalLignes: round3(parBord.get(b.id)?._sum.montant ?? 0),
      })),
      total: rows.length,
    });
  }

  // Extrait de compte : mouvements avec solde progressif.
  if (vue === "extrait") {
    const compteId = int(sp.get("compteId"));
    if (!compteId) return NextResponse.json({ error: "compteId requis" }, { status: 400 });

    const rows = await prisma.mouvementCompte.findMany({
      where: { compteId },
      orderBy: [{ dateMvt: "asc" }, { id: "asc" }],
      take: 500,
    });

    let solde = 0;
    const avecSolde = rows.map((m) => {
      solde = round3(solde + (m.sens === "E" ? m.montant : -m.montant));
      return { ...m, solde };
    });

    const compte = await prisma.erpAccount.findUnique({ where: { id: compteId } });
    return NextResponse.json({
      compte,
      rows: avecSolde,
      total: rows.length,
      totalEntrees: round3(rows.filter((m) => m.sens === "E").reduce((s, m) => s + m.montant, 0)),
      totalSorties: round3(rows.filter((m) => m.sens === "S").reduce((s, m) => s + m.montant, 0)),
      soldeFinal: solde,
    });
  }

  // Synthèse : encaissements / décaissements et portefeuille de chèques.
  const [encaiss, decaiss, chequesParEtat, nbComptes] = await Promise.all([
    prisma.erpReglement.aggregate({ where: { sens: "C" }, _sum: { montant: true }, _count: { _all: true } }),
    prisma.erpReglement.aggregate({ where: { sens: "F" }, _sum: { montant: true }, _count: { _all: true } }),
    prisma.cheque.groupBy({ by: ["etat"], _count: { _all: true }, _sum: { montant: true } }),
    prisma.erpAccount.count(),
  ]);

  const parMode = await prisma.erpReglement.groupBy({
    by: ["modePay", "sens"],
    _count: { _all: true },
    _sum: { montant: true },
  });

  const enc = round3(encaiss._sum.montant ?? 0);
  const dec = round3(decaiss._sum.montant ?? 0);

  return NextResponse.json({
    encaissements: { total: enc, nb: encaiss._count._all },
    decaissements: { total: dec, nb: decaiss._count._all },
    solde: round3(enc - dec),
    nbComptes,
    portefeuille: chequesParEtat.map((c) => ({
      etat: c.etat,
      nb: c._count._all,
      montant: round3(c._sum.montant ?? 0),
    })),
    parMode: parMode.map((m) => ({
      mode: m.modePay ?? "—",
      sens: m.sens,
      nb: m._count._all,
      montant: round3(m._sum.montant ?? 0),
    })),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => ({}));
  const action = s(body?.action);

  // Création d'un chéquier + génération de ses chèques en état "Libre".
  if (action === "chequier") {
    const banque = s(body.banque);
    const numDebut = int(body.numDebut);
    const numFin = int(body.numFin);
    if (!banque) return NextResponse.json({ error: "Banque requise" }, { status: 400 });
    if (numDebut == null || numFin == null || numFin < numDebut) {
      return NextResponse.json({ error: "Plage de numéros invalide" }, { status: 400 });
    }
    if (numFin - numDebut > 500) {
      return NextResponse.json({ error: "Plage trop large (500 chèques maximum)" }, { status: 400 });
    }

    const row = await prisma.chequier.create({
      data: {
        banque,
        numCompte: s(body.numCompte) || null,
        serie: s(body.serie) || null,
        numDebut,
        numFin,
        suivant: numDebut,
      },
    });
    return NextResponse.json({
      ok: true,
      row,
      message: `Chéquier ${banque} créé — ${numFin - numDebut + 1} chèques (${numDebut} à ${numFin})`,
    });
  }

  // Émission d'un chèque sur le prochain numéro disponible.
  if (action === "emettre-cheque") {
    const chequierId = int(body.chequierId);
    if (!chequierId) return NextResponse.json({ error: "Chéquier requis" }, { status: 400 });

    const ch = await prisma.chequier.findUnique({ where: { id: chequierId } });
    if (!ch) return NextResponse.json({ error: "Chéquier introuvable" }, { status: 404 });

    const numero = ch.suivant > 0 ? ch.suivant : ch.numDebut;
    if (numero > ch.numFin) {
      return NextResponse.json({ error: "Chéquier épuisé" }, { status: 409 });
    }

    const montant = num(body.montant);
    if (montant <= 0) return NextResponse.json({ error: "Montant invalide" }, { status: 400 });

    const ops: Prisma.PrismaPromise<unknown>[] = [
      prisma.cheque.create({
        data: {
          chequierId,
          numero,
          montant: round3(montant),
          dateEmis: new Date(),
          echeance: body.echeance ? new Date(String(body.echeance)) : null,
          etat: "Emis",
          tiersNom: s(body.tiersNom) || null,
          tiersCode: int(body.tiersCode),
        },
      }),
      prisma.chequier.update({
        where: { id: chequierId },
        data: { suivant: numero + 1, epuise: numero + 1 > ch.numFin },
      }),
    ];
    await prisma.$transaction(ops);

    return NextResponse.json({ ok: true, message: `Chèque n°${numero} émis (${round3(montant)} TND)`, numero });
  }

  // Changement d'état d'un chèque (remise, encaissement, rejet, déchirement).
  if (action === "cheque-etat") {
    const id = int(body.id);
    const etat = s(body.etat);
    if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
    if (!(ETATS_CHEQUE as readonly string[]).includes(etat)) {
      return NextResponse.json({ error: "État invalide" }, { status: 400 });
    }
    const row = await prisma.cheque.update({ where: { id }, data: { etat } });
    return NextResponse.json({ ok: true, row, message: `Chèque n°${row.numero} → ${etat}` });
  }

  // Bordereau de remise : regroupe des chèques et les passe en "Remis".
  if (action === "borderau") {
    const chequeIds: number[] = Array.isArray(body.chequeIds)
      ? body.chequeIds.map((x: unknown) => int(x)).filter((x: number | null): x is number => x != null)
      : [];
    if (chequeIds.length === 0) {
      return NextResponse.json({ error: "Sélectionnez au moins un chèque" }, { status: 400 });
    }

    const cheques = await prisma.cheque.findMany({ where: { id: { in: chequeIds } } });
    const nonEmis = cheques.filter((c) => c.etat !== "Emis");
    if (nonEmis.length) {
      return NextResponse.json(
        { error: `${nonEmis.length} chèque(s) ne sont pas à l'état « Emis »` },
        { status: 409 }
      );
    }

    const total = round3(cheques.reduce((s, c) => s + c.montant, 0));
    const dernier = await prisma.erpBorderau.findFirst({ orderBy: { id: "desc" }, select: { id: true } });
    const id = (dernier?.id ?? 0) + 1;
    const compteId = int(body.compteId);

    const ops: Prisma.PrismaPromise<unknown>[] = [
      prisma.erpBorderau.create({
        data: {
          id,
          dateBord: new Date(),
          numCompte: compteId != null ? String(compteId) : null,
          total,
          type: s(body.type) || "Chèque",
          utilisateur: auth.user.name,
        },
      }),
      prisma.borderauLigne.createMany({
        data: cheques.map((c) => ({
          borderauId: id,
          chequeId: c.id,
          numPiece: String(c.numero),
          tiersNom: c.tiersNom,
          montant: c.montant,
          echeance: c.echeance,
        })),
      }),
      prisma.cheque.updateMany({
        where: { id: { in: chequeIds } },
        data: { etat: "Remis", borderauId: id },
      }),
    ];

    // La remise alimente le compte de trésorerie choisi.
    if (compteId != null) {
      const precedents = await prisma.mouvementCompte.findMany({
        where: { compteId },
        select: { sens: true, montant: true },
      });
      const soldeAvant = precedents.reduce(
        (s, m) => round3(s + (m.sens === "E" ? m.montant : -m.montant)),
        0
      );
      ops.push(
        prisma.mouvementCompte.create({
          data: {
            compteId,
            dateMvt: new Date(),
            libelle: `Remise bordereau n°${id}`,
            sens: "E",
            montant: total,
            soldeApres: round3(soldeAvant + total),
            reference: String(id),
            borderauId: id,
            utilisateur: auth.user.name,
          },
        })
      );
    }

    await prisma.$transaction(ops);
    return NextResponse.json({
      ok: true,
      message: `Bordereau n°${id} créé — ${cheques.length} chèque(s), ${total} TND`,
      id,
      total,
    });
  }

  // Saisie manuelle d'un mouvement de compte.
  if (action === "mouvement") {
    const compteId = int(body.compteId);
    const montant = num(body.montant);
    const sens = s(body.sens) === "S" ? "S" : "E";
    if (!compteId) return NextResponse.json({ error: "Compte requis" }, { status: 400 });
    if (montant <= 0) return NextResponse.json({ error: "Montant invalide" }, { status: 400 });

    const precedents = await prisma.mouvementCompte.findMany({
      where: { compteId },
      select: { sens: true, montant: true },
    });
    const soldeAvant = precedents.reduce(
      (s, m) => round3(s + (m.sens === "E" ? m.montant : -m.montant)),
      0
    );
    const soldeApres = round3(soldeAvant + (sens === "E" ? montant : -montant));

    const row = await prisma.mouvementCompte.create({
      data: {
        compteId,
        dateMvt: body.dateMvt ? new Date(String(body.dateMvt)) : new Date(),
        libelle: s(body.libelle) || (sens === "E" ? "Entrée" : "Sortie"),
        sens,
        montant: round3(montant),
        soldeApres,
        reference: s(body.reference) || null,
        utilisateur: auth.user.name,
      },
    });

    return NextResponse.json({ ok: true, row, message: `Mouvement enregistré — solde ${soldeApres} TND` });
  }

  return NextResponse.json({ error: "action inconnue" }, { status: 400 });
}
