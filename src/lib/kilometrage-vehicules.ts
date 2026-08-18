import prisma from "@/lib/prisma";

// Compteur kilométrique des véhicules, alimenté par les ordres de mission.
//
// Chaque tournée relève le compteur au départ et au retour (`kmDepart` /
// `kmArrive`). C'est la seule mesure réelle du parc : plutôt que de demander à
// l'exploitant de ressaisir un kilométrage sur la fiche véhicule, on le déduit
// des tournées. Les échéances d'entretien (vidange, courroie) deviennent alors
// automatiques.
//
// Les relevés saisis à la main comportent des fautes de frappe : un chiffre
// oublié fait reculer le compteur, un chiffre en trop le propulse à deux
// millions. On ne retient donc pas le maximum — qui serait toujours la pire
// aberration — mais le dernier relevé chronologique jugé plausible.

/**
 * Distance maximale admise pour une journée de tournée.
 *
 * Les tournées observées vont de 150 à 1 200 km ; au-delà de 2 000 km en un
 * jour il s'agit d'une erreur de saisie (relevés constatés à 268 773 km).
 */
export const KM_MAX_PAR_JOUR = 2000;

export type ReleveKm = {
  plaque: string;
  /** Compteur retenu, ou `null` si aucun relevé exploitable. */
  kilometrage: number | null;
  /** Date de la tournée d'où provient le relevé. */
  releveLe: Date | null;
  missionId: number | null;
  /** Relevés écartés parce qu'implausibles. */
  ignores: number;
};

type Tournee = {
  id: number;
  dateOrdre: Date | null;
  kmDepart: number;
  kmArrive: number;
};

/**
 * Dernier kilométrage crédible d'un véhicule d'après ses tournées.
 *
 * On ne peut pas se contenter de suivre la série depuis le début : une seule
 * valeur aberrante en tête (un compteur relevé à 2 040 010 km) rejetterait
 * ensuite toute la série honnête, jugée « en recul ». On part donc de la
 * tournée la plus récente et on remonte jusqu'à trouver un relevé *corroboré*
 * — c'est-à-dire enchaîné avec les tournées voisines, le retour de l'un étant
 * le départ de la suivante. Une faute de frappe est isolée ; une série
 * continue ne l'est pas.
 */
export function dernierReleveCredible(plaque: string, tournees: Tournee[]): ReleveKm {
  const ordonnees = [...tournees]
    .filter((t) => t.dateOrdre != null)
    .sort((a, b) => a.dateOrdre!.getTime() - b.dateOrdre!.getTime());

  const releves = ordonnees
    .map((t) => ({
      // `kmArrive` fait foi : c'est le compteur en fin de tournée. `kmDepart`
      // sert de recours quand le retour n'a pas été saisi.
      valeur: t.kmArrive > 0 ? t.kmArrive : t.kmDepart,
      depart: t.kmDepart,
      date: t.dateOrdre!,
      id: t.id,
    }))
    .filter((r) => r.valeur > 0);

  if (releves.length === 0) {
    return { plaque, kilometrage: null, releveLe: null, missionId: null, ignores: 0 };
  }

  /** Un relevé est corroboré si une tournée voisine le confirme. */
  const corrobore = (i: number): boolean => {
    const r = releves[i];
    const precedent = releves[i - 1];
    const suivant = releves[i + 1];
    // Le départ de la tournée suivante reprend le compteur de celle-ci.
    if (suivant && Math.abs(suivant.depart - r.valeur) <= 5) return true;
    // Ou la tournée précédente enchaîne sur celle-ci, à distance plausible.
    if (precedent) {
      const jours = Math.max(1, Math.round((r.date.getTime() - precedent.date.getTime()) / 86_400_000));
      const ecart = r.valeur - precedent.valeur;
      if (ecart >= 0 && ecart <= KM_MAX_PAR_JOUR * jours) return true;
    }
    // Relevé unique : rien ne le contredit, on l'accepte faute de mieux.
    return releves.length === 1;
  };

  for (let i = releves.length - 1; i >= 0; i--) {
    if (!corrobore(i)) continue;
    const r = releves[i];
    return {
      plaque, kilometrage: r.valeur, releveLe: r.date, missionId: r.id,
      ignores: releves.length - 1 - i,
    };
  }

  // Aucun relevé corroboré : on retient le plus récent, faute de mieux.
  const dernier = releves[releves.length - 1];
  return {
    plaque, kilometrage: dernier.valeur, releveLe: dernier.date,
    missionId: dernier.id, ignores: 0,
  };
}

