import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { TYPES_VENTE, TYPES_RETOUR, round3, MOIS_LONGS } from "@/lib/vente-stats";
import { filtrePortefeuille, cleCommercial, emplacementVehicule } from "@/lib/perimetre-commercial";
import { rafraichirOperationsSiPerime } from "@/lib/sync-operations";
import { iaDisponible, repondreAvecIA, type OutilIA } from "@/lib/assistant-ia";

// Assistant BIS — répond avec les données réelles, dans le périmètre du rôle.
//
// POST /api/assistant { question }
//
// Remplace une maquette dont les réponses étaient écrites en dur (« CA de mai
// 2026 : 23 100 TND »), identiques pour tous les rôles et sans rapport avec la
// base. Ici chaque réponse est calculée, et **cloisonnée** :
//   ADMIN / MANAGER : toute la société, tous les commerciaux ;
//   COMMERCIAL      : son portefeuille, ses ventes, son camion, ses tournées ;
//   CLIENT          : ses propres documents et son solde, rien d'autre.
//
// Aucune écriture : l'assistant lit, il ne modifie jamais rien.

type Role = "ADMIN" | "MANAGER" | "COMMERCIAL" | "CLIENT";
type Ctx = { role: Role; nom: string; codeTiers: number | null };
/** Dernier sujet traité : permet de comprendre « donne-moi la liste », « et le mois dernier ? ». */
type Suivi = { sujet?: string | null; detail?: string | null };

const fmt = (v: number) =>
  new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(round3(v));
