import prisma from "@/lib/prisma";
import { round3 } from "@/lib/vente-stats";

// GPAO — ordonnancement / planification des ordres de fabrication.
//
// Reproduit `plannifierOf` de l'ERP source. Chaque opération de l'OF génère
// jusqu'à trois créneaux successifs, dans cet ordre :
//
//   Temps réglage → Temps préparation → Temps opératoire
//
// Le temps opératoire est **découpé sur les plages ouvrables** du poste de
// charge (matin / après-midi) : une opération de 6 h ne tient pas dans une
// matinée de 4 h, elle reprend l'après-midi puis le lendemain. A codait les
// plages en dur (08:00–12:00 / 13:00–17:00) ; ici elles viennent du poste de
// charge, donc chaque atelier peut avoir son horaire.
//
// La disponibilité est vérifiée : un créneau qui chevauche un créneau déjà
// planifié sur la même ressource est enregistré avec `disponibilite: false`
// plutôt que refusé — c'est un conflit à arbitrer, pas une erreur de saisie.

export type Creneau = {
  refDoc: string;
  operationId: number | null;
  desOperation: string;
  dateDebut: Date;
  dateFin: Date;
  duree: number;
  typeDuree: string;
  posteChargeId: number | null;
  posteMo: string | null;
  disponibilite: boolean;
};

export type ResultatPlanification = {
  ok: boolean;
  message: string;
  creneaux: number;
  conflits: number;
  dateFin: Date | null;
  /** Dépassement de la date limite demandée, s'il y en a une. */
  horsDelai: boolean;
  alertes: string[];
};

const MINUTE = 60_000;

/** "HH:MM" → minutes depuis minuit. */
export function heureEnMinutes(h: string): number {
  const [hh, mm] = String(h ?? "").split(":").map((x) => parseInt(x, 10));
  if (!Number.isFinite(hh)) return 0;
  return hh * 60 + (Number.isFinite(mm) ? mm : 0);
}

const minutesDuJour = (d: Date) => d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;

const auMinuit = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

/** Date à `minutes` depuis minuit du jour de `jour`. */
const poserHeure = (jour: Date, minutes: number) =>
  new Date(auMinuit(jour).getTime() + minutes * MINUTE);

/** Plages ouvrables d'un poste, en minutes depuis minuit. */
type Plages = { debut: number; fin: number }[];

function plagesDuPoste(poste: {
  heureDebut: string; heureFin: string; pauseDebut: string; pauseFin: string;
}): Plages {
  const d = heureEnMinutes(poste.heureDebut);
  const f = heureEnMinutes(poste.heureFin);
  const pd = heureEnMinutes(poste.pauseDebut);
  const pf = heureEnMinutes(poste.pauseFin);

  // Pause hors journée ou incohérente → journée continue.
  if (pd <= d || pf >= f || pf <= pd) return [{ debut: d, fin: f }];
  return [
    { debut: d, fin: pd },
    { debut: pf, fin: f },
  ];
}

/**
 * Place `duree` minutes de travail à partir de `depart`, en découpant sur les
 * plages ouvrables. Retourne les tranches et l'instant de fin.
 *
 * Les samedis/dimanches sont sautés : un atelier fermé ne produit pas.
 */
