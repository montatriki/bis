import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { coordValide, distanceM } from "@/lib/geo";
import { cleCommercial, memeCommercial } from "@/lib/perimetre-commercial";

// Enregistrements vocaux des visites terrain.
//
// GET  /api/enregistrements?vue=liste|encours
// POST /api/enregistrements { vue: "demarrer", ligneId, latitude, longitude }
// PUT  /api/enregistrements { id, audio?, transcript?, motifFin? }  -> clôture
//
// Le cycle suit la visite : le commercial confirme son arrivée (« Je suis chez
// ce client »), l'enregistrement démarre et la visite passe « En cours ».
// Il s'arrête quand le GPS constate l'éloignement, ou manuellement.

const s = (v: unknown) => (v == null ? "" : String(v).trim());
const int = (v: unknown) => {
  const x = parseInt(String(v ?? ""), 10);
  return Number.isFinite(x) ? x : null;
};

/**
 * Distance au-delà de laquelle on considère que le commercial a quitté le
 * client. 150 m absorbe la dérive d'un GPS de tablette (souvent 20 à 50 m en
 * ville) sans laisser tourner l'enregistrement pendant le trajet suivant.
 */
const RAYON_PRESENCE_M = 150;

/** Taille maximale de l'audio transmis (data URL), ~4 Mo. */
const AUDIO_MAX = 4_000_000;

