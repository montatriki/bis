import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { coordValide, distanceM, SEUIL_PRESENCE_M } from "@/lib/geo";
import { memePortefeuille } from "@/lib/perimetre-commercial";
import { dateLocaleIso } from "@/lib/date-locale";

// Journal des visites terrain (table `visites_client`).
//
// POST /api/visites            -> le commercial pointe « je suis là »
// GET  /api/visites?clientId=  -> journal d'un client
// GET  /api/visites?du=&au=&commercial=&search=  -> rapport (admin/manager)
//
// Le pointage est un fait daté : il n'est ni modifiable ni supprimable, sinon
// le rapport admin ne vaudrait rien.

export async function POST(req: NextRequest) {
  const auth = await requireSession(["COMMERCIAL", "MANAGER", "ADMIN"]);
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => ({}));
  const clientId = Number(body?.clientId);
  if (!Number.isFinite(clientId) || clientId <= 0) {
    return NextResponse.json({ error: "Client invalide" }, { status: 400 });
  }

  const client = await prisma.partner.findUnique({ where: { id: clientId } });
  if (!client || client.nature !== "C") {
    return NextResponse.json({ error: "Client introuvable" }, { status: 404 });
  }
  // Un commercial ne pointe que ses propres clients.
  if (auth.user.role === "COMMERCIAL" && !memePortefeuille(client.commercial, auth.user.name)) {
    return NextResponse.json({ error: "Ce client n'est pas dans votre portefeuille" }, { status: 403 });
  }

  // Position du commercial : le navigateur ne la donne pas toujours (refus,
  // intérieur de bâtiment). On enregistre alors la visite sans distance
  // plutôt que de la refuser — le rapport indiquera « position inconnue ».
  const lat = Number(body?.latitude), lng = Number(body?.longitude);
  const posCommercial = coordValide(lat, lng) ? { lat, lng } : null;

  // Position du client, éventuellement corrigée à l'instant par le commercial.
  let latClient = client.latitude, lngClient = client.longitude;
  let positionCorrigee = false;
  if (body?.corrigerPosition === true) {
    if (!posCommercial) {
      return NextResponse.json({ error: "Position GPS indisponible : impossible de corriger" }, { status: 400 });
    }
    // Corriger, c'est dire « le client est là où je suis ».
    latClient = posCommercial.lat;
    lngClient = posCommercial.lng;
    positionCorrigee = true;
    await prisma.partner.update({
      where: { id: clientId },
      data: { latitude: latClient, longitude: lngClient },
    });
  }

  const distance =
    posCommercial && coordValide(latClient, lngClient)
      ? Math.round(distanceM(posCommercial.lat, posCommercial.lng, latClient as number, lngClient as number))
      : null;

  const visite = await prisma.visiteClient.create({
    data: {
      clientId,
      clientNom: client.raisonSocial,
      adresse: [client.ville, client.gouvernorat].filter(Boolean).join(" — ") || client.adresse || null,
      userId: auth.user.id ?? null,
      commercialNom: auth.user.name,
      latCommercial: posCommercial?.lat ?? null,
      lngCommercial: posCommercial?.lng ?? null,
      latClient: coordValide(latClient, lngClient) ? latClient : null,
      lngClient: coordValide(latClient, lngClient) ? lngClient : null,
      distanceM: distance,
      surPlace: distance !== null && distance <= SEUIL_PRESENCE_M,
      positionCorrigee,
      commentaire: String(body?.commentaire ?? "").trim() || null,
    },
  });

  return NextResponse.json({ ok: true, visite, seuilM: SEUIL_PRESENCE_M });
}

export async function GET(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER", "COMMERCIAL"]);
  if (!auth.ok) return auth.res;
  const sp = req.nextUrl.searchParams;

  // Journal d'un client : lu par l'index (clientId, visiteLe).
  const clientId = Number(sp.get("clientId"));
  if (Number.isFinite(clientId) && clientId > 0) {
    const client = await prisma.partner.findUnique({
      where: { id: clientId },
      select: { commercial: true },
    });
    if (auth.user.role === "COMMERCIAL" && !memePortefeuille(client?.commercial, auth.user.name)) {
      return NextResponse.json({ error: "Ce client n'est pas dans votre portefeuille" }, { status: 403 });
    }
    const rows = await prisma.visiteClient.findMany({
      where: { clientId },
      orderBy: { visiteLe: "desc" },
      take: Math.min(Number(sp.get("limit")) || 50, 200),
    });
    return NextResponse.json({ rows, seuilM: SEUIL_PRESENCE_M });
  }

  // Rapport : par période, commercial, ou nom de client.
  const du = sp.get("du"), au = sp.get("au");
  const where: Record<string, unknown> = {};
  if (du || au) {
    // `au` est inclusif : la journée entière, pas jusqu'à minuit pile.
    const fin = au ? new Date(`${au}T23:59:59.999`) : undefined;
    where.visiteLe = { ...(du ? { gte: new Date(`${du}T00:00:00`) } : {}), ...(fin ? { lte: fin } : {}) };
  }
  // Un commercial ne voit que ses propres pointages.
  if (auth.user.role === "COMMERCIAL") {
    where.commercialNom = { equals: auth.user.name, mode: "insensitive" };
  } else {
    const com = sp.get("commercial")?.trim();
    if (com) where.commercialNom = { equals: com, mode: "insensitive" };
  }
  const search = sp.get("search")?.trim();
  if (search) where.clientNom = { contains: search, mode: "insensitive" };

  const limit = Math.min(Number(sp.get("limit")) || 200, 1000);
  const [rows, total] = await Promise.all([
    prisma.visiteClient.findMany({ where, orderBy: { visiteLe: "desc" }, take: limit }),
    prisma.visiteClient.count({ where }),
  ]);

  // Repères du rapport : combien de passages réellement sur place.
  const surPlace = rows.filter((r) => r.surPlace).length;
  const clients = new Set(rows.map((r) => r.clientId)).size;

  return NextResponse.json({
    rows, total, limit,
    resume: { visites: rows.length, surPlace, clients, jour: dateLocaleIso(new Date()) },
    seuilM: SEUIL_PRESENCE_M,
  });
}