function decouperSurPlages(
  depart: Date,
  duree: number,
  plages: Plages,
  joursMax = 60
): { tranches: { debut: Date; fin: Date; duree: number }[]; fin: Date } {
  const tranches: { debut: Date; fin: Date; duree: number }[] = [];
  let reste = duree;
  let curseur = new Date(depart);
  let jours = 0;

  if (reste <= 0) return { tranches, fin: curseur };

  while (reste > 0.0001 && jours <= joursMax) {
    const jourOuvrable = curseur.getDay() !== 0 && curseur.getDay() !== 6;

    if (jourOuvrable) {
      const m = minutesDuJour(curseur);
      // Première plage qui peut encore accueillir du travail aujourd'hui.
      const plage = plages.find((p) => m < p.fin);

      if (plage) {
        const debutTranche = Math.max(m, plage.debut);
        const capacite = plage.fin - debutTranche;

        if (capacite > 0.0001) {
          const pris = Math.min(capacite, reste);
          const debut = poserHeure(curseur, debutTranche);
          const fin = poserHeure(curseur, debutTranche + pris);
          tranches.push({ debut, fin, duree: round3(pris) });
          reste -= pris;
          curseur = fin;
          if (reste <= 0.0001) break;
        }
        // Plage épuisée : aller au début de la plage suivante.
        const suivante = plages.find((p) => p.debut > debutTranche);
        if (suivante) {
          curseur = poserHeure(curseur, suivante.debut);
          continue;
        }
      }
    }

    // Journée terminée (ou non ouvrable) → ouverture du lendemain.
    const lendemain = new Date(auMinuit(curseur).getTime() + 24 * 60 * MINUTE);
    curseur = poserHeure(lendemain, plages[0].debut);
    jours += 1;
  }

  return { tranches, fin: curseur };
}

/**
 * Génère les opérations d'un OF depuis la gamme de l'article.
 *
 * Le temps opératoire de la gamme est exprimé pour `qteBase` unités : il est
 * mis à l'échelle de la quantité à produire, corrigé de l'efficience du poste.
 * Réglage et préparation ne dépendent pas de la quantité — on règle la machine
 * une fois, quel que soit le lot.
 */
export async function genererOperationsOf(
  refDoc: string,
  refArt: string,
  quantite: number
): Promise<{ ok: boolean; message: string; operations: number }> {
  const gamme = await prisma.gpaoGamme.findFirst({
    where: { refArt, exploitation: true },
    include: { operations: { orderBy: [{ numSequence: "asc" }, { id: "asc" }] } },
    orderBy: { id: "desc" },
  });

  if (!gamme) return { ok: false, message: `Aucune gamme en exploitation pour ${refArt}`, operations: 0 };
  if (gamme.operations.length === 0) {
    return { ok: false, message: `La gamme ${gamme.gamme} n'a aucune opération`, operations: 0 };
  }

  const art = await prisma.article.findUnique({
    where: { refArt },
    select: { designation: true },
  });

  const qte = Number(quantite) > 0 ? Number(quantite) : 1;

  const rows = gamme.operations.map((op) => {
    const base = op.qteBase > 0 ? op.qteBase : 1;
    const eff = op.efficience > 0 ? op.efficience / 100 : 1;
    // Temps opératoire proportionnel à la quantité, pondéré par le coefficient
    // de charge et dégradé par l'efficience réelle du poste.
    const operatoire = (op.tempsOperatoire / base) * qte * (op.coeffCharge || 1) / eff;

    return {
      refDoc,
      desArt: art?.designation ?? refArt,
      operationId: op.operationId,
      desOperation: op.desOperation,
      numSequence: op.numSequence,
      posteChargeId: op.posteChargeId,
      posteMo: op.posteMo,
      tempsReg: round3(op.tempsReg),
      tempsPreparation: round3(op.tempsPreparation),
      tempsOperatoire: round3(operatoire),
      duree: round3(op.tempsReg + op.tempsPreparation + operatoire),
    };
  });

  // Regénérer remplace : une gamme modifiée doit pouvoir être rejouée.
  await prisma.$transaction([
    prisma.gpaoOperationOf.deleteMany({ where: { refDoc } }),
    prisma.gpaoOperationOf.createMany({ data: rows }),
  ]);

  return { ok: true, message: `${rows.length} opération(s) générée(s) depuis la gamme ${gamme.gamme}`, operations: rows.length };
}

/**
 * Planifie un OF à partir de `dateDebut`.
 *
 * Les opérations sont enchaînées dans l'ordre des séquences : une opération ne
 * démarre qu'à la fin de la précédente (jalonnement successif, le mode par
 * défaut de A). `dateLimite` ne bloque pas la planification — elle sert à
 * signaler un dépassement de délai.
 */
