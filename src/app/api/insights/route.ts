import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { TYPES_CA, signeCA, round3 } from "@/lib/vente-stats";

// Insights du tableau de bord admin — les quatre indicateurs de tête.
//
// GET /api/insights
//
// Remplace les widgets figés du tableau de bord par des valeurs calculées sur
// la base réelle :
//   1. objectif       — objectif du mois vs réalisé (modèle `Objectif`)
//   2. clientsRisque  — clients sans achat depuis > 30 j, avec le téléphone du
//                       commercial pour la relance WhatsApp
//   3. rupturesStock  — articles à zéro, exprimés en % du catalogue vendable
//   4. rupturesDebout — articles encore en stock mais sous le seuil minimum
//                       (« rupture debout » : présents mais non réapprovisionnés)

/** Jours sans achat au-delà desquels un client est considéré à risque. */
const SEUIL_RISQUE_JOURS = 30;

/** Le vendeur d'un document : `commercial` si présent, sinon `utilisateur`. */
const vendeurDe = (d: { commercial: string | null; utilisateur: string | null }) =>
  d.commercial?.trim() || d.utilisateur?.trim() || "";

/**
 * Clé de rapprochement d'un nom de commercial. Le champ `Partner.commercial`
 * de l'ERP est du texte libre ("mokhtar trabelsi", "MOKHTAR") : on compare donc
 * sans casse ni accents ni espaces superflus.
 */
