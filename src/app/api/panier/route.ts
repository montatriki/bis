import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { round3 } from "@/lib/vente-stats";
import { validerDocument } from "@/lib/document-validation";

// Panier de commande persistant — tuile « PANIER DE COMMANDE » de l'app
// commerciale de l'ERP source (avec son badge de compteur).
//
// Le panier de B vivait dans l'état React : il disparaissait au moindre
// changement d'écran. Un panier « Ouvert » par commercial est désormais
// conservé en base.
//
// GET    /api/panier?vue=courant|badge
// POST   /api/panier { vue: "ligne"|"valider", ... }
// PUT    /api/panier { refArt, qte } | { codeCli }
// DELETE /api/panier?refArt=…   (ou sans refArt : vide le panier)

const s = (v: unknown) => (v == null ? "" : String(v).trim());
const int = (v: unknown) => {
  const x = parseInt(String(v ?? ""), 10);
  return Number.isFinite(x) ? x : null;
};
const num = (v: unknown) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

const AVEC_LIGNES = { lignes: { orderBy: { id: "asc" as const } } };

/** Panier ouvert du commercial, sans le créer. */
function chercherPanier(utilisateur: string) {
  return prisma.panier.findFirst({
    where: { utilisateur, etat: "Ouvert" },
    include: AVEC_LIGNES,
    orderBy: { id: "desc" },
  });
}

/** Panier ouvert du commercial, créé à la volée s'il n'existe pas. */
async function panierCourant(utilisateur: string) {
  const existant = await chercherPanier(utilisateur);
  if (existant) return existant;

  const cree = await prisma.panier.create({ data: { utilisateur, etat: "Ouvert" } });
  return { ...cree, lignes: [] };
}

/**
 * Totaux HT / TVA / TTC d'un panier.
 *
 * L'ERP d'origine raisonne en **TTC** : le catalogue affiche `t1_ttc`, c'est ce
 * prix que le commercial annonce au client, et la TVA de la ligne s'en déduit
 * (`Mt_tva = valeur_ttc − valeur_ht`). Le FODEC entrant dans la base de TVA,
 * l'appliquer est indispensable : sans lui KIDS ZONE était facturé 28,586 au
 * lieu des 28,872 affichés au catalogue et en production.
 */
function totaux(
  lignes: { qte: number; puHt: number; tauxTva: number; tauxFodec?: number; remise?: number }[],
) {
  // La remise porte sur le prix TTC (c'est ainsi qu'elle est saisie) ; le HT
  // s'en déduit au prorata, comme dans la ligne de vente d'origine.
  let ht = 0, ttc = 0, remiseTotale = 0;
  for (const l of lignes) {
    const coef = 1 - (l.remise ?? 0) / 100;
    const ttcPlein = l.qte * l.puHt * (1 + (l.tauxFodec ?? 0) / 100) * (1 + l.tauxTva / 100);
    ht += l.qte * l.puHt * coef;
    ttc += ttcPlein * coef;
    // `tot_remise` de la production est une remise HT (`tht_net = tht_brut −
    // tot_remise`, vérifié sur 440 tickets récents), pas une remise TTC.
    remiseTotale += l.qte * l.puHt * (1 - coef);
  }
  // La TVA est le solde entre le TTC facturé et le HT : elle absorbe le FODEC,
  // exactement comme la ligne de vente de l'ERP d'origine.
  return {
    totalHT: round3(ht),
    totalTVA: round3(ttc - ht),
    totalTTC: round3(ttc),
    totalRemise: round3(remiseTotale),
  };
}

export async function GET(req: NextRequest) {
  const auth = await requireSession();
  if (!auth.ok) return auth.res;

  const vue = req.nextUrl.searchParams.get("vue") ?? "courant";

  // Badge du menu : uniquement le compteur, sans créer de panier vide.
  if (vue === "badge") {
    const p = await chercherPanier(auth.user.name);
    const articles = p?.lignes.length ?? 0;
    return NextResponse.json({
      articles,
      unites: round3((p?.lignes ?? []).reduce((t, l) => t + l.qte, 0)),
    });
  }

  const p = await panierCourant(auth.user.name);
  return NextResponse.json({
    panier: { id: p.id, codeCli: p.codeCli, clientNom: p.clientNom, etat: p.etat },
    lignes: p.lignes.map((l) => {
      // Total de ligne calculé comme le document : remise appliquée, puis FODEC
      // dans la base de TVA. Sans cela la ligne affichait le prix catalogue
      // alors que le ticket était émis au prix remisé.
      const coef = 1 - (l.remise ?? 0) / 100;
      const htNet = l.qte * l.puHt * coef;
      const ttcNet = htNet * (1 + (l.tauxFodec ?? 0) / 100) * (1 + l.tauxTva / 100);
      return { ...l, totalHT: round3(htNet), totalTTC: round3(ttcNet) };
    }),
    ...totaux(p.lignes),
    nbLignes: p.lignes.length,
  });
}

