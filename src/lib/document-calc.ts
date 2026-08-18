// Calcul des totaux d'un document de vente/achat.
// Reproduit la logique du module Vente de l'ERP source : remise ligne,
// HT net, TVA et FODEC par ligne, puis agrégation en tête de document.

export type LineInput = {
  refArt: string;
  designation: string;
  unite?: string | null;
  qte: number;
  puHt: number;
  remise?: number; // %
  tauxTva?: number; // %
  tauxFodec?: number; // %
};

export type ComputedLine = LineInput & {
  remise: number;
  tauxTva: number;
  tauxFodec: number;
  thtBrut: number;
  thtNet: number;
  totTva: number;
  ttcNet: number;
};

export type DocumentTotals = {
  thtBrut: number;
  totRemise: number;
  thtNet: number;
  totFodec: number;
  totTva: number;
  timbre: number;
  ttcNet: number;
};

const n = (v: unknown) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

// Montants monétaires en millimes (3 décimales, convention TND).
export const round3 = (v: number) => Math.round((n(v) + Number.EPSILON) * 1000) / 1000;

/**
 * Calcule une ligne. La FODEC s'applique sur le HT net et entre dans
 * l'assiette de la TVA, comme dans l'ERP source.
 */
export function computeLine(line: LineInput): ComputedLine {
  const qte = n(line.qte);
  const puHt = n(line.puHt);
  const remise = n(line.remise);
  const tauxTva = n(line.tauxTva);
  const tauxFodec = n(line.tauxFodec);

  const thtBrut = round3(qte * puHt);
  const thtNet = round3(thtBrut * (1 - remise / 100));
  const fodec = round3(thtNet * (tauxFodec / 100));
  const totTva = round3((thtNet + fodec) * (tauxTva / 100));
  const ttcNet = round3(thtNet + fodec + totTva);

  return {
    ...line,
    remise,
    tauxTva,
    tauxFodec,
    qte,
    puHt,
    thtBrut,
    thtNet,
    totTva,
    ttcNet,
  };
}

/**
 * Agrège les lignes en totaux de document.
 * `timbre` (timbre fiscal) est ajouté tel quel au TTC.
 */
export function computeTotals(lines: LineInput[], timbre = 0): DocumentTotals {
  const computed = lines.map(computeLine);

  const thtBrut = round3(computed.reduce((s, l) => s + l.thtBrut, 0));
  const thtNet = round3(computed.reduce((s, l) => s + l.thtNet, 0));
  const totTva = round3(computed.reduce((s, l) => s + l.totTva, 0));
  const totFodec = round3(
    computed.reduce((s, l) => s + l.thtNet * (l.tauxFodec / 100), 0)
  );
  const t = round3(timbre);

  return {
    thtBrut,
    totRemise: round3(thtBrut - thtNet),
    thtNet,
    totFodec,
    totTva,
    timbre: t,
    ttcNet: round3(thtNet + totFodec + totTva + t),
  };
}

/** Lignes calculées + totaux, en une passe. */
export function computeDocument(lines: LineInput[], timbre = 0) {
  return {
    lines: lines.map(computeLine),
    totals: computeTotals(lines, timbre),
  };
}
