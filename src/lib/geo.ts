// Utilitaires de géolocalisation partagés par les écrans commerciaux.
//
// Les coordonnées des clients viennent de l'ERP (`partners.latitude/longitude`).
// Une partie des tiers importés a des coordonnées nulles ou à zéro : elles sont
// traitées comme absentes plutôt que comme un point au large de l'Afrique.

/** Rayon moyen de la Terre, en mètres. */
const RAYON_TERRE_M = 6_371_000;

/** Une coordonnée est exploitable si elle est renseignée et non nulle. */
export function coordValide(lat?: number | null, lng?: number | null): boolean {
  return (
    typeof lat === "number" && typeof lng === "number" &&
    Number.isFinite(lat) && Number.isFinite(lng) &&
    lat !== 0 && lng !== 0 &&
    Math.abs(lat) <= 90 && Math.abs(lng) <= 180
  );
}

/**
 * Distance en mètres entre deux points (formule de haversine).
 * Précision largement suffisante aux distances d'une tournée commerciale.
 */
export function distanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * RAYON_TERRE_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Seuils métier de proximité, en mètres.
 * `SUR_PLACE` : on considère le commercial physiquement chez le client ;
 * `PROCHE`    : le client est à portée immédiate (même rue / même bloc) ;
 * `ZONE`      : le client reste pertinent à proposer dans la tournée.
 */
export const SEUILS = {
  SUR_PLACE: 120,
  PROCHE: 500,
  ZONE: 5_000,
} as const;

export type Proximite = "sur-place" | "proche" | "zone" | "loin";

/** Qualifie une distance selon les seuils métier. */
export function proximite(m: number): Proximite {
  if (m <= SEUILS.SUR_PLACE) return "sur-place";
  if (m <= SEUILS.PROCHE) return "proche";
  if (m <= SEUILS.ZONE) return "zone";
  return "loin";
}

/** Distance lisible : « 85 m », « 1,2 km ». */
export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(m / 1000)} km`;
}

/**
 * Distance en deçà de laquelle un commercial est considéré « sur place » chez
 * son client. 150 m couvre l'imprécision d'un GPS de téléphone en ville (murs,
 * immeubles) sans confondre deux commerces voisins.
 */
export const SEUIL_PRESENCE_M = 150;
