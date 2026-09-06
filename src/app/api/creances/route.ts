import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { round3 } from "@/lib/vente-stats";
import { filtrePortefeuille } from "@/lib/perimetre-commercial";

// Détail des créances clients et de la trésorerie — ouvert depuis la carte
// « Créances clients » du tableau de bord.
//
// GET /api/creances?axe=anciennete|commercial|client|tresorerie[&cible=…]
//
// La question de l'exploitant n'est pas « combien me doit-on ? » (le montant
// est déjà sur la carte) mais « qui, depuis quand, et est-ce récupérable ? ».
// L'axe « ancienneté » y répond directement : une créance de plus de 90 jours
// ne se recouvre pas comme une facture du mois.

/** Tranches d'ancienneté, en jours. Bornes usuelles du recouvrement. */
const TRANCHES = [
  { cle: "0-30", libelle: "Moins de 30 jours", min: 0, max: 30 },
  { cle: "31-60", libelle: "31 à 60 jours", min: 31, max: 60 },
  { cle: "61-90", libelle: "61 à 90 jours", min: 61, max: 90 },
  { cle: "91-180", libelle: "91 à 180 jours", min: 91, max: 180 },
  { cle: "180+", libelle: "Plus de 180 jours", min: 181, max: Number.POSITIVE_INFINITY },
] as const;

const JOUR = 86_400_000;

