import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { round3 } from "@/lib/vente-stats";
import { pmpApresEntree } from "@/lib/tarif-article";

// Transferts de stock entre dépôts et véhicules (`Type_doc = TR`).
//
// GET    /api/transferts?du=&au=&commercial=&depot=&etat=
// POST   /api/transferts        { dateDoc, transferFrom, transferTo, lignes[] }
// PUT    /api/transferts        { refDoc, action: "valider"|"devalider" }
// DELETE /api/transferts?refDoc=…
//
// Dans l'ERP d'origine, « Liste des transferts » est la liste des documents
// d'achat filtrée sur le type TR (`ListAchat isTransfer`), avec deux colonnes
// propres au transfert — dépôt d'origine et dépôt de destination — et le suivi
// généré / facturé / comptabilisé. On reprend ce modèle, en y ajoutant le
// mouvement de stock réel, qui n'était pas fait automatiquement.

/**
 * Caractéristiques de document qui constituent un transfert de stock.
 *
 * L'ERP d'origine ne distingue pas les transferts par `Type_doc` mais par
 * `Cara_doc`, dont le paramétrage porte `T_stock = 'T'` : bon de transfert,
 * transfert véhicule, bon de sortie, retour déchargement, perte de stock.
 * Filtrer sur `Type_doc = "TR"` ne ramenait donc jamais rien.
 */
const CARA_TRANSFERT = ["TRD", "TRV", "BTR", "DEC", "PER"];

/** Sélecteur commun : un transfert, quelle que soit sa caractéristique. */
const OU_TRANSFERT = {
  OR: [{ caraDoc: { in: CARA_TRANSFERT } }, { typeDoc: "TR" }],
};

const s = (v: unknown) => (v == null ? "" : String(v).trim());
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