function cleNom(nom: string): string {
  return nom
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

/**
 * Normalise un téléphone tunisien au format international pour wa.me :
 * on ne garde que les chiffres et on préfixe 216 si l'indicatif manque.
 * Renvoie null si le numéro n'est pas exploitable.
 */
function telWhatsapp(tel?: string | null): string | null {
  if (!tel) return null;
  // Un champ peut contenir plusieurs numéros ("22 333 444 / 98 111 222").
  const premier = String(tel).split(/[/,;]/)[0];
  const chiffres = premier.replace(/\D/g, "");
  if (chiffres.length < 8) return null;
  if (chiffres.startsWith("216")) return chiffres.length >= 11 ? chiffres : null;
  if (chiffres.startsWith("00216")) return chiffres.slice(2);
  return `216${chiffres.slice(-8)}`;
}

export async function GET(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.res;

  const sp = req.nextUrl.searchParams;
  const now = new Date();

  // Sans mois explicite, on se cale sur le dernier mois ayant des ventes : la
  // base ERP est un import figé, et le mois courant y est souvent vide — un
  // tableau de bord entièrement à zéro n'apprendrait rien à l'exploitant.
  let mois: number;
  let annee: number;
  if (sp.get("mois") && sp.get("annee")) {
    mois = parseInt(sp.get("mois")!, 10);
    annee = parseInt(sp.get("annee")!, 10);
  } else {
    // Le mois de référence est le plus récent qui porte **à la fois** un
    // objectif et des ventes. Se caler sur la toute dernière vente donnait un
    // mois entamé (6 documents en août) sans objectif associé : la carte
    // affichait « Aucun objectif » alors que 56 objectifs existent en base.
    const [periodesObjectif, dernierDoc] = await Promise.all([
      prisma.objectif.findMany({
        distinct: ["annee", "mois"],
        select: { annee: true, mois: true },
        orderBy: [{ annee: "desc" }, { mois: "desc" }],
      }),
      prisma.erpDocument.findFirst({
        where: { nature: "Vente", typeDoc: { in: [...TYPES_CA] }, dateDoc: { not: null } },
        orderBy: { dateDoc: "desc" },
        select: { dateDoc: true },
      }),
    ]);

    const ref = dernierDoc?.dateDoc ?? now;
    const rang = (a: number, m: number) => a * 12 + m;
    const rangCourant = rang(ref.getFullYear(), ref.getMonth() + 1);

    // Objectif le plus récent qui ne soit pas dans le futur.
    const pertinent = periodesObjectif.find((p) => rang(p.annee, p.mois) <= rangCourant);
    if (pertinent) {
      mois = pertinent.mois;
      annee = pertinent.annee;
    } else {
      mois = ref.getMonth() + 1;
      annee = ref.getFullYear();
    }
  }

  const debutMois = new Date(annee, mois - 1, 1, 0, 0, 0, 0);
  const finMois = new Date(annee, mois, 0, 23, 59, 59, 999);
  const limiteRisque = new Date(now.getTime() - SEUIL_RISQUE_JOURS * 86400000);

  const [docsMois, objectifs, articles, commerciaux, derniersAchats] = await Promise.all([
    // Réalisé du mois, tous vendeurs confondus.
    prisma.erpDocument.findMany({
      where: { nature: "Vente", typeDoc: { in: [...TYPES_CA] }, dateDoc: { gte: debutMois, lte: finMois } },
      select: { typeDoc: true, ttcNet: true, commercial: true, utilisateur: true },
    }),
    prisma.objectif.findMany({ where: { mois, annee } }),
    // Catalogue vendable : base du taux de rupture.
    prisma.article.findMany({
      where: { archiver: 0, vendable: 1 },
      select: { refArt: true, designation: true, enStock: true, stMin: true, puAchat: true },
    }),
    // Annuaire des commerciaux : le téléphone de relance vient du compte
    // utilisateur (`User.phone`), seul endroit où il est saisissable.
    prisma.user.findMany({
      where: { role: "COMMERCIAL" },
      select: { name: true, phone: true },
    }),
    // Dernière vente par client — sert à détecter l'inactivité.
    prisma.erpDocument.groupBy({
      by: ["codeCli"],
      where: { nature: "Vente", typeDoc: { in: [...TYPES_CA] }, codeCli: { not: null } },
      _max: { dateDoc: true },
    }),
  ]);

  // ---- 1. Objectif du mois -------------------------------------------------
  let realise = 0;
  const realiseParVendeur = new Map<string, number>();
  for (const d of docsMois) {
    const montant = signeCA(d.typeDoc) * d.ttcNet;
    realise += montant;
    const v = vendeurDe(d);
    if (v) realiseParVendeur.set(v, (realiseParVendeur.get(v) ?? 0) + montant);
  }
  const objectifCA = objectifs.reduce((s, o) => s + o.objectifCA, 0);
  const tauxObjectif = objectifCA > 0 ? (realise / objectifCA) * 100 : 0;

  // ---- 2. Clients à risque de perte ---------------------------------------
  // On part du **portefeuille client réel**, pas des codes présents sur les
  // documents : l'import contient des `codeCli` archivés ou sans fiche, qui
  // gonflaient le compteur (1 432 annoncés pour 379 clients réellement actifs).
  //
  // Deux populations sont à risque :
  //   - les clients dont le dernier achat dépasse le seuil d'inactivité ;
  //   - ceux qui n'ont **jamais** commandé — le risque y est maximal, et ils
  //     étaient purement ignorés jusqu'ici.
  const dernierAchatParClient = new Map<number, Date>();
  for (const g of derniersAchats) {
    if (g.codeCli != null && g._max.dateDoc) dernierAchatParClient.set(g.codeCli, g._max.dateDoc);
  }

  const clientsActifs = await prisma.partner.findMany({
    where: { nature: "C", archiver: 0 },
    select: { id: true, raisonSocial: true, tel: true, soldeFin: true, commercial: true, ville: true },
  });

  const aRisque = clientsActifs
    .map((p) => ({ p, dernier: dernierAchatParClient.get(p.id) ?? null }))
    .filter(({ dernier }) => dernier === null || dernier < limiteRisque);

  const parId = new Map(aRisque.map(({ p }) => [p.id, p]));
  // Trié du plus ancien au plus récent ; les « jamais commandé » en tête.
  const inactifs = aRisque
    .map(({ p, dernier }) => ({ codeCli: p.id, dernier }))
    .sort((a, b) => (a.dernier?.getTime() ?? 0) - (b.dernier?.getTime() ?? 0));

  // Téléphone d'un commercial, indexé sur son nom (la seule clé commune entre
  // les comptes utilisateurs et le champ `Partner.commercial` de l'ERP).
  const telCommercial = new Map<string, string | null>();
  for (const c of commerciaux) {
    const nom = cleNom(c.name);
    if (nom) telCommercial.set(nom, telWhatsapp(c.phone));
  }

  const clientsRisque = inactifs
    .map((g) => {
      const p = parId.get(g.codeCli);
      if (!p) return null;
      // `null` = jamais de commande : on ne peut pas mesurer une ancienneté,
      // la carte l'affiche comme tel plutôt qu'avec un nombre trompeur.
      const jours = g.dernier
        ? Math.floor((now.getTime() - g.dernier.getTime()) / 86400000)
        : null;
      const nomCommercial = (p.commercial ?? "").trim();
      const telCom = telCommercial.get(cleNom(nomCommercial)) ?? null;
      const telCli = telWhatsapp(p.tel);
      // Cible de la relance WhatsApp : le commercial en charge quand son
      // numéro est connu, sinon le client lui-même.
      const cible = telCom
        ? { tel: telCom, vers: "commercial" as const }
        : telCli
          ? { tel: telCli, vers: "client" as const }
          : null;
      return {
        codeCli: p.id,
        nom: p.raisonSocial,
        ville: p.ville,
        jours,
        jamaisCommande: g.dernier === null,
        solde: round3(p.soldeFin),
        // Score de risque : ancienneté de l'inactivité pondérée par la créance.
        // Un client jamais servi est au plafond — c'est le cas le plus urgent.
        score: g.dernier === null
          ? 99
          : Math.min(99, Math.round(((jours ?? 0) / 120) * 70 + (p.soldeFin > 0 ? 25 : 0))),
        commercial: nomCommercial || null,
        telCommercial: telCom,
        telClient: telCli,
        whatsapp: cible,
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);

  // ---- 3. Ruptures de stock (en % du catalogue) ---------------------------
  const enRupture = articles.filter((a) => a.enStock <= 0);
  const tauxRupture = articles.length > 0 ? (enRupture.length / articles.length) * 100 : 0;

  // ---- 4. Ruptures debout (sous le seuil mini, mais pas encore à zéro) -----
  // Aucun des 488 articles de l'import n'a de `stMin` : appliqué tel quel, cet
  // indicateur affichait invariablement 0 et n'alertait sur rien. On retient
  // donc le seuil de l'article quand il est renseigné, et à défaut un seuil de
  // repli — l'exploitant voit ainsi les références qui vont manquer.
  const SEUIL_DEFAUT = 5;
  const seuilDe = (a: { stMin: number }) => (a.stMin > 0 ? a.stMin : SEUIL_DEFAUT);

  const debout = articles.filter((a) => a.enStock > 0 && a.enStock <= seuilDe(a));
  const tauxDebout = articles.length > 0 ? (debout.length / articles.length) * 100 : 0;
  // Nombre d'articles dont le seuil vient du référentiel : permet à l'écran de
  // signaler que le repli est utilisé faute de paramétrage.
  const nbAvecSeuil = articles.filter((a) => a.stMin > 0).length;

  return NextResponse.json({
    periode: { mois, annee, du: debutMois, au: finMois },
    objectif: {
      objectifCA: round3(objectifCA),
      realise: round3(realise),
      taux: round3(tauxObjectif),
      reste: round3(Math.max(0, objectifCA - realise)),
      nbVendeurs: realiseParVendeur.size,
      parVendeur: [...realiseParVendeur.entries()]
        .map(([vendeur, ca]) => {
          const o = objectifs.find((x) => x.vendeur === vendeur)?.objectifCA ?? 0;
          return { vendeur, ca: round3(ca), objectifCA: round3(o), taux: o > 0 ? round3((ca / o) * 100) : 0 };
        })
        .sort((a, b) => b.ca - a.ca)
        .slice(0, 10),
    },
    clientsRisque: {
      total: inactifs.length,
      seuilJours: SEUIL_RISQUE_JOURS,
      // Ventilation : distinguer « client perdu de vue » et « jamais servi »
      // change complètement l'action commerciale à mener.
      jamaisCommande: inactifs.filter((g) => g.dernier === null).length,
      inactifs: inactifs.filter((g) => g.dernier !== null).length,
      nbClients: clientsActifs.length,
      rows: clientsRisque,
    },
    rupturesStock: {
      nb: enRupture.length,
      nbArticles: articles.length,
      taux: round3(tauxRupture),
      valeurManquante: round3(enRupture.reduce((s, a) => s + Math.max(0, a.stMin) * a.puAchat, 0)),
      rows: enRupture.slice(0, 12).map((a) => ({
        refArt: a.refArt, designation: a.designation, stock: a.enStock, stMin: a.stMin,
        suggere: Math.max(1, Math.ceil(a.stMin || 1)), puAchat: round3(a.puAchat),
      })),
    },
    rupturesDebout: {
      nb: debout.length,
      taux: round3(tauxDebout),
      // Seuil de repli appliqué quand le référentiel n'en fournit aucun.
      seuilDefaut: SEUIL_DEFAUT,
      nbAvecSeuil,
      rows: debout.slice(0, 12).map((a) => ({
        refArt: a.refArt, designation: a.designation, stock: a.enStock,
        stMin: a.stMin, seuilApplique: seuilDe(a),
        manque: round3(Math.max(0, seuilDe(a) - a.enStock)),
      })),
    },
  });
}
