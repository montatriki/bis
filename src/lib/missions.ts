import prisma from "@/lib/prisma";
import { round3, signeCA, TYPES_VENTE, TYPES_RETOUR } from "@/lib/vente-stats";
import { appliquerReleveMission } from "@/lib/kilometrage-vehicules";

// Tournées de vente ambulante (van sales) — reprend `ordre_mission`,
// `ligne_mission` et `reclamation_client` de l'ERP source.
//
// Le cœur du module est le lien `dayID` : chaque document et chaque règlement
// est rattaché à la tournée qui l'a produit. C'est ce qui permet, en fin de
// journée, de répondre à la seule question qui compte pour un commercial
// ambulant : **combien doit-il rendre, et le stock du camion est-il juste ?**
//
// `getMouvementsCommercial` dans A répond à cette question par sept requêtes
// SQL séparées, sans jamais recouper les chiffres. On centralise ici la
// réconciliation, avec le contrôle que A n'a pas.

export type LigneVisite = {
  codeCli: number | null;
  /** Optionnel : relu du référentiel dès que `codeCli` est fourni. */
  clientNom?: string | null;
  motif?: string | null;
  objectif?: number;
  heurePrevue?: string | null;
  numOrdre?: number;
};

export type ResultatTournee = {
  ok: boolean;
  message: string;
  dayId?: number;
  lignes?: number;
  /** Compteur du véhicule après prise en compte du relevé de la tournée. */
  kilometrage?: number | null;
};

/** États d'une visite, dans l'ordre du déroulé d'une tournée. */
export const ETATS_VISITE = ["À visiter", "Visité", "Reporté", "Absent"] as const;
export const ETATS_MISSION = ["Planifiée", "En cours", "Clôturée", "Annulée"] as const;

/**
 * Une tournée est-elle clôturée ? Les 2 500 tournées importées portent
 * l'orthographe de l'ERP source (« Cloturé », sans accent ni accord) là où
 * l'application écrit « Clôturée ». Comparer la chaîne exacte laisserait donc
 * l'historique modifiable par erreur.
 */
export const estCloturee = (etat?: string | null) => /^cl[oô]tur/i.test((etat ?? "").trim());

/**
 * Crée une tournée et son planning de visites.
 *
 * `ErpMission.id` n'est pas auto-incrémenté (il reprend `id_day` de A, importé
 * tel quel) : on calcule donc le prochain identifiant. Une boucle courte
 * absorbe les collisions en cas de création simultanée.
 */
