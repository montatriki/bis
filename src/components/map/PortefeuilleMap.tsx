"use client";
import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

// Carte du portefeuille : tous les clients géolocalisés du commercial autour
// de sa position. Pas d'ordre de passage ici — c'est une vue d'ensemble, on
// clique un client pour ouvrir sa fiche.

export type PointClient = {
  id: number; nom: string; ville: string | null;
  latitude: number; longitude: number; soldeFin: number; tel: string | null;
};

export default function PortefeuilleMap({
  clients, position, actifId, filtre, onSelect, recentrer = 0,
}: {
  clients: PointClient[];
  /** Position GPS du commercial : centre de la carte quand elle est connue. */
  position: { lat: number; lng: number } | null;
  /** Client en visite : mis en évidence. */
  actifId: number | null;
  /** Incrémenté par l'appelant pour recentrer la carte sur le commercial. */
  recentrer?: number;
  /** Un filtre est actif : on cadre sur les clients filtrés, pas sur la position. */
  filtre: boolean;
  onSelect: (c: PointClient) => void;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstance = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const layerRef = useRef<any>(null);
  // Jeu de clients déjà cadré : on recadre seulement quand il change (filtre),
  // jamais sur un simple rafraîchissement de position — l'utilisateur garde
  // la main sur le zoom entre-temps.
  const cadrePour = useRef<PointClient[] | null>(null);
  const onSelectRef = useRef(onSelect);
  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let annule = false;

    import("leaflet").then((L) => {
      if (annule || !mapRef.current) return;

      if (!mapInstance.current) {
        const map = L.map(mapRef.current, {
          center: [35.9, 10.0], zoom: 8,
          zoomControl: false, attributionControl: false,
        });
        mapInstance.current = map;
        L.control.zoom({ position: "bottomright" }).addTo(map);
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
        }).addTo(map);
        setTimeout(() => map.invalidateSize(), 60);
      }

      const map = mapInstance.current;
      if (layerRef.current) map.removeLayer(layerRef.current);
      const groupe = L.layerGroup().addTo(map);
      layerRef.current = groupe;

      for (const c of clients) {
        const actif = c.id === actifId;
        const couleur = actif ? "#facc15" : c.soldeFin > 0 ? "#f59e0b" : "#2563eb";
        L.circleMarker([c.latitude, c.longitude], {
          radius: actif ? 10 : 7, color: "#fff", weight: 2,
          fillColor: couleur, fillOpacity: 0.95,
        })
          .addTo(groupe)
          .bindTooltip(
            `<b>${c.nom}</b>${c.ville ? `<br/>${c.ville}` : ""}` +
            (c.soldeFin > 0 ? `<br/>Solde : ${c.soldeFin.toFixed(0)} TND` : ""),
            { direction: "top", offset: [0, -8] },
          )
          .on("click", () => onSelectRef.current(c));
      }

      if (position) {
        L.circleMarker([position.lat, position.lng], {
          radius: 9, color: "#fff", weight: 3,
          fillColor: "#7c3aed", fillOpacity: 1,
        }).addTo(groupe).bindTooltip("Vous êtes ici", { direction: "top" });
      }

      // Cadrage : à chaque nouveau jeu de clients (changement de filtre).
      // Filtre actif → sur les clients filtrés, pour zoomer sur la zone ;
      // sans filtre → autour du commercial s'il est localisé, sinon sur
      // l'ensemble du portefeuille.
      if (cadrePour.current !== clients && (position || clients.length)) {
        cadrePour.current = clients;
        if (!filtre && position) map.setView([position.lat, position.lng], 13, { animate: false });
        else if (clients.length) map.fitBounds(L.latLngBounds(clients.map((c) => [c.latitude, c.longitude] as [number, number])).pad(0.15), { animate: false, maxZoom: 15 });
      }
    });

    return () => { annule = true; };
  }, [clients, position, actifId, filtre]);

  // Recentrage explicite (bouton « Ma position ») : distinct du cadrage
  // automatique, qui ne se déclenche qu'au changement de filtre.
  useEffect(() => {
    if (!recentrer || !position || !mapInstance.current) return;
    mapInstance.current.setView([position.lat, position.lng], 14, { animate: true });
  }, [recentrer, position]);

  useEffect(() => () => {
    if (mapInstance.current) {
      mapInstance.current.remove();
      mapInstance.current = null;
    }
  }, []);

  return <div ref={mapRef} className="w-full h-full" />;
}
