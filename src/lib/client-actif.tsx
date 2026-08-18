"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { coordValide, distanceM, proximite, type Proximite } from "@/lib/geo";

// Client actif de la tournée.
//
// Le commercial travaille *pour un client à la fois* : catalogue, panier et
// commande doivent tous porter sur le même tiers. On mémorise donc la sélection
// dans un contexte partagé, persisté en `localStorage` pour survivre à la
// navigation et à un rechargement de page en clientèle.

export type ClientActif = {
  id: number;
  raisonSocial: string;
  ville?: string | null;
  gouvernorat?: string | null;
  adresse?: string | null;
  tel?: string | null;
  soldeFin?: number;
  plafond?: number | null;
  famille?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  /** Distance constatée au moment de la sélection, si le GPS était disponible. */
  distance?: number | null;
  /** Comment le client a été sélectionné — sert à tracer les visites. */
  origine?: "gps" | "manuel";
};

export type PositionGps = { lat: number; lng: number; precision: number; horodatage: number };

type Etat = {
  client: ClientActif | null;
  choisir: (c: ClientActif, origine?: "gps" | "manuel") => void;
  effacer: () => void;
  /** Position GPS courante du commercial, `null` tant qu'elle est inconnue. */
  position: PositionGps | null;
  erreurGps: string | null;
  gpsEnCours: boolean;
  /** Redemande une position au navigateur. */
  rafraichirPosition: () => void;
  /** Vérifie la cohérence entre la position courante et un client donné. */
  verifierPosition: (c: Pick<ClientActif, "latitude" | "longitude">) =>
    | { statut: "inconnu"; motif: string }
    | { statut: Proximite; distance: number };
  pret: boolean;
};

const CLE = "bis-client-actif";
const Ctx = createContext<Etat | null>(null);

export function ClientActifProvider({ children }: { children: React.ReactNode }) {
  const [client, setClient] = useState<ClientActif | null>(null);
  const [position, setPosition] = useState<PositionGps | null>(null);
  const [erreurGps, setErreurGps] = useState<string | null>(null);
  const [gpsEnCours, setGpsEnCours] = useState(false);
  const [pret, setPret] = useState(false);

  // Restauration de la sélection précédente, lue une seule fois à
  // l'initialisation de l'état plutôt que dans un effet : `localStorage` est
  // disponible immédiatement côté client, et cela évite un rendu en cascade.
  useEffect(() => {
    const restaurer = () => {
      try {
        const brut = localStorage.getItem(CLE);
        if (brut) setClient(JSON.parse(brut));
      } catch {
        // Sélection illisible : on repart d'une tournée vierge.
      }
      setPret(true);
    };
    const t = setTimeout(restaurer, 0);
    return () => clearTimeout(t);
  }, []);

  // Dernière position transmise au serveur : on n'envoie que les déplacements
  // réels, pour ne pas inonder la base des micro-oscillations du GPS à l'arrêt.
  const derniereRemontee = useRef<{ lat: number; lng: number; t: number } | null>(null);

  /**
   * Transmet la position au serveur, qui met à jour le véhicule et
   * l'historique GPS. Sans cet envoi, la supervision cartographique reste
   * figée sur les données d'import.
   */
  const remonterPosition = useCallback((p: PositionGps) => {
    const precedent = derniereRemontee.current;
    const ecart = precedent ? distanceM(precedent.lat, precedent.lng, p.lat, p.lng) : Infinity;
    const age = precedent ? Date.now() - precedent.t : Infinity;
    // Envoi si le commercial a bougé de plus de 50 m, ou toutes les 2 minutes
    // à l'arrêt — assez pour que la carte le montre présent sans le pister.
    if (ecart < 50 && age < 120_000) return;

    derniereRemontee.current = { lat: p.lat, lng: p.lng, t: Date.now() };
    fetch("/api/position", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ latitude: p.lat, longitude: p.lng, precision: p.precision }),
    }).catch(() => {
      // Hors couverture : la position reste utilisable localement, la
      // prochaine remontée réussie rattrapera le suivi.
      derniereRemontee.current = precedent;
    });
  }, []);

  const demanderPosition = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setErreurGps("Géolocalisation non disponible sur cet appareil");
      return;
    }
    setGpsEnCours(true);
    setErreurGps(null);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const pos = {
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          precision: p.coords.accuracy,
          horodatage: p.timestamp,
        };
        setPosition(pos);
        remonterPosition(pos);
        setGpsEnCours(false);
      },
      (e) => {
        // Message explicite : le commercial doit savoir s'il doit autoriser
        // l'accès ou simplement sortir du bâtiment.
        const messages: Record<number, string> = {
          1: "Accès à la position refusé — autorisez la localisation",
          2: "Position indisponible — vérifiez le GPS",
          3: "Recherche de position trop longue",
        };
        setErreurGps(messages[e.code] ?? "Position introuvable");
        setGpsEnCours(false);
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
    );
  }, [remonterPosition]);

  // Suivi continu pendant la tournée. Une lecture unique au montage ne
  // suffisait pas : la position restait celle du dépôt toute la journée, les
  // distances aux clients étaient fausses et la carte ne bougeait jamais.
  useEffect(() => {
    // `watchPosition` émet lui-même un premier point : pas besoin d'une
    // lecture synchrone supplémentaire, qui provoquerait un rendu en cascade.
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    const veille = navigator.geolocation.watchPosition(
      (p) => {
        const pos = {
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          precision: p.coords.accuracy,
          horodatage: p.timestamp,
        };
        setPosition(pos);
        remonterPosition(pos);
        setErreurGps(null);
      },
      () => {
        // Perte ponctuelle du signal : on garde le dernier point connu plutôt
        // que d'effacer la position et de bloquer le pointage.
      },
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 30_000 },
    );
    return () => navigator.geolocation.clearWatch(veille);
  }, [remonterPosition]);

  const choisir = useCallback((c: ClientActif, origine: "gps" | "manuel" = "manuel") => {
    const enrichi = { ...c, origine };
    setClient(enrichi);
    try { localStorage.setItem(CLE, JSON.stringify(enrichi)); } catch { /* quota plein */ }
  }, []);

  const effacer = useCallback(() => {
    setClient(null);
    try { localStorage.removeItem(CLE); } catch { /* ignore */ }
  }, []);

  const verifierPosition = useCallback<Etat["verifierPosition"]>((c) => {
    if (!position) return { statut: "inconnu", motif: "Position du commercial inconnue" };
    if (!coordValide(c.latitude, c.longitude)) {
      return { statut: "inconnu", motif: "Ce client n'a pas de coordonnées GPS enregistrées" };
    }
    const d = distanceM(position.lat, position.lng, c.latitude!, c.longitude!);
    return { statut: proximite(d), distance: Math.round(d) };
  }, [position]);

  const valeur = useMemo<Etat>(() => ({
    client, choisir, effacer,
    position, erreurGps, gpsEnCours,
    rafraichirPosition: demanderPosition,
    verifierPosition, pret,
  }), [client, choisir, effacer, position, erreurGps, gpsEnCours, demanderPosition, verifierPosition, pret]);

  return <Ctx.Provider value={valeur}>{children}</Ctx.Provider>;
}

export function useClientActif(): Etat {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useClientActif doit être utilisé dans <ClientActifProvider>");
  return ctx;
}
