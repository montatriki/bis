import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { round3 } from "@/lib/vente-stats";

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

/** Totaux HT / TVA / TTC d'un panier. */
function totaux(lignes: { qte: number; puHt: number; tauxTva: number }[]) {
  const ht = lignes.reduce((t, l) => t + l.qte * l.puHt, 0);
  const tva = lignes.reduce((t, l) => t + l.qte * l.puHt * (l.tauxTva / 100), 0);
  return { totalHT: round3(ht), totalTVA: round3(tva), totalTTC: round3(ht + tva) };
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
    lignes: p.lignes.map((l) => ({
      ...l,
      totalHT: round3(l.qte * l.puHt),
      totalTTC: round3(l.qte * l.puHt * (1 + l.tauxTva / 100)),
    })),
    ...totaux(p.lignes),
    nbLignes: p.lignes.length,
  });
}

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
      select: { designation: true, unite: true, tarif1Ht: true, tauxTva: true, enStock: true },
    });
    if (!art) return NextResponse.json({ error: `Article ${refArt} inconnu` }, { status: 400 });

    const existante = p.lignes.find((l) => l.refArt === refArt);
    // Ajouter un article déjà au panier cumule les quantités, comme dans A.
    const row = existante
      ? await prisma.panierLigne.update({
          where: { id: existante.id },
          data: { qte: round3(existante.qte + qte) },
        })
      : await prisma.panierLigne.create({
          data: {
            panierId: p.id, refArt,
            designation: art.designation, unite: art.unite,
            qte: round3(qte), puHt: art.tarif1Ht, tauxTva: art.tauxTva,
          },
        });

    const alertes: string[] = [];
    if (art.enStock <= 0) alertes.push(`${refArt} est en rupture de stock`);
    else if (row.qte > art.enStock) {
      alertes.push(`${refArt} : ${row.qte} demandé pour ${art.enStock} en stock`);
    }

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
          qte: l.qte, puHt: l.puHt, tauxTva: l.tauxTva,
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

    return NextResponse.json({
      ok: true, refDoc: d.refDoc, ttcNet: d.ttcNet,
      message: `Commande ${d.refDoc} créée`,
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
