import prisma from "@/lib/prisma";

// Échéances du parc roulant : assurance, visite technique, vignette, et les
// opérations périodiques d'entretien (vidange, courroie…).
//
// L'ERP d'origine ne signalait une échéance que le jour même
// (`WHERE date_fin_assurance LIKE '<aujourd'hui>'`) : si personne n'ouvrait
// l'application ce jour-là, l'alerte était perdue et l'assurance expirait sans
// que personne ne le voie. On raisonne donc en fenêtre — on prévient à
// l'avance, et on continue de signaler tant que c'est en retard.

const JOUR = 86_400_000;

/** Seuils d'alerte, en jours avant l'échéance. */
export const PREAVIS = {
  /** Au-delà : rien à signaler. */
  suivi: 30,
  /** En deçà : urgent (bandeau rouge, notification quotidienne). */
  urgent: 7,
} as const;

export type Gravite = "expire" | "urgent" | "proche";

export type Echeance = {
  vehicleId: string;
  plaque: string;
  /** `assurance` | `visite` | `vignette` | `operation`. */
  nature: string;
  libelle: string;
  date: Date | null;
  /** Négatif = dépassé depuis N jours. */
  jours: number | null;
  /** Kilomètres restants avant l'opération, si elle est aussi kilométrique. */
  kmRestants: number | null;
  gravite: Gravite;
};

/** Jours calendaires entre aujourd'hui et `d` (négatif si dépassé). */
export function joursAvant(d: Date | null | undefined, maintenant = Date.now()): number | null {
  if (!d) return null;
  // On compare des jours entiers, pas des instants : une échéance « demain »
  // doit afficher 1 même si l'heure d'enregistrement est passée.
  const jour = new Date(d);
  jour.setHours(0, 0, 0, 0);
  const ref = new Date(maintenant);
  ref.setHours(0, 0, 0, 0);
  return Math.round((jour.getTime() - ref.getTime()) / JOUR);
}

function gravite(jours: number | null, kmRestants: number | null): Gravite {
  const depasse = (jours != null && jours < 0) || (kmRestants != null && kmRestants < 0);
  if (depasse) return "expire";
  const urgentParJours = jours != null && jours <= PREAVIS.urgent;
  // 500 km avant la vidange, c'est une semaine de tournée : même urgence.
  const urgentParKm = kmRestants != null && kmRestants <= 500;
  return urgentParJours || urgentParKm ? "urgent" : "proche";
}

/**
 * Toutes les échéances du parc dans la fenêtre de préavis, plus celles déjà
 * dépassées. Triées de la plus critique à la plus lointaine.
 *
 * @param fenetre Nombre de jours de préavis (défaut : `PREAVIS.suivi`).
 */
export async function echeancesAVenir(fenetre: number = PREAVIS.suivi): Promise<Echeance[]> {
  const maintenant = Date.now();
  const vehicules = await prisma.vehicle.findMany({
    include: { operations: { where: { actif: true } } },
  });

  const out: Echeance[] = [];

  for (const v of vehicules) {
    const administratives: { nature: string; libelle: string; date: Date | null }[] = [
      { nature: "assurance", libelle: "Assurance", date: v.insuranceExpiry },
      { nature: "visite", libelle: "Visite technique", date: v.controlExpiry },
      { nature: "vignette", libelle: "Vignette / taxe", date: v.taxExpiry },
    ];

    for (const a of administratives) {
      const jours = joursAvant(a.date, maintenant);
      if (jours == null || jours > fenetre) continue;
      out.push({
        vehicleId: v.id, plaque: v.plate, nature: a.nature, libelle: a.libelle,
        date: a.date, jours, kmRestants: null, gravite: gravite(jours, null),
      });
    }

    for (const op of v.operations) {
      const jours = joursAvant(op.prochaineDate, maintenant);
      // Une opération kilométrique n'est exigible que si le compteur du
      // véhicule est renseigné — sinon on ne sait rien de sa distance réelle.
      const kmRestants =
        op.prochainKm != null && v.kilometrage != null ? op.prochainKm - v.kilometrage : null;

      // Rien de connu sur cette opération : ni date ni compteur exploitable.
      if (jours == null && kmRestants == null) continue;
      // Encore loin sur les deux critères : on ne l'affiche pas.
      const loinEnJours = jours == null || jours > fenetre;
      const loinEnKm = kmRestants == null || kmRestants > 500;
      if (loinEnJours && loinEnKm) continue;

      out.push({
        vehicleId: v.id, plaque: v.plate, nature: "operation", libelle: op.libelle,
        date: op.prochaineDate, jours, kmRestants, gravite: gravite(jours, kmRestants),
      });
    }
  }

  const rang: Record<Gravite, number> = { expire: 0, urgent: 1, proche: 2 };
  return out.sort(
    (a, b) => rang[a.gravite] - rang[b.gravite] || (a.jours ?? 9999) - (b.jours ?? 9999),
  );
}

