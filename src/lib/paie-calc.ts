// Moteur de calcul de paie — reproduit la logique de `traitement-paie` de l'ERP source.
//
// Chaîne de calcul (ordre imposé, chaque étape dépend de la précédente) :
//   1. salaire de base selon le régime (M = mensuel au prorata des jours, H = horaire)
//   2. + primes + heures supplémentaires        => brut
//   3. − CNSS (sur le brut cotisable)           => salaire imposable
//   4. − IRPP (barème annuel par tranches / 12) => après impôt
//   5. − CSS (% sur l'imposable après IRPP)     => net à payer
//
// Les taux viennent de `grh_impo` / `grh_typecnss` / `grh_parametrage_generale`
// dans A ; ils sont ici centralisés et surchargeables par appel.

export type Regime = "M" | "H";

/** Tranche du barème IRPP (montants annuels, en TND). */
export type TrancheIrpp = { du: number; au: number; taux: number };

/**
 * Barème IRPP annuel tunisien. `au: Infinity` pour la dernière tranche.
 * Modifiable par paramétrage sans toucher au moteur, comme dans A.
 */
export const BAREME_IRPP: TrancheIrpp[] = [
  { du: 0, au: 5000, taux: 0 },
  { du: 5000, au: 20000, taux: 26 },
  { du: 20000, au: 30000, taux: 28 },
  { du: 30000, au: 50000, taux: 32 },
  { du: 50000, au: Infinity, taux: 35 },
];

export type ParamsPaie = {
  tauxCnss: number; // % retenue salariale CNSS
  tauxCss: number; // % contribution sociale de solidarité
  appliquerIrpp: boolean;
  bareme: TrancheIrpp[];
  /** Abattement annuel pour chef de famille. */
  abattementChefFamille: number;
  /** Abattement annuel par enfant à charge. */
  abattementParEnfant: number;
};

export const PARAMS_DEFAUT: ParamsPaie = {
  tauxCnss: 9.18,
  tauxCss: 1,
  appliquerIrpp: true,
  bareme: BAREME_IRPP,
  abattementChefFamille: 300,
  abattementParEnfant: 100,
};

const n = (v: unknown) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

export const round3 = (v: number) => Math.round((n(v) + Number.EPSILON) * 1000) / 1000;

export type EntreePaie = {
  regime: Regime;
  salaireBase: number;
  coutHoraire: number;
  njTraitNormal: number; // jours de référence du mois (typiquement 26)

  presenceJ: number;
  presenceH: number;
  congeJ: number;
  ferieJ: number;
  hSupp: number;

  primes?: number;
  autresRetenues?: number;

  chefFamille?: boolean;
  nbrEnfants?: number;
  /** Exonéré d'IRPP (cas particulier prévu dans A). */
  exonereIrpp?: boolean;
};

export type Bulletin = {
  salaireBase: number;
  primes: number;
  heuresSupp: number;
  brutImposable: number;
  cnss: number;
  irpp: number;
  css: number;
  autresRet: number;
  netAPayer: number;
  jourTravailles: number;
};

/**
 * IRPP mensuel : barème appliqué au revenu annuel, divisé par 12.
 * Les abattements familiaux sont annuels, comme dans A.
 */
export function calculIrppMensuel(
  salaireImposableMensuel: number,
  params: ParamsPaie,
  chefFamille = false,
  nbrEnfants = 0
): number {
  if (!params.appliquerIrpp) return 0;

  let annuel = n(salaireImposableMensuel) * 12;
  if (chefFamille) annuel -= params.abattementChefFamille;
  annuel -= n(nbrEnfants) * params.abattementParEnfant;
  if (annuel <= 0) return 0;

  let impot = 0;
  for (const t of params.bareme) {
    if (annuel <= t.du) break;
    const plafond = Math.min(annuel, t.au);
    impot += (plafond - t.du) * (t.taux / 100);
  }

  return round3(impot / 12);
}

/**
 * Calcule un bulletin de paie complet.
 * Régime M : salaire au prorata des jours travaillés (présence + congé + férié).
 * Régime H : salaire = heures de présence × coût horaire.
 */
export function calculerBulletin(e: EntreePaie, params: ParamsPaie = PARAMS_DEFAUT): Bulletin {
  const primes = round3(n(e.primes));
  const autresRet = round3(n(e.autresRetenues));

  // 1. Salaire de base selon le régime
  let salaireBase: number;
  let jourTravailles: number;

  if (e.regime === "H") {
    jourTravailles = n(e.presenceH);
    salaireBase = round3(n(e.presenceH) * n(e.coutHoraire));
  } else {
    // Congés payés et jours fériés comptent comme travaillés.
    jourTravailles = n(e.presenceJ) + n(e.congeJ) + n(e.ferieJ);
    const base = n(e.njTraitNormal) > 0 ? n(e.njTraitNormal) : 26;
    salaireBase = round3((n(e.salaireBase) * jourTravailles) / base);
  }

  // 2. Heures supplémentaires — majorées de 25 %, sur la base du coût horaire.
  const tauxHoraire =
    e.regime === "H"
      ? n(e.coutHoraire)
      : n(e.njTraitNormal) > 0
        ? n(e.salaireBase) / (n(e.njTraitNormal) * 8)
        : 0;
  const heuresSupp = round3(n(e.hSupp) * tauxHoraire * 1.25);

  const brut = round3(salaireBase + primes + heuresSupp);

  // 3. CNSS sur le brut
  const cnss = round3(brut * (params.tauxCnss / 100));
  const imposable = round3(brut - cnss);

  // 4. IRPP
  const irpp = e.exonereIrpp
    ? 0
    : calculIrppMensuel(imposable, params, e.chefFamille, e.nbrEnfants);

  // 5. CSS sur l'imposable après IRPP
  const css = round3((imposable - irpp) * (params.tauxCss / 100));

  const netAPayer = round3(imposable - irpp - css - autresRet);

  return {
    salaireBase,
    primes,
    heuresSupp,
    brutImposable: brut,
    cnss,
    irpp,
    css,
    autresRet,
    netAPayer,
    jourTravailles: round3(jourTravailles),
  };
}
