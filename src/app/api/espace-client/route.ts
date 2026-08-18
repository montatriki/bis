import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { signeCA, round3 } from "@/lib/vente-stats";

// Espace client — données du tiers connecté uniquement.
//
// GET /api/espace-client?vue=resume|documents|suivi[&type=&search=]
//
// Le périmètre vient de `user.codeTiers` (jamais d'un paramètre de requête) :
// un client ne peut pas consulter les documents d'un autre tiers.

/**
 * Étapes de livraison déduites du type et de l'état du document.
 * L'ERP ne trace pas d'états de livraison : le type de document *est* le
 * jalon atteint (commande → bon de livraison/ticket → facture), et le solde
 * indique si l'affaire est réglée.
 */
function etapesLivraison(d: {
  typeDoc: string; dateDoc: Date | null; valide: boolean; soldeDoc: number; ttcNet: number;
}) {
  const t = (d.typeDoc || "").toUpperCase();
  const livre = ["BL", "TIC", "FC", "FAC"].includes(t);
  const facture = ["FC", "FAC"].includes(t);
  const date = d.dateDoc ? new Date(d.dateDoc).toLocaleDateString("fr-FR") : "—";

  return [
    { label: "Commande enregistrée", date, fait: true },
    { label: "Validation", date: d.valide ? date : "En attente", fait: d.valide },
    { label: "Préparation", date: livre ? date : "En attente", fait: livre },
    { label: "Livrée", date: livre ? date : "En attente", fait: livre },
    { label: "Facturée / soldée", date: facture && d.soldeDoc <= 0 ? date : "En attente", fait: facture && d.soldeDoc <= 0 },
  ];
}

