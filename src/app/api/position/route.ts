import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { coordValide } from "@/lib/geo";
import { cleCommercial, emplacementVehicule } from "@/lib/perimetre-commercial";

// Remontée de la position du commercial en tournée.
//
// POST /api/position { latitude, longitude, precision?, vitesse? }
//
// L'application terrain lisait la position du navigateur mais ne la
// transmettait jamais : `Vehicle.currentLat` et l'historique `GpsPosition`
// restaient figés sur les valeurs d'import, et la supervision cartographique
// affichait des véhicules immobiles depuis des semaines tout en annonçant du
// « temps réel ».

/** Position manifestement fausse : hors de Tunisie et de ses abords. */
function dansLaZone(lat: number, lng: number): boolean {
  return lat > 29 && lat < 39 && lng > 6 && lng < 14;
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(["COMMERCIAL", "MANAGER", "ADMIN"]);
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => ({}));
  const lat = Number(body.latitude);
  const lng = Number(body.longitude);

  if (!coordValide(lat, lng)) {
    return NextResponse.json({ error: "Coordonnées invalides" }, { status: 400 });
  }
  // Un point aberrant fausserait la carte et les distances de proximité : on
  // le refuse plutôt que de le stocker.
  if (!dansLaZone(lat, lng)) {
    return NextResponse.json({ error: "Position hors zone d'exploitation" }, { status: 400 });
  }

  const precision = Number(body.precision);
  const vitesse = Number(body.vitesse);
  const maintenant = new Date();

  // Le véhicule du commercial. Son emplacement de stock est libellé
  // « mokhtar 206TU7140 » : la plaque y est incluse mais ne constitue pas le
  // libellé entier, il faut donc l'en extraire pour retrouver la fiche.
  const emplacement = await emplacementVehicule(auth.user.name).catch(() => null);
  const vehicule = emplacement
    ? await (async () => {
        const flotte = await prisma.vehicle.findMany();
        const cible = emplacement.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
        return flotte.find((v) => cible.includes(v.plate.trim().toLowerCase())) ?? null;
      })()
    : null;

  if (vehicule) {
    await prisma.$transaction([
      prisma.vehicle.update({
        where: { id: vehicule.id },
        data: {
          currentLat: lat, currentLng: lng, lastUpdate: maintenant,
          // Un véhicule qui remonte sa position roule : il n'est plus « garé ».
          status: Number.isFinite(vitesse) && vitesse > 5 ? "ACTIVE" : vehicule.status,
        },
      }),
      prisma.gpsPosition.create({
        data: {
          vehicleId: vehicule.id, lat, lng,
          speed: Number.isFinite(vitesse) ? vitesse : 0,
          timestamp: maintenant,
        },
      }),
    ]);
  } else {
    // Commercial sans véhicule rattaché : on conserve quand même la trace,
    // sans quoi sa tournée serait invisible sur la carte.
    await prisma.gpsPosition.create({
      data: {
        lat, lng,
        speed: Number.isFinite(vitesse) ? vitesse : 0,
        timestamp: maintenant,
      },
    });
  }

  return NextResponse.json({
    ok: true,
    vehicule: vehicule?.plate ?? null,
    commercial: cleCommercial(auth.user.name),
    horodatage: maintenant,
    precision: Number.isFinite(precision) ? Math.round(precision) : null,
  });
}