/**
 * Recalcule le compteur de tous les véhicules de la flotte d'après les
 * tournées, et enregistre le résultat.
 *
 * @param appliquer `false` pour simuler sans écrire (contrôle avant reprise).
 */
export async function synchroniserKilometrages(appliquer = true): Promise<ReleveKm[]> {
  const vehicules = await prisma.vehicle.findMany({ select: { id: true, plate: true, kilometrage: true } });

  const releves: ReleveKm[] = [];
  for (const v of vehicules) {
    const tournees = await prisma.erpMission.findMany({
      where: {
        // Les matricules sont saisis à la main : la casse varie (`243tu7638`).
        vehicule: { equals: v.plate, mode: "insensitive" },
        OR: [{ kmArrive: { gt: 0 } }, { kmDepart: { gt: 0 } }],
      },
      orderBy: { dateOrdre: "asc" },
      select: { id: true, dateOrdre: true, kmDepart: true, kmArrive: true },
    });

    const releve = dernierReleveCredible(v.plate, tournees);
    releves.push(releve);

    // On n'écrase jamais un compteur par une valeur plus ancienne : la fiche
    // peut avoir été mise à jour à la main lors d'un entretien.
    if (
      appliquer && releve.kilometrage != null &&
      (v.kilometrage == null || releve.kilometrage > v.kilometrage)
    ) {
      await prisma.vehicle.update({
        where: { id: v.id }, data: { kilometrage: Math.round(releve.kilometrage) },
      });
    }
  }

  return releves;
}

/**
 * Met à jour le compteur d'un véhicule après la saisie d'une tournée.
 *
 * Appelé à la création et à la clôture d'un ordre de mission : c'est ce qui
 * rend les alertes d'entretien automatiques.
 *
 * @returns le compteur retenu, ou `null` si le relevé a été écarté.
 */
export async function appliquerReleveMission(
  plaque: string | null | undefined,
  kmArrive: number | null | undefined,
  kmDepart?: number | null,
): Promise<number | null> {
  const matricule = (plaque ?? "").trim();
  if (!matricule) return null;

  const releve = Number(kmArrive) > 0 ? Number(kmArrive) : Number(kmDepart);
  if (!Number.isFinite(releve) || releve <= 0) return null;

  const vehicule = await prisma.vehicle.findFirst({
    where: { plate: { equals: matricule, mode: "insensitive" } },
  });
  // Matricule absent de la flotte : la tournée reste valide, mais il n'y a
  // aucun compteur à tenir. Le rapprochement signale ces véhicules manquants.
  if (!vehicule) return null;

  // Relevé en retrait du compteur connu : saisie erronée, on ne régresse pas.
  if (vehicule.kilometrage != null && releve <= vehicule.kilometrage) return vehicule.kilometrage;

  // Bond invraisemblable depuis le dernier compteur connu : on refuse plutôt
  // que de déclencher à tort toutes les échéances kilométriques.
  if (vehicule.kilometrage != null && releve - vehicule.kilometrage > KM_MAX_PAR_JOUR * 30) {
    return vehicule.kilometrage;
  }

  const maj = await prisma.vehicle.update({
    where: { id: vehicule.id }, data: { kilometrage: Math.round(releve) },
  });
  return maj.kilometrage;
}

/**
 * Matricules cités par les tournées mais absents de la flotte : leurs
 * kilométrages ne peuvent être suivis et leurs entretiens échappent aux
 * alertes.
 */
export async function vehiculesNonReferences(): Promise<{ plaque: string; missions: number }[]> {
  const [flotte, parMatricule] = await Promise.all([
    prisma.vehicle.findMany({ select: { plate: true } }),
    prisma.erpMission.groupBy({ by: ["vehicule"], _count: { _all: true } }),
  ]);

  const connus = new Set(flotte.map((v) => v.plate.trim().toLowerCase()));
  return parMatricule
    .filter((m) => {
      const p = (m.vehicule ?? "").trim();
      return p !== "" && !connus.has(p.toLowerCase());
    })
    .map((m) => ({ plaque: (m.vehicule ?? "").trim(), missions: m._count._all }))
    .sort((a, b) => b.missions - a.missions);
}
