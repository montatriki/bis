import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { rafraichirOperationsSiPerime } from "@/lib/sync-operations";
import { requireSession } from "@/lib/session";
import { round3 } from "@/lib/vente-stats";
import { coordValide, distanceM } from "@/lib/geo";
import { filtrePortefeuille, memePortefeuille } from "@/lib/perimetre-commercial";

// Clients réels (table `partners`, nature C) pour les écrans commerciaux.
//
// GET  /api/clients?search=&gouvernorat=&creances=1&limit=
//   creances=1 -> uniquement les clients avec un solde débiteur (recouvrement)
// POST /api/clients  -> création d'un point de vente depuis le terrain

export async function GET(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER", "COMMERCIAL"]);
  if (!auth.ok) return auth.res;
  // Production vivante : si les opérations datent, une mise à jour part en
  // arrière-plan — cette requête sert l'état connu, la suivante le frais.
  void rafraichirOperationsSiPerime();

  const sp = req.nextUrl.searchParams;

  // Détail d'un client : ses documents non soldés (écran recouvrement).
  const codeCli = sp.get("codeCli");
  if (codeCli) {
    const id = Number(codeCli);
    const [client, docs] = await Promise.all([
      prisma.partner.findUnique({ where: { id } }),
      prisma.erpDocument.findMany({
        where: { codeCli: id, nature: "Vente" },
        orderBy: { dateDoc: "desc" },
        take: 50,
        select: { refDoc: true, typeDoc: true, dateDoc: true, ttcNet: true, soldeDoc: true, totalRegle: true, etat: true },
      }),
    ]);
    if (!client) return NextResponse.json({ error: "Client introuvable" }, { status: 404 });
    // Un commercial ne peut pas ouvrir la fiche d'un client d'un collègue en
    // devinant son code.
    if (auth.user.role === "COMMERCIAL" && !memePortefeuille(client.commercial, auth.user.name)) {
      return NextResponse.json({ error: "Ce client n'est pas dans votre portefeuille" }, { status: 403 });
    }
    return NextResponse.json({ client, docs });
  }

  // Mode carte : tous les clients géolocalisés du portefeuille, champs
  // minimaux, sans limite — la carte doit montrer l'ensemble, pas une page.
  if (sp.get("geo") === "1") {
    const govGeo = (sp.get("gouvernorat") ?? "").trim();
    const rechGeo = (sp.get("search") ?? "").trim();
    const rows = await prisma.partner.findMany({
      where: {
        nature: "C", ...(filtrePortefeuille(auth.user) ?? {}),
        latitude: { not: null }, longitude: { not: null },
        // Mêmes filtres que la liste : la carte montre ce que la liste montre.
        ...(govGeo && govGeo !== "Tous" ? { gouvernorat: { equals: govGeo, mode: "insensitive" as const } } : {}),
        ...(rechGeo
          ? { OR: [{ raisonSocial: { contains: rechGeo, mode: "insensitive" as const } }, { ville: { contains: rechGeo, mode: "insensitive" as const } }] }
          : {}),
      },
      select: { id: true, raisonSocial: true, ville: true, latitude: true, longitude: true, soldeFin: true, tel: true },
    });
    // (0,0) est la valeur « non renseignée » héritée de l'import : pas un point.
    return NextResponse.json({ rows: rows.filter((c) => !(c.latitude === 0 && c.longitude === 0)) });
  }

  const search = (sp.get("search") ?? "").trim();
  const gouvernorat = (sp.get("gouvernorat") ?? "").trim();
  const creances = sp.get("creances") === "1";
  const limit = Math.min(500, Math.max(1, parseInt(sp.get("limit") ?? "200", 10)));

  // Un commercial ne voit que son portefeuille ; ADMIN et MANAGER voient tout.
  const portefeuille = filtrePortefeuille(auth.user);

  const where = {
    nature: "C",
    ...(portefeuille ?? {}),
    ...(creances ? { soldeFin: { gt: 0 } } : {}),
    // insensitive : les données mélangent "TUNIS" et "Tunis"
    ...(gouvernorat && gouvernorat !== "Tous"
      ? { gouvernorat: { equals: gouvernorat, mode: "insensitive" as const } }
      : {}),
    ...(search
      ? { OR: [{ raisonSocial: { contains: search, mode: "insensitive" as const } }, { ville: { contains: search, mode: "insensitive" as const } }] }
      : {}),
  };

  const [rows, total, agg, gouvernorats, familles] = await Promise.all([
    prisma.partner.findMany({
      where,
      orderBy: creances ? { soldeFin: "desc" } : { raisonSocial: "asc" },
      take: limit,
      select: {
        id: true, raisonSocial: true, ville: true, gouvernorat: true, tel: true, email: true,
        adresse: true, famille: true, sousFamille: true, soldeFin: true, debit: true, credit: true,
        plafond: true, latitude: true, longitude: true, matriculeF: true,
        codeTva: true, cletva: true, categorieTva: true, etabTva: true, registreCom: true,
      },
    }),
    prisma.partner.count({ where }),
    prisma.partner.aggregate({ where, _sum: { soldeFin: true } }),
    prisma.partner.findMany({
      where: { nature: "C", gouvernorat: { not: null } },
      distinct: ["gouvernorat"],
      select: { gouvernorat: true },
      orderBy: { gouvernorat: "asc" },
    }),
    prisma.refTable.findMany({ where: { kind: "famille-cli" }, select: { label: true }, orderBy: { label: "asc" } }),
  ]);

  // Les données importées mélangent les casses ("TUNIS" / "Tunis") : on
  // dédoublonne sans casse en gardant la première graphie rencontrée.
  const vus = new Map<string, string>();
  for (const g of gouvernorats) {
    const v = (g.gouvernorat ?? "").trim();
    if (!v) continue;
    const k = v.toLocaleLowerCase("fr");
    if (!vus.has(k)) vus.set(k, v);
  }

  return NextResponse.json({
    rows,
    total,
    totalCreances: round3(agg._sum.soldeFin ?? 0),
    gouvernorats: [...vus.values()].sort((a, b) => a.localeCompare(b, "fr")),
    familles: familles.map((f) => f.label).filter(Boolean),
  });
}

