import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { round3 } from "@/lib/vente-stats";
import { filtrePortefeuille } from "@/lib/perimetre-commercial";
import { rafraichirStockSiPerime } from "@/lib/sync-production";
import { appliquerReleveMission, synchroniserKilometrages, vehiculesNonReferences } from "@/lib/kilometrage-vehicules";
import {
  ETATS_MISSION, ETATS_VISITE, cloturerTournee, creerTournee, estCloturee,
  reconcilierTournee, stockVehicule,
} from "@/lib/missions";

// Tournées de vente ambulante — planning, visites, réconciliation.
//
// GET    /api/missions?vue=liste|jour|detail|reconciliation|stock-vehicule|clients|stats
// POST   /api/missions { vue: "tournee"|"visite"|"cloturer" }
// PUT    /api/missions { vue: "visite"|"tournee", id, ... }
// DELETE /api/missions?vue=tournee|visite&id=…
//
// Un COMMERCIAL ne voit que ses propres tournées : le périmètre vient de la
// session, jamais de l'URL.

const s = (v: unknown) => (v == null ? "" : String(v).trim());
const int = (v: unknown) => {
  const x = parseInt(String(v ?? ""), 10);
  return Number.isFinite(x) ? x : null;
};
const num = (v: unknown) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};
const dateDe = (v: unknown) => {
  if (!v) return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
};

/**
 * Nom du commercial imposé pour un utilisateur COMMERCIAL.
 * `null` = pas de restriction (ADMIN / MANAGER).
 */
function perimetre(user: { role: string; name: string }): string | null {
  return user.role === "COMMERCIAL" ? user.name : null;
}

