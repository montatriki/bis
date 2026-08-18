// Constantes et helpers partagés par les tableaux de bord et les rapports de vente.
//
// Règle reprise de l'ERP source (`getArticlesVenteByPeriod`) : le chiffre
// d'affaires est la somme des documents de vente MOINS les retours et avoirs.
//   CA = Σ(BL, TIC, FC) − Σ(BR, AV)

/** Types de documents qui augmentent le CA. */
export const TYPES_VENTE = ["BL", "TIC", "FC", "FAC"] as const;

/** Types de documents qui diminuent le CA (retours, avoirs). */
export const TYPES_RETOUR = ["BR", "AV", "BRE"] as const;

export const TYPES_CA = [...TYPES_VENTE, ...TYPES_RETOUR];

/** Signe à appliquer au montant d'un document dans un calcul de CA. */
export function signeCA(typeDoc?: string | null): number {
  const t = String(typeDoc ?? "").toUpperCase();
  if ((TYPES_RETOUR as readonly string[]).includes(t)) return -1;
  if ((TYPES_VENTE as readonly string[]).includes(t)) return 1;
  return 0;
}

/** Bornes de période depuis des chaînes ISO ; par défaut, les 12 derniers mois. */
export function periode(du?: string | null, au?: string | null) {
  const fin = au ? new Date(au) : new Date();
  fin.setHours(23, 59, 59, 999);
  const debut = du ? new Date(du) : new Date(fin.getFullYear(), fin.getMonth() - 11, 1);
  debut.setHours(0, 0, 0, 0);
  return { debut, fin };
}

export const MOIS_COURTS = [
  "Jan", "Fév", "Mar", "Avr", "Mai", "Juin",
  "Juil", "Août", "Sep", "Oct", "Nov", "Déc",
];

export const round3 = (v: number) => Math.round((Number(v) + Number.EPSILON) * 1000) / 1000;
