import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { memePortefeuille } from "@/lib/perimetre-commercial";
import { round3, TYPES_VENTE, TYPES_RETOUR } from "@/lib/vente-stats";

// Fiche client du commercial, sur un mois.
//
// GET /api/clients/fiche?codeCli=&mois=&annee=
//   -> { client, periode, totaux, tickets, commandes, factures, retours, reglements, visites }
//
// Chaque document porte ses lignes : le commercial voit ce qui a été vendu,
// pas seulement un montant. Le CA suit la règle de l'ERP source :
// Σ(BL, TIC, FC) − Σ(BR, AV), nature « Vente » seulement.
//
// Le compte du client (débit, crédit, solde) n'est PAS lu dans les compteurs
// stockés sur le tiers : il est recalculé à chaque appel à partir des
// transactions, comme l'extrait de compte de l'ERP source
// (`clients.service.js › getFournisseurMouvements`) :
//   débit  = tickets/BL non facturés + factures
//   crédit = retours/avoirs non facturés + règlements
//   solde  = solde initial + débit − crédit
// Vérifié sur la base : cette règle reproduit le solde stocké pour 4 458
// clients sur 4 530 ; les 72 autres sont des compteurs dérivés en production.
// Calculer plutôt que stocker : tout nouveau ticket ou règlement est pris en
// compte sans qu'aucun compteur n'ait à être entretenu.

const VENTE = new Set<string>(TYPES_VENTE);
const RETOUR = new Set<string>(TYPES_RETOUR);
const DEBIT_NON_FACTURE = new Set(["TIC", "BL"]);
const CREDIT_NON_FACTURE = new Set(["BR", "AV"]);

type Mvt = { date: Date | null; ref: string; libelle: string; debit: number; credit: number };

/** Sens comptable d'un document sur le compte client : débit, crédit ou hors compte. */
function sensCompte(d: { typeDoc: string; facturer: boolean | null }): "debit" | "credit" | null {
  if (d.typeDoc === "FC") return "debit";
  if (DEBIT_NON_FACTURE.has(d.typeDoc) && !d.facturer) return "debit";
  if (CREDIT_NON_FACTURE.has(d.typeDoc) && !d.facturer) return "credit";
  return null;
}

