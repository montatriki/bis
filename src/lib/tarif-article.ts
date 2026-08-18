// Calcul des prix d'un article — formules reprises de l'ERP d'origine
// (`app/src/inventoryModule/products-management/Tarifs.js`).
//
// Chaîne de prix, du coût d'achat au prix payé par le client :
//
//   PU achat HT ──(marge %)──► Prix vente HT ──(fodec)──► base ──(TVA)──► TTC
//
// Le FODEC est une taxe tunisienne assise sur le HT ; la TVA s'applique
// ensuite sur le HT **majoré du FODEC**, pas sur le HT nu. C'est l'ordre de
// l'ERP source, et il change le résultat dès que le FODEC est non nul.
//
// Les trois grandeurs (marge, HT, TTC) sont liées : modifier l'une recalcule
// les deux autres. L'écran d'origine le fait dans les deux sens, d'où les
// fonctions inverses ci-dessous.

import { round3 } from "@/lib/document-calc";

export type Taxes = {
  /** Taux de TVA en %, ex. 19. */
  tauxTva?: number | null;
  /** Taux de FODEC en %, ex. 1. */
  tauxFodec?: number | null;
};

const n = (v: unknown) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

/**
 * Coefficient qui transforme un prix HT en prix TTC.
 * `(1 + fodec) × (1 + tva)` — le FODEC entre dans l'assiette de la TVA.
 */
export function coefficientTtc(taxes: Taxes): number {
  const tva = n(taxes.tauxTva);
  const fodec = n(taxes.tauxFodec);
  return (1 + fodec / 100) * (1 + tva / 100);
}

/** Prix TTC à partir d'un prix HT. */
export function htVersTtc(prixHt: number, taxes: Taxes): number {
  return round3(n(prixHt) * coefficientTtc(taxes));
}

/** Prix HT à partir d'un prix TTC (opération inverse). */
export function ttcVersHt(prixTtc: number, taxes: Taxes): number {
  const coef = coefficientTtc(taxes);
  return coef === 0 ? 0 : round3(n(prixTtc) / coef);
}

/**
 * Prix de vente HT obtenu en appliquant une marge au prix d'achat.
 * `PU achat × (1 + marge/100)` — marge sur coût d'achat, comme dans l'ERP.
 */
export function margeVersHt(puAchat: number, margePct: number): number {
  return round3(n(puAchat) * (1 + n(margePct) / 100));
}

/**
 * Marge en % déduite d'un prix de vente HT.
 * `(HT − achat) / achat × 100`. Renvoie 0 si le prix d'achat est nul :
 * la marge n'a pas de sens sans coût de revient.
 */
export function htVersMarge(puAchat: number, prixHt: number): number {
  const achat = n(puAchat);
  if (achat === 0) return 0;
  return round3(((n(prixHt) - achat) / achat) * 100);
}

export type LigneTarif = {
  /** Prix d'achat HT servant de base au calcul de la marge. */
  puAchat: number;
  margePct: number;
  prixHt: number;
  prixTtc: number;
};

/**
 * Recalcule la ligne de tarif complète à partir du champ que l'utilisateur
 * vient de modifier. Reproduit `calcul()` / `calculBack()` de l'ERP source :
 *
 * - `marge`  → HT puis TTC
 * - `ht`     → marge puis TTC
 * - `ttc`    → HT puis marge
 * - `achat`  → HT et TTC recalculés à marge constante
 */
export function recalculerTarif(
  champ: "marge" | "ht" | "ttc" | "achat",
  valeurs: { puAchat: number; margePct: number; prixHt: number; prixTtc: number },
  taxes: Taxes,
): LigneTarif {
  const puAchat = n(valeurs.puAchat);

  switch (champ) {
    case "marge":
    case "achat": {
      const margePct = round3(n(valeurs.margePct));
      const prixHt = margeVersHt(puAchat, margePct);
      return { puAchat, margePct, prixHt, prixTtc: htVersTtc(prixHt, taxes) };
    }
    case "ht": {
      const prixHt = round3(n(valeurs.prixHt));
      return {
        puAchat,
        margePct: htVersMarge(puAchat, prixHt),
        prixHt,
        prixTtc: htVersTtc(prixHt, taxes),
      };
    }
    case "ttc": {
      const prixTtc = round3(n(valeurs.prixTtc));
      const prixHt = ttcVersHt(prixTtc, taxes);
      return { puAchat, margePct: htVersMarge(puAchat, prixHt), prixHt, prixTtc };
    }
  }
}

/**
 * Nouveau PMP après une entrée en stock — moyenne pondérée.
 *
 *   PMP = (PMP_actuel × qté_actuelle + qté_entrée × prix_entrée)
 *         / (qté_actuelle + qté_entrée)
 *
 * Formule de `products.service.js` (`newpmp`). Le PMP ne bouge qu'à l'entrée :
 * une sortie consomme du stock au coût moyen, elle ne le modifie pas.
 *
 * Cas limites : quantité résultante nulle ou négative (stock incohérent hérité
 * de l'import) → on conserve le PMP existant plutôt que de diviser par zéro.
 */
export function pmpApresEntree(
  pmpActuel: number,
  qteActuelle: number,
  qteEntree: number,
  prixEntree: number,
): number {
  const qteFinale = n(qteActuelle) + n(qteEntree);
  if (qteFinale <= 0) return round3(n(pmpActuel));
  const valeur = n(pmpActuel) * n(qteActuelle) + n(qteEntree) * n(prixEntree);
  return round3(valeur / qteFinale);
}
