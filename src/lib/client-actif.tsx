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

/**
 * Le contexte est scindé en deux.
 *
 * Le GPS émet un point toutes les 30 s (`maximumAge: 30_000`). Avec un seul
 * contexte, chaque point changeait la valeur partagée et **re-rendait tout
 * l'arbre de la tournée** : les écrans qui ne lisent pas la position — stock
 * camion, journal, panier — refaisaient malgré tout leurs appels réseau, d'où
 * une salve identique toutes les 31 s dans les journaux du serveur.
 *
 * `CtxClient` ne change qu'au changement de client ; `CtxPosition` porte le
 * GPS et n'est consommé que par les écrans qui s'en servent.
 */
type EtatClient = Pick<Etat, "client" | "choisir" | "effacer" | "pret">;
type EtatPosition = Pick<Etat, "position" | "erreurGps" | "gpsEnCours" | "rafraichirPosition" | "verifierPosition">;

const CtxClient = createContext<EtatClient | null>(null);
const CtxPosition = createContext<EtatPosition | null>(null);

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
    let annule = false;
    const restaurer = () => {
      let memo: ClientActif | null = null;
      try {
        const brut = localStorage.getItem(CLE);
        if (brut) { memo = JSON.parse(brut) as ClientActif; setClient(memo); }
      } catch {
        // Sélection illisible : on repart d'une tournée vierge.
      }
      setPret(true);
      // La sélection mémorisée date de la veille ou d'avant une resync : on la
      // rafraîchit depuis la base (solde, adresse, position). Un solde de
      // 17 TND effacé depuis restait sinon affiché dans le bandeau. Si le
      // client n'est plus accessible (hors portefeuille, supprimé), on l'oublie.
      if (memo?.id) {
        fetch(`/api/clients?codeCli=${memo.id}`)
          .then(async (r) => ({ ok: r.ok, status: r.status, d: await r.json().catch(() => ({})) }))
          .then(({ ok, status, d }) => {
            if (annule) return;
            if (!ok) { if (status === 403 || status === 404) { setClient(null); try { localStorage.removeItem(CLE); } catch { /* ignore */ } } return; }
            const c = d.client;
            if (!c) return;
            const frais: ClientActif = {
              ...memo!,
              raisonSocial: c.raisonSocial ?? memo!.raisonSocial,
              ville: c.ville ?? null, gouvernorat: c.gouvernorat ?? null, adresse: c.adresse ?? null,
              tel: c.tel ?? null, soldeFin: Number(c.soldeFin ?? 0), plafond: c.plafond ?? null,
              latitude: c.latitude ?? null, longitude: c.longitude ?? null,
            };
            setClient(frais);
            try { localStorage.setItem(CLE, JSON.stringify(frais)); } catch { /* quota plein */ }
          })
          .catch(() => { /* hors ligne : on garde la sélection mémorisée */ });
      }
    };
    const t = setTimeout(restaurer, 0);
    return () => { annule = true; clearTimeout(t); };
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
      // `maximumAge: 0` : on exige un fix neuf. Avec 60 s, le navigateur
      // servait un point mis en cache — souvent la position **réseau** de
      // l'antenne, à plusieurs kilomètres — et le commercial voyait des
      // clients de Tunis alors qu'il était à Radès.
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 0 },
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
        // Un point plus imprécis que le précédent n'apporte rien : sur mobile,
        // la position réseau (2–3 km) arrive avant le GPS (10–20 m) et
        // pouvait ensuite le remplacer. On ne dégrade jamais la précision.
        setPosition((avant) =>
          avant && avant.precision != null && pos.precision > avant.precision * 1.5 && pos.precision > 200
            ? avant
            : pos,
        );
        remonterPosition(pos);
        setErreurGps(null);
      },
      () => {
        // Perte ponctuelle du signal : on garde le dernier point connu plutôt
        // que d'effacer la position et de bloquer le pointage.
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 30_000 },
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

  // Stable tant que le commercial ne change pas de client : un point GPS ne
  // provoque plus de rendu des écrans de tournée.
  const valeurClient = useMemo<EtatClient>(
    () => ({ client, choisir, effacer, pret }),
    [client, choisir, effacer, pret],
  );

  const valeurPosition = useMemo<EtatPosition>(() => ({
    position, erreurGps, gpsEnCours,
    rafraichirPosition: demanderPosition,
    verifierPosition,
  }), [position, erreurGps, gpsEnCours, demanderPosition, verifierPosition]);

  return (
    <CtxClient.Provider value={valeurClient}>
      <CtxPosition.Provider value={valeurPosition}>{children}</CtxPosition.Provider>
    </CtxClient.Provider>
  );
}

/**
 * Client en cours et sélection. Ne re-rend pas sur les points GPS — c'est ce
 * qui évite qu'un écran sans rapport avec la position refasse ses appels
 * toutes les 30 secondes.
 */
export function useClientActif(): Etat {
  const c = useContext(CtxClient);
  const p = useContext(CtxPosition);
  if (!c || !p) throw new Error("useClientActif doit être utilisé dans <ClientActifProvider>");
  return { ...c, ...p };
}

/**
 * Client en cours seul, sans la position : à préférer sur les écrans qui
 * n'affichent pas de distance. Ils ne se re-rendent alors plus à chaque point
 * GPS, et ne relancent plus leurs appels réseau toutes les 30 secondes.
 */
export function useClientSeul(): EtatClient {
  const c = useContext(CtxClient);
  if (!c) throw new Error("useClientSeul doit être utilisé dans <ClientActifProvider>");
  return c;
}

/** Position GPS seule, pour les écrans qui n'ont pas besoin du client. */
export function usePositionGps(): EtatPosition {
  const p = useContext(CtxPosition);
  if (!p) throw new Error("usePositionGps doit être utilisé dans <ClientActifProvider>");
  return p;
}