export async function GET(req: NextRequest) {
  // La production sert cet écran au commercial (`etatImpayerParClient` de
  // l'application mobile) : c'est son outil de relance sur tournée. Il n'y voit
  // que son propre portefeuille.
  const auth = await requireSession(["ADMIN", "MANAGER", "COMMERCIAL"]);
  if (!auth.ok) return auth.res;

  const perimetre = filtrePortefeuille({ role: auth.user.role, name: auth.user.name });

  const sp = req.nextUrl.searchParams;
  const axe = sp.get("axe") ?? "anciennete";
  const cible = (sp.get("cible") ?? "").trim();

  // Trésorerie : mouvements encaissés, pas les créances. Axe distinct car il
  // répond à « d'où vient l'argent ? » et non « qui me doit ? ».
  if (axe === "tresorerie") {
    // Cet axe agrège les encaissements et décaissements de toute la société,
    // sans notion de portefeuille : le `perimetre` calculé plus haut ne lui
    // était pas appliqué. Réservé au pilotage — le commercial garde l'axe des
    // créances, lui bien cloisonné.
    if (auth.user.role === "COMMERCIAL") {
      return NextResponse.json({ error: "Réservé au pilotage" }, { status: 403 });
    }
    const [parMode, parMois] = await Promise.all([
      prisma.erpReglement.groupBy({
        by: ["modePay", "sens"],
        _sum: { montant: true },
        _count: { _all: true },
      }),
      prisma.erpReglement.findMany({
        where: { datePay: { not: null } },
        select: { datePay: true, montant: true, sens: true },
      }),
    ]);

    const modes = parMode.map((m) => ({
      libelle: `${m.modePay ?? "—"} · ${m.sens === "C" ? "encaissement" : "décaissement"}`,
      mode: m.modePay ?? "—",
      sens: m.sens,
      nb: m._count._all,
      montant: round3(m._sum.montant ?? 0),
    })).sort((a, b) => b.montant - a.montant);

    // Évolution mensuelle : c'est la tendance qui alerte, pas le solde brut.
    const parMoisMap = new Map<string, { encaisse: number; decaisse: number }>();
    for (const r of parMois) {
      const k = r.datePay!.toISOString().slice(0, 7);
      const e = parMoisMap.get(k) ?? { encaisse: 0, decaisse: 0 };
      if (r.sens === "C") e.encaisse += r.montant; else e.decaisse += r.montant;
      parMoisMap.set(k, e);
    }
    const mois = [...parMoisMap.entries()]
      .map(([k, v]) => ({
        libelle: k, nb: 0,
        encaisse: round3(v.encaisse), decaisse: round3(v.decaisse),
        montant: round3(v.encaisse - v.decaisse),
      }))
      .sort((a, b) => a.libelle.localeCompare(b.libelle))
      .slice(-18);

    const encaisse = round3(modes.filter((m) => m.sens === "C").reduce((s, m) => s + m.montant, 0));
    const decaisse = round3(modes.filter((m) => m.sens === "F").reduce((s, m) => s + m.montant, 0));

    return NextResponse.json({
      axe, niveau: "groupes", rows: modes, mois,
      totaux: { nb: modes.reduce((s, m) => s + m.nb, 0), montant: round3(encaisse - decaisse), encaisse, decaisse },
    });
  }

  // Documents de vente non soldés : la créance réelle, pièce par pièce.
  const impayes = await prisma.erpDocument.findMany({
    where: { nature: "Vente", soldeDoc: { gt: 0 }, ...(perimetre ?? {}) },
    select: {
      refDoc: true, typeDoc: true, dateDoc: true, raisonSocial: true,
      codeCli: true, soldeDoc: true, ttcNet: true, commercial: true,
    },
  });

  // `ErpDocument.commercial` n'a jamais été alimenté par l'import (0 document
  // sur 4 574). Le commercial se retrouve via la fiche client, qui elle est
  // renseignée : sans ce rapprochement, l'axe « par commercial » n'afficherait
  // qu'une seule ligne « Sans commercial ».
  const codesClients = [...new Set(impayes.map((d) => d.codeCli).filter((c): c is number => c != null))];
  const fiches = codesClients.length
    ? await prisma.partner.findMany({
        where: { id: { in: codesClients } },
        select: { id: true, commercial: true },
      })
    : [];
  const commercialDuClient = new Map(fiches.map((f) => [f.id, (f.commercial ?? "").trim()]));
  const commercialDe = (d: { commercial: string | null; codeCli: number | null }) =>
    (d.commercial ?? "").trim() || (d.codeCli != null ? commercialDuClient.get(d.codeCli) ?? "" : "");

  const maintenant = Date.now();
  const age = (d: Date | null) => (d ? Math.floor((maintenant - d.getTime()) / JOUR) : null);

  // Détail d'une tranche / d'un commercial : on descend aux documents.
  if (cible) {
    const dans = impayes.filter((d) => {
      if (axe === "anciennete") {
        const t = TRANCHES.find((x) => x.cle === cible);
        if (!t) return false;
        const j = age(d.dateDoc);
        return j != null && j >= t.min && j <= t.max;
      }
      if (axe === "commercial") return (commercialDe(d) || "—") === cible;
      return String(d.codeCli ?? "") === cible;
    });

    return NextResponse.json({
      axe, niveau: "documents", cible,
      rows: dans
        .map((d) => ({
          refDoc: d.refDoc, typeDoc: d.typeDoc, dateDoc: d.dateDoc,
          libelle: d.raisonSocial ?? `Client ${d.codeCli ?? "?"}`,
          montant: round3(d.soldeDoc),
          jours: age(d.dateDoc),
        }))
        .sort((a, b) => (b.jours ?? 0) - (a.jours ?? 0)),
      totaux: { nb: dans.length, montant: round3(dans.reduce((s, d) => s + d.soldeDoc, 0)) },
    });
  }

  // Regroupement de premier niveau.
  const groupes = new Map<string, { libelle: string; cle: string; nb: number; montant: number }>();
  const ajouter = (cle: string, libelle: string, montant: number) => {
    const g = groupes.get(cle) ?? { cle, libelle, nb: 0, montant: 0 };
    g.nb += 1; g.montant += montant;
    groupes.set(cle, g);
  };

  for (const d of impayes) {
    if (axe === "anciennete") {
      const j = age(d.dateDoc);
      // Une pièce sans date ne peut pas être classée par ancienneté : la
      // ranger arbitrairement fausserait la lecture du recouvrement.
      const t = j == null ? null : TRANCHES.find((x) => j >= x.min && j <= x.max);
      ajouter(t?.cle ?? "sans-date", t?.libelle ?? "Sans date", d.soldeDoc);
    } else if (axe === "commercial") {
      const c = commercialDe(d) || "—";
      ajouter(c, c === "—" ? "Sans commercial" : c, d.soldeDoc);
    } else {
      const c = String(d.codeCli ?? "");
      ajouter(c, d.raisonSocial ?? `Client ${c || "?"}`, d.soldeDoc);
    }
  }

  const rows = [...groupes.values()]
    .map((g) => ({ ...g, montant: round3(g.montant) }))
    .sort((a, b) =>
      // L'ancienneté garde son ordre naturel ; les autres axes se lisent du
      // plus gros débiteur au plus petit.
      axe === "anciennete"
        ? TRANCHES.findIndex((t) => t.cle === a.cle) - TRANCHES.findIndex((t) => t.cle === b.cle)
        : b.montant - a.montant,
    )
    .slice(0, axe === "client" ? 60 : 40);

  return NextResponse.json({
    axe, niveau: "groupes", rows,
    totaux: {
      nb: impayes.length,
      montant: round3(impayes.reduce((s, d) => s + d.soldeDoc, 0)),
    },
  });
}