/** Message lisible pour une échéance — utilisé en notification et à l'écran. */
export function libelleEcheance(e: Echeance): string {
  const quand =
    e.jours == null ? ""
    : e.jours < 0 ? `dépassée depuis ${-e.jours} j`
    : e.jours === 0 ? "aujourd'hui"
    : e.jours === 1 ? "demain"
    : `dans ${e.jours} j`;
  const km =
    e.kmRestants == null ? ""
    : e.kmRestants < 0 ? `dépassement de ${-e.kmRestants} km`
    : `${e.kmRestants} km restants`;
  const details = [quand, km].filter(Boolean).join(" · ");
  return `${e.plaque} — ${e.libelle}${details ? ` : ${details}` : ""}`;
}

/**
 * Replanifie une opération après son exécution : la prochaine échéance repart
 * de la date et du compteur du jour, selon la périodicité configurée.
 */
export function prochaineEcheance(
  op: { intervalleKm: number | null; intervalleJours: number | null },
  faitLe: Date,
  kmActuel: number | null,
): { prochaineDate: Date | null; prochainKm: number | null } {
  const prochaineDate = op.intervalleJours
    ? new Date(faitLe.getTime() + op.intervalleJours * JOUR)
    : null;
  const prochainKm =
    op.intervalleKm != null && kmActuel != null ? kmActuel + op.intervalleKm : null;
  return { prochaineDate, prochainKm };
}

/**
 * Crée les notifications correspondant aux échéances du jour, sans doublon.
 *
 * Une même échéance ne doit pas re-notifier à chaque chargement de page : on
 * ne réémet que si rien n'a été posté pour ce véhicule et cette nature dans
 * les dernières 20 h — ce qui donne bien une alerte par jour, comme la
 * vérification quotidienne de 8 h de l'application d'origine, mais sans
 * dépendre du fait que quelqu'un soit connecté à cet instant précis.
 */
export async function notifierEcheances(userIds: string[]): Promise<number> {
  if (userIds.length === 0) return 0;

  const echeances = (await echeancesAVenir()).filter((e) => e.gravite !== "proche");
  if (echeances.length === 0) return 0;

  const depuis = new Date(Date.now() - 20 * 3600_000);
  const recentes = await prisma.notification.findMany({
    where: { type: "vehicule-echeance", createdAt: { gte: depuis }, userId: { in: userIds } },
    select: { userId: true, title: true },
  });
  const dejaVu = new Set(recentes.map((n) => `${n.userId}|${n.title}`));

  const aCreer = [];
  for (const e of echeances) {
    const title = `${e.plaque} — ${e.libelle}`;
    for (const userId of userIds) {
      if (dejaVu.has(`${userId}|${title}`)) continue;
      aCreer.push({
        userId, title, type: "vehicule-echeance",
        message: libelleEcheance(e),
      });
    }
  }

  if (aCreer.length === 0) return 0;
  const res = await prisma.notification.createMany({ data: aCreer });
  return res.count;
}
