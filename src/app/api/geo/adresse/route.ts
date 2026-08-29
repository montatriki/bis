import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { coordValide } from "@/lib/geo";

// Adresse postale d'une position GPS (géocodage inverse).
//
// GET /api/geo/adresse?lat=&lng=
//   -> { adresse, ville, gouvernorat, codePostal }
//
// Même source et même découpage que l'ancien mobile (Nominatim / OpenStreetMap) :
//   adresse     = display_name          « El Ghazela, Délégation Raoued, Gouvernorat Ariana, 1083, Tunisie »
//   ville       = state_district sans « Délégation »   « Raoued »
//   gouvernorat = state sans « Gouvernorat »           « Ariana »
// Passer par le serveur donne une identité applicative propre à Nominatim
// (exigée par ses conditions d'usage) et un cache : deux commerciaux devant
// la même boutique ne déclenchent qu'un appel.

const UA = "SKY-ERP/1.0 (contact: montatriki896@gmail.com)";
const cache = new Map<string, Resultat>();

type Resultat = { adresse: string; ville: string; gouvernorat: string; codePostal: string };

function nettoyer(v: unknown, prefixe: string): string {
  const s = typeof v === "string" ? v.trim() : "";
  return s.toLowerCase().startsWith(prefixe.toLowerCase()) ? s.slice(prefixe.length).trim() : s;
}

export async function GET(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER", "COMMERCIAL"]);
  if (!auth.ok) return auth.res;

  const lat = Number(req.nextUrl.searchParams.get("lat"));
  const lng = Number(req.nextUrl.searchParams.get("lng"));
  if (!coordValide(lat, lng)) return NextResponse.json({ error: "Position invalide" }, { status: 400 });

  // ~10 m de précision : suffisant pour une adresse, et mutualise le cache.
  const cle = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  const connu = cache.get(cle);
  if (connu) return NextResponse.json(connu);

  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=fr&zoom=18`,
      { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(8000) },
    );
    if (!r.ok) throw new Error(`Nominatim ${r.status}`);
    const d = await r.json();
    const a = d.address ?? {};
    const res: Resultat = {
      adresse: typeof d.display_name === "string" ? d.display_name : "",
      ville: nettoyer(a.state_district, "Délégation ") || nettoyer(a.city ?? a.town ?? a.village, ""),
      gouvernorat: nettoyer(a.state, "Gouvernorat "),
      codePostal: typeof a.postcode === "string" ? a.postcode : "",
    };
    if (res.adresse) cache.set(cle, res);
    return NextResponse.json(res);
  } catch {
    return NextResponse.json({ error: "Service d'adresses indisponible — saisissez l'adresse à la main" }, { status: 502 });
  }
}