// PUT /api/clients { id, raisonSocial?, adresse?, tel?, email?, ville?, gouvernorat?,
//                    famille?, matriculeF?, codeTva?, cletva?, categorieTva?, registreCom?,
//                    latitude?, longitude? }
//
// Mise à jour d'un client depuis le terrain — l'écran « Modifier un client »
// de l'ancien mobile. Un commercial ne modifie que son portefeuille. Les
// soldes (débit, crédit, solde) et le commercial affecté ne passent jamais
// par ici : ils sont pilotés par les documents, les règlements et l'admin.
/** Taille maximale de la photo du point de vente (data URL), ~600 Ko. */
const PHOTO_MAX = 600_000;

export async function PUT(req: NextRequest) {
  const auth = await requireSession(["COMMERCIAL", "MANAGER", "ADMIN"]);
  if (!auth.ok) return auth.res;
  const body = await req.json().catch(() => ({}));
  const id = Number(body?.id);
  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: "Client invalide" }, { status: 400 });

  const client = await prisma.partner.findUnique({ where: { id } });
  if (!client || client.nature !== "C") return NextResponse.json({ error: "Client introuvable" }, { status: 404 });
  if (auth.user.role === "COMMERCIAL" && !memePortefeuille(client.commercial, auth.user.name)) {
    return NextResponse.json({ error: "Ce client n'est pas dans votre portefeuille" }, { status: 403 });
  }

  const texte = (k: string) => (body?.[k] === undefined ? undefined : String(body[k] ?? "").trim() || null);
  const raisonSocial = texte("raisonSocial");
  if (raisonSocial === null) return NextResponse.json({ error: "La raison sociale est obligatoire" }, { status: 400 });

  // Coordonnées : les deux ou aucune ; (0,0) et hors Tunisie sont refusés.
  let latitude: number | null | undefined, longitude: number | null | undefined;
  if (body?.latitude !== undefined || body?.longitude !== undefined) {
    const lat = Number(body?.latitude), lng = Number(body?.longitude);
    if (body.latitude === null || body.latitude === "") { latitude = null; longitude = null; }
    else if (!coordValide(lat, lng)) return NextResponse.json({ error: "Coordonnées GPS invalides" }, { status: 400 });
    else { latitude = lat; longitude = lng; }
  }

  const tel = body?.tel === undefined ? undefined : (normaliserTel(body.tel) || null);

  // Photo de la devanture : ajoutée ou remplacée depuis le terrain. Absente du
  // corps = inchangée ; `null` explicite = supprimée. Mêmes contrôles qu'à la
  // création — sans eux, un envoi malformé passerait en base.
  let photo: string | null | undefined;
  if (body?.photo !== undefined) {
    if (body.photo === null || body.photo === "") {
      photo = null;
    } else if (typeof body.photo !== "string" || !body.photo.startsWith("data:image/")) {
      return NextResponse.json({ error: "Format de photo non supporté" }, { status: 400 });
    } else if (body.photo.length > PHOTO_MAX) {
      return NextResponse.json({ error: "Photo trop lourde (max ~600 Ko)" }, { status: 400 });
    } else {
      photo = body.photo;
    }
  }

  const row = await prisma.partner.update({
    where: { id },
    data: {
      raisonSocial: raisonSocial ?? undefined,
      adresse: texte("adresse"), tel, email: texte("email"),
      ville: texte("ville"), gouvernorat: texte("gouvernorat"),
      famille: texte("famille"), matriculeF: texte("matriculeF"),
      codeTva: texte("codeTva"), cletva: texte("cletva"), categorieTva: texte("categorieTva"),
      etabTva: texte("etabTva"),
      registreCom: texte("registreCom"),
      latitude, longitude, photo,
    },
    select: {
      id: true, raisonSocial: true, ville: true, gouvernorat: true, tel: true, email: true,
      adresse: true, famille: true, sousFamille: true, soldeFin: true, debit: true, credit: true,
      plafond: true, latitude: true, longitude: true, matriculeF: true,
      codeTva: true, cletva: true, categorieTva: true, etabTva: true, registreCom: true, photo: true,
    },
  });
  return NextResponse.json({ ok: true, client: row });
}

