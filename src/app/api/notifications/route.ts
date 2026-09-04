import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { round3 } from "@/lib/vente-stats";
import { echeancesAVenir, libelleEcheance } from "@/lib/echeances-vehicules";
import { filtrePortefeuille, emplacementVehicule } from "@/lib/perimetre-commercial";

// Notifications de la barre supérieure.
//
// GET  /api/notifications        -> notifications de l'utilisateur + alertes système
// POST /api/notifications        { ids?: string[] }  -> marque comme lues
//                                (sans `ids`, marque tout comme lu)
//
// Deux sources sont fusionnées :
//   - les notifications persistées (modèle `Notification`), adressées à un
//     utilisateur et dont l'état lu/non-lu est conservé ;
//   - des alertes calculées en direct sur l'état de la base (stock, impayés),
//     qui n'ont pas vocation à être stockées puisqu'elles se recalculent.

type Notif = {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: Date;
  /** `db` = persistée et marquable comme lue ; `systeme` = recalculée. */
  source: "db" | "systeme";
};

/** Icône et couleur d'affichage selon le type de notification. */
const STYLE: Record<string, { icon: string; color: string }> = {
  STOCK: { icon: "📦", color: "bg-amber-50 text-amber-600 border border-amber-100" },
  FINANCE: { icon: "💰", color: "bg-red-50 text-red-600 border border-red-100" },
  RECOUVREMENT: { icon: "⏰", color: "bg-red-50 text-red-600 border border-red-100" },
  VALIDATION: { icon: "📝", color: "bg-blue-50 text-blue-600 border border-blue-100" },
  PERF: { icon: "🏆", color: "bg-emerald-50 text-emerald-700 border border-emerald-100" },
  GPS: { icon: "🚗", color: "bg-blue-50 text-blue-600 border border-blue-100" },
  VEHICULE: { icon: "🔧", color: "bg-orange-50 text-orange-600 border border-orange-100" },
  VEHICULE_EXPIRE: { icon: "🚨", color: "bg-red-50 text-red-600 border border-red-100" },
};
const STYLE_DEFAUT = { icon: "🔔", color: "bg-slate-50 text-slate-600 border border-slate-100" };

/**
 * Écran qui permet de traiter l'alerte.
 *
 * Une notification qui ne mène nulle part oblige à retrouver l'écran soi-même :
 * on rattache donc chaque type à la page où l'on agit réellement.
 */
const LIEN: Record<string, string> = {
  STOCK: "/admin/modules/stock/etat-stock",
  RECOUVREMENT: "/admin/modules/tresorerie/reglements-clients",
  FINANCE: "/admin/modules/tresorerie/cockpit",
  VALIDATION: "/admin/modules/vente/documents",
  GPS: "/admin/missions",
  VEHICULE: "/admin/modules/parc-roulant/entretien",
  VEHICULE_EXPIRE: "/admin/modules/parc-roulant/entretien",
};

/**
 * Empreinte d'une alerte système : deux alertes de même clé mais de contenu
 * différent (montant qui bouge, échéance qui approche) doivent réapparaître
 * après acquittement. Le message suffit à les distinguer.
 */
const empreinteDe = (n: { id: string; message: string }) => `${n.id}|${n.message}`;

/** Emplacement de référence pour la rupture des non-commerciaux. */
const DEPOT_PRINCIPAL = "Dépôt principale";