export async function GET(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER", "COMMERCIAL"]);
  if (!auth.ok) return auth.res;

  const sp = req.nextUrl.searchParams;
  const vue = sp.get("vue") ?? "liste";

  // Un commercial ne consulte que ses propres enregistrements.
  const cle = auth.user.role === "COMMERCIAL" ? cleCommercial(auth.user.name) : null;
  const perimetre = cle ? { commercial: { startsWith: cle, mode: "insensitive" as const } } : {};

  // Enregistrement encore ouvert : l'écran le reprend après un rechargement.
  if (vue === "encours") {
    const row = await prisma.enregistrementVisite.findFirst({
      where: { ...perimetre, fin: null },
      orderBy: { debut: "desc" },
    });
    return NextResponse.json({ row });
  }

  const rows = await prisma.enregistrementVisite.findMany({
    where: perimetre,
    orderBy: { debut: "desc" },
    take: 200,
    // L'audio n'est pas renvoyé dans la liste : plusieurs Mo par ligne.
    select: {
      id: true, ligneId: true, commercial: true, codeCli: true, clientNom: true,
      debut: true, fin: true, duree: true, motifFin: true, transcript: true,
      latitude: true, longitude: true,
    },
  });

  return NextResponse.json({
    rows,
    total: rows.length,
    dureeTotale: rows.reduce((t, r) => t + r.duree, 0),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(["COMMERCIAL", "MANAGER", "ADMIN"]);
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => ({}));
  if (s(body.vue) !== "demarrer") {
    return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
  }

  const ligneId = int(body.ligneId);
  if (!ligneId) return NextResponse.json({ error: "Visite requise" }, { status: 400 });

  const ligne = await prisma.ligneMission.findUnique({
    where: { id: ligneId },
    include: { mission: { select: { commercial: true } } },
  });
  if (!ligne) return NextResponse.json({ error: "Visite introuvable" }, { status: 404 });

  // Un commercial ne peut pointer que sur ses propres visites.
  if (auth.user.role === "COMMERCIAL" && !memeCommercial(ligne.mission.commercial, auth.user.name)) {
    return NextResponse.json({ error: "Cette visite n'est pas la vôtre" }, { status: 403 });
  }

  const lat = Number(body.latitude);
  const lng = Number(body.longitude);
  const position = coordValide(lat, lng) ? { lat, lng } : null;

  // Contrôle de présence : « Je suis chez ce client » atteste d'un passage sur
  // place et déclenche un enregistrement. Sans vérification, le pointage
  // pouvait être fait depuis n'importe où et ne prouvait rien. On compare donc
  // la position transmise aux coordonnées du client.
  const tiers = ligne.codeCli != null
    ? await prisma.partner.findUnique({
        where: { id: ligne.codeCli },
        select: { latitude: true, longitude: true, raisonSocial: true },
      })
    : null;

  const clientLocalise = coordValide(tiers?.latitude, tiers?.longitude);
  let distanceClient: number | null = null;

  if (clientLocalise && position) {
    distanceClient = Math.round(
      distanceM(position.lat, position.lng, tiers!.latitude!, tiers!.longitude!),
    );
    // `forcer` laisse la main à l'exploitant : coordonnées client erronées,
    // livraison sur un autre site… mais le dépassement est alors tracé.
    if (distanceClient > RAYON_PRESENCE_M && body.forcer !== true) {
      return NextResponse.json(
        {
          error: `Vous êtes à ${distanceClient} m de ${tiers!.raisonSocial ?? "ce client"}`
            + ` — approchez-vous à moins de ${RAYON_PRESENCE_M} m pour pointer la visite.`,
          code: "trop-loin",
          distance: distanceClient,
          rayon: RAYON_PRESENCE_M,
        },
        { status: 409 },
      );
    }
  } else if (!position) {
    // Sans position, le pointage n'atteste de rien : on le refuse, sauf
    // décision explicite (GPS en panne, client sans coordonnées).
    if (body.forcer !== true) {
      return NextResponse.json(
        { error: "Position GPS indisponible — impossible de confirmer votre présence.",
          code: "sans-position" },
        { status: 409 },
      );
    }
  }

  // Un seul enregistrement ouvert à la fois : arriver chez un nouveau client
  // clôt implicitement le précédent, resté ouvert faute de signal GPS.
  const ouvert = await prisma.enregistrementVisite.findFirst({
    where: { commercial: auth.user.name, fin: null },
  });
  if (ouvert) {
    if (ouvert.ligneId === ligneId) {
      return NextResponse.json({ ok: true, row: ouvert, message: "Enregistrement déjà en cours" });
    }
    const fin = new Date();
    await prisma.enregistrementVisite.update({
      where: { id: ouvert.id },
      data: {
        fin,
        duree: Math.max(0, Math.round((fin.getTime() - ouvert.debut.getTime()) / 1000)),
        motifFin: "nouveau-client",
      },
    });
  }

  const [row] = await prisma.$transaction([
    prisma.enregistrementVisite.create({
      data: {
        ligneId,
        commercial: auth.user.name,
        codeCli: ligne.codeCli,
        clientNom: ligne.clientNom,
        latitude: position?.lat ?? null,
        longitude: position?.lng ?? null,
      },
    }),
    // La visite passe « En cours » et mémorise le point de pointage : c'est la
    // preuve du passage sur place.
    prisma.ligneMission.update({
      where: { id: ligneId },
      data: {
        etat: "En cours",
        dateVisite: new Date(),
        ...(position ? { latitude: position.lat, longitude: position.lng } : {}),
      },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    row,
    rayonPresence: RAYON_PRESENCE_M,
    distance: distanceClient,
    // Le pointage forcé est signalé : la présence n'a pas pu être vérifiée.
    presenceVerifiee: distanceClient != null && distanceClient <= RAYON_PRESENCE_M,
    // Ne jamais annoncer « confirmée » un pointage forcé : la mention servirait
    // ensuite de preuve d'un passage qui n'a pas été constaté.
    message: distanceClient == null
      ? `Arrivée enregistrée chez ${ligne.clientNom ?? "le client"} — présence non vérifiée (GPS indisponible)`
      : distanceClient <= RAYON_PRESENCE_M
        ? `Arrivée confirmée chez ${ligne.clientNom ?? "le client"} (${distanceClient} m) — enregistrement démarré`
        : `Pointage forcé chez ${ligne.clientNom ?? "le client"} à ${distanceClient} m — présence non vérifiée`,
  });
}

export async function PUT(req: NextRequest) {
  const auth = await requireSession(["COMMERCIAL", "MANAGER", "ADMIN"]);
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => ({}));
  const id = int(body.id);
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  const row = await prisma.enregistrementVisite.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ error: "Enregistrement introuvable" }, { status: 404 });
  if (auth.user.role === "COMMERCIAL" && !memeCommercial(row.commercial, auth.user.name)) {
    return NextResponse.json({ error: "Enregistrement d'un autre commercial" }, { status: 403 });
  }
  if (row.fin) return NextResponse.json({ ok: true, row, message: "Déjà clôturé" });

  const audio = typeof body.audio === "string" ? body.audio : null;
  if (audio && audio.length > AUDIO_MAX) {
    return NextResponse.json({ error: "Enregistrement trop volumineux (max 4 Mo)" }, { status: 413 });
  }

  const fin = new Date();
  const maj = await prisma.enregistrementVisite.update({
    where: { id },
    data: {
      fin,
      duree: Math.max(0, Math.round((fin.getTime() - row.debut.getTime()) / 1000)),
      motifFin: s(body.motifFin) || "manuel",
      ...(audio ? { audio } : {}),
      ...(body.transcript != null ? { transcript: s(body.transcript) || null } : {}),
    },
  });

  return NextResponse.json({
    ok: true,
    row: { ...maj, audio: undefined },
    message: `Enregistrement clôturé (${maj.duree} s)`,
  });
}