/**
 * Téléphone réduit à ses chiffres significatifs, indicatif tunisien retiré.
 * « 98 123 456 », « +216 98123456 » et « 0021698123456 » désignent le même
 * abonné : sans cette normalisation, le contrôle d'unicité serait contournable
 * en ajoutant un espace.
 */
function normaliserTel(v: unknown): string {
  const chiffres = String(v ?? "").replace(/\D/g, "");
  return chiffres.replace(/^(00216|216)/, "");
}

/**
 * Rayon en dessous duquel deux points de vente sont considérés comme le même.
 * 25 m tolère l'imprécision d'un GPS de tablette tout en distinguant deux
 * commerces voisins — 138 clients de l'import partagent des coordonnées
 * arrondies sans être des doublons.
 */
const RAYON_DOUBLON_M = 25;

/** Client déjà enregistré à quelques mètres de la position donnée. */
async function clientTropProche(lat: number, lng: number) {
  // Pré-filtre grossier (~0.01° ≈ 1,1 km) pour ne pas parcourir les 2 449
  // tiers à chaque création.
  const candidats = await prisma.partner.findMany({
    where: {
      latitude: { gte: lat - 0.01, lte: lat + 0.01 },
      longitude: { gte: lng - 0.01, lte: lng + 0.01 },
    },
    select: { id: true, raisonSocial: true, latitude: true, longitude: true },
  });

  for (const c of candidats) {
    if (c.latitude == null || c.longitude == null) continue;
    // Les positions 0,0 de l'import sont des valeurs par défaut, pas des lieux.
    if (c.latitude === 0 && c.longitude === 0) continue;
    const distance = distanceM(lat, lng, c.latitude, c.longitude);
    if (distance <= RAYON_DOUBLON_M) {
      return { id: c.id, raisonSocial: c.raisonSocial, distance };
    }
  }
  return null;
}

