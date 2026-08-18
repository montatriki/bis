import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { coordValide, distanceM, proximite, SEUILS } from "@/lib/geo";
import { round3 } from "@/lib/vente-stats";
import { filtrePortefeuille } from "@/lib/perimetre-commercial";

// Clients les plus proches d'une position GPS.
//
// GET /api/clients/proches?lat=&lng=&rayon=&limit=
//
// Sert au commercial en tournée : à l'ouverture de l'application, on identifie
// le point de vente devant lequel il se trouve pour le sélectionner d'emblée,
// sans le faire chercher dans une liste de 2 400 clients.

export async function GET(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER", "COMMERCIAL"]);
  if (!auth.ok) return auth.res;

  const sp = req.nextUrl.searchParams;
  const lat = Number(sp.get("lat"));
  const lng = Number(sp.get("lng"));
  const rayon = Math.min(50_000, Math.max(50, Number(sp.get("rayon") ?? SEUILS.ZONE)));
  const limit = Math.min(50, Math.max(1, parseInt(sp.get("limit") ?? "8", 10)));

  if (!coordValide(lat, lng)) {
    return NextResponse.json({ error: "Position GPS invalide" }, { status: 400 });
  }

  // Pré-filtre par boîte englobante : évite de calculer la distance sur tous
  // les tiers. 1° de latitude ≈ 111 km ; la longitude se resserre avec le
  // cosinus de la latitude.
  const degLat = rayon / 111_320;
  const degLng = rayon / (111_320 * Math.max(0.15, Math.cos((lat * Math.PI) / 180)));

  const candidats = await prisma.partner.findMany({
    where: {
      nature: "C",
      archiver: 0,
      // Un commercial ne travaille que son portefeuille : sans ce filtre, la
      // détection de proximité lui proposait les clients de ses collègues —
      // des noms qu'il ne connaît pas, et qu'il n'a pas à démarcher.
      ...(filtrePortefeuille(auth.user) ?? {}),
      latitude: { gte: lat - degLat, lte: lat + degLat },
      longitude: { gte: lng - degLng, lte: lng + degLng },
    },
    select: {
      id: true, raisonSocial: true, ville: true, gouvernorat: true, adresse: true,
      tel: true, soldeFin: true, plafond: true, famille: true,
      latitude: true, longitude: true, commercial: true,
    },
    take: 500,
  });

  const rows = candidats
    .filter((c) => coordValide(c.latitude, c.longitude))
    .map((c) => {
      const d = distanceM(lat, lng, c.latitude!, c.longitude!);
      return {
        id: c.id,
        raisonSocial: (c.raisonSocial || "").trim() || `Client ${c.id}`,
        ville: c.ville,
        gouvernorat: c.gouvernorat,
        adresse: c.adresse,
        tel: c.tel,
        soldeFin: round3(c.soldeFin),
        plafond: c.plafond,
        famille: c.famille,
        latitude: c.latitude,
        longitude: c.longitude,
        commercial: c.commercial,
        distance: Math.round(d),
        proximite: proximite(d),
      };
    })
    .filter((c) => c.distance <= rayon)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);

  // Le client « sur place » n'est proposé en sélection automatique que s'il est
  // sans ambiguïté : très proche, et nettement plus proche que le suivant.
  const premier = rows[0];
  const second = rows[1];
  const auto =
    premier && premier.proximite === "sur-place" &&
    (!second || second.distance - premier.distance > 40)
      ? premier
      : null;

  return NextResponse.json({
    position: { lat, lng },
    rayon,
    rows,
    total: rows.length,
    /** Client à présélectionner sans confirmation ; null si ambigu. */
    auto,
  });
}
