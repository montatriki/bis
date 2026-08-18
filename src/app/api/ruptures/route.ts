import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { round3 } from "@/lib/vente-stats";

// Détail des ruptures de stock — ouvert depuis la carte « Ruptures stock ».
//
// GET /api/ruptures?axe=articles|famille|depot|negatifs
//
// « 269 ruptures » ne dit pas quoi faire. Ce qui compte : quels articles, dans
// quelle famille, et surtout **lesquels se vendent** — un article à zéro qui
// n'a aucune vente ne coûte rien, un best-seller en rupture fait perdre du CA
// tous les jours.

export async function GET(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.res;

  const axe = req.nextUrl.searchParams.get("axe") ?? "articles";

  const articles = await prisma.article.findMany({
    where: { archiver: 0, vendable: 1 },
    select: {
      refArt: true, designation: true, enStock: true, stMin: true,
      puAchat: true, tarif1Ht: true, famille: true, sousFamille: true,
    },
  });

  // Stock négatif : physiquement impossible. C'est une anomalie d'inventaire
  // (sorties saisies sans les entrées) et non une rupture ; on la traite à
  // part pour que l'exploitant sache quoi régulariser.
  const negatifs = articles.filter((a) => a.enStock < 0);
  const ruptures = articles.filter((a) => a.enStock <= 0);
  const sousMini = articles.filter((a) => a.enStock > 0 && a.stMin > 0 && a.enStock <= a.stMin);

  if (axe === "negatifs") {
    const rows = negatifs
      .map((a) => ({
        refArt: a.refArt, libelle: a.designation ?? a.refArt,
        stock: round3(a.enStock),
        // Valeur manquante à reconstituer pour remettre le stock à zéro.
        montant: round3(Math.abs(a.enStock) * a.puAchat),
      }))
      .sort((a, b) => b.montant - a.montant)
      .slice(0, 100);
    return NextResponse.json({
      axe, niveau: "articles", rows,
      totaux: { nb: negatifs.length, montant: round3(rows.reduce((s, r) => s + r.montant, 0)) },
    });
  }

  if (axe === "famille") {
    const refs = await prisma.refTable.findMany({
      where: { kind: { in: ["famille-art", "sousfamille-art"] } },
    });
    const nomFamille = new Map(
      refs.filter((r) => r.kind === "famille-art").map((r) => [r.code, r.label]),
    );

    const parFamille = new Map<string, { libelle: string; cle: string; nb: number; montant: number }>();
    for (const a of ruptures) {
      const code = a.famille != null ? String(a.famille) : "";
      const cle = code || "—";
      const g = parFamille.get(cle) ?? {
        cle, libelle: nomFamille.get(code) ?? (code ? `Famille ${code}` : "Sans famille"),
        nb: 0, montant: 0,
      };
      g.nb += 1;
      // Prix de vente unitaire cumulé : à défaut de stock minimum (jamais
      // renseigné dans les données) et de lignes de vente (l'import ne
      // contient que des en-têtes), c'est le seul indicateur honnête du poids
      // commercial d'une famille en rupture.
      g.montant += a.tarif1Ht;
      parFamille.set(cle, g);
    }

    const rows = [...parFamille.values()]
      .map((g) => ({ ...g, montant: round3(g.montant) }))
      .sort((a, b) => b.nb - a.nb);
    return NextResponse.json({
      axe, niveau: "groupes", rows,
      totaux: { nb: ruptures.length, montant: round3(rows.reduce((s, r) => s + r.montant, 0)) },
    });
  }

  if (axe === "depot") {
    // Une rupture globale peut n'être qu'un problème de répartition : la
    // marchandise existe, mais pas là où on la vend.
    const refsRupture = ruptures.map((a) => a.refArt);
    const parDepot = refsRupture.length
      ? await prisma.stockDepot.groupBy({
          by: ["emplacement"],
          where: { refArt: { in: refsRupture }, quantite: { gt: 0 } },
          _count: { _all: true },
          _sum: { quantite: true },
        })
      : [];

    const rows = parDepot
      .map((d) => ({
        cle: d.emplacement, libelle: d.emplacement || "—",
        nb: d._count._all, montant: round3(d._sum.quantite ?? 0),
      }))
      .sort((a, b) => b.nb - a.nb);

    return NextResponse.json({
      axe, niveau: "groupes", rows,
      // `montant` porte ici des quantités, pas des dinars : l'écran l'indique.
      unite: "quantite",
      totaux: { nb: rows.reduce((s, r) => s + r.nb, 0), montant: round3(rows.reduce((s, r) => s + r.montant, 0)) },
    });
  }

  // Articles en rupture, les plus pénalisants d'abord.
  //
  // Le stock minimum n'est renseigné pour aucun article et l'import ne
  // contient pas les lignes de vente : impossible de classer par rotation
  // réelle. On classe donc par prix de vente unitaire — le meilleur proxy
  // disponible du manque à gagner — en remontant d'abord les stocks négatifs,
  // qui sont des anomalies à corriger avant toute reconstitution.
  const rows = ruptures
    .map((a) => ({
      refArt: a.refArt, libelle: a.designation ?? a.refArt,
      stock: round3(a.enStock), mini: round3(a.stMin),
      montant: round3(a.tarif1Ht),
      // Valeur à reconstituer pour ramener un stock négatif à zéro.
      aRegulariser: a.enStock < 0 ? round3(Math.abs(a.enStock) * a.puAchat) : 0,
      negatif: a.enStock < 0,
    }))
    .sort((a, b) => b.aRegulariser - a.aRegulariser || b.montant - a.montant)
    .slice(0, 120);

  return NextResponse.json({
    axe, niveau: "articles", rows,
    resume: {
      nbRuptures: ruptures.length,
      nbNegatifs: negatifs.length,
      nbSousMini: sousMini.length,
      nbArticles: articles.length,
      valeurARegulariser: round3(negatifs.reduce((s, a) => s + Math.abs(a.enStock) * a.puAchat, 0)),
      // Aucun seuil de réapprovisionnement n'est paramétré : l'écran doit le
      // dire, sinon « 0 article sous le minimum » se lit comme un bon résultat.
      seuilsConfigures: articles.some((a) => a.stMin > 0),
    },
    totaux: { nb: ruptures.length, montant: round3(rows.reduce((s, r) => s + r.montant, 0)) },
  });
}