// POST /api/clients — création d'un point de vente par le commercial en tournée.
// La position GPS et la photo de la devanture sont capturées sur place : elles
// permettent de retrouver le client automatiquement lors des visites suivantes.
export async function POST(req: NextRequest) {
  const auth = await requireSession(["COMMERCIAL", "MANAGER", "ADMIN"]);
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => ({}));
  const raisonSocial = String(body?.raisonSocial ?? "").trim();
  if (!raisonSocial) {
    return NextResponse.json({ error: "La raison sociale est obligatoire" }, { status: 400 });
  }

  const lat = Number(body?.latitude);
  const lng = Number(body?.longitude);
  const aGeo = coordValide(lat, lng);

  const photo = typeof body?.photo === "string" ? body.photo : null;
  if (photo && !photo.startsWith("data:image/")) {
    return NextResponse.json({ error: "Format de photo non supporté" }, { status: 400 });
  }
  if (photo && photo.length > PHOTO_MAX) {
    return NextResponse.json({ error: "Photo trop volumineuse (max 600 Ko)" }, { status: 413 });
  }

  // ── Champs obligatoires à la création ────────────────────────────────
  // Ces règles ne valent que pour les NOUVEAUX clients : les 2 399 tiers
  // importés n'ont ni matricule fiscal ni photo, et restent modifiables tels
  // quels par l'administrateur (voir PUT).
  const tel = normaliserTel(body?.tel);
  const matriculeF = String(body?.matriculeF ?? "").trim();

  if (!tel) {
    return NextResponse.json({ error: "Le numéro de téléphone est obligatoire" }, { status: 400 });
  }
  if (!matriculeF) {
    return NextResponse.json({ error: "Le matricule fiscal est obligatoire" }, { status: 400 });
  }
  if (!photo) {
    return NextResponse.json({ error: "La photo du point de vente est obligatoire" }, { status: 400 });
  }
  if (!aGeo) {
    return NextResponse.json(
      { error: "La position GPS est obligatoire — activez la localisation sur place" },
      { status: 400 },
    );
  }

  // ── Unicité (téléphone, matricule fiscal, position) ──────────────────
  // Comparaison sur le téléphone normalisé : « 98 123 456 » et « 98123456 »
  // désignent le même client.
  const [avecTel, memeMf] = await Promise.all([
    // Comparaison en mémoire : la normalisation (espaces, indicatif) ne
    // s'exprime pas en SQL sans fonction dédiée.
    prisma.partner.findMany({
      where: { tel: { not: null } },
      select: { id: true, raisonSocial: true, tel: true },
    }),
    prisma.partner.findFirst({
      where: { matriculeF: { equals: matriculeF, mode: "insensitive" } },
      select: { id: true, raisonSocial: true },
    }),
  ]);
  const memeTel = avecTel.find((c) => normaliserTel(c.tel) === tel) ?? null;

  if (memeTel) {
    return NextResponse.json(
      { error: `Ce téléphone est déjà utilisé par « ${memeTel.raisonSocial} » (code ${memeTel.id})` },
      { status: 409 },
    );
  }
  if (memeMf) {
    return NextResponse.json(
      { error: `Ce matricule fiscal est déjà utilisé par « ${memeMf.raisonSocial} » (code ${memeMf.id})` },
      { status: 409 },
    );
  }

  // Position : deux commerces d'une même rue peuvent partager des coordonnées
  // arrondies (138 cas dans l'import). On ne refuse donc que le vrai doublon,
  // c'est-à-dire un client déjà enregistré à quelques mètres.
  // Le commercial est devant la boutique : c'est lui qui voit s'il s'agit du
  // même commerce ou du voisin. On l'avertit, et il confirme (`forcer`) en
  // connaissance de cause plutôt que d'être bloqué sur le terrain.
  const proche = aGeo && !body?.forcer ? await clientTropProche(lat, lng) : null;
  if (proche) {
    return NextResponse.json(
      {
        code: "client-proche",
        client: { id: proche.id, raisonSocial: proche.raisonSocial, distance: Math.round(proche.distance) },
        error:
          `Un client existe déjà à cet endroit : « ${proche.raisonSocial} » ` +
          `(code ${proche.id}, ${Math.round(proche.distance)} m)`,
      },
      { status: 409 },
    );
  }

  // `Partner.id` reprend `Code_cli` de l'ERP et n'est pas auto-incrémenté :
  // on prend la valeur suivante au-dessus du plus grand code client existant.
  const dernier = await prisma.partner.findFirst({
    where: { nature: "C" },
    orderBy: { id: "desc" },
    select: { id: true },
  });
  const id = (dernier?.id ?? 41_100_000) + 1;

  const client = await prisma.partner.create({
    data: {
      id,
      nature: "C",
      raisonSocial,
      adresse: String(body?.adresse ?? "").trim() || null,
      ville: String(body?.ville ?? "").trim() || null,
      gouvernorat: String(body?.gouvernorat ?? "").trim() || null,
      tel: tel || null,
      email: String(body?.email ?? "").trim() || null,
      matriculeF: matriculeF || null,
      // Segments du matricule fiscal, saisis séparément côté terrain comme
      // dans l'ERP d'origine : ce sont eux que lisent les écrans admin et les
      // documents, `matriculeF` n'en étant que la forme concaténée.
      codeTva: String(body?.codeTva ?? "").trim() || null,
      cletva: String(body?.cletva ?? "").trim().toUpperCase() || null,
      categorieTva: String(body?.categorieTva ?? "").trim().toUpperCase() || null,
      etabTva: String(body?.etabTva ?? "").trim() || null,
      famille: String(body?.famille ?? "").trim() || null,
      latitude: aGeo ? lat : null,
      longitude: aGeo ? lng : null,
      plafond: Number.isFinite(Number(body?.plafond)) ? Number(body.plafond) : null,
      photo,
      creePar: auth.user.name || auth.user.login,
      commercial: auth.user.name || auth.user.login,
      dateCreation: new Date(),
    },
    select: {
      id: true, raisonSocial: true, ville: true, gouvernorat: true, adresse: true,
      tel: true, latitude: true, longitude: true, photo: true,
    },
  });

  return NextResponse.json({ ok: true, client, message: `Client ${raisonSocial} créé` }, { status: 201 });
}