export async function planifierOf(
  refDoc: string,
  dateDebut: Date,
  dateLimite?: Date | null
): Promise<ResultatPlanification> {
  const vide: ResultatPlanification = {
    ok: false, message: "", creneaux: 0, conflits: 0,
    dateFin: null, horsDelai: false, alertes: [],
  };

  const operations = await prisma.gpaoOperationOf.findMany({
    where: { refDoc },
    orderBy: [{ numSequence: "asc" }, { id: "asc" }],
  });

  if (operations.length === 0) {
    return { ...vide, message: `${refDoc} : aucune opération à planifier — générez-les depuis la gamme` };
  }

  const posteIds = [...new Set(operations.map((o) => o.posteChargeId).filter((x): x is number => x != null))];
  const postes = posteIds.length
    ? await prisma.gpaoPosteCharge.findMany({ where: { id: { in: posteIds } } })
    : [];
  const parPoste = new Map(postes.map((p) => [p.id, p]));

  // Plages par défaut quand l'opération n'a pas de poste de charge : on planifie
  // quand même, sinon l'OF resterait invisible dans l'ordonnancement.
  const plagesDefaut: Plages = [
    { debut: heureEnMinutes("08:00"), fin: heureEnMinutes("12:00") },
    { debut: heureEnMinutes("13:00"), fin: heureEnMinutes("17:00") },
  ];

  const alertes: string[] = [];
  const creneaux: Creneau[] = [];
  let curseur = new Date(dateDebut);

  for (const op of operations) {
    const poste = op.posteChargeId != null ? parPoste.get(op.posteChargeId) : undefined;
    if (op.posteChargeId != null && !poste) {
      alertes.push(`Opération « ${op.desOperation} » : poste de charge introuvable — horaire par défaut appliqué`);
    }
    if (op.posteChargeId == null && !op.posteMo) {
      alertes.push(`Opération « ${op.desOperation} » : aucune ressource affectée`);
    }
    if (poste && poste.machine && poste.nbRessources <= 0) {
      alertes.push(`Poste ${poste.libelle} : aucune ressource déclarée`);
    }

    const plages = poste ? plagesDuPoste(poste) : plagesDefaut;

    // Ne jamais démarrer hors plage : caler sur la prochaine ouverture.
    const { fin: depart } = decouperSurPlages(curseur, 0.0002, plages);
    curseur = depart;

    const phases: { type: string; duree: number }[] = [
      { type: "Temps réglage", duree: op.tempsReg },
      { type: "Temps préparation", duree: op.tempsPreparation },
      { type: "Temps opératoire", duree: op.tempsOperatoire },
    ];

    for (const phase of phases) {
      if (phase.duree <= 0) continue;

      const { tranches, fin } = decouperSurPlages(curseur, phase.duree, plages);
      if (tranches.length === 0) {
        alertes.push(`Opération « ${op.desOperation} » (${phase.type}) : aucune plage ouvrable trouvée`);
        continue;
      }

      for (const t of tranches) {
        creneaux.push({
          refDoc,
          operationId: op.operationId,
          desOperation: op.desOperation,
          dateDebut: t.debut,
          dateFin: t.fin,
          duree: t.duree,
          typeDuree: phase.type,
          posteChargeId: op.posteChargeId,
          posteMo: op.posteMo,
          disponibilite: true,
        });
      }
      curseur = fin;
    }
  }

  if (creneaux.length === 0) {
    return { ...vide, message: `${refDoc} : tous les temps sont à zéro — rien à planifier`, alertes };
  }

  // Conflits : chevauchement avec un créneau déjà posé sur la même ressource
  // (hors OF courant, qui est remplacé).
  const debutGlobal = creneaux.reduce((m, c) => (c.dateDebut < m ? c.dateDebut : m), creneaux[0].dateDebut);
  const finGlobale = creneaux.reduce((m, c) => (c.dateFin > m ? c.dateFin : m), creneaux[0].dateFin);

  const existants = await prisma.gpaoPlan.findMany({
    where: {
      refDoc: { not: refDoc },
      dateDebut: { lt: finGlobale },
      dateFin: { gt: debutGlobal },
    },
    select: { posteChargeId: true, posteMo: true, dateDebut: true, dateFin: true, refDoc: true },
  });

  let conflits = 0;
  for (const c of creneaux) {
    const occupe = existants.find(
      (e) =>
        ((c.posteChargeId != null && e.posteChargeId === c.posteChargeId) ||
          (c.posteMo != null && e.posteMo === c.posteMo)) &&
        e.dateDebut < c.dateFin &&
        e.dateFin > c.dateDebut
    );
    if (occupe) {
      c.disponibilite = false;
      conflits += 1;
      alertes.push(
        `Conflit sur « ${c.desOperation} » le ${c.dateDebut.toLocaleString("fr-FR")} — ressource déjà prise par ${occupe.refDoc}`
      );
    }
  }

  // Replanifier remplace le plan précédent de cet OF.
  await prisma.$transaction([
    prisma.gpaoPlan.deleteMany({ where: { refDoc } }),
    prisma.gpaoPlan.createMany({ data: creneaux }),
  ]);

  const horsDelai = Boolean(dateLimite && finGlobale > dateLimite);
  if (horsDelai) {
    alertes.push(
      `Fin de fabrication le ${finGlobale.toLocaleString("fr-FR")} — après la date limite du ${dateLimite!.toLocaleDateString("fr-FR")}`
    );
  }

  return {
    ok: true,
    message: `${creneaux.length} créneau(x) planifié(s)${conflits ? `, ${conflits} en conflit` : ""}`,
    creneaux: creneaux.length,
    conflits,
    dateFin: finGlobale,
    horsDelai,
    alertes: [...new Set(alertes)],
  };
}