/** Une ligne de règlement saisie à la validation du ticket. */
type ReglementSaisi = {
  mode?: string;
  montant?: number | string;
  numPiece?: string;
  echeance?: string;
};

export async function POST(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER", "COMMERCIAL"]);
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => ({}));
  const vue = s(body.vue) || "ligne";
  const p = await panierCourant(auth.user.name);

  if (vue === "ligne") {
    const refArt = s(body.refArt);
    if (!refArt) return NextResponse.json({ error: "Article requis" }, { status: 400 });

    const qte = num(body.qte) || 1;
    if (qte <= 0) return NextResponse.json({ error: "Quantité invalide" }, { status: 400 });

    // Prix et libellé viennent du référentiel, jamais du corps de requête :
    // un client ne doit pas pouvoir fixer son propre tarif.
    const art = await prisma.article.findUnique({
      where: { refArt },
      select: {
        designation: true, unite: true, tarif1Ht: true, tauxTva: true, tauxFodec: true,
        remiseMax: true, enStock: true,
      },
    });
    if (!art) return NextResponse.json({ error: `Article ${refArt} inconnu` }, { status: 400 });

    // Remise de ligne, exprimée en pourcentage du **prix TTC** — l'ERP
    // d'origine lie les deux champs du catalogue : saisir un taux met à jour le
    // prix net, saisir un prix net recalcule le taux
    // (`remise = 100 − net × 100 / t1_ttc`).
    const prixTtcUnitaire = art.tarif1Ht * (1 + art.tauxFodec / 100) * (1 + art.tauxTva / 100);
    let remise = num(body.remise);
    if (body.net != null && body.net !== "") {
      const net = num(body.net);
      remise = prixTtcUnitaire > 0 ? round3(100 - (net * 100) / prixTtcUnitaire) : 0;
    }
    // Bornes de l'ERP d'origine : jamais négative, jamais au-delà de la remise
    // maximale de l'article (0 = pas de plafond).
    if (!Number.isFinite(remise) || remise < 0) remise = 0;
    let remiseRefusee: string | undefined;
    if (art.remiseMax > 0 && remise > art.remiseMax) {
      remiseRefusee = `Remise maximale de ${art.remiseMax} % pour ${refArt}`;
      remise = 0;
    }
    if (remise > 100) { remiseRefusee = "Remise supérieure à 100 %"; remise = 0; }

    const existante = p.lignes.find((l) => l.refArt === refArt);
    // Ajouter un article déjà au panier cumule les quantités, comme dans A.
    const row = existante
      ? await prisma.panierLigne.update({
          where: { id: existante.id },
          data: {
            qte: round3(existante.qte + qte),
            // Une remise transmise remplace la précédente ; sans elle, celle
            // déjà accordée sur la ligne est conservée.
            ...(body.remise != null || body.net != null ? { remise } : {}),
          },
        })
      : await prisma.panierLigne.create({
          data: {
            panierId: p.id, refArt,
            designation: art.designation, unite: art.unite,
            qte: round3(qte), puHt: art.tarif1Ht, tauxTva: art.tauxTva, tauxFodec: art.tauxFodec,
            remise,
          },
        });

    const alertes: string[] = [];
    if (art.enStock <= 0) alertes.push(`${refArt} est en rupture de stock`);
    else if (row.qte > art.enStock) {
      alertes.push(`${refArt} : ${row.qte} demandé pour ${art.enStock} en stock`);
    }

    if (remiseRefusee) alertes.push(remiseRefusee);

    return NextResponse.json({ ok: true, row, alertes, message: `${art.designation} ajouté au panier` });
  }

  if (vue === "valider") {
    if (p.lignes.length === 0) {
      return NextResponse.json({ error: "Le panier est vide" }, { status: 400 });
    }

    const codeCli = int(body.codeCli) ?? p.codeCli;
    if (codeCli == null) {
      return NextResponse.json({ error: "Sélectionnez un client avant de valider" }, { status: 400 });
    }
    const tiers = await prisma.partner.findUnique({
      where: { id: codeCli }, select: { raisonSocial: true },
    });
    if (!tiers) return NextResponse.json({ error: `Tiers ${codeCli} inconnu` }, { status: 400 });

    // On réutilise `/api/commandes`, qui porte déjà la numérotation par souche
    // et le moteur de calcul : dupliquer cette logique la ferait diverger.
    const origine = req.nextUrl.origin;
    const rep = await fetch(`${origine}/api/commandes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: req.headers.get("cookie") ?? "",
      },
      body: JSON.stringify({
        codeCli,
        raisonSocial: tiers.raisonSocial,
        typeDoc: s(body.typeDoc) || "COM",
        libDoc: s(body.libDoc) || null,
        lignes: p.lignes.map((l) => ({
          refArt: l.refArt, designation: l.designation, unite: l.unite,
          // Le FODEC accompagne la ligne : sans lui, la commande recalcule un
          // TTC inférieur à celui annoncé au client dans le panier.
          qte: l.qte, puHt: l.puHt, tauxTva: l.tauxTva, tauxFodec: l.tauxFodec,
          // La remise accordée au client suit la ligne jusqu'au document.
          remise: l.remise,
        })),
      }),
    });
    const d = await rep.json().catch(() => ({}));
    if (!rep.ok) {
      return NextResponse.json({ error: d.error ?? "Échec de la création" }, { status: rep.status });
    }

    // Le panier est archivé plutôt que supprimé : il garde la trace de ce qui
    // a produit la commande, et le prochain ajout ouvre un panier neuf.
    await prisma.panier.update({
      where: { id: p.id },
      data: { etat: "Validé", refDoc: d.refDoc ?? null, codeCli, clientNom: tiers.raisonSocial },
    });

    // Un **ticket** est encaissé sur place : la marchandise quitte le camion et
    // le compte du client est débité dans la foulée, comme l'annonce l'écran
    // (« Le ticket est émis immédiatement »). Sans cette validation, le
    // document restait « En cours » : le stock du véhicule ne bougeait pas et
    // le solde client non plus.
    //
    // Une commande (COM), elle, reste à valider par l'administration : elle
    // n'engage encore ni le stock ni le compte.
    const typeDoc = s(body.typeDoc) || "COM";
    let validation: { ok: boolean; message: string } | null = null;
    if (typeDoc === "TIC" && d.refDoc) {
      const r = await validerDocument(d.refDoc);
      validation = { ok: r.ok, message: r.message };
    }

    // Encaissement immédiat.
    //
    // L'application d'origine enchaîne la validation par un règlement :
    // Espèce, Chèque, Traite ou Retenue à la source, avec la possibilité de
    // n'encaisser qu'une partie (le reste demeure au débit du client). Les
    // chèques et traites peuvent être multiples, à échéances mensuelles.
    const reglements: ReglementSaisi[] = Array.isArray(body.reglements) ? body.reglements : [];
    const encaisses: { mode: string; montant: number; echeance?: string | null }[] = [];
    if (typeDoc === "TIC" && validation?.ok && reglements.length > 0) {
      for (const r of reglements) {
        const montant = num(r.montant);
        if (!(montant > 0)) continue;
        const mode = s(r.mode) || "Espèce";
        const rep = await fetch(`${origine}/api/reglements`, {
          method: "POST",
          headers: { "Content-Type": "application/json", cookie: req.headers.get("cookie") ?? "" },
          body: JSON.stringify({
            codeCli, sens: "C", montant, mode,
            numPiece: s(r.numPiece) || null,
            // Rattachement au ticket : sans lui, le ticket imprimé affichait
            // « réglé : 0 » alors que le client venait de payer.
            numDoc: d.refDoc ?? null,
            // L'échéance n'a de sens que pour un effet à recouvrer.
            echeance: mode === "Chèque" || mode === "Traite" ? s(r.echeance) || null : null,
            commentaire: `Ticket ${d.refDoc}`,
          }),
        });
        if (rep.ok) encaisses.push({ mode, montant, echeance: s(r.echeance) || null });
      }
    }

    const totalEncaisse = round3(encaisses.reduce((t, e) => t + e.montant, 0));
    const reste = round3((d.ttcNet ?? 0) - totalEncaisse);

    // Le document porte le règlement : mode de paiement, montant réglé et
    // solde restant. Sans cela le ticket imprimé n'affichait ni le mode ni le
    // montant encaissé, et le document restait dû en totalité alors que le
    // client avait payé.
    if (d.refDoc && encaisses.length > 0) {
      await prisma.erpDocument.update({
        where: { refDoc: d.refDoc },
        data: {
          // Plusieurs effets possibles : on retient les modes distincts.
          modePayement: [...new Set(encaisses.map((e) => e.mode))].join(" + "),
          totalRegle: totalEncaisse,
          soldeDoc: reste > 0 ? reste : 0,
        },
      });
    }

    return NextResponse.json({
      ok: true, refDoc: d.refDoc, ttcNet: d.ttcNet,
      valide: validation?.ok ?? false,
      // Détail de l'encaissement, pour l'impression du ticket.
      reglements: encaisses,
      totalEncaisse,
      // Ce qui reste dû après encaissement : zéro si le client a tout réglé.
      reste,
      // L'échec de validation n'annule pas le document : il est signalé pour
      // que le commercial sache que le stock n'a pas encore bougé.
      avertissement: validation && !validation.ok ? validation.message : undefined,
      message: typeDoc === "TIC"
        ? `Ticket ${d.refDoc} émis`
        : `Commande ${d.refDoc} créée`,
    });
  }

  return NextResponse.json({ error: `Vue inconnue : ${vue}` }, { status: 400 });
}

export async function PUT(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER", "COMMERCIAL"]);
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => ({}));
  const p = await panierCourant(auth.user.name);

  // Choix du client destinataire.
  if (body.codeCli !== undefined) {
    const codeCli = int(body.codeCli);
    let clientNom: string | null = null;
    if (codeCli != null) {
      const t = await prisma.partner.findUnique({ where: { id: codeCli }, select: { raisonSocial: true } });
      if (!t) return NextResponse.json({ error: `Tiers ${codeCli} inconnu` }, { status: 400 });
      clientNom = t.raisonSocial;
    }
    const row = await prisma.panier.update({
      where: { id: p.id }, data: { codeCli, clientNom },
    });
    return NextResponse.json({ ok: true, row, message: clientNom ? `Client : ${clientNom}` : "Client retiré" });
  }

  const refArt = s(body.refArt);
  if (!refArt) return NextResponse.json({ error: "refArt requis" }, { status: 400 });

  const ligne = p.lignes.find((l) => l.refArt === refArt);
  if (!ligne) return NextResponse.json({ error: "Article absent du panier" }, { status: 404 });

  const qte = num(body.qte);
  // Passer la quantité à zéro retire la ligne : c'est le geste attendu.
  if (qte <= 0) {
    await prisma.panierLigne.delete({ where: { id: ligne.id } });
    return NextResponse.json({ ok: true, supprime: true, message: "Article retiré du panier" });
  }

  const row = await prisma.panierLigne.update({
    where: { id: ligne.id }, data: { qte: round3(qte) },
  });
  return NextResponse.json({ ok: true, row, message: "Quantité mise à jour" });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER", "COMMERCIAL"]);
  if (!auth.ok) return auth.res;

  const refArt = s(req.nextUrl.searchParams.get("refArt"));
  const p = await chercherPanier(auth.user.name);
  if (!p) return NextResponse.json({ ok: true, message: "Panier déjà vide" });

  if (refArt) {
    const ligne = p.lignes.find((l) => l.refArt === refArt);
    if (!ligne) return NextResponse.json({ error: "Article absent du panier" }, { status: 404 });
    await prisma.panierLigne.delete({ where: { id: ligne.id } });
    return NextResponse.json({ ok: true, message: "Article retiré" });
  }

  const res = await prisma.panierLigne.deleteMany({ where: { panierId: p.id } });
  return NextResponse.json({ ok: true, message: `Panier vidé (${res.count} ligne(s))` });
}