export async function GET(req: NextRequest) {
  const auth = await requireSession();
  if (!auth.ok) return auth.res;

  const codeTiers = auth.user.codeTiers;
  if (codeTiers == null) {
    return NextResponse.json(
      { error: "Aucun compte client rattaché à cet utilisateur" },
      { status: 403 }
    );
  }

  const sp = req.nextUrl.searchParams;
  const vue = sp.get("vue") ?? "resume";

  const partner = await prisma.partner.findUnique({ where: { id: codeTiers } });
  if (!partner) return NextResponse.json({ error: "Compte client introuvable" }, { status: 404 });

  // Suivi de livraison : les commandes et livraisons en cours du client.
  if (vue === "suivi") {
    const docs = await prisma.erpDocument.findMany({
      where: { codeCli: codeTiers, nature: "Vente", typeDoc: { in: ["COM", "BL", "TIC", "FC", "FAC"] } },
      orderBy: { dateDoc: "desc" },
      take: 10,
      select: {
        refDoc: true, typeDoc: true, dateDoc: true, ttcNet: true, thtNet: true,
        soldeDoc: true, totalRegle: true, etat: true, valide: true, commercial: true,
        vehicule: true, utilisateur: true,
      },
    });

    // Les lignes détaillent ce qui est livré ; absentes de l'export ERP pour
    // une partie des documents, auquel cas on n'affiche que l'en-tête.
    const refs = docs.map((d) => d.refDoc);
    const lignes = refs.length
      ? await prisma.erpDocumentLine.findMany({
          where: { refDoc: { in: refs } },
          select: { refDoc: true, refArt: true, designation: true, qte: true, puHt: true, ttcNet: true },
        })
      : [];
    const parDoc = new Map<string, typeof lignes>();
    for (const l of lignes) {
      const arr = parDoc.get(l.refDoc) ?? [];
      arr.push(l);
      parDoc.set(l.refDoc, arr);
    }

    return NextResponse.json({
      client: {
        id: partner.id, raisonSocial: partner.raisonSocial,
        adresse: partner.adresse, ville: partner.ville, tel: partner.tel,
      },
      commandes: docs.map((d) => ({
        refDoc: d.refDoc, typeDoc: d.typeDoc, dateDoc: d.dateDoc,
        ttcNet: round3(d.ttcNet), soldeDoc: round3(d.soldeDoc),
        totalRegle: round3(d.totalRegle), valide: d.valide,
        commercial: d.commercial ?? d.utilisateur, vehicule: d.vehicule,
        etapes: etapesLivraison(d),
        lignes: (parDoc.get(d.refDoc) ?? []).map((l) => ({
          refArt: l.refArt, designation: l.designation,
          qte: l.qte, puHt: round3(l.puHt), ttcNet: round3(l.ttcNet),
        })),
      })),
      total: docs.length,
    });
  }

  if (vue === "documents") {
    const type = (sp.get("type") ?? "").trim();
    const search = (sp.get("search") ?? "").trim();

    const where = {
      codeCli: codeTiers,
      nature: "Vente",
      ...(type && type !== "ALL" ? { typeDoc: type } : {}),
      ...(search ? { refDoc: { contains: search, mode: "insensitive" as const } } : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.erpDocument.findMany({
        where,
        orderBy: { dateDoc: "desc" },
        take: 200,
        select: {
          refDoc: true, typeDoc: true, dateDoc: true, thtNet: true, totTva: true,
          ttcNet: true, soldeDoc: true, totalRegle: true, etat: true, valide: true,
        },
      }),
      prisma.erpDocument.count({ where }),
    ]);

    // Types réellement présents pour ce client (onglets du filtre).
    const types = await prisma.erpDocument.groupBy({
      by: ["typeDoc"],
      where: { codeCli: codeTiers, nature: "Vente" },
      _count: { _all: true },
    });

    return NextResponse.json({
      client: { id: partner.id, raisonSocial: partner.raisonSocial, soldeFin: partner.soldeFin },
      rows,
      total,
      types: types.map((t) => ({ type: t.typeDoc, count: t._count._all })),
    });
  }

  // vue = resume
  const docs = await prisma.erpDocument.findMany({
    where: { codeCli: codeTiers, nature: "Vente" },
    orderBy: { dateDoc: "desc" },
    select: { refDoc: true, typeDoc: true, dateDoc: true, ttcNet: true, soldeDoc: true, etat: true },
  });

  const ca = round3(docs.reduce((s, d) => s + signeCA(d.typeDoc) * d.ttcNet, 0));
  const impayes = docs.filter((d) => d.soldeDoc > 0);
  const totalImpaye = round3(impayes.reduce((s, d) => s + d.soldeDoc, 0));

  // Derniers articles commandés, depuis les lignes des documents du client.
  const lignes = await prisma.erpDocumentLine.findMany({
    where: { document: { codeCli: codeTiers } },
    orderBy: { id: "desc" },
    take: 100,
    select: { refArt: true, designation: true, qte: true, puHt: true },
  });
  const parArticle = new Map<string, { refArt: string; designation: string; qte: number }>();
  for (const l of lignes) {
    const cur = parArticle.get(l.refArt) ?? { refArt: l.refArt, designation: l.designation, qte: 0 };
    cur.qte = round3(cur.qte + l.qte);
    parArticle.set(l.refArt, cur);
  }

  const plafond = partner.plafond && partner.plafond > 0 ? partner.plafond : 5000;

  return NextResponse.json({
    client: {
      id: partner.id,
      raisonSocial: partner.raisonSocial,
      ville: partner.ville,
      gouvernorat: partner.gouvernorat,
      tel: partner.tel,
      soldeFin: partner.soldeFin,
      debit: partner.debit,
      credit: partner.credit,
      plafond,
      depassement: partner.soldeFin > plafond,
    },
    kpis: {
      ca,
      nbDocuments: docs.length,
      nbImpayes: impayes.length,
      totalImpaye,
    },
    derniers: docs.slice(0, 8),
    habituels: [...parArticle.values()].sort((a, b) => b.qte - a.qte).slice(0, 6),
  });
}