export async function creerTournee(
  data: {
    commercial: string;
    vehicule?: string | null;
    dateOrdre: Date;
    utilisateur?: string | null;
    objectifCA?: number;
    kmDepart?: number;
    /** Bornes de la tournée : date de départ et date de retour. */
    du?: Date | null;
    au?: Date | null;
  },
  visites: LigneVisite[] = []
): Promise<ResultatTournee> {
  const commercial = String(data.commercial ?? "").trim();
  if (!commercial) return { ok: false, message: "Commercial requis" };
  if (!data.dateOrdre || Number.isNaN(data.dateOrdre.getTime())) {
    return { ok: false, message: "Date de tournée invalide" };
  }

  // Bornes de la tournée. `dateOrdre` reste la date de référence (unicité par
  // jour, rattachement des ventes) ; `du`/`au` décrivent une tournée qui peut
  // s'étendre sur plusieurs jours.
  const du = data.du ?? data.dateOrdre;
  const au = data.au ?? du;
  if (Number.isNaN(du.getTime()) || Number.isNaN(au.getTime())) {
    return { ok: false, message: "Dates de départ ou de retour invalides" };
  }
  if (au < du) {
    return { ok: false, message: "La date de retour ne peut pas précéder la date de départ" };
  }

  // Une seule tournée par commercial et par jour : deux tournées le même jour
  // rendraient la réconciliation ambiguë (à laquelle rattacher une vente ?).
  const jour = new Date(data.dateOrdre);
  jour.setHours(0, 0, 0, 0);
  const lendemain = new Date(jour.getTime() + 86_400_000);

  const existante = await prisma.erpMission.findFirst({
    where: {
      commercial,
      dateOrdre: { gte: jour, lt: lendemain },
      etat: { notIn: ["Annulée"] },
    },
    select: { id: true },
  });
  if (existante) {
    return {
      ok: false,
      message: `Une tournée existe déjà pour ${commercial} à cette date (n° ${existante.id})`,
    };
  }

  // Les noms de clients sont relus du référentiel, jamais recopiés du formulaire.
  const codes = visites.map((v) => v.codeCli).filter((c): c is number => c != null);
  const tiers = codes.length
    ? await prisma.partner.findMany({
        where: { id: { in: codes } },
        select: { id: true, raisonSocial: true },
      })
    : [];
  const parCode = new Map(tiers.map((t) => [t.id, t.raisonSocial]));

  const dernier = await prisma.erpMission.findFirst({ orderBy: { id: "desc" }, select: { id: true } });
  let id = (dernier?.id ?? 0) + 1;

  for (let essai = 0; essai < 5; essai++) {
    try {
      await prisma.erpMission.create({
        data: {
          id,
          commercial,
          vehicule: data.vehicule?.trim() || null,
          dateOrdre: data.dateOrdre,
          utilisateur: data.utilisateur ?? null,
          objectifCA: round3(data.objectifCA ?? 0),
          kmDepart: data.kmDepart ?? 0,
          etat: "Planifiée",
          du,
          au,
          lignes: {
            create: visites.map((v, i) => ({
              codeCli: v.codeCli ?? null,
              clientNom: v.codeCli != null ? (parCode.get(v.codeCli) ?? v.clientNom ?? null) : (v.clientNom ?? null),
              motif: v.motif ?? null,
              objectif: round3(v.objectif ?? 0),
              heurePrevue: v.heurePrevue ?? null,
              numOrdre: v.numOrdre ?? i + 1,
              etat: "À visiter",
            })),
          },
        },
      });
      // Le relevé de départ vaut déjà compteur : une tournée peut être créée
      // longtemps avant d'être clôturée, et le kilométrage doit être connu
      // sans attendre la fin de la journée.
      const compteur = await appliquerReleveMission(data.vehicule, null, data.kmDepart);

      return {
        ok: true,
        dayId: id,
        lignes: visites.length,
        kilometrage: compteur,
        message: `Tournée n° ${id} créée pour ${commercial} — ${visites.length} visite(s) planifiée(s)`,
      };
    } catch {
      // Identifiant pris entre-temps : on avance.
      id += 1;
    }
  }
  return { ok: false, message: "Impossible d'attribuer un numéro de tournée" };
}

export type ReconciliationTournee = {
  mission: {
    id: number; commercial: string | null; vehicule: string | null;
    dateOrdre: Date | null; etat: string | null; objectifCA: number;
    kmDepart: number; kmArrive: number;
  };
  visites: {
    total: number; visitees: number; reportees: number; absentes: number; restantes: number;
    tauxRealisation: number;
  };
  ventes: { nb: number; montant: number };
  retours: { nb: number; montant: number };
  caNet: number;
  /** Réalisation de l'objectif de la tournée, ou null si aucun objectif fixé. */
  tauxObjectif: number | null;
  encaissements: { nb: number; montant: number; parMode: { mode: string; nb: number; montant: number }[] };
  /** Ce qui a été vendu mais pas encaissé : le crédit accordé pendant la tournée. */
  resteAEncaisser: number;
  /** Espèces collectées — ce que le commercial doit physiquement rendre. */
  especes: number;
  kmParcourus: number | null;
  reclamations: number;
  alertes: string[];
};

/**
 * Réconcilie une tournée : ventes, retours, encaissements, visites.
 *
 * `CA net = Σ(ventes) − Σ(retours)`, la règle centrale de `vente-stats.ts`.
 * Le « reste à encaisser » est la différence entre le CA net et ce qui a été
 * réellement collecté : c'est le crédit accordé sur la journée, l'information
 * que A ne calculait nulle part.
 */