export async function GET(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER", "COMMERCIAL"]);
  if (!auth.ok) return auth.res;

  const sp = req.nextUrl.searchParams;
  const du = sp.get("du"), au = sp.get("au");
  const commercial = s(sp.get("commercial"));
  const depot = s(sp.get("depot"));
  const etat = s(sp.get("etat"));

  const where = {
    ...OU_TRANSFERT,
    ...(du || au
      ? { dateDoc: { ...(du ? { gte: new Date(du) } : {}), ...(au ? { lte: new Date(`${au}T23:59:59`) } : {}) } }
      : {}),
    ...(commercial ? { commercial: { contains: commercial, mode: "insensitive" as const } } : {}),
    // Un dépôt sélectionné concerne le transfert qu'il en soit l'origine ou la
    // destination : l'exploitant cherche « ce qui touche ce dépôt ». On passe
    // par `AND` pour ne pas écraser le `OR` qui identifie les transferts.
    ...(depot ? { AND: [{ OR: [{ transferFrom: depot }, { transferTo: depot }] }] } : {}),
    ...(etat === "valide" ? { valide: true } : etat === "attente" ? { valide: false } : {}),
  };

  // Détail d'un transfert : en-tête + lignes d'articles, pour le formulaire
  // de consultation/modification et pour l'impression.
  const refDetail = s(sp.get("refDoc"));
  if (refDetail) {
    const doc = await prisma.erpDocument.findUnique({
      where: { refDoc: refDetail },
      include: { lignes: { orderBy: { ordre: "asc" } } },
    });
    if (!doc) return NextResponse.json({ error: "Transfert introuvable" }, { status: 404 });

    // Stock actuel des deux emplacements : le formulaire d'origine affiche
    // « en stock dépôt » et « Qté dépôt au » en regard de chaque ligne.
    const refs = doc.lignes.map((l) => l.refArt);
    const stocks = refs.length
      ? await prisma.stockDepot.findMany({
          where: {
            refArt: { in: refs },
            emplacement: { in: [doc.transferFrom ?? "", doc.transferTo ?? ""] },
          },
          select: { refArt: true, emplacement: true, quantite: true },
        })
      : [];
    const cle = (r: string, e: string) => `${r}|${e}`;
    const parCle = new Map(stocks.map((x) => [cle(x.refArt, x.emplacement), x.quantite]));

    return NextResponse.json({
      row: doc,
      lignes: doc.lignes.map((l) => ({
        ...l,
        // Une partie des lignes importées porte `qte = 0` alors que la valeur
        // est renseignée : c'est ainsi dans la base d'origine (inventaires
        // véhicule notamment). La quantité réelle se déduit de la valeur et du
        // prix unitaire — l'afficher à zéro laisserait croire à un document vide.
        qte: l.qte > 0 ? l.qte : (l.puHt > 0 ? round3(l.thtNet / l.puHt) : 0),
        qteDeduite: l.qte <= 0 && l.puHt > 0 && l.thtNet > 0,
        stockSource: parCle.get(cle(l.refArt, doc.transferFrom ?? "")) ?? 0,
        stockDest: parCle.get(cle(l.refArt, doc.transferTo ?? "")) ?? 0,
      })),
      totaux: {
        ht: round3(doc.lignes.reduce((t, l) => t + l.thtNet, 0)),
        tva: round3(doc.lignes.reduce((t, l) => t + l.totTva, 0)),
        ttc: round3(doc.lignes.reduce((t, l) => t + l.ttcNet, 0)),
      },
    });
  }

  const [rows, total, agg, depots, commerciaux] = await Promise.all([
    prisma.erpDocument.findMany({ where, orderBy: { dateDoc: "desc" }, take: 300 }),
    prisma.erpDocument.count({ where }),
    prisma.erpDocument.aggregate({ where, _sum: { thtNet: true, ttcNet: true, soldeDoc: true } }),
    prisma.refTable.findMany({ where: { kind: "depot" }, orderBy: { label: "asc" } }),
    prisma.erpDocument.findMany({
      where: { ...OU_TRANSFERT, commercial: { not: null } },
      distinct: ["commercial"], select: { commercial: true },
    }),
  ]);

  return NextResponse.json({
    rows, total,
    totaux: {
      ht: round3(agg._sum.thtNet ?? 0),
      ttc: round3(agg._sum.ttcNet ?? 0),
      solde: round3(agg._sum.soldeDoc ?? 0),
    },
    // Listes de filtres : mêmes sélecteurs que l'écran d'origine.
    depots: depots.map((d) => d.label),
    commerciaux: commerciaux.map((c) => c.commercial).filter(Boolean),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.res;
  const body = await req.json().catch(() => ({}));

  const transferFrom = s(body.transferFrom);
  const transferTo = s(body.transferTo);
  if (!transferFrom || !transferTo) {
    return NextResponse.json({ error: "Dépôt d'origine et de destination requis" }, { status: 400 });
  }
  if (transferFrom === transferTo) {
    return NextResponse.json({ error: "Les deux dépôts doivent être différents" }, { status: 400 });
  }

  const lignes = Array.isArray(body.lignes) ? body.lignes : [];
  if (lignes.length === 0) {
    return NextResponse.json({ error: "Ajoutez au moins un article" }, { status: 400 });
  }

  // Numérotation continue par type, comme les autres documents.
  const dernier = await prisma.erpDocument.findFirst({
    where: { typeDoc: "TR" }, orderBy: { refDoc: "desc" }, select: { refDoc: true },
  });
  const seq = dernier ? Number(dernier.refDoc.replace(/\D/g, "").slice(-6)) + 1 : 1;
  const refDoc = `TR${String(seq).padStart(6, "0")}`;

  const totalHt = round3(lignes.reduce((t: number, l: Record<string, unknown>) => t + num(l.qte) * num(l.puHt), 0));

  const doc = await prisma.erpDocument.create({
    data: {
      refDoc, nature: "Achat", typeDoc: "TR",
      // « Bon de transfert » : la caractéristique qui vaut `T_stock = 'T'`.
      caraDoc: "TRD",
      libDoc: `Transfert ${transferFrom} → ${transferTo}`,
      dateDoc: body.dateDoc ? new Date(String(body.dateDoc)) : new Date(),
      transferFrom, transferTo,
      commercial: s(body.commercial) || null,
      thtNet: totalHt, thtBrut: totalHt, ttcNet: totalHt,
      utilisateur: auth.user.name,
      valide: false,
    },
  });

  // Les lignes sont conservées pour pouvoir mouvementer le stock à la
  // validation : un transfert non validé ne déplace rien.
  await prisma.erpStockMovement.createMany({
    data: lignes.map((l: Record<string, unknown>) => ({
      refDoc, refArt: s(l.refArt), sens: "N", qte: num(l.qte),
      puHt: num(l.puHt), typeDoc: "TR", motif: `${transferFrom} → ${transferTo}`,
    })),
  });

  return NextResponse.json({
    ok: true, row: doc,
    message: `Transfert ${refDoc} créé — à valider pour déplacer le stock`,
  });
}

export async function PUT(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.res;
  const body = await req.json().catch(() => ({}));
  const refDoc = s(body.refDoc);
  const action = s(body.action) || "valider";

  const doc = await prisma.erpDocument.findUnique({ where: { refDoc } });
  if (!doc || !estTransfert(doc)) {
    return NextResponse.json({ error: "Transfert introuvable" }, { status: 404 });
  }

  const lignes = await prisma.erpStockMovement.findMany({ where: { refDoc } });
  const source = doc.transferFrom ?? "";
  const dest = doc.transferTo ?? "";

  if (action === "devalider") {
    if (!doc.valide) return NextResponse.json({ error: "Transfert non validé" }, { status: 400 });
    // Mouvement inverse : la marchandise revient à son dépôt d'origine.
    await deplacer(lignes, dest, source);
    const row = await prisma.erpDocument.update({
      where: { refDoc }, data: { valide: false, generer: false },
    });
    return NextResponse.json({ ok: true, row, message: `Transfert ${refDoc} dévalidé — stock restitué` });
  }

  if (doc.valide) return NextResponse.json({ error: "Transfert déjà validé" }, { status: 400 });

  // Contrôle de disponibilité avant de bouger quoi que ce soit : un transfert
  // qui rendrait le dépôt source négatif est refusé en bloc.
  const manquants: string[] = [];
  for (const l of lignes) {
    const stock = await prisma.stockDepot.findUnique({
      where: { refArt_emplacement: { refArt: l.refArt, emplacement: source } },
    });
    if ((stock?.quantite ?? 0) < l.qte) {
      manquants.push(`${l.refArt} (dispo ${round3(stock?.quantite ?? 0)}, demandé ${round3(l.qte)})`);
    }
  }
  if (manquants.length > 0 && body.forcer !== true) {
    return NextResponse.json(
      { error: `Stock insuffisant dans « ${source} » : ${manquants.slice(0, 5).join(", ")}`,
        code: "stock-insuffisant", manquants },
      { status: 409 },
    );
  }

  await deplacer(lignes, source, dest);
  const row = await prisma.erpDocument.update({
    where: { refDoc }, data: { valide: true, generer: true },
  });
  return NextResponse.json({
    ok: true, row,
    message: `Transfert ${refDoc} validé — ${lignes.length} article(s) déplacé(s) de ${source} vers ${dest}`,
  });
}

/** Un document est un transfert par sa caractéristique ou par son type. */
function estTransfert(d: { caraDoc: string | null; typeDoc: string }): boolean {
  return d.typeDoc === "TR" || CARA_TRANSFERT.includes(d.caraDoc ?? "");
}

/**
 * Déplace les quantités d'un emplacement vers un autre.
 *
 * Le PMP suit la marchandise : le dépôt d'arrivée recalcule son coût moyen
 * pondéré, faute de quoi la valorisation du stock serait fausse dès le premier
 * transfert entre dépôts de coûts différents.
 */
async function deplacer(
  lignes: { refArt: string; qte: number; puHt: number }[],
  source: string,
  dest: string,
) {
  for (const l of lignes) {
    const [avant, arrivee] = await Promise.all([
      prisma.stockDepot.findUnique({ where: { refArt_emplacement: { refArt: l.refArt, emplacement: source } } }),
      prisma.stockDepot.findUnique({ where: { refArt_emplacement: { refArt: l.refArt, emplacement: dest } } }),
    ]);
    // Le coût transféré est celui du dépôt d'origine, pas le prix saisi.
    const cout = avant?.pmp || l.puHt;
    const pmpDest = pmpApresEntree(arrivee?.pmp ?? 0, arrivee?.quantite ?? 0, l.qte, cout);

    await prisma.$transaction([
      prisma.stockDepot.upsert({
        where: { refArt_emplacement: { refArt: l.refArt, emplacement: source } },
        create: { refArt: l.refArt, emplacement: source, quantite: -l.qte, pmp: cout },
        update: { quantite: { decrement: l.qte } },
      }),
      prisma.stockDepot.upsert({
        where: { refArt_emplacement: { refArt: l.refArt, emplacement: dest } },
        create: { refArt: l.refArt, emplacement: dest, quantite: l.qte, pmp: cout },
        update: { quantite: { increment: l.qte }, pmp: pmpDest },
      }),
    ]);
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireSession(["ADMIN"]);
  if (!auth.ok) return auth.res;
  const refDoc = s(req.nextUrl.searchParams.get("refDoc"));
  const doc = await prisma.erpDocument.findUnique({ where: { refDoc } });
  if (!doc || !estTransfert(doc)) {
    return NextResponse.json({ error: "Transfert introuvable" }, { status: 404 });
  }
  // Un transfert validé a déplacé du stock : le supprimer laisserait les
  // quantités déplacées sans justificatif.
  if (doc.valide) {
    return NextResponse.json({ error: "Dévalidez le transfert avant de le supprimer" }, { status: 409 });
  }
  await prisma.erpStockMovement.deleteMany({ where: { refDoc } });
  await prisma.erpDocument.delete({ where: { refDoc } });
  return NextResponse.json({ ok: true, message: `Transfert ${refDoc} supprimé` });
}
