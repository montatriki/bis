import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { rafraichirOperationsSiPerime } from "@/lib/sync-operations";
import { requireSession } from "@/lib/session";
import { cleCommercial, memeCommercial } from "@/lib/perimetre-commercial";
import { coordValide, distanceM } from "@/lib/geo";
import { round3 } from "@/lib/vente-stats";

// Tournée du jour : plan de travail géographique du commercial.
//
// GET  /api/tournee?date=YYYY-MM-DD          -> la tournée du jour + trajet
// POST /api/tournee { date, depart?, taille? } -> (re)génère la tournée
// PUT  /api/tournee { ligneId, etat, lat, lng } -> avancement d'une étape
//
// Les tournées importées de l'ERP n'ont aucune ligne : le planning terrain n'a
// jamais été saisi. On le construit donc automatiquement à partir des clients
// du commercial, ordonnés en trajet réaliste plutôt qu'au hasard.

const s = (v: unknown) => (v == null ? "" : String(v).trim());

/** Nom du commercial imposé pour un COMMERCIAL ; null pour ADMIN / MANAGER. */
function perimetre(user: { role: string; name: string }): string | null {
  return user.role === "COMMERCIAL" ? user.name : null;
}

/**
 * Coût attribué à chaque visite manquante quand un secteur ne remplit pas la
 * journée : un planning à 6 visites au lieu de 12 obligera à rouler un autre
 * jour. Exprimé en mètres pour rester homogène avec les distances.
 *
 * La pénalité est **ramenée à la visite**, comme les autres termes du coût.
 * Appliquée en bloc, elle écrasait tout : un commercial à Hammamet avec sept
 * clients à moins de 5 km se voyait envoyer à Sousse, 59 km plus loin, parce
 * que les cinq visites manquantes pesaient 75 km face à un secteur complet.
 */
const PENALITE_VISITE_MANQUANTE_M = 15_000;

/**
 * Distance au-delà de laquelle un secteur n'est plus « sur place ».
 *
 * En deçà, le commercial est déjà dans la zone : aucune pénalité de
 * remplissage ne justifie de lui faire traverser le pays. Visiter sept
 * clients à sa porte vaut mieux que douze à une heure de route.
 */
const RAYON_SUR_PLACE_M = 15_000;
/** Au-delà, une position ne peut pas servir de départ (point réseau, pas GPS). */
const PRECISION_DEPART_MAX_M = 300;

/** Nombre de visites planifiées par défaut dans une journée. */
const TAILLE_DEFAUT = 12;

/** Point de départ par défaut : le dépôt principal (Sousse). */
const DEPOT_DEFAUT = { lat: 35.8254, lng: 10.6084 };

/**
 * Rayon maximal d'une journée de tournée, en mètres. Au-delà, le temps de
 * route mange la journée : mieux vaut regrouper le secteur sur un autre jour.
 */
const RAYON_JOURNEE = 40_000;

/**
 * Compare deux noms de commercial en ignorant casse, accents et espaces.
 * Le champ `Partner.commercial` de l'ERP est du texte libre.
 */
type Etape = {
  id: number; codeCli: number; nom: string;
  ville: string | null; adresse: string | null; tel: string | null;
  latitude: number; longitude: number;
  soldeFin: number; numOrdre: number; etat: string;
  heurePrevue: string | null; commentaire: string | null;
  /** Distance depuis l'étape précédente, en mètres. */
  distanceDepuisPrec: number;
};

/**
 * Ordonne les clients en trajet par « plus proche voisin » : on part du dépôt
 * et on enchaîne à chaque fois le client non visité le plus proche. C'est
 * l'heuristique classique du voyageur de commerce — non optimale mais rapide
 * et bien plus réaliste qu'un ordre alphabétique ou aléatoire.
 */