export async function reconcilierTournee(dayId: number): Promise<ReconciliationTournee | null> {
  const mission = await prisma.erpMission.findUnique({
    where: { id: dayId },
    include: { lignes: { orderBy: [{ numOrdre: "asc" }, { id: "asc" }] } },
  });
  if (!mission) return null;

  const [documents, reglements, nbReclam] = await Promise.all([
    prisma.erpDocument.findMany({
      where: { dayId },
      select: { refDoc: true, typeDoc: true, ttcNet: true, totalRegle: true, soldeDoc: true },
    }),
    prisma.erpReglement.findMany({
      where: { dayId },
      select: { id: true, montant: true, modePay: true },
    }),
    prisma.reclamation.count({ where: { dayId } }),
  ]);

  const alertes: string[] = [];

  const ventes = documents.filter((d) => (TYPES_VENTE as readonly string[]).includes(String(d.typeDoc ?? "").toUpperCase()));
  const retours = documents.filter((d) => (TYPES_RETOUR as readonly string[]).includes(String(d.typeDoc ?? "").toUpperCase()));
  const horsRegle = documents.filter((d) => signeCA(d.typeDoc) === 0);
  if (horsRegle.length > 0) {
    alertes.push(`${horsRegle.length} document(s) hors règle de CA (ni vente ni retour) — non comptés`);
  }

  const montantVentes = round3(ventes.reduce((t, d) => t + (d.ttcNet ?? 0), 0));
  const montantRetours = round3(retours.reduce((t, d) => t + (d.ttcNet ?? 0), 0));
  const caNet = round3(montantVentes - montantRetours);

  const montantEncaisse = round3(reglements.reduce((t, r) => t + (r.montant ?? 0), 0));

  const parModeMap = new Map<string, { nb: number; montant: number }>();
  for (const r of reglements) {
    const mode = (r.modePay ?? "Non précisé").trim() || "Non précisé";
    const prev = parModeMap.get(mode) ?? { nb: 0, montant: 0 };
    prev.nb += 1;
    prev.montant = round3(prev.montant + (r.montant ?? 0));
    parModeMap.set(mode, prev);
  }
  // Les espèces sont ce que le commercial rapporte physiquement : on les isole.
  const especes = round3(
    [...parModeMap.entries()]
      .filter(([m]) => /esp|cash|liquide/i.test(m))
      .reduce((t, [, v]) => t + v.montant, 0)
  );

  const visitees = mission.lignes.filter((l) => l.etat === "Visité").length;
  const reportees = mission.lignes.filter((l) => l.etat === "Reporté").length;
  const absentes = mission.lignes.filter((l) => l.etat === "Absent").length;
  const total = mission.lignes.length;

  const resteAEncaisser = round3(caNet - montantEncaisse);
  if (resteAEncaisser < -0.001) {
    // Encaisser plus que le CA du jour est normal (recouvrement d'anciennes
    // créances) — on le signale pour que le chiffre ne surprenne pas.
    alertes.push(
      `Encaissements supérieurs au CA du jour de ${round3(-resteAEncaisser)} — recouvrement d'anciennes créances`
    );
  }

  const kmParcourus =
    mission.kmArrive > 0 && mission.kmDepart > 0 ? round3(mission.kmArrive - mission.kmDepart) : null;
  if (kmParcourus != null && kmParcourus < 0) {
    alertes.push("Kilométrage d'arrivée inférieur au départ — saisie à vérifier");
  }

  return {
    mission: {
      id: mission.id, commercial: mission.commercial, vehicule: mission.vehicule,
      dateOrdre: mission.dateOrdre, etat: mission.etat, objectifCA: mission.objectifCA,
      kmDepart: mission.kmDepart, kmArrive: mission.kmArrive,
    },
    visites: {
      total, visitees, reportees, absentes,
      restantes: total - visitees - reportees - absentes,
      tauxRealisation: total > 0 ? round3((visitees / total) * 100) : 0,
    },
    ventes: { nb: ventes.length, montant: montantVentes },
    retours: { nb: retours.length, montant: montantRetours },
    caNet,
    tauxObjectif: mission.objectifCA > 0 ? round3((caNet / mission.objectifCA) * 100) : null,
    encaissements: {
      nb: reglements.length,
      montant: montantEncaisse,
      parMode: [...parModeMap.entries()]
        .map(([mode, v]) => ({ mode, nb: v.nb, montant: v.montant }))
        .sort((a, b) => b.montant - a.montant),
    },
    resteAEncaisser,
    especes,
    kmParcourus,
    reclamations: nbReclam,
    alertes,
  };
}

