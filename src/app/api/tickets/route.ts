import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { cleCommercial, memeCommercial } from "@/lib/perimetre-commercial";
import { round3 } from "@/lib/vente-stats";

// Tickets de vente — tuile « DERNIER TICKET » de l'app commerciale.
//
// Le ticket est le document TIC (bon de livraison / ticket de caisse) émis en
// tournée. L'écran sert à retrouver et réimprimer le dernier ticket édité,
// typiquement quand l'impression a échoué ou que le client en redemande un.
//
// GET /api/tickets?vue=dernier|liste|detail

const s = (v: unknown) => (v == null ? "" : String(v).trim());

/** Types considérés comme des tickets de vente au comptoir / en tournée. */
const TYPES_TICKET = ["TIC", "BL", "FC"];

export async function GET(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER", "COMMERCIAL"]);
  if (!auth.ok) return auth.res;

  // Identité d'impression de la société, seule : sert aux reçus (recouvrement).
  if (req.nextUrl.searchParams.get("vue") === "societe") {
    const params = await prisma.refTable.findMany({ where: { kind: "param", code: { startsWith: "societe." } } });
    const ste: Record<string, string> = {};
    for (const p of params) ste[(p.code ?? "").replace("societe.", "")] = p.label ?? "";
    if (!ste.nom) ste.nom = "STE SKY EDITION ET DISTRIBUTION";
    return NextResponse.json({ societe: ste });
  }


  const sp = req.nextUrl.searchParams;
  const vue = sp.get("vue") ?? "dernier";

  // Un commercial ne voit que ses propres tickets ; le périmètre vient de la
  // session. `utilisateur` porte l'auteur de la saisie (voir §13 : `commercial`
  // est vide sur les 5 000 documents importés).
  const impose = auth.user.role === "COMMERCIAL" ? auth.user.name : null;
  const auteur = impose ?? s(sp.get("utilisateur"));

  // Rapprochement sur le prénom : `users.name` vaut « Mokhtar Trabelsi » quand
  // les documents portent « MOKHTAR ». Un `contains` du nom complet ne
  // trouverait rien et masquerait tous les tickets du commercial.
  const cle = cleCommercial(auteur);
  // Filtre client optionnel : « le dernier ticket de CE client ».
  const codeCli = Number(sp.get("codeCli")) || 0;
  const filtre = {
    typeDoc: { in: TYPES_TICKET },
    ...(codeCli > 0 ? { codeCli } : {}),
    ...(cle
      ? {
          OR: [
            { utilisateur: { startsWith: cle, mode: "insensitive" as const } },
            { commercial: { startsWith: cle, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  if (vue === "detail" || vue === "dernier") {
    const refDoc = s(sp.get("refDoc"));

    const doc = refDoc
      ? await prisma.erpDocument.findUnique({ where: { refDoc } })
      : await prisma.erpDocument.findFirst({
          where: filtre,
          orderBy: [{ dateDoc: "desc" }, { refDoc: "desc" }],
        });

    if (!doc) {
      return NextResponse.json({ ticket: null, lignes: [], message: "Aucun ticket trouvé" });
    }
    // Un commercial ne peut pas ouvrir le ticket d'un collègue par son numéro.
    if (impose && refDoc) {
      // Même rapprochement par prénom que le filtre de liste : sinon le
      // commercial se verrait refuser ses propres tickets.
      const sien =
        memeCommercial(doc.utilisateur, impose) || memeCommercial(doc.commercial, impose);
      if (!sien) return NextResponse.json({ error: "Ticket d'un autre commercial" }, { status: 403 });
    }

    const [lignes, reglements, societe] = await Promise.all([
      prisma.erpDocumentLine.findMany({
        where: { refDoc: doc.refDoc },
        orderBy: [{ ordre: "asc" }, { id: "asc" }],
      }),
      prisma.erpReglement.findMany({
        where: { numDoc: doc.refDoc },
        select: { id: true, montant: true, modePay: true, datePay: true },
      }),
      // Identité de la société pour l'en-tête d'impression : stockée en
      // `RefTable` avec `kind: "param"` (§16), pas dans `ParamCompta`.
      prisma.refTable.findMany({ where: { kind: "param", code: { startsWith: "societe." } } }),
    ]);

    const ste: Record<string, string> = {};
    for (const p of societe) ste[(p.code ?? "").replace("societe.", "")] = p.label ?? "";
    // Tant que la fiche société n'est pas renseignée (Paramètres › Société),
    // l'en-tête imprimé resterait vide : on retombe sur la raison sociale.
    if (!ste.nom) ste.nom = "STE SKY EDITION ET DISTRIBUTION";

    // Coordonnées fiscales du client pour l'en-tête du ticket : elles vivent
    // sur le tiers, le document ne les recopie pas.
    const client = doc.codeCli
      ? await prisma.partner.findUnique({
          where: { id: doc.codeCli },
          select: { adresse: true, matriculeF: true, tel: true, ville: true, registreCom: true },
        })
      : null;

    return NextResponse.json({
      ticket: {
        ...doc,
        adresse: client?.adresse ?? null,
        matriculeF: client?.matriculeF ?? null,
        registreComClient: client?.registreCom ?? null,
        telClient: client?.tel ?? null,
        villeClient: client?.ville ?? null,
      },
      lignes,
      reglements,
      totalRegle: round3(reglements.reduce((t, r) => t + (r.montant ?? 0), 0)),
      nbLignes: lignes.length,
      societe: ste,
    });
  }

  // clients — les clients du commercial ayant au moins un ticket, pour le
  // filtre de l'écran « Dernier ticket ». Triés du plus servi au moins servi.
  if (vue === "clients") {
    const groupes = await prisma.erpDocument.groupBy({
      by: ["codeCli", "raisonSocial"],
      where: { ...filtre, codeCli: { not: null } },
      _count: { refDoc: true },
    });
    const rows = groupes
      .map((g) => ({ codeCli: g.codeCli, raisonSocial: (g.raisonSocial ?? "").trim() || `Client ${g.codeCli}`, nb: g._count.refDoc }))
      .sort((a, b) => b.nb - a.nb);
    return NextResponse.json({ rows });
  }

  // liste — paginée : un commercial cumule plus de 1 500 tickets, une liste
  // plafonnée en cachait l'essentiel tout en annonçant « 100 » comme total.
  const PAGE = 100;
  const page = Math.max(0, Number(sp.get("page")) || 0);
  const [rows, total] = await Promise.all([
    prisma.erpDocument.findMany({
      where: filtre,
      orderBy: [{ dateDoc: "desc" }, { refDoc: "desc" }],
      skip: page * PAGE,
      take: PAGE,
      select: {
        refDoc: true, typeDoc: true, dateDoc: true, raisonSocial: true,
        thtNet: true, totTva: true, ttcNet: true, totalRegle: true,
        soldeDoc: true, valide: true, utilisateur: true, dayId: true,
        _count: { select: { lignes: true } },
      },
    }),
    prisma.erpDocument.count({ where: filtre }),
  ]);

  return NextResponse.json({
    rows: rows.map((r) => ({ ...r, nbLignes: r._count.lignes })),
    total,
    page,
    pages: Math.ceil(total / PAGE),
  });
}