function ordonnerTrajet<T extends { latitude: number; longitude: number }>(
  clients: T[],
  depart: { lat: number; lng: number },
): { client: T; distance: number }[] {
  const restants = [...clients];
  const trajet: { client: T; distance: number }[] = [];
  let courant = depart;

  while (restants.length > 0) {
    let meilleur = 0;
    let meilleureDist = Infinity;
    for (let i = 0; i < restants.length; i++) {
      const d = distanceM(courant.lat, courant.lng, restants[i].latitude, restants[i].longitude);
      if (d < meilleureDist) { meilleureDist = d; meilleur = i; }
    }
    const [choisi] = restants.splice(meilleur, 1);
    trajet.push({ client: choisi, distance: Math.round(meilleureDist) });
    courant = { lat: choisi.latitude, lng: choisi.longitude };
  }
  return trajet;
}

/** Heure prévisionnelle d'une étape : 8h + 45 min par visite. */
function heureEtape(index: number): string {
  const minutes = 8 * 60 + index * 45;
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Charge la tournée d'un jour avec ses étapes enrichies des données client. */
async function chargerTournee(
  commercial: string,
  jour: Date,
  /** Position réelle du commercial ; à défaut, le dépôt. */
  depart?: { lat: number; lng: number } | null,
) {
  const lendemain = new Date(jour.getTime() + 86_400_000);

  // Prénom : les missions portent « MOKHTAR », la session « Mokhtar Trabelsi ».
  const cle = cleCommercial(commercial);
  const lignesOrd = { orderBy: [{ numOrdre: "asc" as const }, { id: "asc" as const }] };

  // 1) La mission datée d'aujourd'hui.
  // Une tournée de l'ERP d'origine s'étend sur plusieurs jours (2888 : datée
  // du 31/08, ouverte du 31/08 11:56 au 02/09 10:46 — les ventes du 01/09 lui
  // appartiennent). On retient donc la tournée datée du jour, ou à défaut
  // celle dont la période couvre ce jour.
  const couvreLeJour = {
    commercial: { startsWith: cle, mode: "insensitive" as const },
    etat: { notIn: ["Annulée"] },
    OR: [
      { dateOrdre: { gte: jour, lt: lendemain } },
      { du: { lt: lendemain }, OR: [{ au: null }, { au: { gte: jour } }] },
    ],
  };
  let mission = await prisma.erpMission.findFirst({
    where: { ...couvreLeJour, dateOrdre: { gte: jour, lt: lendemain } },
    include: { lignes: lignesOrd },
    orderBy: { id: "desc" },
  });
  if (!mission) {
    mission = await prisma.erpMission.findFirst({
      where: couvreLeJour,
      include: { lignes: lignesOrd },
      orderBy: { dateOrdre: "desc" },
    });
  }

  // 2) Sinon, la tournée encore « En cours » : une mission ouverte hier reste
  //    la tournée active tant qu'elle n'est pas clôturée (l'admin crée l'ordre
  //    du jour le matin ; entre-temps, le commercial travaille la précédente).
  if (!mission) {
    mission = await prisma.erpMission.findFirst({
      where: {
        commercial: { startsWith: cle, mode: "insensitive" },
        etat: "En cours",
      },
      include: { lignes: lignesOrd },
      orderBy: { dateOrdre: "desc" },
    });
  }

  if (!mission || mission.lignes.length === 0) {
    return { mission, etapes: [] as Etape[] };
  }

  const codes = mission.lignes.map((l) => l.codeCli).filter((c): c is number => c != null);
  const tiers = await prisma.partner.findMany({
    where: { id: { in: codes } },
    select: {
      id: true, raisonSocial: true, ville: true, adresse: true, tel: true,
      latitude: true, longitude: true, soldeFin: true,
    },
  });
  const parId = new Map(tiers.map((t) => [t.id, t]));

  // Le trajet est reconstruit dans l'ordre des étapes. La première étape n'a
  // pas de distance « depuis la précédente » : le trajet d'approche depuis le
  // dépôt est compté à part (`distanceApproche`), sinon il gonflerait le
  // kilométrage de tournée qui doit mesurer les inter-visites.
  let precedent: { lat: number; lng: number } | null = null;
  const etapes: Etape[] = [];
  for (const l of mission.lignes) {
    const t = l.codeCli != null ? parId.get(l.codeCli) : null;
    if (!t || !coordValide(t.latitude, t.longitude)) continue;
    const d = precedent
      ? Math.round(distanceM(precedent.lat, precedent.lng, t.latitude!, t.longitude!))
      : 0;
    etapes.push({
      id: l.id,
      codeCli: t.id,
      nom: (t.raisonSocial || "").trim() || `Client ${t.id}`,
      ville: t.ville, adresse: t.adresse, tel: t.tel,
      latitude: t.latitude!, longitude: t.longitude!,
      soldeFin: round3(t.soldeFin),
      numOrdre: l.numOrdre,
      etat: l.etat,
      heurePrevue: l.heurePrevue,
      commentaire: l.commentaire,
      distanceDepuisPrec: d,
    });
    precedent = { lat: t.latitude!, lng: t.longitude! };
  }

  // Trajet d'approche : de la position du commercial (ou du dépôt à défaut)
  // jusqu'à la première visite. Le mesurer systématiquement depuis le dépôt de
  // Sousse affichait 124 km d'approche à un commercial déjà sur zone à Ariana.
  const origine = depart ?? DEPOT_DEFAUT;
  const distanceApproche = etapes.length
    ? Math.round(distanceM(origine.lat, origine.lng, etapes[0].latitude, etapes[0].longitude))
    : 0;

  return { mission, etapes, distanceApproche, origine };
}

export async function GET(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER", "COMMERCIAL"]);
  if (!auth.ok) return auth.res;
  // Production vivante : si les opérations datent, une mise à jour part en
  // arrière-plan — cette requête sert l'état connu, la suivante le frais.
  void rafraichirOperationsSiPerime();

  const sp = req.nextUrl.searchParams;
  const commercial = perimetre(auth.user) ?? s(sp.get("commercial"));
  if (!commercial) return NextResponse.json({ error: "Commercial requis" }, { status: 400 });

  const jour = sp.get("date") ? new Date(`${sp.get("date")}T00:00:00`) : new Date();
  jour.setHours(0, 0, 0, 0);

  // Position du commercial transmise par l'écran (GPS de la tablette) : elle
  // sert de point de départ réel pour le calcul du trajet d'approche.
  const posLat = Number(sp.get("lat"));
  const posLng = Number(sp.get("lng"));
  const maPosition = coordValide(posLat, posLng) ? { lat: posLat, lng: posLng } : null;

  const { mission, etapes, distanceApproche, origine } =
    await chargerTournee(commercial, jour, maPosition);

  const visitees = etapes.filter((e) => e.etat === "Visité").length;
  // L'étape courante est la première non traitée : c'est là que le commercial
  // doit se rendre.
  const courante = etapes.find((e) => e.etat === "À visiter") ?? null;

  // Véhicule affecté au commercial : la barre de tournée l'affiche même les
  // jours sans ordre de mission. Sans lui, un commercial qui n'a pas encore
  // planifié sa journée lisait « Véhicule — » alors qu'un camion lui est
  // attribué et que son stock embarqué en dépend.
  const affecte = await prisma.commercial.findFirst({
    where: { userId: auth.user.id },
    select: { vehicle: { select: { plate: true } } },
  });
  const plaqueAffectee = affecte?.vehicle?.plate.trim() ?? null;

  return NextResponse.json({
    date: jour,
    commercial,
    mission: mission
      ? {
          id: mission.id, etat: mission.etat,
          vehicule: mission.vehicule?.trim() || plaqueAffectee,
          objectifCA: mission.objectifCA,
        }
      : null,
    vehiculeAffecte: plaqueAffectee,
    depart: origine,
    etapes,
    courante,
    stats: {
      total: etapes.length,
      visitees,
      restantes: etapes.filter((e) => e.etat === "À visiter").length,
      reportees: etapes.filter((e) => e.etat === "Reporté").length,
      absentes: etapes.filter((e) => e.etat === "Absent").length,
      progression: etapes.length ? Math.round((visitees / etapes.length) * 100) : 0,
      distanceTotale: etapes.reduce((s, e) => s + e.distanceDepuisPrec, 0),
      distanceApproche,
    },
  });
}

// POST — génère (ou régénère) la tournée du jour.
export async function POST(req: NextRequest) {
  const auth = await requireSession(["COMMERCIAL", "MANAGER", "ADMIN"]);
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => ({}));
  const commercial = perimetre(auth.user) ?? s(body?.commercial);
  if (!commercial) return NextResponse.json({ error: "Commercial requis" }, { status: 400 });

  const jour = body?.date ? new Date(`${body.date}T00:00:00`) : new Date();
  jour.setHours(0, 0, 0, 0);
  const lendemain = new Date(jour.getTime() + 86_400_000);

  const taille = Math.min(30, Math.max(3, Number(body?.taille) || TAILLE_DEFAUT));
  // Un point de départ trop imprécis est refusé plutôt que remplacé par le
  // dépôt : une position réseau (2–3 km) bâtissait une tournée sur Tunis
  // centre alors que le commercial était à Radès, et le dépôt de Sousse
  // serait pire encore. Le client renvoie alors le message au commercial.
  const precisionDepart = Number(body?.depart?.precision);
  if (Number.isFinite(precisionDepart) && precisionDepart > PRECISION_DEPART_MAX_M) {
    return NextResponse.json(
      { error: `Position trop imprécise (±${Math.round(precisionDepart)} m) — attendez le signal GPS` },
      { status: 400 },
    );
  }
  const depart = coordValide(body?.depart?.lat, body?.depart?.lng)
    ? { lat: Number(body.depart.lat), lng: Number(body.depart.lng) }
    : DEPOT_DEFAUT;

  // Clients du commercial disposant de coordonnées exploitables.
  const tous = await prisma.partner.findMany({
    where: {
      nature: "C", archiver: 0,
      // La tournée se construit sur le portefeuille du commercial : planifier
      // la visite d'un client d'un collègue n'aurait pas de sens.
      commercial: { startsWith: cleCommercial(commercial), mode: "insensitive" },
      AND: [{ latitude: { not: null } }, { longitude: { not: null } }],
    },
    select: {
      id: true, raisonSocial: true, ville: true, adresse: true, tel: true,
      latitude: true, longitude: true, soldeFin: true, commercial: true,
    },
  });

  // Rattachement par **prénom**, comme dans tout le reste de l'application
  // (`cleCommercial`). Comparer les noms complets ne retenait ici que les
  // 24 clients orthographiés « mokhtar trabelsi » et écartait les 467 saisis
  // « MOKHTAR » : la tournée se construisait sur 4 % du portefeuille, ce qui
  // faisait ignorer des clients situés à 1 km au profit d'autres à 7 km.
  const cle = cleCommercial(commercial);
  const siens = tous.filter(
    (c) => coordValide(c.latitude, c.longitude) && cleCommercial(c.commercial ?? "") === cle,
  );
  // Un commercial sans portefeuille nominatif (données ERP hétérogènes) se voit
  // proposer les clients les plus proches du point de départ.
  const base = siens.length >= 3 ? siens : tous.filter((c) => coordValide(c.latitude, c.longitude));

  if (base.length === 0) {
    return NextResponse.json({ error: "Aucun client géolocalisé à planifier" }, { status: 400 });
  }

  const geo = base.map((c) => ({ ...c, latitude: c.latitude!, longitude: c.longitude! }));

  const rayonDemande = Number(body?.rayon);
  const rayon = Number.isFinite(rayonDemande) && rayonDemande > 0
    ? Math.min(200_000, rayonDemande)
    : RAYON_JOURNEE;

  // Le commercial est-il déjà entouré de clients ?
  //
  // C'est le cas le plus fréquent sur le terrain, et le plus mal traité
  // jusqu'ici : parti de Hammamet avec 23 clients à moins de 15 km, le
  // planificateur cherchait le *meilleur amas* du portefeuille et l'envoyait
  // à Sousse, 59 km plus loin, parce que l'amas y était plus dense. Un
  // commercial ne traverse pas le pays quand sa journée est faisable à sa
  // porte.
  //
  // On sert donc d'abord ce qui l'entoure ; la recherche de secteur ne
  // reprend la main que s'il n'y a pas de quoi remplir la journée sur place.
  const autourDeMoi = geo
    .map((c) => ({ c, d: distanceM(depart.lat, depart.lng, c.latitude, c.longitude) }))
    .filter((x) => x.d <= rayon)
    .sort((a, b) => a.d - b.d);

  const groupeDe = (centre: (typeof geo)[number]) =>
    geo.filter((c) => distanceM(centre.latitude, centre.longitude, c.latitude, c.longitude) <= rayon);

  let meilleurGroupe: typeof geo = [];
  let meilleurCout = Number.POSITIVE_INFINITY;

  if (autourDeMoi.length >= taille) {
    // De quoi remplir la journée sans quitter la zone : on retient les clients
    // les plus proches, la sélection fine et l'ordre de passage étant traités
    // plus bas.
    meilleurGroupe = autourDeMoi.map((x) => x.c);
    meilleurCout = 0;
  }

  for (const centre of meilleurGroupe.length >= taille ? [] : geo) {
    const groupe = groupeDe(centre);
    // Un secteur qui ne remplit pas la journée oblige à rouler davantage
    // ailleurs : on pénalise proportionnellement aux visites manquantes.
    const retenues = Math.min(groupe.length, taille);
    if (retenues === 0) continue;

    const approche = distanceM(depart.lat, depart.lng, centre.latitude, centre.longitude);
    // Rayon moyen du secteur ≈ étalement des visites : proxy du trajet interne.
    const etalement =
      groupe.reduce((t, c) => t + distanceM(centre.latitude, centre.longitude, c.latitude, c.longitude), 0) /
      groupe.length;

    // Coût ramené à la visite : c'est ce qui compte pour l'exploitant.
    //
    // L'approche est payée **une fois** pour toute la journée, la pénalité de
    // remplissage est donc elle aussi ramenée à la visite — sinon elle domine
    // tout le calcul et envoie au loin un commercial déjà entouré de clients.
    const manquantes = taille - retenues;
    // Un secteur où l'on se trouve déjà ne se pénalise pas : la journée peut
    // être complétée sur place ou le lendemain, sans un aller de 60 km.
    const penalite = approche <= RAYON_SUR_PLACE_M
      ? 0
      : (manquantes * PENALITE_VISITE_MANQUANTE_M) / taille;

    const cout = (approche + etalement * retenues) / retenues + penalite;

    if (cout < meilleurCout) { meilleurGroupe = groupe; meilleurCout = cout; }
  }

  // Sélection des visites du jour.
  //
  // Deux corrections par rapport à la version précédente, qui produisait des
  // tournées absurdes — elle ignorait des clients à 1 km pour en retenir à 7 km :
  //
  //  1. La distance se mesure depuis **le commercial**, pas depuis l'ancre du
  //     secteur. L'ancre sert à choisir la zone ; une fois la zone choisie,
  //     c'est la position réelle qui décide de ce qu'on va visiter.
  //  2. Le bonus « débiteur » vaut 1,5 km, pas 8 km. À 8 km il écrasait la
  //     distance : un débiteur à 7 km passait devant le client d'en face, et
  //     l'ancre elle-même — pourtant le client le plus proche — sortait de sa
  //     propre tournée. Une relance justifie un petit détour, pas la journée.
  const BONUS_DEBITEUR_M = 1_500;
  const candidats = meilleurGroupe
    .map((c) => ({
      ...c,
      score:
        distanceM(depart.lat, depart.lng, c.latitude, c.longitude) -
        (c.soldeFin > 0 ? BONUS_DEBITEUR_M : 0),
    }))
    .sort((a, b) => a.score - b.score)
    .slice(0, taille);

  // Le trajet part de **là où se trouve le commercial** : la première visite
  // est la plus proche de lui, pas la plus proche du centre du secteur.
  const trajet = ordonnerTrajet(candidats, depart);

  // La tournée du jour est remplacée : on repart d'un planning propre.
  const existante = await prisma.erpMission.findFirst({
    where: {
      // Prénom : les missions portent « MOKHTAR », la session « Mokhtar Trabelsi ».
      commercial: { startsWith: cleCommercial(commercial), mode: "insensitive" },
      dateOrdre: { gte: jour, lt: lendemain },
      etat: { notIn: ["Annulée"] },
    },
    orderBy: { id: "desc" },
  });

  // Véhicule du commercial : l'ordre de mission le porte en production, et
  // c'est lui qu'affichent la barre de tournée et le relevé kilométrique. Une
  // tournée créée sans véhicule laissait « Véhicule — » à l'écran alors que le
  // commercial en a bien un affecté.
  const affectation = await prisma.commercial.findFirst({
    where: { userId: auth.user.id },
    select: { vehicle: { select: { plate: true } } },
  });
  const plaque = affectation?.vehicle?.plate.trim() || null;

  let missionId: number;
  if (existante) {
    missionId = existante.id;
    await prisma.ligneMission.deleteMany({ where: { dayId: missionId } });
    // Tournée rejouée : on complète le véhicule s'il manquait.
    if (plaque && !existante.vehicule?.trim()) {
      await prisma.erpMission.update({ where: { id: missionId }, data: { vehicule: plaque } });
    }
  } else {
    // `ErpMission.id` reprend `id_day` de l'ERP : pas d'auto-incrément.
    const dernier = await prisma.erpMission.findFirst({ orderBy: { id: "desc" }, select: { id: true } });
    missionId = (dernier?.id ?? 0) + 1;
    await prisma.erpMission.create({
      data: {
        id: missionId,
        commercial,
        vehicule: plaque,
        utilisateur: auth.user.login,
        dateOrdre: jour,
        etat: "En cours",
      },
    });
  }

  await prisma.ligneMission.createMany({
    data: trajet.map((t, i) => ({
      dayId: missionId,
      codeCli: t.client.id,
      clientNom: (t.client.raisonSocial || "").trim() || `Client ${t.client.id}`,
      numOrdre: i + 1,
      etat: "À visiter",
      heurePrevue: heureEtape(i),
      motif: t.client.soldeFin > 0 ? "Recouvrement" : "Visite commerciale",
    })),
  });

  const { mission, etapes, distanceApproche } = await chargerTournee(commercial, jour, depart);
  return NextResponse.json({
    ok: true,
    message: `Tournée générée — ${etapes.length} client(s)`,
    mission: mission ? { id: mission.id, etat: mission.etat } : null,
    depart,
    etapes,
    stats: {
      total: etapes.length,
      distanceTotale: etapes.reduce((s, e) => s + e.distanceDepuisPrec, 0),
      distanceApproche,
    },
  });
}