/**
 * Clôture une tournée.
 *
 * Refusée s'il reste des visites non traitées : une tournée clôturée avec des
 * clients « à visiter » laisse un planning faux, et le taux de réalisation
 * deviendrait ininterprétable. `forcer` permet au manager de passer outre en
 * marquant le reste comme reporté — un choix explicite, pas un effet de bord.
 */
export async function cloturerTournee(
  dayId: number,
  options: { kmArrive?: number; forcer?: boolean } = {}
): Promise<ResultatTournee & { reportees?: number; kilometrage?: number | null }> {
  const mission = await prisma.erpMission.findUnique({
    where: { id: dayId },
    include: { lignes: { select: { id: true, etat: true } } },
  });
  if (!mission) return { ok: false, message: "Tournée introuvable" };
  if (estCloturee(mission.etat)) {
    return { ok: false, message: `La tournée n° ${dayId} est déjà clôturée` };
  }

  const restantes = mission.lignes.filter((l) => l.etat === "À visiter");
  if (restantes.length > 0 && !options.forcer) {
    return {
      ok: false,
      message: `${restantes.length} visite(s) encore « À visiter » — traitez-les ou forcez la clôture`,
    };
  }

  if (options.kmArrive != null && options.kmArrive < mission.kmDepart) {
    return { ok: false, message: "Le kilométrage d'arrivée est inférieur au départ" };
  }

  await prisma.$transaction([
    ...(restantes.length > 0
      ? [prisma.ligneMission.updateMany({
          where: { id: { in: restantes.map((l) => l.id) } },
          data: { etat: "Reporté", commentaire: "Reporté à la clôture de la tournée" },
        })]
      : []),
    prisma.erpMission.update({
      where: { id: dayId },
      data: {
        etat: "Clôturée",
        au: new Date(),
        ...(options.kmArrive != null ? { kmArrive: options.kmArrive } : {}),
      },
    }),
  ]);

  // Le relevé de fin de tournée met à jour le compteur du véhicule : c'est ce
  // qui rend les échéances d'entretien (vidange, courroie) automatiques, sans
  // ressaisie sur la fiche véhicule.
  const compteur = await appliquerReleveMission(
    mission.vehicule, options.kmArrive ?? mission.kmArrive, mission.kmDepart,
  );

  return {
    ok: true,
    dayId,
    reportees: restantes.length,
    kilometrage: compteur,
    message: `Tournée n° ${dayId} clôturée`
      + (restantes.length > 0 ? ` — ${restantes.length} visite(s) reportée(s)` : "")
      + (compteur != null ? ` — compteur ${mission.vehicule} : ${compteur.toLocaleString("fr-TN")} km` : ""),
  };
}

/**
 * Stock réellement embarqué dans un véhicule.
 *
 * S'appuie sur `StockDepot` (§18) : le véhicule est un emplacement comme un
 * autre. C'est ce qui remplace le stock camion inventé de `retour-stock`.
 */