/** Charge planifiée par poste sur une période — vue capacité de l'ordonnancement. */
export async function chargeParPoste(du: Date, au: Date) {
  const plans = await prisma.gpaoPlan.findMany({
    where: { dateDebut: { gte: du }, dateFin: { lte: au } },
    include: { posteCharge: { select: { code: true, libelle: true, nbRessources: true, heureDebut: true, heureFin: true, pauseDebut: true, pauseFin: true } } },
  });

  const agrege = new Map<string, { poste: string; minutes: number; creneaux: number; conflits: number }>();
  for (const p of plans) {
    const cle = p.posteCharge?.code ?? p.posteMo ?? "Non affecté";
    const lib = p.posteCharge?.libelle ?? p.posteMo ?? "Non affecté";
    const prev = agrege.get(cle) ?? { poste: lib, minutes: 0, creneaux: 0, conflits: 0 };
    prev.minutes += p.duree;
    prev.creneaux += 1;
    if (!p.disponibilite) prev.conflits += 1;
    agrege.set(cle, prev);
  }

  // Capacité ouvrable de la période, pour situer la charge en pourcentage.
  const joursOuvrables = (() => {
    let n = 0;
    const d = auMinuit(du);
    const fin = auMinuit(au);
    while (d <= fin) {
      if (d.getDay() !== 0 && d.getDay() !== 6) n += 1;
      d.setDate(d.getDate() + 1);
    }
    return n;
  })();

  return [...agrege.entries()].map(([code, v]) => {
    const poste = plans.find((p) => p.posteCharge?.code === code)?.posteCharge;
    const parJour = poste
      ? plagesDuPoste(poste).reduce((s, pl) => s + (pl.fin - pl.debut), 0) * (poste.nbRessources || 1)
      : 8 * 60;
    const capacite = parJour * joursOuvrables;
    return {
      code,
      poste: v.poste,
      heures: round3(v.minutes / 60),
      creneaux: v.creneaux,
      conflits: v.conflits,
      capaciteHeures: round3(capacite / 60),
      tauxCharge: capacite > 0 ? round3((v.minutes / capacite) * 100) : null,
    };
  }).sort((a, b) => (b.tauxCharge ?? 0) - (a.tauxCharge ?? 0));
}