// PUT — avancement d'une étape (visité / reporté / absent).
export async function PUT(req: NextRequest) {
  const auth = await requireSession(["COMMERCIAL", "MANAGER", "ADMIN"]);
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => ({}));
  const ligneId = Number(body?.ligneId);
  const etat = s(body?.etat);

  const ETATS = ["À visiter", "Visité", "Reporté", "Absent"];
  if (!Number.isFinite(ligneId)) return NextResponse.json({ error: "Étape requise" }, { status: 400 });
  if (!ETATS.includes(etat)) return NextResponse.json({ error: "État invalide" }, { status: 400 });

  const ligne = await prisma.ligneMission.findUnique({
    where: { id: ligneId },
    include: { mission: true },
  });
  if (!ligne) return NextResponse.json({ error: "Étape introuvable" }, { status: 404 });

  // Un commercial ne peut faire avancer que sa propre tournée.
  const impose = perimetre(auth.user);
  // Même clé que partout ailleurs : les missions portent « MOKHTAR » là où la
  // session porte « Mokhtar Trabelsi ». Comparer les noms complets refusait au
  // commercial l'accès à sa propre tournée.
  if (impose && !memeCommercial(ligne.mission.commercial, impose)) {
    return NextResponse.json({ error: "Tournée d'un autre commercial" }, { status: 403 });
  }

  // La position du terminal au moment du passage est conservée : elle atteste
  // que la visite a bien eu lieu sur place.
  const lat = Number(body?.lat);
  const lng = Number(body?.lng);
  const aGeo = coordValide(lat, lng);

  const maj = await prisma.ligneMission.update({
    where: { id: ligneId },
    data: {
      etat,
      dateVisite: etat === "À visiter" ? null : new Date(),
      ...(aGeo ? { latitude: lat, longitude: lng } : {}),
      ...(body?.commentaire !== undefined ? { commentaire: s(body.commentaire) || null } : {}),
    },
  });

  return NextResponse.json({ ok: true, ligne: maj, message: `Étape marquée « ${etat} »` });
}
