/**
 * Date au format AAAA-MM-JJ en heure LOCALE.
 *
 * `toISOString().slice(0, 10)` convertit d'abord en UTC : en Tunisie (UTC+1),
 * de minuit à 1 h la « date du jour » devenait celle de la veille, et une
 * tournée datée de minuit local reculait d'un jour. Les écrans cherchaient
 * alors la mauvaise tournée.
 */
export function dateLocaleIso(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