export async function GET(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER", "COMMERCIAL"]);
  if (!auth.ok) return auth.res;

  const sp = req.nextUrl.searchParams;
  const vue = sp.get("vue") ?? "liste";
  const impose = perimetre(auth.user);

  // Matricules cités par les tournées mais absents de la flotte. Lecture pure :
  // la consultation d'un écran ne doit jamais passer par une écriture.
  if (vue === "vehicules-manquants") {
    return NextResponse.json({ rows: await vehiculesNonReferences() });
  }

  if (vue === "liste") {
    const commercial = impose ?? s(sp.get("commercial"));
    const etat = s(sp.get("etat"));
    const du = dateDe(sp.get("du"));
    const au = dateDe(sp.get("au"));

    // Les tournées importées portent l'orthographe de l'ERP source
    // (« Cloturé ») là où l'application écrit « Clôturée » : le filtre doit
    // reconnaître les deux, sinon 2 500 tournées deviennent introuvables.
    const etatFiltre = /^cl[oô]tur/i.test(etat)
      ? { etat: { in: ["Clôturée", "Cloturé", "Cloturée", "Clôturé"] } }
      : etat && etat !== "Tous"
        ? { etat }
        : {};

    const filtreMissions = {
      ...(commercial ? { commercial: { contains: commercial, mode: "insensitive" as const } } : {}),
      ...etatFiltre,
      ...(du || au
        ? { dateOrdre: { ...(du ? { gte: du } : {}), ...(au ? { lte: au } : {}) } }
        : {}),
    };

    // 2 631 tournées en historique : une liste plafonnée à 200 en cachait les
    // sept huitièmes tout en annonçant « 200 » comme total.
    const PAGE_MISSIONS = 200;
    const pageMissions = Math.max(0, int(sp.get("page")) ?? 0);
    const [rows, totalMissions] = await Promise.all([
      prisma.erpMission.findMany({
        where: filtreMissions,
        orderBy: { dateOrdre: "desc" },
        skip: pageMissions * PAGE_MISSIONS,
        take: PAGE_MISSIONS,
        include: { _count: { select: { lignes: true, documents: true, reglements: true } } },
      }),
      prisma.erpMission.count({ where: filtreMissions }),
    ]);

    return NextResponse.json({
      rows: rows.map((m) => ({
        id: m.id, commercial: m.commercial, vehicule: m.vehicule,
        dateOrdre: m.dateOrdre, etat: m.etat, objectifCA: m.objectifCA,
        // Bornes de la tournée : départ et retour, distincts quand elle
        // s'étale sur plusieurs jours.
        du: m.du, au: m.au,
        kmDepart: m.kmDepart, kmArrive: m.kmArrive,
        nbVisites: m._count.lignes,
        nbDocuments: m._count.documents,
        nbReglements: m._count.reglements,
      })),
      total: totalMissions,
      page: pageMissions,
      pages: Math.ceil(totalMissions / PAGE_MISSIONS),
      etats: ETATS_MISSION,
    });
  }

  // Tournée du jour du commercial connecté — l'écran « Planning ».
  if (vue === "jour") {
    const commercial = impose ?? s(sp.get("commercial"));
    if (!commercial) {
      return NextResponse.json({ error: "Commercial requis" }, { status: 400 });
    }
    const jour = dateDe(sp.get("date")) ?? new Date();
    jour.setHours(0, 0, 0, 0);
    const lendemain = new Date(jour.getTime() + 86_400_000);

    // Véhicule affecté au commercial connecté. La barre de tournée l'affiche
    // même quand l'ordre de mission ne le porte pas : le camion existe, il
    // n'a simplement pas été repris sur la pièce.
    const affectation = await prisma.commercial.findFirst({
      where: { user: { name: { equals: commercial, mode: "insensitive" } } },
      select: { vehicle: { select: { plate: true } } },
    });
    const plaqueAffectee = affectation?.vehicle?.plate.trim() ?? null;

    const mission = await prisma.erpMission.findFirst({
      where: {
        commercial: { contains: commercial, mode: "insensitive" },
        dateOrdre: { gte: jour, lt: lendemain },
        etat: { notIn: ["Annulée"] },
      },
      include: { lignes: { orderBy: [{ numOrdre: "asc" }, { id: "asc" }] } },
      orderBy: { id: "desc" },
    });

    if (!mission) {
      return NextResponse.json({
        mission: null, visites: [], date: jour, commercial,
        vehiculeAffecte: plaqueAffectee,
      });
    }

    // Coordonnées et solde des clients visités, pour la carte et la fiche.
    const codes = mission.lignes.map((l) => l.codeCli).filter((c): c is number => c != null);
    const tiers = codes.length
      ? await prisma.partner.findMany({
          where: { id: { in: codes } },
          select: { id: true, raisonSocial: true, adresse: true, ville: true, tel: true, soldeFin: true },
        })
      : [];
    const parCode = new Map(tiers.map((t) => [t.id, t]));

    const recon = await reconcilierTournee(mission.id);

    return NextResponse.json({
      mission: {
        id: mission.id, commercial: mission.commercial,
        // À défaut sur la pièce, le véhicule affecté au commercial.
        vehicule: mission.vehicule?.trim() || plaqueAffectee,
        dateOrdre: mission.dateOrdre, etat: mission.etat, objectifCA: mission.objectifCA,
      },
      vehiculeAffecte: plaqueAffectee,
      visites: mission.lignes.map((l) => {
        const t = l.codeCli != null ? parCode.get(l.codeCli) : undefined;
        return {
          ...l,
          adresse: t?.adresse ?? null,
          ville: t?.ville ?? null,
          tel: t?.tel ?? null,
          solde: t?.soldeFin ?? 0,
        };
      }),
      reconciliation: recon,
      date: jour,
      etatsVisite: ETATS_VISITE,
    });
  }

  if (vue === "detail" || vue === "reconciliation") {
    const id = int(sp.get("id"));
    if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

    const recon = await reconcilierTournee(id);
    if (!recon) return NextResponse.json({ error: "Tournée introuvable" }, { status: 404 });
    if (impose && recon.mission.commercial && !recon.mission.commercial.toLowerCase().includes(impose.toLowerCase())) {
      return NextResponse.json({ error: "Accès refusé à cette tournée" }, { status: 403 });
    }

    if (vue === "reconciliation") return NextResponse.json(recon);

    const [lignes, documents, reglements, reclamations] = await Promise.all([
      prisma.ligneMission.findMany({ where: { dayId: id }, orderBy: [{ numOrdre: "asc" }, { id: "asc" }] }),
      prisma.erpDocument.findMany({
        where: { dayId: id },
        select: { refDoc: true, typeDoc: true, dateDoc: true, raisonSocial: true, ttcNet: true, totalRegle: true, soldeDoc: true, valide: true },
        orderBy: { dateDoc: "asc" },
      }),
      prisma.erpReglement.findMany({
        where: { dayId: id },
        select: { id: true, datePay: true, tiersNom: true, montant: true, modePay: true, etat: true },
        orderBy: { datePay: "asc" },
      }),
      prisma.reclamation.findMany({ where: { dayId: id }, orderBy: { dateReclam: "desc" } }),
    ]);

    return NextResponse.json({ reconciliation: recon, lignes, documents, reglements, reclamations });
  }

  if (vue === "stock-vehicule") {
    const vehicule = s(sp.get("vehicule"));
    if (!vehicule) return NextResponse.json({ error: "vehicule requis" }, { status: 400 });
    // Production vivante : si les données datent, une resynchronisation part
    // en arrière-plan — cette requête sert l'état connu, la suivante le frais.
    void rafraichirStockSiPerime();
    return NextResponse.json(await stockVehicule(vehicule));
  }

  // Clients géolocalisés, pour la carte. 2 283 des 2 399 tiers ont des
  // coordonnées réelles ; les autres sont exclus plutôt que placés au large.
  // Agrégation des clients par gouvernorat, pour la couche « Zones » de la
  // carte de supervision. Le barycentre des clients sert de point d'ancrage :
  // il tombe au cœur de la zone réellement couverte, contrairement au
  // chef-lieu administratif.
  if (vue === "zones") {
    const rows = await prisma.partner.findMany({
      where: {
        nature: "C", archiver: 0,
        ...(filtrePortefeuille(auth.user) ?? {}),
        latitude: { not: 0 },
        longitude: { not: 0 },
        AND: [{ latitude: { not: null } }, { longitude: { not: null } }],
      },
      select: { gouvernorat: true, latitude: true, longitude: true, soldeFin: true },
    });

    type Zone = { nom: string; nb: number; lat: number; lng: number; solde: number; debiteurs: number };
    const zones = new Map<string, Zone>();
    for (const r of rows) {
      // Casse hétérogène dans l'import (« TUNIS » / « Tunis ») : on regroupe
      // sans casse et on garde la première graphie rencontrée.
      const nom = (r.gouvernorat ?? "").trim() || "Sans gouvernorat";
      const cle = nom.toLocaleLowerCase("fr");
      const z = zones.get(cle) ?? { nom, nb: 0, lat: 0, lng: 0, solde: 0, debiteurs: 0 };
      z.nb += 1;
      z.lat += r.latitude!;
      z.lng += r.longitude!;
      z.solde += r.soldeFin;
      if (r.soldeFin > 0) z.debiteurs += 1;
      zones.set(cle, z);
    }

    return NextResponse.json({
      rows: [...zones.values()]
        .map((z) => ({
          gouvernorat: z.nom,
          nb: z.nb,
          latitude: round3(z.lat / z.nb),
          longitude: round3(z.lng / z.nb),
          solde: round3(z.solde),
          debiteurs: z.debiteurs,
        }))
        .sort((a, b) => b.nb - a.nb),
    });
  }

  // Trafic : les tournées en cours, avec leur itinéraire planifié.
  //
  // Une flotte de vans ne se supervise pas avec de simples punaises : ce qui
  // compte est le **plan de la journée** — dans quel ordre le commercial doit
  // passer, où il en est, et ce qu'il reste à faire. Les coordonnées viennent
  // du client (les lignes de mission n'en portent pas), et la position du
  // véhicule du dernier point GPS connu.
  if (vue === "trafic") {
    const jour = dateDe(sp.get("date")) ?? new Date();
    jour.setHours(0, 0, 0, 0);
    const lendemain = new Date(jour.getTime() + 86_400_000);

    const missions = await prisma.erpMission.findMany({
      where: {
        // Les tournées du jour, plus celles encore ouvertes : une tournée
        // « En cours » datée d'hier reste à superviser.
        OR: [
          { dateOrdre: { gte: jour, lt: lendemain } },
          { etat: { in: ["En cours", "Planifiée"] } },
        ],
        ...(filtrePortefeuille(auth.user) ?? {}),
      },
      include: { lignes: { orderBy: { numOrdre: "asc" } } },
      orderBy: { dateOrdre: "desc" },
      take: 40,
    });

    // Coordonnées des clients visités : résolues en une requête.
    const codes = [...new Set(
      missions.flatMap((m) => m.lignes.map((l) => l.codeCli).filter((c): c is number => c != null)),
    )];
    const clients = codes.length
      ? await prisma.partner.findMany({
          where: { id: { in: codes } },
          select: { id: true, raisonSocial: true, ville: true, tel: true,
                    latitude: true, longitude: true, soldeFin: true },
        })
      : [];
    const parClient = new Map(clients.map((c) => [c.id, c]));

    // Position courante des véhicules et dernier point GPS relevé.
    const [vehicules, derniersPoints] = await Promise.all([
      prisma.vehicle.findMany(),
      prisma.gpsPosition.findMany({ orderBy: { timestamp: "desc" }, take: 200 }),
    ]);
    const dernierParVehicule = new Map<string, (typeof derniersPoints)[number]>();
    for (const pt of derniersPoints) {
      if (pt.vehicleId && !dernierParVehicule.has(pt.vehicleId)) dernierParVehicule.set(pt.vehicleId, pt);
    }

    const tournees = missions.map((m) => {
      const etapes = m.lignes.map((l) => {
        const c = l.codeCli != null ? parClient.get(l.codeCli) : undefined;
        return {
          numOrdre: l.numOrdre,
          codeCli: l.codeCli,
          clientNom: l.clientNom ?? c?.raisonSocial ?? null,
          ville: c?.ville ?? null,
          tel: c?.tel ?? null,
          etat: l.etat,
          heurePrevue: l.heurePrevue,
          objectif: l.objectif,
          solde: c?.soldeFin ?? null,
          // La ligne de mission peut porter le point réel du pointage ;
          // à défaut on prend l'adresse connue du client.
          latitude: l.latitude ?? c?.latitude ?? null,
          longitude: l.longitude ?? c?.longitude ?? null,
        };
      });

      const geolocalisees = etapes.filter((e) => e.latitude != null && e.longitude != null);
      const faites = etapes.filter((e) => e.etat === "Visité").length;

      const vehicule = m.vehicule
        ? vehicules.find((v) => v.plate.trim().toLowerCase() === m.vehicule!.trim().toLowerCase())
        : undefined;
      const point = vehicule ? dernierParVehicule.get(vehicule.id) : undefined;

      return {
        id: m.id,
        commercial: m.commercial,
        vehicule: m.vehicule,
        dateOrdre: m.dateOrdre,
        etat: m.etat,
        objectifCA: m.objectifCA,
        etapes: geolocalisees,
        // Une tournée dont aucun client n'est géolocalisé ne peut pas être
        // tracée : on le dit plutôt que de l'afficher vide.
        sansCoordonnees: etapes.length - geolocalisees.length,
        progression: { total: etapes.length, faites,
          pct: etapes.length ? Math.round((faites / etapes.length) * 100) : 0 },
        // Position du véhicule, avec l'âge du relevé. Une position vieille de
        // plusieurs semaines n'est pas du temps réel : l'écran doit le dire
        // plutôt que de laisser croire que le van est là maintenant.
        position: (() => {
          const maj = vehicule?.lastUpdate ?? point?.timestamp ?? null;
          const coords = vehicule?.currentLat != null && vehicule?.currentLng != null
            ? { lat: vehicule.currentLat, lng: vehicule.currentLng }
            : point ? { lat: point.lat, lng: point.lng } : null;
          if (!coords) return null;
          const ageMinutes = maj
            ? Math.round((Date.now() - new Date(maj).getTime()) / 60_000)
            : null;
          return {
            ...coords,
            statut: vehicule?.status ?? null,
            maj,
            ageMinutes,
            // Au-delà d'une heure sans relevé, on ne sait plus où est le van.
            perime: ageMinutes == null || ageMinutes > 60,
          };
        })(),
      };
    });

    return NextResponse.json({
      rows: tournees.filter((t) => t.etapes.length > 0 || t.position),
      total: tournees.length,
      // Véhicules sans position connue : la supervision « temps réel » ne peut
      // rien en dire tant qu'aucun point GPS n'est remonté.
      vehiculesSansPosition: vehicules
        .filter((v) => v.currentLat == null && !dernierParVehicule.has(v.id))
        .map((v) => v.plate),
    });
  }

  if (vue === "geo") {
    const gouvernorat = s(sp.get("gouvernorat"));
    const jour = dateDe(sp.get("date")) ?? new Date();
    jour.setHours(0, 0, 0, 0);

    const rows = await prisma.partner.findMany({
      where: {
        nature: "C",
        // La carte ne montre que le portefeuille du commercial connecté :
        // sans cela il verrait l'implantation des clients de ses collègues.
        ...(filtrePortefeuille(auth.user) ?? {}),
        latitude: { not: 0 },
        longitude: { not: 0 },
        AND: [{ latitude: { not: null } }, { longitude: { not: null } }],
        ...(gouvernorat && gouvernorat !== "Tous"
          ? { gouvernorat: { equals: gouvernorat, mode: "insensitive" } }
          : {}),
      },
      select: {
        id: true, raisonSocial: true, ville: true, gouvernorat: true,
        tel: true, latitude: true, longitude: true, soldeFin: true,
      },
      take: 1500,
    });

    // Visites du jour, pour colorer les clients de la tournée en cours.
    const commercial = impose ?? s(sp.get("commercial"));
    const mission = commercial
      ? await prisma.erpMission.findFirst({
          where: {
            commercial: { contains: commercial, mode: "insensitive" },
            dateOrdre: { gte: jour, lt: new Date(jour.getTime() + 86_400_000) },
            etat: { notIn: ["Annulée"] },
          },
          include: { lignes: { select: { codeCli: true, etat: true, numOrdre: true } } },
          orderBy: { id: "desc" },
        })
      : null;

    const parCode = new Map(
      (mission?.lignes ?? [])
        .filter((l) => l.codeCli != null)
        .map((l) => [l.codeCli!, { etat: l.etat, numOrdre: l.numOrdre }])
    );

    const gouvernorats = [
      ...new Set(
        (await prisma.partner.findMany({
          where: { nature: "C", gouvernorat: { not: null } },
          select: { gouvernorat: true },
          distinct: ["gouvernorat"],
        }))
          .map((g) => (g.gouvernorat ?? "").trim())
          .filter(Boolean)
          // Casses mélangées dans les données : dédoublonnage insensible.
          .map((g) => g.charAt(0).toUpperCase() + g.slice(1).toLowerCase())
      ),
    ].sort();

    return NextResponse.json({
      rows: rows.map((p) => {
        const v = parCode.get(p.id);
        return {
          ...p,
          dansTournee: v != null,
          etatVisite: v?.etat ?? null,
          numOrdre: v?.numOrdre ?? null,
        };
      }),
      total: rows.length,
      gouvernorats,
      missionId: mission?.id ?? null,
    });
  }

  // Clients à proposer au planning : les tiers réels, avec leur solde.
  if (vue === "clients") {
    const q = s(sp.get("q"));
    // Modes de sélection repris de l'écran « Créer mission » de l'ERP source :
    // tous les clients, ceux d'un commercial, ou ceux d'une zone géographique.
    const filtreCommercial = s(sp.get("clientsCommercial"));
    const gouvernorat = s(sp.get("gouvernorat"));
    const ville = s(sp.get("ville"));

    // Un COMMERCIAL ne choisit que dans son portefeuille, quel que soit le
    // paramètre d'URL ; ADMIN et MANAGER peuvent filtrer librement.
    const perimetreClients = filtrePortefeuille(auth.user);
    const where = {
      nature: "C",
      archiver: 0,
      ...(perimetreClients ?? (filtreCommercial
        ? { commercial: { contains: filtreCommercial, mode: "insensitive" as const } }
        : {})),
      // Zone : « Tous » (ou vide) = toute la Tunisie. Les 14 clients sans
      // gouvernorat et les 44 sans ville ne doivent pas disparaître de la
      // sélection — sans adresse renseignée, ils restent visitables partout.
      ...(gouvernorat && gouvernorat !== "Tous"
        ? { gouvernorat: { equals: gouvernorat, mode: "insensitive" as const } }
        : {}),
      ...(ville && ville !== "Toutes"
        ? { ville: { equals: ville, mode: "insensitive" as const } }
        : {}),
      ...(q
        ? {
            OR: [
              { raisonSocial: { contains: q, mode: "insensitive" as const } },
              { ville: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.partner.findMany({
        where,
        select: {
          id: true, raisonSocial: true, ville: true, gouvernorat: true,
          tel: true, soldeFin: true, commercial: true,
        },
        orderBy: { raisonSocial: "asc" },
        take: 300,
      }),
      prisma.partner.count({ where }),
    ]);
    return NextResponse.json({ rows, total, affiches: rows.length });
  }

  // Référentiels servant aux filtres de l'écran de planification.
  if (vue === "referentiels") {
    const [gouvernorats, villes, commerciaux, vehicules] = await Promise.all([
      prisma.partner.findMany({
        where: { nature: "C", gouvernorat: { not: null } },
        distinct: ["gouvernorat"], select: { gouvernorat: true },
        orderBy: { gouvernorat: "asc" },
      }),
      prisma.partner.findMany({
        where: { nature: "C", ville: { not: null } },
        distinct: ["ville"], select: { ville: true, gouvernorat: true },
        orderBy: { ville: "asc" },
      }),
      prisma.user.findMany({
        where: { role: "COMMERCIAL", isActive: true },
        select: { name: true }, orderBy: { name: "asc" },
      }),
      prisma.refTable.findMany({ where: { kind: "vehicule" }, select: { code: true, label: true } }),
    ]);

    // Les données importées mélangent les casses ("TUNIS" / "Tunis") : on
    // dédoublonne sans casse en gardant la première graphie rencontrée.
    const uniq = (vals: (string | null)[]) => {
      const vus = new Map<string, string>();
      for (const v of vals) {
        const t = (v ?? "").trim();
        if (!t) continue;
        const k = t.toLocaleLowerCase("fr");
        if (!vus.has(k)) vus.set(k, t);
      }
      return [...vus.values()].sort((a, b) => a.localeCompare(b, "fr"));
    };

    // Les commerciaux de l'ERP (champ libre sur les tiers) complètent les
    // comptes applicatifs : les deux référentiels coexistent dans les données.
    const commerciauxErp = await prisma.partner.findMany({
      where: { nature: "C", commercial: { not: null } },
      distinct: ["commercial"], select: { commercial: true },
    });

    return NextResponse.json({
      gouvernorats: uniq(gouvernorats.map((g) => g.gouvernorat)),
      villes: uniq(villes.map((v) => v.ville)),
      villesParGouvernorat: villes.reduce<Record<string, string[]>>((acc, v) => {
        const g = (v.gouvernorat ?? "").trim();
        const t = (v.ville ?? "").trim();
        if (!g || !t) return acc;
        (acc[g] ??= []).push(t);
        return acc;
      }, {}),
      commerciaux: uniq([
        ...commerciaux.map((c) => c.name),
        ...commerciauxErp.map((c) => c.commercial),
      ]),
      vehicules: vehicules
        .map((v) => (v.label || v.code || "").trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "fr")),
    });
  }

  // stats
  const commercial = impose;
  const where = commercial ? { commercial: { contains: commercial, mode: "insensitive" as const } } : {};
  const [total, planifiees, enCours, cloturees] = await Promise.all([
    prisma.erpMission.count({ where }),
    prisma.erpMission.count({ where: { ...where, etat: "Planifiée" } }),
    prisma.erpMission.count({ where: { ...where, etat: "En cours" } }),
    prisma.erpMission.count({ where: { ...where, etat: { in: ["Clôturée", "Cloturé", "Cloturée", "Clôturé"] } } }),
  ]);
  const visites = await prisma.ligneMission.groupBy({ by: ["etat"], _count: { _all: true } });

  return NextResponse.json({
    total, planifiees, enCours, cloturees,
    visites: visites.map((v) => ({ etat: v.etat, nb: v._count._all })),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER", "COMMERCIAL"]);
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => ({}));
  const vue = s(body.vue) || "tournee";
  const impose = perimetre(auth.user);

  if (vue === "tournee") {
    // Un commercial ne planifie que pour lui-même.
    const commercial = impose ?? s(body.commercial);
    const dateOrdre = dateDe(body.dateOrdre) ?? new Date();

    const visites = Array.isArray(body.visites)
      ? body.visites.map((v: Record<string, unknown>, i: number) => ({
          codeCli: int(v.codeCli),
          clientNom: s(v.clientNom) || null,
          motif: s(v.motif) || null,
          objectif: num(v.objectif),
          heurePrevue: s(v.heurePrevue) || null,
          numOrdre: int(v.numOrdre) ?? i + 1,
        }))
      : [];

    const res = await creerTournee(
      {
        commercial, dateOrdre,
        vehicule: s(body.vehicule) || null,
        utilisateur: auth.user.name,
        objectifCA: num(body.objectifCA),
        kmDepart: num(body.kmDepart),
        // Tournée sur plusieurs jours : départ et retour. À défaut, la journée
        // de `dateOrdre` fait office des deux.
        du: dateDe(body.du) ?? dateOrdre,
        au: dateDe(body.au) ?? dateDe(body.du) ?? dateOrdre,
      },
      visites
    );
    return NextResponse.json(res, { status: res.ok ? 200 : 409 });
  }

  if (vue === "visite") {
    const dayId = int(body.dayId);
    if (!dayId) return NextResponse.json({ error: "dayId requis" }, { status: 400 });

    const mission = await prisma.erpMission.findUnique({
      where: { id: dayId }, select: { commercial: true, etat: true },
    });
    if (!mission) return NextResponse.json({ error: "Tournée introuvable" }, { status: 404 });
    if (estCloturee(mission.etat)) {
      return NextResponse.json({ error: "Tournée clôturée — planning non modifiable" }, { status: 409 });
    }

    const codeCli = int(body.codeCli);
    let clientNom = s(body.clientNom) || null;
    if (codeCli != null) {
      const p = await prisma.partner.findUnique({ where: { id: codeCli }, select: { raisonSocial: true } });
      if (!p) return NextResponse.json({ error: `Tiers ${codeCli} inconnu` }, { status: 400 });
      clientNom = p.raisonSocial;
    }

    const dernier = await prisma.ligneMission.findFirst({
      where: { dayId }, orderBy: { numOrdre: "desc" }, select: { numOrdre: true },
    });

    const row = await prisma.ligneMission.create({
      data: {
        dayId, codeCli, clientNom,
        motif: s(body.motif) || null,
        objectif: round3(num(body.objectif)),
        heurePrevue: s(body.heurePrevue) || null,
        numOrdre: int(body.numOrdre) ?? (dernier?.numOrdre ?? 0) + 1,
        etat: "À visiter",
      },
    });
    return NextResponse.json({ ok: true, row, message: "Visite ajoutée au planning" });
  }

  // Reprise des compteurs sur l'historique : les 2 218 tournées déjà saisies
  // portent des relevés que la fiche véhicule n'a jamais enregistrés.
  if (vue === "synchroniser-km") {
    const appliquer = body.simulation !== true;
    const [releves, orphelins] = await Promise.all([
      synchroniserKilometrages(appliquer),
      vehiculesNonReferences(),
    ]);
    return NextResponse.json({
      ok: true,
      simulation: !appliquer,
      releves,
      // Matricules roulant sans fiche véhicule : leurs entretiens ne peuvent
      // pas être suivis tant qu'ils ne sont pas créés dans la flotte.
      vehiculesManquants: orphelins,
      message: appliquer
        ? `${releves.filter((r) => r.kilometrage != null).length} compteur(s) mis à jour`
        : "Simulation — aucun compteur modifié",
    });
  }

  if (vue === "cloturer") {
    const id = int(body.id);
    if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
    const res = await cloturerTournee(id, {
      kmArrive: body.kmArrive != null ? num(body.kmArrive) : undefined,
      forcer: body.forcer === true,
    });
    return NextResponse.json(res, { status: res.ok ? 200 : 409 });
  }

  return NextResponse.json({ error: `Vue inconnue : ${vue}` }, { status: 400 });
}

export async function PUT(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER", "COMMERCIAL"]);
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => ({}));
  const vue = s(body.vue) || "visite";
  const id = int(body.id);
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  // Remplacement en bloc du planning d'une tournée. L'écran de planification
  // manipule une sélection de clients entière : la réécrire d'un coup évite
  // une cascade d'appels ligne à ligne et garde le planning cohérent.
  if (vue === "planning") {
    const mission = await prisma.erpMission.findUnique({
      where: { id },
      select: { etat: true, commercial: true },
    });
    if (!mission) return NextResponse.json({ error: "Tournée introuvable" }, { status: 404 });
    if (estCloturee(mission.etat)) {
      return NextResponse.json({ error: "Tournée clôturée — planning non modifiable" }, { status: 409 });
    }

    const visites = Array.isArray(body.visites) ? body.visites : [];
    const codes = visites
      .map((v: Record<string, unknown>) => int(v.codeCli))
      .filter((c: number | null): c is number => c != null);

    // Les noms de clients sont relus du référentiel, jamais recopiés du formulaire.
    const tiers = codes.length
      ? await prisma.partner.findMany({
          where: { id: { in: codes } },
          select: { id: true, raisonSocial: true },
        })
      : [];
    const parCode = new Map(tiers.map((t) => [t.id, t.raisonSocial]));

    // Les visites déjà effectuées conservent leur état : replanifier ne doit
    // pas effacer le travail fait sur le terrain.
    const existantes = await prisma.ligneMission.findMany({
      where: { dayId: id },
      select: { codeCli: true, etat: true, dateVisite: true, commentaire: true },
    });
    const parClient = new Map(existantes.filter((e) => e.codeCli != null).map((e) => [e.codeCli!, e]));

    await prisma.$transaction([
      prisma.ligneMission.deleteMany({ where: { dayId: id } }),
      prisma.ligneMission.createMany({
        data: visites.map((v: Record<string, unknown>, i: number) => {
          const codeCli = int(v.codeCli);
          const avant = codeCli != null ? parClient.get(codeCli) : undefined;
          return {
            dayId: id,
            codeCli,
            clientNom: (codeCli != null ? parCode.get(codeCli) : null) ?? (s(v.clientNom) || null),
            motif: s(v.motif) || null,
            objectif: round3(num(v.objectif)),
            heurePrevue: s(v.heurePrevue) || null,
            numOrdre: int(v.numOrdre) ?? i + 1,
            etat: avant?.etat ?? "À visiter",
            dateVisite: avant?.dateVisite ?? null,
            commentaire: avant?.commentaire ?? null,
          };
        }),
      }),
    ]);

    return NextResponse.json({
      ok: true,
      lignes: visites.length,
      message: `Planning enregistré — ${visites.length} visite(s)`,
    });
  }

  if (vue === "visite") {
    const ligne = await prisma.ligneMission.findUnique({
      where: { id }, include: { mission: { select: { etat: true } } },
    });
    if (!ligne) return NextResponse.json({ error: "Visite introuvable" }, { status: 404 });
    if (estCloturee(ligne.mission.etat)) {
      return NextResponse.json({ error: "Tournée clôturée — visite non modifiable" }, { status: 409 });
    }

    const etat = body.etat != null ? s(body.etat) : undefined;
    if (etat != null && !(ETATS_VISITE as readonly string[]).includes(etat)) {
      return NextResponse.json({ error: `État de visite invalide : ${etat}` }, { status: 400 });
    }

    // Passer à « Visité » horodate le passage : sans date, le planning ne dit
    // pas quand le client a été vu.
    const dateVisite =
      body.dateVisite != null
        ? dateDe(body.dateVisite)
        : etat === "Visité" && !ligne.dateVisite
          ? new Date()
          : undefined;

    const row = await prisma.ligneMission.update({
      where: { id },
      data: {
        ...(etat != null ? { etat } : {}),
        ...(dateVisite !== undefined ? { dateVisite } : {}),
        ...(body.motif != null ? { motif: s(body.motif) || null } : {}),
        ...(body.objectif != null ? { objectif: round3(num(body.objectif)) } : {}),
        ...(body.heurePrevue != null ? { heurePrevue: s(body.heurePrevue) || null } : {}),
        ...(body.numOrdre != null ? { numOrdre: int(body.numOrdre) ?? 0 } : {}),
        ...(body.commentaire != null ? { commentaire: s(body.commentaire) || null } : {}),
        ...(body.latitude != null ? { latitude: num(body.latitude) } : {}),
        ...(body.longitude != null ? { longitude: num(body.longitude) } : {}),
      },
    });
    return NextResponse.json({ ok: true, row, message: `Visite marquée « ${row.etat} »` });
  }

  if (vue === "tournee") {
    const etat = body.etat != null ? s(body.etat) : undefined;
    if (etat != null && !(ETATS_MISSION as readonly string[]).includes(etat)) {
      return NextResponse.json({ error: `État invalide : ${etat}` }, { status: 400 });
    }
    const row = await prisma.erpMission.update({
      where: { id },
      data: {
        ...(etat != null ? { etat } : {}),
        ...(body.vehicule != null ? { vehicule: s(body.vehicule) || null } : {}),
        ...(body.objectifCA != null ? { objectifCA: round3(num(body.objectifCA)) } : {}),
        ...(body.kmDepart != null ? { kmDepart: num(body.kmDepart) } : {}),
        ...(body.kmArrive != null ? { kmArrive: num(body.kmArrive) } : {}),
      },
    });
    // Modifier un relevé kilométrique doit se répercuter sur le compteur du
    // véhicule, sinon la correction resterait sans effet sur les entretiens.
    const compteur = await appliquerReleveMission(row.vehicule, row.kmArrive, row.kmDepart);

    return NextResponse.json({
      ok: true, row, kilometrage: compteur,
      message: "Tournée modifiée"
        + (compteur != null ? ` — compteur ${row.vehicule} : ${compteur.toLocaleString("fr-TN")} km` : ""),
    });
  }

  return NextResponse.json({ error: `Vue inconnue : ${vue}` }, { status: 400 });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.res;

  const sp = req.nextUrl.searchParams;
  const vue = s(sp.get("vue")) || "visite";
  const id = int(sp.get("id"));
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  if (vue === "tournee") {
    // Une tournée qui porte des documents ne disparaît pas : les ventes
    // perdraient leur rattachement et la réconciliation serait fausse.
    const [nbDocs, nbRegs] = await Promise.all([
      prisma.erpDocument.count({ where: { dayId: id } }),
      prisma.erpReglement.count({ where: { dayId: id } }),
    ]);
    if (nbDocs > 0 || nbRegs > 0) {
      return NextResponse.json(
        { error: `Tournée rattachée à ${nbDocs} document(s) et ${nbRegs} règlement(s) — annulez-la plutôt` },
        { status: 409 }
      );
    }
    await prisma.erpMission.delete({ where: { id } });
    return NextResponse.json({ ok: true, message: "Tournée supprimée" });
  }

  if (vue === "visite") {
    const ligne = await prisma.ligneMission.findUnique({
      where: { id }, include: { mission: { select: { etat: true } } },
    });
    if (!ligne) return NextResponse.json({ error: "Visite introuvable" }, { status: 404 });
    if (estCloturee(ligne.mission.etat)) {
      return NextResponse.json({ error: "Tournée clôturée — planning non modifiable" }, { status: 409 });
    }
    await prisma.ligneMission.delete({ where: { id } });
    return NextResponse.json({ ok: true, message: "Visite retirée du planning" });
  }

  return NextResponse.json({ error: `Vue inconnue : ${vue}` }, { status: 400 });
}
