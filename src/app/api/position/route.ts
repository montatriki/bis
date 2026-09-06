import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { coordValide } from "@/lib/geo";
import type { VehicleStatus } from "@prisma/client";
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
  // Fiche commerciale de l'utilisateur : sans elle, le point remonté n'est
  // rattaché à personne. C'était le cas de 1 102 des 1 700 positions
  // enregistrées — ni commercial, ni véhicule, donc invisibles sur la carte.
  const fiche = await prisma.commercial.findFirst({
    where: { userId: auth.user.id },
    select: { id: true, vehicleId: true },
  });

  // Le véhicule vient d'abord du rattachement de la fiche ; à défaut, on le
  // déduit de l'emplacement de stock (« mokhtar 206TU7140 »), dont le libellé
  // contient la plaque sans s'y réduire.
  let vehicule: { id: number; plate: string; status: VehicleStatus } | null = fiche?.vehicleId
    ? await prisma.vehicle.findUnique({
        where: { id: fiche.vehicleId },
        select: { id: true, plate: true, status: true },
      })
    : null;

  if (!vehicule) {
    const emplacement = await emplacementVehicule(auth.user.name).catch(() => null);
    if (emplacement) {
      const flotte = await prisma.vehicle.findMany({ select: { id: true, plate: true, status: true } });
      const cible = emplacement.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
      vehicule = flotte.find((v) => cible.includes(v.plate.trim().toLowerCase())) ?? null;
    }
  }

  const roule = Number.isFinite(vitesse) && vitesse > 5;
  const ecritures = [];

  if (vehicule) {
    ecritures.push(
      prisma.vehicle.update({
        where: { id: vehicule.id },
        data: {
          currentLat: lat, currentLng: lng, lastUpdate: maintenant,
          // Un véhicule qui remonte sa position roule : il n'est plus « garé ».
          status: roule ? "ACTIVE" : vehicule.status,
        },
      }),
    );
  }

  // La position du commercial alimente la supervision même quand aucun
  // véhicule ne lui est rattaché.
  if (fiche) {
    ecritures.push(
      prisma.commercial.update({
        where: { id: fiche.id },
        data: { currentLat: lat, currentLng: lng, lastGpsUpdate: maintenant },
      }),
    );
  }

  ecritures.push(
    prisma.gpsPosition.create({
      data: {
        // Les deux rattachements, quand ils existent : une trace anonyme ne
        // sert à rien.
        ...(vehicule ? { vehicleId: vehicule.id } : {}),
        ...(fiche ? { commercialId: fiche.id } : {}),
        lat, lng,
        speed: Number.isFinite(vitesse) ? vitesse : 0,
        timestamp: maintenant,
      },
    }),
  );

  await prisma.$transaction(ecritures);

  return NextResponse.json({
    ok: true,
    vehicule: vehicule?.plate ?? null,
    commercial: cleCommercial(auth.user.name),
    horodatage: maintenant,
    precision: Number.isFinite(precision) ? Math.round(precision) : null,
  });
}