export async function stockVehicule(vehicule: string, options?: { toutVoir?: boolean }) {
  // Les emplacements de stock sont libellés « mokhtar 206TU7140 » : le nom du
  // commercial précède la plaque. L'écran, lui, ne connaît que la plaque
  // (« 206TU7140 ») — une égalité stricte ne trouvait donc jamais rien, et le
  // camion apparaissait vide alors qu'il portait 222 références.
  const plaque = vehicule.trim();
  const rows = await prisma.stockDepot.findMany({
    where: {
      quantite: { not: 0 },
      OR: [
        { emplacement: plaque },
        // La plaque est contenue dans le libellé de l'emplacement.
        { emplacement: { contains: plaque, mode: "insensitive" } },
      ],
    },
    orderBy: { refArt: "asc" },
  });

  const refs = rows.map((r) => r.refArt);
  const articles = refs.length
    ? await prisma.article.findMany({
        where: { refArt: { in: refs } },
        select: { refArt: true, designation: true, unite: true, pmp: true, puAchat: true, tarif1Ht: true, kind: true },
      })
    : [];
  const parRef = new Map(articles.map((a) => [a.refArt, a]));

  const lignes = rows.map((r) => {
    const a = parRef.get(r.refArt);
    // Coût moyen du **véhicule** en priorité : la marchandise chargée peut
    // avoir été achetée à un autre prix que celle restée au dépôt. On ne
    // retombe sur le PMP global que si l'emplacement n'a pas de coût du tout.
    //
    // Un coût nul est une valeur, pas une absence : la production rapporte un
    // PMP à zéro pour les articles jamais entrés en stock valorisé. Le traiter
    // comme « non renseigné » faisait basculer sur le prix d'achat et
    // surévaluait le camion.
    const pmp = Number(
      r.pmp !== null && r.pmp !== undefined ? r.pmp
      : a?.pmp !== null && a?.pmp !== undefined ? a.pmp
      : a?.puAchat ?? 0,
    );
    return {
      refArt: r.refArt,
      designation: a?.designation ?? null,
      unite: a?.unite ?? null,
      quantite: round3(r.quantite),
      pmp: round3(pmp),
      valeur: round3(r.quantite * pmp),
      // P = produit fini (`prouit_fini` en source), seul type embarqué à la
      // vente ; MP / SF / CH ne figurent pas au stock camion.
      kind: a?.kind ?? "P",
      horsReferentiel: !a,
    };
  });

  // Ce que le camion porte réellement, au sens de l'ERP d'origine : sa requête
  // filtre `d.en_stock > 0 AND a.prouit_fini = 1`.
  //
  // Une quantité négative n'est pas de la marchandise à bord : c'est une sortie
  // enregistrée sans l'entrée correspondante (un article vendu depuis le camion
  // sans bon d'approvisionnement). La base de production en contient — dix sur
  // ce seul véhicule — et les afficher donnait un « stock camion » à moitié
  // négatif, avec des valeurs comme −626 400 TND, incompréhensible pour le
  // commercial et jamais montré par l'application d'origine.
  //
  // Les anomalies ne sont pas perdues pour autant : elles sont retournées à
  // part pour que l'administration puisse les régulariser.
  const embarque = lignes.filter((l) => l.quantite > 0 && l.kind === "P");
  const anomalies = lignes.filter((l) => l.quantite < 0);
  // Matières premières et semi-finis à quantité positive : présents en stock
  // mais hors du catalogue vendable, comme en production.
  const horsCatalogue = lignes.filter((l) => l.quantite > 0 && l.kind !== "P");

  return {
    vehicule,
    lignes: options?.toutVoir ? lignes : embarque,
    total: options?.toutVoir ? lignes.length : embarque.length,
    valeurTotale: round3((options?.toutVoir ? lignes : embarque).reduce((t, l) => t + l.valeur, 0)),
    // Compléments d'information, sans effet sur l'écran du commercial.
    anomalies: anomalies.map(({ refArt, designation, quantite, valeur }) => ({ refArt, designation, quantite, valeur })),
    nbAnomalies: anomalies.length,
    nbHorsCatalogue: horsCatalogue.length,
  };
}