export async function GET(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER", "COMMERCIAL"]);
  if (!auth.ok) return auth.res;

  const sp = req.nextUrl.searchParams;
  const id = Number(sp.get("codeCli"));
  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: "Client invalide" }, { status: 400 });

  const maintenant = new Date();
  const client = await prisma.partner.findUnique({ where: { id } });
  if (!client) return NextResponse.json({ error: "Client introuvable" }, { status: 404 });
  if (auth.user.role === "COMMERCIAL" && !memePortefeuille(client.commercial, auth.user.name)) {
    return NextResponse.json({ error: "Ce client n'est pas dans votre portefeuille" }, { status: 403 });
  }

  // Compte client sur tout l'historique : une seule lecture légère par table,
  // sans les lignes. C'est ce qui donne le solde d'ouverture du mois.
  const [tousDocs, tousRegs] = await Promise.all([
    prisma.erpDocument.findMany({
      where: { codeCli: id, nature: "Vente" },
      select: { refDoc: true, typeDoc: true, dateDoc: true, ttcNet: true, facturer: true },
    }),
    prisma.erpReglement.findMany({
      where: { sens: "C", tiersCode: id },
      select: { id: true, datePay: true, montant: true, modePay: true, numPiece: true },
    }),
  ]);

  const mouvements: Mvt[] = [];
  for (const d of tousDocs) {
    const sens = sensCompte(d);
    if (!sens) continue;
    mouvements.push({
      date: d.dateDoc, ref: d.refDoc,
      libelle: d.typeDoc === "FC" ? "Facture" : d.typeDoc === "BR" ? "Bon de retour" : d.typeDoc === "AV" ? "Avoir" : d.typeDoc === "BL" ? "Bon de livraison" : "Ticket",
      debit: sens === "debit" ? d.ttcNet : 0, credit: sens === "credit" ? d.ttcNet : 0,
    });
  }
  for (const r of tousRegs) {
    mouvements.push({
      date: r.datePay, ref: `REG-${r.id}`,
      libelle: `Règlement ${r.modePay ?? ""}${r.numPiece ? ` n° ${r.numPiece}` : ""}`.trim(),
      debit: 0, credit: r.montant,
    });
  }
  mouvements.sort((a, b) => (a.date?.getTime() ?? 0) - (b.date?.getTime() ?? 0));

  // Période : imposée par l'appelant, sinon le mois courant — et si le client
  // n'y a rien, son dernier mois d'activité. Ouvrir une fiche sur un mois vide
  // alors que le client a un historique donne l'impression que les données
  // manquent.
  const derniereActivite = [...mouvements].reverse().find((m) => m.date)?.date ?? null;
  let annee = Number(sp.get("annee")) || 0;
  let mois = Number(sp.get("mois")) || 0; // 1..12
  let periodeAuto = false;
  if (!annee || !mois) {
    annee = maintenant.getFullYear(); mois = maintenant.getMonth() + 1;
    const dansMoisCourant = mouvements.some((m) => m.date && m.date.getFullYear() === annee && m.date.getMonth() + 1 === mois);
    if (!dansMoisCourant && derniereActivite) {
      annee = derniereActivite.getFullYear(); mois = derniereActivite.getMonth() + 1; periodeAuto = true;
    }
  }
  const du = new Date(annee, mois - 1, 1);
  const au = new Date(annee, mois, 1);

  let debitTotal = 0, creditTotal = 0, soldeOuverture = client.soldeIni;
  for (const m of mouvements) {
    debitTotal += m.debit; creditTotal += m.credit;
    if (m.date && m.date < du) soldeOuverture += m.debit - m.credit;
  }
  const soldeCalcule = round3(client.soldeIni + debitTotal - creditTotal);

  // Extrait du mois : solde courant ligne à ligne, à partir du solde d'ouverture.
  let courant = soldeOuverture;
  const extrait = mouvements
    .filter((m) => m.date && m.date >= du && m.date < au)
    .map((m) => { courant += m.debit - m.credit; return { ...m, solde: round3(courant) }; });

  // Années proposées : de la première transaction du client à aujourd'hui.
  const premiere = mouvements.find((m) => m.date)?.date;
  const anneeMin = Math.min(premiere ? premiere.getFullYear() : maintenant.getFullYear(), maintenant.getFullYear());
  const annees = Array.from({ length: maintenant.getFullYear() - anneeMin + 1 }, (_, i) => maintenant.getFullYear() - i);

  const [docs, reglements, visites] = await Promise.all([
    prisma.erpDocument.findMany({
      where: { codeCli: id, nature: "Vente", dateDoc: { gte: du, lt: au } },
      orderBy: { dateDoc: "desc" },
      take: 300,
      select: {
        refDoc: true, typeDoc: true, dateDoc: true, etat: true, thtNet: true, totTva: true, totRemise: true,
        ttcNet: true, soldeDoc: true, totalRegle: true, modePayement: true, transformeEn: true, docSource: true,
      },
    }),
    prisma.erpReglement.findMany({
      where: { sens: "C", tiersCode: id, datePay: { gte: du, lt: au } },
      orderBy: { datePay: "desc" },
      select: { id: true, datePay: true, montant: true, modePay: true, numPiece: true, numDoc: true, etat: true, banque: true },
    }),
    // Une visite planifiée n'a pas encore de date propre : elle prend celle
    // de sa tournée.
    prisma.ligneMission.findMany({
      where: {
        codeCli: id,
        OR: [
          { dateVisite: { gte: du, lt: au } },
          { dateVisite: null, mission: { dateOrdre: { gte: du, lt: au } } },
        ],
      },
      select: { id: true, dateVisite: true, etat: true, heurePrevue: true, motif: true, commentaire: true, dayId: true, mission: { select: { dateOrdre: true } } },
    }).then((rows) =>
      rows
        .map((v) => ({ id: v.id, dateVisite: v.dateVisite ?? v.mission.dateOrdre, etat: v.etat, heurePrevue: v.heurePrevue, motif: v.motif, commentaire: v.commentaire, dayId: v.dayId }))
        .sort((a, b) => (b.dateVisite?.getTime() ?? 0) - (a.dateVisite?.getTime() ?? 0)),
    ),
  ]);

  const lignes = docs.length
    ? await prisma.erpDocumentLine.findMany({
        where: { refDoc: { in: docs.map((d) => d.refDoc) } },
        orderBy: [{ refDoc: "asc" }, { ordre: "asc" }],
        select: { refDoc: true, refArt: true, designation: true, qte: true, puHt: true, remise: true, thtNet: true, ttcNet: true },
      })
    : [];
  const parDoc = new Map<string, typeof lignes>();
  for (const l of lignes) {
    const t = parDoc.get(l.refDoc) ?? [];
    t.push(l);
    parDoc.set(l.refDoc, t);
  }
  const avecLignes = docs.map((d) => ({ ...d, lignes: parDoc.get(d.refDoc) ?? [] }));

  const tickets = avecLignes.filter((d) => d.typeDoc === "TIC" || d.typeDoc === "BL");
  const factures = avecLignes.filter((d) => d.typeDoc === "FC");
  const commandes = avecLignes.filter((d) => d.typeDoc === "COM" || d.typeDoc === "DEV");
  const retours = avecLignes.filter((d) => RETOUR.has(d.typeDoc));

  let ca = 0;
  for (const d of docs) {
    if (VENTE.has(d.typeDoc)) ca += d.ttcNet;
    else if (RETOUR.has(d.typeDoc)) ca -= d.ttcNet;
  }

  return NextResponse.json({
    client: {
      id: client.id, raisonSocial: client.raisonSocial, ville: client.ville, gouvernorat: client.gouvernorat,
      adresse: client.adresse, tel: client.tel, email: client.email, famille: client.famille,
      sousFamille: client.sousFamille, matriculeF: client.matriculeF, plafond: client.plafond,
      soldeFin: client.soldeFin, debit: client.debit, credit: client.credit,
      latitude: client.latitude, longitude: client.longitude,
      // Devanture prise sur le terrain : sert de fond à l'en-tête de la fiche.
      photo: client.photo,
    },
    periode: { mois, annee, annees, auto: periodeAuto, derniereActivite },
    // Compte calculé depuis les transactions (voir en-tête du fichier).
    compte: {
      soldeIni: round3(client.soldeIni),
      debit: round3(debitTotal),
      credit: round3(creditTotal),
      solde: soldeCalcule,
      soldeOuverture: round3(soldeOuverture),
      soldeFinMois: round3(courant),
      // Compteur stocké sur le tiers, pour signaler une dérive héritée.
      soldeStocke: round3(client.soldeFin),
      ecart: round3(soldeCalcule - client.soldeFin),
    },
    extrait,
    totaux: {
      ca: round3(ca),
      nbTickets: tickets.length,
      commandes: round3(commandes.reduce((s, d) => s + d.ttcNet, 0)),
      nbCommandes: commandes.length,
      factures: round3(factures.reduce((s, d) => s + d.ttcNet, 0)),
      nbFactures: factures.length,
      encaisse: round3(reglements.reduce((s, r) => s + r.montant, 0)),
      nbReglements: reglements.length,
      nbVisites: visites.length,
      nbVisitesFaites: visites.filter((v) => v.etat === "Visité").length,
    },
    tickets, commandes, factures, retours, reglements, visites,
  });
}