export async function GET() {
  const auth = await requireSession();
  if (!auth.ok) return auth.res;

  // Chaque rôle a son périmètre : un commercial recevait « 5 006 documents à
  // valider » et les visites techniques de véhicules qui ne sont pas le sien —
  // des alertes d'administration sur lesquelles il ne peut rien.
  const role = auth.user.role;
  const estCommercial = role === "COMMERCIAL";
  const estClient = role === "CLIENT";
  const pilote = role === "ADMIN" || role === "MANAGER";

  // Portefeuille du commercial : ses impayés sont ceux de ses propres clients.
  const perimetre = filtrePortefeuille({ role, name: auth.user.name });

  // Un client ne voit que ce qui le concerne : ses propres documents impayés.
  // Seules les ventes (ticket, BL, facture) font une créance : une commande
  // ou un bon de chargement (COM/CMI) avec un solde n'est pas un impayé.
  const baseImpayes = { nature: "Vente", typeDoc: { in: ["TIC", "BL", "FC"] }, soldeDoc: { gt: 0 } };
  const filtreImpayes = estClient
    ? { ...baseImpayes, codeCli: auth.user.codeTiers ?? -1 }
    : perimetre
      ? { ...baseImpayes, ...perimetre }
      : baseImpayes;

  // Le stock qui compte pour un commercial est celui de son camion ; pour les
  // autres, la rupture au catalogue.
  const emplacement = estCommercial
    ? await emplacementVehicule(auth.user.name, null)
    : null;

  const [persistees, ruptures, impayes, docsNonValides] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: auth.user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    // Rupture : le camion du commercial, le catalogue pour les autres.
    estClient
      ? Promise.resolve(0)
      : prisma.stockDepot.count({
          // Stock négatif = vente à découvert : la seule vraie anomalie. Un
          // camion ne porte qu'une fraction du catalogue, donc « tout ce qui
          // est à zéro » y remonterait 500+ articles jamais chargés et noierait
          // le signal. On alerte donc sur le stock passé sous zéro.
          // (`article.enStock` est une valeur héritée figée, pas le stock réel.)
          where: { emplacement: emplacement ?? DEPOT_PRINCIPAL, quantite: { lt: 0 } },
        }),
    prisma.erpDocument.findMany({
      where: filtreImpayes,
      orderBy: { dateDoc: "asc" },
      select: { refDoc: true, raisonSocial: true, soldeDoc: true, dateDoc: true },
      take: 3,
    }),
    // La validation des documents relève de l'administration : un commercial ne
    // valide pas, un client encore moins.
    pilote
      ? prisma.erpDocument.count({ where: { nature: "Vente", valide: false } })
      : Promise.resolve(0),
  ]);

  // Échéances du parc roulant : assurance, visite, vignette et entretiens
  // périodiques. Un véhicule sans assurance valide ne doit pas rouler, l'alerte
  // reste donc affichée tant que la situation n'est pas régularisée.
  //
  // Un commercial ne voit que son propre véhicule — les autres ne le regardent
  // pas ; un client n'a pas de parc roulant.
  const toutesEcheances = estClient ? [] : await echeancesAVenir();
  const plaqueSienne = estCommercial
    ? (await prisma.commercial.findFirst({
        where: { userId: auth.user.id },
        select: { vehicle: { select: { plate: true } } },
      }))?.vehicle?.plate?.trim().toUpperCase() ?? null
    : null;
  const echeances = toutesEcheances
    .filter((e) => e.gravite !== "proche")
    .filter((e) => !estCommercial || (plaqueSienne && e.plaque.trim().toUpperCase() === plaqueSienne));

  const notifs: Notif[] = persistees.map((n) => ({
    // Les alertes recalculées portent un identifiant textuel (`sys-ruptures`) :
    // l'identifiant numérique de la base est donc rendu sous forme de texte.
    id: String(n.id),
    title: n.title,
    message: n.message,
    type: n.type,
    isRead: n.isRead,
    createdAt: n.createdAt,
    source: "db",
  }));

  const maintenant = new Date();

  // Alertes système — recalculées à chaque appel, jamais stockées.
  if (ruptures > 0) {
    notifs.push({
      id: "sys-ruptures",
      title: emplacement ? "Stock négatif dans votre camion" : "Stock négatif au dépôt",
      message: emplacement
        ? `${ruptures} référence(s) en négatif dans ${emplacement} (vendues à découvert)`
        : `${ruptures} article(s) en stock négatif au dépôt principal`,
      type: "STOCK",
      isRead: false,
      createdAt: maintenant,
      source: "systeme",
    });
  }

  for (const d of impayes) {
    const jours = d.dateDoc
      ? Math.floor((maintenant.getTime() - d.dateDoc.getTime()) / 86400000)
      : 0;
    if (jours < 90) continue;
    notifs.push({
      id: `sys-impaye-${d.refDoc}`,
      title: "Impayé ancien",
      message: `${d.refDoc} — ${d.raisonSocial || "client inconnu"} · ${round3(d.soldeDoc)} TND dus depuis ${jours} j`,
      type: "RECOUVREMENT",
      isRead: false,
      createdAt: d.dateDoc ?? maintenant,
      source: "systeme",
    });
  }

  for (const e of echeances) {
    notifs.push({
      id: `sys-vehicule-${e.vehicleId}-${e.nature}-${e.libelle}`,
      title: e.gravite === "expire" ? `${e.plaque} — ${e.libelle} expirée` : `${e.plaque} — ${e.libelle}`,
      message: libelleEcheance(e),
      type: e.gravite === "expire" ? "VEHICULE_EXPIRE" : "VEHICULE",
      isRead: false,
      // Datée de l'échéance : une assurance expirée depuis un mois remonte
      // naturellement en tête de liste, avant les alertes du jour.
      createdAt: e.date ?? maintenant,
      source: "systeme",
    });
  }

  if (docsNonValides > 0) {
    notifs.push({
      id: "sys-validation",
      title: "Documents à valider",
      message: `${docsNonValides} document(s) de vente en attente de validation`,
      type: "VALIDATION",
      isRead: false,
      createdAt: maintenant,
      source: "systeme",
    });
  }

  // Retrait des alertes système déjà acquittées par cet utilisateur, tant que
  // leur contenu n'a pas changé.
  const acquits = await prisma.alerteAcquittee.findMany({ where: { userId: auth.user.id } });
  const parCle = new Map(acquits.map((a) => [a.cle, a.empreinte]));
  const visibles = notifs.filter(
    (n) => n.source !== "systeme" || parCle.get(n.id) !== empreinteDe(n),
  );

  visibles.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const rows = visibles.map((n) => {
    const style = STYLE[n.type] ?? STYLE_DEFAUT;
    return {
      ...n, icon: style.icon, color: style.color,
      lien: LIEN[n.type] ?? null,
      // Renvoyée telle quelle par le client à l'acquittement.
      empreinte: n.source === "systeme" ? empreinteDe(n) : null,
    };
  });

  return NextResponse.json({
    rows,
    total: rows.length,
    nonLues: rows.filter((n) => !n.isRead).length,
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireSession();
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => ({}));
  const ids: unknown = body?.ids;

  // Seules les notifications persistées de l'utilisateur courant sont
  // marquables ; les alertes système se recalculent et sont ignorées ici.
  const where =
    Array.isArray(ids) && ids.length
      ? {
          userId: auth.user.id,
          // Seules les notifications persistées sont marquables : les alertes
          // système (`sys-…`) n'ont pas d'identifiant numérique.
          id: { in: ids.map((i) => Number(i)).filter((i) => Number.isFinite(i)) },
        }
      : { userId: auth.user.id };

  const { count } = await prisma.notification.updateMany({ where, data: { isRead: true } });

  // Les alertes système n'existent pas en base : on les acquitte séparément,
  // en mémorisant leur empreinte pour qu'elles reviennent si elles évoluent.
  const systeme: unknown = body?.systeme;
  let acquittees = 0;
  if (Array.isArray(systeme) && systeme.length > 0) {
    for (const a of systeme) {
      const cle = String((a as { id?: unknown })?.id ?? "").trim();
      const empreinte = String((a as { empreinte?: unknown })?.empreinte ?? "").trim();
      if (!cle) continue;
      await prisma.alerteAcquittee.upsert({
        where: { userId_cle: { userId: auth.user.id, cle } },
        create: { userId: auth.user.id, cle, empreinte },
        update: { empreinte, acquitteA: new Date() },
      });
      acquittees++;
    }
  }

  return NextResponse.json({ ok: true, count, acquittees });
}
