import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { round3 } from "@/lib/vente-stats";
import { creerMouvement, etatParEmplacement, TYPES_MVT, type LigneMvt } from "@/lib/mouvements-depot";
import { rafraichirStockSiPerime } from "@/lib/sync-production";

// Bons de sortie / transfert / retour (module Gestion Tourner).
//
// GET  /api/mouvements-depot?vue=emplacements|etat|historique[&emplacement=]
// POST /api/mouvements-depot { typeDoc, source, destination, lignes: [...] }

const s = (v: unknown) => (v == null ? "" : String(v).trim());

export async function GET(req: NextRequest) {
  // Les chiffres de cet écran n'ont de valeur que frais : déclenche une
  // resynchronisation en arrière-plan si les données datent.
  void rafraichirStockSiPerime();
  const auth = await requireSession(["ADMIN", "MANAGER", "COMMERCIAL"]);
  if (!auth.ok) return auth.res;

  const sp = req.nextUrl.searchParams;
  const vue = sp.get("vue") ?? "etat";

  // Emplacements disponibles : dépôts + véhicules du référentiel.
  if (vue === "emplacements") {
    const rows = await prisma.refTable.findMany({
      where: { kind: { in: ["depot", "vehicule"] } },
      orderBy: [{ kind: "asc" }, { label: "asc" }],
    });

    // Véhicule attribué à l'utilisateur connecté. Sans lui, l'écran « Stock
    // camion » retombait sur le premier véhicule de la liste : tous les
    // commerciaux voyaient le même camion, et donc le stock d'un collègue.
    const commercial = await prisma.commercial.findFirst({
      where: { userId: auth.user.id },
      select: { vehicle: { select: { plate: true } } },
    });
    const plaque = commercial?.vehicle?.plate.trim() ?? null;
    const vehicules = rows.filter((r) => r.kind === "vehicule");
    // L'emplacement de stock porte un libellé enrichi (« mokhtar 206TU7140 ») :
    // c'est la plaque qu'il contient qui identifie le véhicule.
    const sien = plaque
      ? vehicules.find((v) =>
          `${v.code ?? ""} ${v.label}`.toUpperCase().includes(plaque.toUpperCase()))
      : undefined;

    // Les emplacements de stock reprennent les `Code_mag` de la production, qui
    // mélangent entrepôts et camions (« AZIZ 248TU6787 » est un camion, pas un
    // dépôt). On repère la plaque dans le libellé pour les distinguer à l'écran.
    const plaques = vehicules.map((v) => (v.code ?? v.label).toUpperCase());
    const estCamion = (label: string) =>
      plaques.some((p) => label.toUpperCase().includes(p));
    const emplacements = rows
      .filter((r) => r.kind === "depot")
      .map((r) => ({ code: r.code ?? r.label, label: r.label, camion: estCamion(r.label) }));

    return NextResponse.json({
      // `depots` ne garde que les vrais entrepôts ; les camions sont listés à part.
      depots: emplacements.filter((e) => !e.camion),
      depotsCamions: emplacements.filter((e) => e.camion),
      emplacements,
      vehicules: vehicules.map((r) => ({ code: r.code ?? r.label, label: r.label })),
      vehiculeAttribue: sien ? (sien.code ?? sien.label) : null,
      plaqueAttribuee: plaque,
      types: Object.entries(TYPES_MVT).map(([code, c]) => ({ code, ...c })),
    });
  }

  if (vue === "historique") {
    const emplacement = s(sp.get("emplacement"));
    const rows = await prisma.mouvementDepot.findMany({
      where: emplacement
        ? { OR: [{ source: emplacement }, { destination: emplacement }] }
        : {},
      orderBy: { id: "desc" },
      take: 200,
    });
    return NextResponse.json({ rows, total: rows.length });
  }

  // Mouvements d'un article — écran « Mouvements » de la fiche produit.
  //
  // Reprend les colonnes de l'ERP d'origine (`ProductsMouvements.js`) :
  //   N° · Date · Document · Libellé · Tiers · Entrer · Sortie · stock
  //   · PU HT · Valeur HT · Valeur TTC · Utilisateur
  // et les quatre totaux du bas : stock de départ, entrées, sorties, stock final.
  if (vue === "article") {
    const refArt = s(sp.get("refArt"));
    if (!refArt) return NextResponse.json({ error: "refArt requis" }, { status: 400 });

    const du = sp.get("du") ? new Date(sp.get("du")!) : null;
    const au = sp.get("au") ? new Date(`${sp.get("au")}T23:59:59.999`) : null;
    const depot = s(sp.get("depot"));

    const [article, mouvements] = await Promise.all([
      prisma.article.findUnique({
        where: { refArt },
        select: { refArt: true, designation: true, enStock: true, unite: true, tauxTva: true, pmp: true },
      }),
      prisma.erpStockMovement.findMany({
        where: {
          refArt,
          ...(du || au ? { createdAt: { ...(du ? { gte: du } : {}), ...(au ? { lte: au } : {}) } } : {}),
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        include: {
          document: {
            select: { refDoc: true, libDoc: true, typeDoc: true, dateDoc: true, raisonSocial: true, utilisateur: true, vehicule: true },
          },
        },
      }),
    ]);

    if (!article) return NextResponse.json({ error: "Article introuvable" }, { status: 404 });

    // Filtre dépôt : le mouvement porte le véhicule/emplacement via son document.
    const filtres = depot ? mouvements.filter((m) => (m.document?.vehicule ?? "") === depot) : mouvements;

    const tva = article.tauxTva ?? 0;
    let entrees = 0;
    let sorties = 0;

    const rows = filtres.map((m, i) => {
      const entree = m.sens === "E" ? m.qte : 0;
      const sortie = m.sens === "S" ? m.qte : 0;
      entrees += entree;
      sorties += sortie;
      const valeurHt = m.qte * m.puHt;
      return {
        num: i + 1,
        id: m.id,
        date: m.createdAt,
        dateDoc: m.document?.dateDoc ?? null,
        document: m.refDoc,
        libelle: m.document?.libDoc ?? m.motif ?? null,
        tiers: m.document?.raisonSocial ?? null,
        entrer: round3(entree),
        sortie: round3(sortie),
        // Stock après le mouvement : la colonne « stock » de l'ERP d'origine.
        stock: round3(m.stockApres),
        puHt: round3(m.puHt),
        valeurHt: round3(valeurHt),
        valeurTtc: round3(valeurHt * (1 + tva / 100)),
        utilisateur: m.document?.utilisateur ?? null,
        depot: m.document?.vehicule ?? null,
        typeDoc: m.typeDoc,
        sens: m.sens,
      };
    });

    // Stock de départ : celui qui précède le premier mouvement de la période.
    // Sans mouvement, on retombe sur le stock courant de l'article.
    const stockDepart = filtres.length > 0 ? round3(filtres[0].stockAvant) : round3(article.enStock);
    const stockFinal = filtres.length > 0 ? round3(filtres[filtres.length - 1].stockApres) : stockDepart;

    return NextResponse.json({
      article,
      rows,
      total: rows.length,
      totaux: {
        stockDepart,
        entrees: round3(entrees),
        sorties: round3(sorties),
        stockFinal,
        valeurHt: round3(rows.reduce((t, r) => t + r.valeurHt, 0)),
      },
    });
  }

  // État du stock par emplacement.
  const emplacement = s(sp.get("emplacement"));
  const rows = await etatParEmplacement(emplacement || undefined);

  // Récapitulatif par emplacement, utile quand aucun filtre n'est posé.
  const parEmpl = new Map<string, { emplacement: string; refs: number; quantite: number; valeur: number }>();
  for (const r of rows) {
    const cur = parEmpl.get(r.emplacement) ?? { emplacement: r.emplacement, refs: 0, quantite: 0, valeur: 0 };
    cur.refs += 1;
    cur.quantite = round3(cur.quantite + r.quantite);
    cur.valeur = round3(cur.valeur + r.valeur);
    parEmpl.set(r.emplacement, cur);
  }

  return NextResponse.json({
    rows,
    total: rows.length,
    parEmplacement: [...parEmpl.values()].sort((a, b) => b.valeur - a.valeur),
    valeurTotale: round3(rows.reduce((sum, r) => sum + r.valeur, 0)),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER", "COMMERCIAL"]);
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => ({}));
  const typeDoc = s(body.typeDoc);
  const source = s(body.source) || null;
  const destination = s(body.destination) || null;

  const lignes: LigneMvt[] = Array.isArray(body.lignes)
    ? body.lignes.map((raw: unknown) => {
        const l = raw as Record<string, unknown>;
        return {
          refArt: s(l.refArt),
          designation: l.designation != null ? s(l.designation) : null,
          quantite: Number(l.quantite) || 0,
        };
      })
    : [];

  const r = await creerMouvement(typeDoc, source, destination, lignes, auth.user.name);
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