const fmtCourt = (v: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(v);

/** Début et fin du mois en cours (heure locale). */
function moisCourant() {
  const n = new Date();
  return { du: new Date(n.getFullYear(), n.getMonth(), 1), au: new Date(n.getFullYear(), n.getMonth() + 1, 1), libelle: `${MOIS_LONGS[n.getMonth()]} ${n.getFullYear()}` };
}

/**
 * Période évoquée dans la question : « aujourd'hui », « hier », « cette
 * semaine », « le mois dernier », « cette année », un mois nommé, sinon le
 * mois en cours. Sans cela, « CA de l'année » répondait sur le mois.
 */
function periodeDemandee(q: string) {
  const n = new Date();
  const j = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (/aujourd|ce jour/.test(q)) {
    const du = j(n); return { du, au: new Date(du.getTime() + 86_400_000), libelle: "aujourd'hui" };
  }
  if (/\bhier\b/.test(q)) {
    const au = j(n); const du = new Date(au.getTime() - 86_400_000); return { du, au, libelle: "hier" };
  }
  if (/semaine/.test(q)) {
    const d = j(n); const lundi = new Date(d); lundi.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return { du: lundi, au: new Date(lundi.getTime() + 7 * 86_400_000), libelle: "cette semaine" };
  }
  if (/mois dernier|mois passe|mois precedent/.test(q)) {
    const du = new Date(n.getFullYear(), n.getMonth() - 1, 1);
    return { du, au: new Date(n.getFullYear(), n.getMonth(), 1), libelle: `${MOIS_LONGS[du.getMonth()]} ${du.getFullYear()}` };
  }
  if (/\bannee\b|\ban\b|annuel/.test(q)) {
    return { du: new Date(n.getFullYear(), 0, 1), au: new Date(n.getFullYear() + 1, 0, 1), libelle: `${n.getFullYear()}` };
  }
  for (let i = 0; i < 12; i++) {
    const nom = MOIS_LONGS[i].toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
    if (new RegExp(`\\b${nom}\\b`).test(q)) {
      const annee = /20\d{2}/.test(q) ? Number(q.match(/20\d{2}/)![0]) : n.getFullYear();
      return { du: new Date(annee, i, 1), au: new Date(annee, i + 1, 1), libelle: `${MOIS_LONGS[i]} ${annee}` };
    }
  }
  return moisCourant();
}

/** Nombre d'éléments demandé (« top 3 », « les 10 premiers »), 5 par défaut. */
function combien(q: string, defaut = 5) {
  const m = q.match(/\b(\d{1,2})\b/);
  const n = m ? Number(m[1]) : defaut;
  return Math.min(20, Math.max(1, n));
}

/** Seuil de montant évoqué (« plus de 3000 », « > 3000 »). */
function seuil(q: string): number | null {
  const m = q.match(/(?:plus de|superieur|sup|>|au dessus de|depassent)\s*(\d[\d\s.,]*)/);
  if (!m) return null;
  const v = Number(m[1].replace(/[\s,]/g, "").replace(/\.(?=\d{3}\b)/g, ""));
  return Number.isFinite(v) && v > 0 ? v : null;
}

/** Filtre documents selon le rôle : un commercial ne voit que ses ventes. */
function filtreDocs(ctx: Ctx) {
  if (ctx.role === "CLIENT") return { codeCli: ctx.codeTiers ?? -1 };
  if (ctx.role === "COMMERCIAL") {
    const cle = cleCommercial(ctx.nom);
    return { OR: [
      { utilisateur: { startsWith: cle, mode: "insensitive" as const } },
      { commercial: { startsWith: cle, mode: "insensitive" as const } },
    ] };
  }
  return {};
}

// ── Intentions ───────────────────────────────────────────────────────────────
async function repondreCA(ctx: Ctx, q: string) {
  const { du, au, libelle } = periodeDemandee(q);
  const docs = await prisma.erpDocument.findMany({
    where: { nature: "Vente", dateDoc: { gte: du, lt: au }, ...filtreDocs(ctx) },
    select: { typeDoc: true, ttcNet: true },
  });
  let ca = 0, nb = 0;
  for (const d of docs) {
    const t = String(d.typeDoc ?? "").toUpperCase();
    if ((TYPES_VENTE as readonly string[]).includes(t)) { ca += d.ttcNet; nb++; }
    else if ((TYPES_RETOUR as readonly string[]).includes(t)) ca -= d.ttcNet;
  }
  const qui = ctx.role === "COMMERCIAL" ? "Votre chiffre d'affaires" : ctx.role === "CLIENT" ? "Vos achats" : "Chiffre d'affaires";
  if (nb === 0) return `📊 ${qui} — ${libelle} : **aucune vente** enregistrée ce mois-ci.`;

  let txt = `📊 ${qui} — ${libelle} : **${fmt(ca)} TND** sur ${nb} document(s).`;

  // « donne-moi la liste », « détail » : les documents plutôt qu'un total.
  if (/liste|detail|lesquel|quels documents|tickets?\b/.test(q)) {
    const docsListe = await prisma.erpDocument.findMany({
      where: { nature: "Vente", dateDoc: { gte: du, lt: au }, typeDoc: { in: [...TYPES_VENTE, ...TYPES_RETOUR] }, ...filtreDocs(ctx) },
      orderBy: { dateDoc: "desc" }, take: combien(q, 10),
      select: { refDoc: true, dateDoc: true, raisonSocial: true, ttcNet: true },
    });
    if (docsListe.length) {
      txt += `\n\nDerniers documents :\n` + docsListe.map((d) =>
        `• ${d.refDoc} — ${d.raisonSocial ?? "client"} — **${fmt(d.ttcNet)} TND**${d.dateDoc ? ` (${new Date(d.dateDoc).toLocaleDateString("fr-FR")})` : ""}`,
      ).join("\n");
    }
  }

  // Objectif du mois (commercial), s'il est fixé.
  if (ctx.role === "COMMERCIAL") {
    const obj = await prisma.objectif.findFirst({
      where: { vendeur: { contains: cleCommercial(ctx.nom), mode: "insensitive" }, mois: du.getMonth() + 1, annee: du.getFullYear() },
      select: { objectifCA: true },
    }).catch(() => null);
    if (obj?.objectifCA) {
      const taux = obj.objectifCA > 0 ? (ca / obj.objectifCA) * 100 : 0;
      txt += `\nObjectif : ${fmt(obj.objectifCA)} TND — réalisé à **${taux.toFixed(1)} %**.`;
    }
  }
  return txt;
}

async function repondreCreances(ctx: Ctx, q: string) {
  if (ctx.role === "CLIENT") {
    const c = await prisma.partner.findUnique({ where: { id: ctx.codeTiers ?? -1 }, select: { raisonSocial: true, soldeFin: true } });
    if (!c) return "Je ne retrouve pas votre fiche client.";
    return c.soldeFin > 0
      ? `💰 Votre solde : **${fmt(c.soldeFin)} TND** dus.`
      : "✅ Votre compte est soldé : rien à payer.";
  }
  // « clients avec solde > 3000 » : le seuil demandé fait foi.
  const min = seuil(q);
  const where = { nature: "C", soldeFin: { gt: min ?? 0 }, ...(filtrePortefeuille({ role: ctx.role, name: ctx.nom }) ?? {}) };
  const combienN = /liste|tous|detail/.test(q) ? combien(q, 15) : combien(q, 5);
  const [top, agg] = await Promise.all([
    prisma.partner.findMany({ where, orderBy: { soldeFin: "desc" }, take: combienN, select: { id: true, raisonSocial: true, soldeFin: true, ville: true, tel: true } }),
    prisma.partner.aggregate({ where, _sum: { soldeFin: true }, _count: true }),
  ]);
  if (!top.length) {
    return min ? `✅ Aucun client au-dessus de ${fmt(min)} TND de solde.` : "✅ Aucun client débiteur dans votre périmètre.";
  }
  const lignes = top.map((c) => `• ${c.raisonSocial ?? `Client ${c.id}`}${c.ville ? ` (${c.ville})` : ""} — **${fmt(c.soldeFin)} TND**${c.tel ? ` · ${c.tel}` : ""}`).join("\n");
  const entete = min
    ? `🔴 ${agg._count} client(s) au-dessus de ${fmt(min)} TND, total **${fmt(agg._sum.soldeFin ?? 0)} TND**.`
    : `🔴 ${agg._count} client(s) débiteur(s), total **${fmt(agg._sum.soldeFin ?? 0)} TND**.`;
  const reste = agg._count > top.length ? `\n… et ${agg._count - top.length} autre(s).` : "";
  return `${entete}\n${lignes}${reste}`;
}

async function repondreStock(ctx: Ctx, q: string) {
  if (ctx.role === "CLIENT") return "Le stock n'est pas accessible depuis votre espace client.";
  // Commercial : son camion. Autres : le dépôt principal.
  const emplacement = ctx.role === "COMMERCIAL" ? await emplacementVehicule(ctx.nom, null) : "Dépôt principale";
  if (!emplacement) return "Aucun véhicule ne vous est affecté : je ne peux pas lire votre stock.";
  const lignes = await prisma.stockDepot.findMany({
    where: { emplacement },
    select: { refArt: true, quantite: true, pmp: true },
  });
  const negatifs = lignes.filter((l) => l.quantite < 0);
  const positifs = lignes.filter((l) => l.quantite > 0);
  const refs = [...positifs, ...negatifs].map((l) => l.refArt);
  const arts = refs.length
    ? new Map((await prisma.article.findMany({ where: { refArt: { in: refs } }, select: { refArt: true, designation: true, stMin: true } })).map((a) => [a.refArt, a]))
    : new Map();
  const sousSeuil = positifs
    .filter((l) => { const a = arts.get(l.refArt); return a && a.stMin > 0 && l.quantite <= a.stMin; })
    .slice(0, 5);

  const lieu = ctx.role === "COMMERCIAL" ? `votre camion (${emplacement})` : `le dépôt principal`;

  // « combien ça vaut », « en dinars », « valeur » : le stock valorisé.
  if (/valeur|valoris|dinars?|\bdt\b|\btnd\b|combien ca vaut|ca vaut|montant/.test(q)) {
    const refsPos = positifs.map((l) => l.refArt);
    const prix = refsPos.length
      ? new Map((await prisma.article.findMany({
          where: { refArt: { in: refsPos } },
          select: { refArt: true, designation: true, tarif1Ht: true, tauxTva: true, tauxFodec: true, pmp: true },
        })).map((a) => [a.refArt, a]))
      : new Map();
    let vente = 0, cout = 0;
    for (const l of positifs) {
      const a = prix.get(l.refArt);
      if (!a) continue;
      vente += l.quantite * a.tarif1Ht * (1 + (a.tauxFodec ?? 0) / 100) * (1 + a.tauxTva / 100);
      cout += l.quantite * (l.pmp || a.pmp || 0);
    }
    return `💰 Valeur du stock dans ${lieu} :\n• Au prix de vente : **${fmt(vente)} TND TTC**\n• Au coût d'achat : ${fmt(cout)} TND\n• ${positifs.length} référence(s) en stock`;
  }

  let txt = `📦 Stock dans ${lieu} : **${positifs.length} référence(s)** disponible(s).`;

  // « donne-moi la liste » : le détail des articles, pas seulement le compte.
  if (/liste|detail|quels articles|lesquel|tout|contenu/.test(q)) {
    const tri = [...positifs].sort((a, b) => b.quantite - a.quantite).slice(0, combien(q, 15));
    if (tri.length) {
      txt += `\n\n` + tri.map((l) => {
        const a = arts.get(l.refArt);
        return `• ${a?.designation ?? l.refArt} — **${fmtCourt(l.quantite)}**`;
      }).join("\n");
      if (positifs.length > tri.length) txt += `\n… et ${positifs.length - tri.length} autre(s).`;
    }
    if (negatifs.length) {
      txt += `\n\n🔻 En négatif :\n` + negatifs.slice(0, 10).map((l) => {
        const a = arts.get(l.refArt);
        return `• ${a?.designation ?? l.refArt} — ${fmtCourt(l.quantite)}`;
      }).join("\n");
    }
    return txt;
  }
  if (sousSeuil.length) {
    txt += `\n\n⚠️ Sous le seuil minimum :\n` + sousSeuil.map((l) => {
      const a = arts.get(l.refArt);
      return `• ${a?.designation ?? l.refArt} — ${fmtCourt(l.quantite)} (min : ${fmtCourt(a?.stMin ?? 0)})`;
    }).join("\n");
  }
  if (negatifs.length) {
    txt += `\n\n🔻 ${negatifs.length} référence(s) en négatif (vendues à découvert) — à régulariser.`;
  }
  return txt;
}

async function repondrePerformance(ctx: Ctx, q: string) {
  if (ctx.role === "CLIENT") return "Cette information n'est pas accessible depuis votre espace client.";
  const { du, au, libelle } = periodeDemandee(q);

  // Un commercial ne voit que sa propre performance.
  if (ctx.role === "COMMERCIAL") {
    const [docs, regs, missions] = await Promise.all([
      prisma.erpDocument.findMany({ where: { nature: "Vente", dateDoc: { gte: du, lt: au }, ...filtreDocs(ctx) }, select: { typeDoc: true, ttcNet: true } }),
      prisma.erpReglement.aggregate({ where: { sens: "C", datePay: { gte: du, lt: au }, utilisateur: { startsWith: cleCommercial(ctx.nom), mode: "insensitive" } }, _sum: { montant: true }, _count: true }),
      prisma.erpMission.findMany({ where: { commercial: { startsWith: cleCommercial(ctx.nom), mode: "insensitive" }, dateOrdre: { gte: du, lt: au } }, select: { id: true, lignes: { select: { etat: true } } } }),
    ]);
    let ca = 0;
    for (const d of docs) {
      const t = String(d.typeDoc ?? "").toUpperCase();
      if ((TYPES_VENTE as readonly string[]).includes(t)) ca += d.ttcNet;
      else if ((TYPES_RETOUR as readonly string[]).includes(t)) ca -= d.ttcNet;
    }
    const visites = missions.flatMap((m) => m.lignes);
    const faites = visites.filter((v) => v.etat === "Visité").length;
    return `📈 Votre activité — ${libelle} :\n• CA : **${fmt(ca)} TND**\n• Encaissé : ${fmt(regs._sum.montant ?? 0)} TND (${regs._count} règlement(s))\n• Tournées : ${missions.length}\n• Visites : ${faites}/${visites.length}`;
  }

  // Admin / manager : classement des commerciaux.
  const docs = await prisma.erpDocument.findMany({
    where: { nature: "Vente", dateDoc: { gte: du, lt: au }, typeDoc: { in: [...TYPES_VENTE, ...TYPES_RETOUR] } },
    select: { typeDoc: true, ttcNet: true, utilisateur: true, commercial: true },
  });
  const parCom = new Map<string, number>();
  for (const d of docs) {
    const nom = (d.commercial || d.utilisateur || "—").trim();
    const t = String(d.typeDoc ?? "").toUpperCase();
    const signe = (TYPES_VENTE as readonly string[]).includes(t) ? 1 : -1;
    parCom.set(nom, (parCom.get(nom) ?? 0) + signe * d.ttcNet);
  }
  const classement = [...parCom.entries()].sort((a, b) => b[1] - a[1]).slice(0, combien(q, 5));
  if (!classement.length) return `Aucune vente enregistrée en ${libelle}.`;
  return `🏆 Classement des commerciaux — ${libelle} :\n` +
    classement.map(([nom, ca], i) => `${i + 1}. ${nom} — **${fmt(ca)} TND**`).join("\n");
}

async function repondreTournee(ctx: Ctx, q: string) {
  if (ctx.role === "CLIENT") return "Cette information n'est pas accessible depuis votre espace client.";
  const cle = ctx.role === "COMMERCIAL" ? cleCommercial(ctx.nom) : null;
  const mission = await prisma.erpMission.findFirst({
    where: { ...(cle ? { commercial: { startsWith: cle, mode: "insensitive" } } : {}), etat: "En cours" },
    include: { lignes: { orderBy: [{ numOrdre: "asc" }, { id: "asc" }], select: { etat: true, codeCli: true, clientNom: true, numOrdre: true } } },
    orderBy: { dateOrdre: "desc" },
  });
  if (!mission) return "Aucune tournée en cours.";
  const faites = mission.lignes.filter((l) => l.etat === "Visité").length;
  let txt = `🚚 Tournée **OM-${mission.id}**${mission.commercial ? ` — ${mission.commercial}` : ""}\n• Véhicule : ${mission.vehicule ?? "—"}\n• Visites : ${faites}/${mission.lignes.length}\n• État : ${mission.etat ?? "—"}`;

  // « la liste » : les clients à visiter, dans l'ordre de passage.
  if (/liste|detail|quels clients|lesquel|etapes?|visites?/.test(q) && mission.lignes.length) {
    const codes = mission.lignes.map((l) => l.codeCli).filter((c): c is number => c != null);
    const noms = codes.length
      ? new Map((await prisma.partner.findMany({ where: { id: { in: codes } }, select: { id: true, raisonSocial: true, ville: true } })).map((p) => [p.id, p]))
      : new Map();
    txt += `\n\n` + mission.lignes.slice(0, combien(q, 15)).map((l) => {
      const c = l.codeCli != null ? noms.get(l.codeCli) : null;
      const nom = c?.raisonSocial ?? l.clientNom ?? (l.codeCli ? `Client ${l.codeCli}` : "—");
      const marque = l.etat === "Visité" ? "✅" : l.etat === "Absent" ? "🚫" : l.etat === "Reporté" ? "⏭️" : "◻️";
      return `${marque} ${l.numOrdre}. ${nom}${c?.ville ? ` (${c.ville})` : ""}`;
    }).join("\n");
  }
  return txt;
}

async function repondreClients(ctx: Ctx, q: string) {
  if (ctx.role === "CLIENT") return "Cette information n'est pas accessible depuis votre espace client.";
  const where = { nature: "C", ...(filtrePortefeuille({ role: ctx.role, name: ctx.nom }) ?? {}) };
  const [total, geo] = await Promise.all([
    prisma.partner.count({ where }),
    prisma.partner.count({ where: { ...where, AND: [{ latitude: { not: null } }, { longitude: { not: null } }] } }),
  ]);
  const qui = ctx.role === "COMMERCIAL" ? "Votre portefeuille" : "Le fichier clients";
  let txt = `👥 ${qui} : **${total} client(s)**, dont ${geo} géolocalisé(s).`;
  if (/liste|detail|lesquel|noms?\b/.test(q)) {
    const liste = await prisma.partner.findMany({
      where, orderBy: { soldeFin: "desc" }, take: combien(q, 15),
      select: { id: true, raisonSocial: true, ville: true, soldeFin: true },
    });
    if (liste.length) {
      txt += `\n\n` + liste.map((c) => `• ${c.raisonSocial ?? `Client ${c.id}`}${c.ville ? ` (${c.ville})` : ""}${c.soldeFin > 0 ? ` — ${fmt(c.soldeFin)} TND` : ""}`).join("\n");
      if (total > liste.length) txt += `\n… et ${total - liste.length} autre(s).`;
    }
  }
  return txt;
}

/** Aiguillage par mots-clés, avec les sujets accessibles au rôle. */
function sujets(role: Role) {
  const tous: { cle: string; mots: string[]; f: (ctx: Ctx, q: string) => Promise<string> }[] = [
    { cle: "ca", mots: ["ca", "chiffre", "vente", "vendu", "facture", "recette", "ticket"], f: repondreCA },
    { cle: "creances", mots: ["creance", "solde", "impaye", "doit", "dette", "recouvr", "argent", "payer", "reste a"], f: repondreCreances },
    { cle: "stock", mots: ["stock", "rupture", "minimum", "camion", "article", "produit", "marchandise", "il me reste", "inventaire"], f: repondreStock },
    { cle: "performance", mots: ["performance", "classement", "meilleur", "objectif", "activite", "resultat", "bilan", "comment je"], f: repondrePerformance },
    { cle: "tournee", mots: ["tournee", "visite", "mission", "planning", "route", "ou aller", "ou dois", "programme", "itineraire", "etape"], f: repondreTournee },
    { cle: "clients", mots: ["client", "portefeuille", "combien de client"], f: repondreClients },
  ];
  if (role === "CLIENT") return tous.filter((s) => ["ca", "creances"].includes(s.cle));
  return tous;
}

const AIDE: Record<Role, string> = {
  ADMIN: "Je réponds sur les **données réelles** de la société : chiffre d'affaires du mois, créances clients, stock du dépôt, classement des commerciaux, tournées en cours, fichier clients.",
  MANAGER: "Je réponds sur les **données réelles** de la société : chiffre d'affaires du mois, créances clients, stock du dépôt, classement des commerciaux, tournées en cours, fichier clients.",
  COMMERCIAL: "Je réponds sur **vos** données : votre chiffre d'affaires du mois, les créances de votre portefeuille, le stock de votre camion, votre activité, votre tournée en cours.",
  CLIENT: "Je réponds sur **votre compte** : vos achats du mois et votre solde.",
};

/** Suggestions proposées à l'ouverture, selon ce que le rôle peut consulter. */
const SUGGESTIONS: Record<Role, string[]> = {
  ADMIN: ["Quel est le CA du mois ?", "Quelles sont les créances clients ?", "Classement des commerciaux", "Stock du dépôt"],
  MANAGER: ["Quel est le CA du mois ?", "Quelles sont les créances clients ?", "Classement des commerciaux", "Stock du dépôt"],
  COMMERCIAL: ["Quel est mon CA du mois ?", "Créances de mes clients", "Stock de mon camion", "Ma tournée en cours"],
  CLIENT: ["Quel est mon solde ?", "Mes achats du mois"],
};

// GET : rôle, message d'accueil et suggestions — le composant n'a ainsi
// aucune connaissance des données ni du périmètre, tout vient du serveur.
export async function GET() {
  const auth = await requireSession();
  if (!auth.ok) return auth.res;
  const role = auth.user.role as Role;
  return NextResponse.json({
    role,
    prenom: auth.user.name,
    accueil: `Bonjour ${auth.user.name.split(" ")[0]} !\n\n${AIDE[role]}`,
    suggestions: SUGGESTIONS[role] ?? SUGGESTIONS.COMMERCIAL,
  });
}

/**
 * Outils mis à la disposition du modèle. Chacun réutilise les fonctions déjà
 * écrites, qui appliquent le périmètre du rôle : le modèle ne peut donc pas
 * obtenir des données auxquelles l'utilisateur n'a pas droit, même s'il les
 * demande.
 */
function outilsPour(ctx: Ctx): OutilIA[] {
  const periode = {
    type: "string",
    description: "Période : « ce mois », « mois dernier », « aujourd'hui », « hier », « cette semaine », « cette année », ou un mois nommé (« août 2026 »). Par défaut le mois en cours.",
  };
  const tous: OutilIA[] = [
    {
      nom: "chiffre_affaires",
      description: ctx.role === "CLIENT"
        ? "Montant des achats du client sur une période, avec la liste des documents si demandé."
        : "Chiffre d'affaires (ventes moins retours) sur une période, avec la liste des documents si demandé.",
      parametres: { type: "object", properties: { periode, liste: { type: "boolean", description: "true pour lister les documents" } }, required: [] },
      executer: async (a) => ({ resultat: await repondreCA(ctx, `${a.periode ?? ""} ${a.liste ? "liste" : ""}`) }),
    },
    {
      nom: "creances_clients",
      description: ctx.role === "CLIENT"
        ? "Solde restant dû par le client."
        : "Clients débiteurs : nombre, total dû et les plus importants. Accepte un seuil minimum.",
      parametres: { type: "object", properties: { seuil_min: { type: "number", description: "Ne garder que les soldes au-dessus de ce montant en TND" }, combien: { type: "number", description: "Nombre de clients à lister" } }, required: [] },
      executer: async (a) => ({ resultat: await repondreCreances(ctx, `${a.seuil_min ? `plus de ${a.seuil_min}` : ""} ${a.combien ?? ""} liste`) }),
    },
    {
      nom: "stock",
      description: "Stock disponible (camion du commercial, ou dépôt principal pour l'administration) : nombre de références, liste des articles, articles sous le seuil, et valeur en dinars si demandé.",
      parametres: { type: "object", properties: { valorise: { type: "boolean", description: "true pour la valeur en TND (prix de vente et coût)" }, liste: { type: "boolean", description: "true pour lister les articles" } }, required: [] },
      executer: async (a) => ({ resultat: await repondreStock(ctx, `${a.valorise ? "valeur en dinars" : ""} ${a.liste ? "liste" : ""}`) }),
    },
    {
      nom: "performance",
      description: ctx.role === "COMMERCIAL"
        ? "Activité du commercial sur une période : CA, encaissements, tournées, visites, objectif."
        : "Classement des commerciaux par chiffre d'affaires sur une période.",
      parametres: { type: "object", properties: { periode, combien: { type: "number" } }, required: [] },
      executer: async (a) => ({ resultat: await repondrePerformance(ctx, `${a.periode ?? ""} ${a.combien ?? ""}`) }),
    },
    {
      nom: "tournee",
      description: "Tournée en cours : véhicule, avancement, et la liste des clients à visiter avec leur état.",
      parametres: { type: "object", properties: { liste: { type: "boolean", description: "true pour lister les clients de la tournée" } }, required: [] },
      executer: async (a) => ({ resultat: await repondreTournee(ctx, a.liste ? "liste" : "") }),
    },
    {
      nom: "ouvrir_page",
      description: "Ouvre un écran de l'application pour l'utilisateur. À utiliser dès qu'il demande à aller quelque part, à voir un écran, ou quand la réponse se prolonge naturellement sur une page (planning, catalogue, panier…).",
      parametres: {
        type: "object",
        properties: {
          page: {
            type: "string",
            enum: ctx.role === "COMMERCIAL"
              ? ["planning", "clients", "catalogue", "panier", "recouvrement", "journal", "dernier-ticket", "stock-vehicule", "approvisionnement", "reclamation", "statistiques", "carte"]
              : ["tableau-de-bord", "clients", "missions", "commerciaux", "etat-stock", "synthese", "comptabilite", "rapports"],
            description: "Écran à ouvrir",
          },
        },
        required: ["page"],
      },
      executer: async (a) => {
        const chemin = cheminPage(String(a.page ?? ""), ctx.role);
        if (!chemin) return { erreur: "Écran inconnu." };
        return { navigation: chemin, message: `Écran « ${a.page} » ouvert.` };
      },
    },
    {
      nom: "chercher_client",
      description: "Recherche un client par son nom (ou une partie du nom) dans le portefeuille de l'utilisateur. Renvoie ses coordonnées, son solde, et le lien vers sa fiche. À utiliser dès que l'utilisateur nomme un client.",
      parametres: { type: "object", properties: { nom: { type: "string", description: "Nom ou fragment du nom du client" }, ouvrir_fiche: { type: "boolean", description: "true pour ouvrir directement la fiche du client trouvé" } }, required: ["nom"] },
      executer: async (a) => {
        const recherche = String(a.nom ?? "").trim();
        if (recherche.length < 2) return { erreur: "Précisez au moins deux lettres du nom." };
        // Les noms importés contiennent des espaces doubles (« AGIL  BEJA
        // NORD ») : une recherche littérale échouerait. On cherche donc sur
        // chaque mot, puis on classe par pertinence.
        const mots = recherche.split(/\s+/).filter((m) => m.length >= 2);
        const trouves = await prisma.partner.findMany({
          where: {
            nature: "C",
            ...(filtrePortefeuille({ role: ctx.role, name: ctx.nom }) ?? {}),
            AND: (mots.length ? mots : [recherche]).map((m) => ({
              raisonSocial: { contains: m, mode: "insensitive" as const },
            })),
          },
          take: 5,
          orderBy: { soldeFin: "desc" },
          select: { id: true, raisonSocial: true, ville: true, gouvernorat: true, tel: true, adresse: true, soldeFin: true },
        });
        if (!trouves.length) return { resultat: `Aucun client nommé « ${recherche} » dans votre portefeuille.` };
        // La fiche n'a pas la même route selon le rôle : le commercial reste
        // dans son espace, l'administrateur dans le module Vente.
        const baseFiche = ctx.role === "COMMERCIAL" ? "/commercial/clients" : "/admin/modules/vente/clients";
        const fiches = trouves.map((c) => ({
          code: c.id, nom: c.raisonSocial, ville: c.ville, gouvernorat: c.gouvernorat,
          telephone: c.tel, adresse: c.adresse, solde_du_tnd: round3(c.soldeFin),
          lien_fiche: `${baseFiche}/${c.id}`,
        }));
        // Un seul résultat et l'utilisateur veut y aller : on ouvre la fiche.
        const navigation = a.ouvrir_fiche && trouves.length === 1 ? `${baseFiche}/${trouves[0].id}` : undefined;
        return { clients: fiches, ...(navigation ? { navigation } : {}) };
      },
    },
    {
      nom: "clients",
      description: "Portefeuille clients : nombre, et la liste avec ville et solde si demandé.",
      parametres: { type: "object", properties: { liste: { type: "boolean" }, combien: { type: "number" } }, required: [] },
      executer: async (a) => ({ resultat: await repondreClients(ctx, `${a.liste ? "liste" : ""} ${a.combien ?? ""}`) }),
    },
  ];
  // Un client n'a accès qu'à ses achats et à son solde.
  if (ctx.role === "CLIENT") return tous.filter((o) => ["chiffre_affaires", "creances_clients"].includes(o.nom));
  return tous;
}

/** Écran de l'application → chemin réel, selon le rôle. */
function cheminPage(page: string, role: Role): string | null {
  const commercial: Record<string, string> = {
    planning: "/commercial/planning", clients: "/commercial/clients", catalogue: "/commercial/catalogue",
    panier: "/commercial/panier", recouvrement: "/commercial/recouvrement", journal: "/commercial/journal",
    "dernier-ticket": "/commercial/dernier-ticket", "stock-vehicule": "/commercial/retour-stock",
    approvisionnement: "/commercial/approvisionnement", reclamation: "/commercial/reclamation",
    statistiques: "/commercial/statistiques", carte: "/commercial/map",
  };
  const pilote: Record<string, string> = {
    "tableau-de-bord": "/admin/dashboard", clients: "/admin/modules/vente/clients",
    missions: "/admin/missions", commerciaux: "/admin/commerciaux", "etat-stock": "/admin/etat-stock",
    visites: "/admin/visites",
    synthese: "/admin/synthese", comptabilite: "/admin/compta", rapports: "/admin/rapports-admin",
  };
  if (role === "CLIENT") return null;
  return (role === "COMMERCIAL" ? commercial : pilote)[page] ?? null;
}

/**
 * Écran déduit de la question elle-même. Sert de filet : le modèle oublie
 * parfois d'appeler `ouvrir_page`, et l'utilisateur attend d'être emmené sur
 * l'écran, pas de lire une phrase.
 */
function pageDemandee(q: string, role: Role): string | null {
  const t = q.toLowerCase();
  const veutOuvrir = /\b(ouvre|ouvrir|affiche|montre|montrer|va sur|vas sur|emm[eè]ne|emmener|je veux voir|amm?[eè]ne|passe (?:sur|[àa]))\b/.test(t);
  if (!veutOuvrir) return null;
  // Du plus spécifique au plus général : « dernier ticket » avant « ticket ».
  const ecrans: [RegExp, string][] = role === "COMMERCIAL"
    ? [
        [/dernier ticket|dernier tick|derniers? ticket/, "dernier-ticket"],
        [/tourn[ée]e|planning|mission du jour/, "planning"],
        [/catalogue|produits?|articles?/, "catalogue"],
        [/panier|commande en cours/, "panier"],
        [/recouvrement|encaissement|r[ée]glement/, "recouvrement"],
        [/journal|historique/, "journal"],
        [/stock (?:du )?(?:v[ée]hicule|camion)|retour stock/, "stock-vehicule"],
        [/approvisionnement/, "approvisionnement"],
        [/r[ée]clamation/, "reclamation"],
        [/statistiques?|performance/, "statistiques"],
        [/carte|g[ée]olocalisation|map/, "carte"],
        [/clients?|portefeuille/, "clients"],
      ]
    : [
        [/tableau de bord|dashboard|accueil/, "tableau-de-bord"],
        [/missions?|tourn[ée]es?/, "missions"],
        [/visites?\s*(?:terrain)?|pointages?/, "visites"],
        [/commerciaux|vendeurs?/, "commerciaux"],
        [/[ée]tat (?:du )?stock|stock/, "etat-stock"],
        [/synth[èe]se|objectifs?/, "synthese"],
        [/comptabilit[ée]|compta/, "comptabilite"],
        [/rapports?/, "rapports"],
        [/clients?/, "clients"],
      ];
  for (const [motif, page] of ecrans) if (motif.test(t)) return cheminPage(page, role);
  return null;
}

/**
 * Fiche client déduite d'une demande explicite (« ouvre la fiche de Shell
 * Grombalia »). Filet, comme `pageDemandee` : la navigation ne doit pas
 * dépendre du fait que le modèle ait pensé à appeler l'outil.
 */
async function ficheDemandee(q: string, ctx: Ctx): Promise<string | null> {
  if (ctx.role === "CLIENT") return null;
  const m = q.match(/(?:fiche|client|compte)\s+(?:du\s+|de\s+la\s+|de\s+l'|de\s+|d')?([\p{L}\d][\p{L}\d '.-]{2,60})/iu);
  if (!m) return null;
  const mots = m[1].trim().replace(/[?!.]+$/, "").split(/\s+/).filter((x) => x.length >= 3);
  if (!mots.length) return null;
  const trouves = await prisma.partner.findMany({
    where: {
      nature: "C",
      ...(filtrePortefeuille({ role: ctx.role, name: ctx.nom }) ?? {}),
      AND: mots.map((x) => ({ raisonSocial: { contains: x, mode: "insensitive" as const } })),
    },
    take: 2,
    select: { id: true },
  });
  if (trouves.length !== 1) return null;
  const base = ctx.role === "COMMERCIAL" ? "/commercial/clients" : "/admin/modules/vente/clients";
  return `${base}/${trouves[0].id}`;
}

/** Consigne du modèle : rôle, périmètre, et interdiction d'inventer. */
function consigne(ctx: Ctx): string {
  const perimetre = {
    ADMIN: "Vous parlez à un administrateur : il voit toute la société.",
    MANAGER: "Vous parlez à un responsable : il voit toute la société.",
    COMMERCIAL: `Vous parlez au commercial ${ctx.nom} : il ne voit que SES clients, SES ventes, SON camion, SES tournées.`,
    CLIENT: "Vous parlez à un client : il ne voit que ses propres achats et son solde.",
  }[ctx.role];
  return [
    "Tu es l'assistant du logiciel de gestion BIS (S.K.Y), entreprise tunisienne de distribution.",
    perimetre,
    "Pour toute question sur des données (ventes, clients, stock, tournées, créances), tu DOIS appeler un outil ; ne réponds jamais de mémoire.",
    "RÈGLE ABSOLUE : n'utilise que les chiffres renvoyés par les outils. N'invente aucun nombre, ne fais aucun calcul supplémentaire, ne reprends pas de chiffres d'exemples.",
    "Réponds en français, de façon naturelle et brève (3 à 6 lignes). Les montants sont en dinars tunisiens (TND).",
    "Tu peux AGIR dans l'application : `ouvrir_page` amène l'utilisateur sur un écran, `chercher_client` retrouve un client et ouvre sa fiche.",
    "Quand l'utilisateur demande à voir un écran, appelle `ouvrir_page`. Quand il nomme un client, appelle `chercher_client` avec ouvrir_fiche=true.",
    "Quand tu ouvres un écran ou une fiche, dis-le en une phrase (« Je vous ouvre le planning du jour. ») avec l'information utile.",
    "Si l'outil ne renvoie rien d'utile, dis-le simplement. Si la question sort de ton domaine, explique en une phrase ce que tu sais faire.",
    "N'affiche JAMAIS ton raisonnement, aucune réflexion en anglais, aucune balise <think> : commence directement par la réponse en français.",
    "Ta réponse est écrite ENTIÈREMENT en français : jamais un mot anglais, jamais une citation de ces consignes, jamais le nom d'un outil. Tu écris comme un collègue tunisien qui répond de vive voix.",
  ].join("\n");
}

export async function POST(req: NextRequest) {
  const auth = await requireSession();
  if (!auth.ok) return auth.res;
  // Données vivantes : une synchronisation part en arrière-plan si elles datent.
  void rafraichirOperationsSiPerime();

  const body = await req.json().catch(() => ({}));
  const question = String(body?.question ?? "").trim();
  if (!question) return NextResponse.json({ error: "Question vide" }, { status: 400 });

  const role = auth.user.role as Role;
  const ctx: Ctx = { role, nom: auth.user.name, codeTiers: (auth.user as { codeTiers?: number | null }).codeTiers ?? null };

  const q = question.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").trim();
  const dispo = sujets(role);

  // Politesses et présentation : répondre comme un interlocuteur, pas par un
  // menu d'aide — c'est ce qui donnait l'impression d'un robot borné.
  if (/^(merci|merci beaucoup|super|parfait|ok|d accord|bien|nickel|top)\b/.test(q)) {
    return NextResponse.json({ reponse: "Avec plaisir 😊 Autre chose ?", sujet: null });
  }
  if (/^(bonjour|bonsoir|salut|slm|salam|hello|coucou|ahla)\b/.test(q)) {
    return NextResponse.json({ reponse: `Bonjour ${auth.user.name.split(" ")[0]} ! ${AIDE[role]}`, sujet: null });
  }
  if (/qui es[- ]?tu|tu es qui|c est quoi|que sais[- ]?tu|que peux[- ]?tu|comment ca marche|\baide\b|help/.test(q)) {
    const exemples = SUGGESTIONS[role].map((x) => `• ${x}`).join("\n");
    return NextResponse.json({
      reponse: `Je suis l'assistant BIS. ${AIDE[role]}\n\nPar exemple :\n${exemples}\n\nJe comprends aussi « la liste », « en dinars », « le mois dernier », « plus de 3000 ».`,
      sujet: "aide",
    });
  }
  // Un montant ou un mot d'argent oriente vers les créances, même si la phrase
  // commence par « clients » (« clients avec solde > 3000 »).
  const versCreances = seuil(q) != null || /solde|creance|impaye|doit|dette|recouvr/.test(q);
  // Le sujet dont un mot-clé apparaît le plus tôt dans la question.
  let choisi: (typeof dispo)[number] | null = null;
  if (versCreances) {
    choisi = dispo.find((s2) => s2.cle === "creances") ?? null;
  }
  if (!choisi) {
    let position = Infinity;
    for (const s2 of dispo) {
      for (const mot of s2.mots) {
        const i = q.indexOf(mot.normalize("NFD").replace(/\p{Diacritic}/gu, ""));
        if (i >= 0 && i < position) { position = i; choisi = s2; }
      }
    }
  }

  // Question de suivi (« donne-moi la liste », « et le détail ? », « combien ? »)
  // : elle ne nomme aucun sujet, on reprend celui de la réponse précédente.
  // ── Voie principale : le modèle de langage ────────────────────────────────
  // Il comprend la question telle qu'elle est posée et appelle les outils
  // ci-dessus, qui restent la seule source de chiffres. En cas de panne ou de
  // dépassement de délai, on retombe sur le moteur local par mots-clés :
  // l'assistant répond toujours quelque chose d'utile.
  const historique = Array.isArray(body?.historique)
    ? (body.historique as { role: string; content: string }[])
        .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content.slice(0, 1500) }))
    : [];

  if (iaDisponible()) {
    try {
      const { reponse, outilsUtilises, navigation } = await repondreAvecIA(
        consigne(ctx), historique, question, outilsPour(ctx),
      );
      return NextResponse.json({
        reponse, sujet: outilsUtilises[0] ?? null, moteur: "ia",
        navigation: navigation ?? (await ficheDemandee(question, ctx)) ?? pageDemandee(question, ctx.role) ?? undefined,
      });
    } catch (e) {
      console.error("[assistant/ia]", e instanceof Error ? e.message : e);
      // on poursuit avec le moteur local
    }
  }

  const suivi: Suivi = (body?.suivi ?? {}) as Suivi;
  if (!choisi && suivi.sujet) {
    const precedent = dispo.find((s2) => s2.cle === suivi.sujet);
    // Toute question courte qui ne nomme aucun sujet prolonge le précédent :
    // « donne-moi la liste », « en dt », « et le détail ? », « combien ? ».
    const prolonge = /liste|detail|lesquel|plus|encore|combien|tout|autres?|oui|dinars?|\bdt\b|\btnd\b|valeur|valoris|montant|prix|total/.test(q)
      || q.split(/\s+/).length <= 4;
    if (precedent && prolonge) {
      const reponseSuivi = await precedent.f(ctx, `${q} liste`);
      return NextResponse.json({ reponse: reponseSuivi, sujet: precedent.cle, navigation: (await ficheDemandee(question, ctx)) ?? pageDemandee(question, ctx.role) ?? undefined });
    }
  }

  if (!choisi) {
    const exemples = SUGGESTIONS[role].map((s2) => `• ${s2}`).join("\n");
    return NextResponse.json({
      reponse: `${AIDE[role]}\n\nEssayez par exemple :\n${exemples}`,
      sujet: "aide",
    });
  }

  try {
    const reponse = await choisi.f(ctx, q);
    return NextResponse.json({ reponse, sujet: choisi.cle, navigation: (await ficheDemandee(question, ctx)) ?? pageDemandee(question, ctx.role) ?? undefined });
  } catch (e) {
    console.error("[assistant]", e instanceof Error ? e.message : e);
    return NextResponse.json({ reponse: "Je n'ai pas pu lire les données pour le moment. Réessayez dans un instant." });
  }
}
