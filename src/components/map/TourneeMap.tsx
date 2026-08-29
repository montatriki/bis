"use client";
import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

// Carte du trajet de la journée : la ligne qui relie les visites dans l'ordre,
// chaque étape portant son numéro. C'est le plan de travail du commercial —
// il suit la ligne, client par client.

export type EtapeGeo = {
  id: number; codeCli: number; nom: string; ville: string | null;
  latitude: number; longitude: number; numOrdre: number; etat: string;
  heurePrevue: string | null; soldeFin: number;
};

/** Couleur d'une étape selon son état d'avancement. */
const COULEURS: Record<string, string> = {
  "Visité": "#16a34a",
  "À visiter": "#2563eb",
  "Reporté": "#f59e0b",
  "Absent": "#dc2626",
};

export default function TourneeMap({
  etapes, courante, position, onSelect,
}: {
  etapes: EtapeGeo[];
  /** Étape en cours : mise en évidence sur la carte. */
  courante: EtapeGeo | null;
  /** Position GPS du commercial, si connue. */
  position: { lat: number; lng: number } | null;
  onSelect: (e: EtapeGeo) => void;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstance = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const layerRef = useRef<any>(null);
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

      if (etapes.length === 0) return;

      const points: [number, number][] = etapes.map((e) => [e.latitude, e.longitude]);

      // Chaque segment est tracé indépendamment : vert plein quand les deux
      // étapes qu'il relie sont traitées, pointillé bleu sinon. Le commercial
      // peut traiter ses étapes dans le désordre — colorer seulement le début
      // du trajet masquerait le travail déjà fait plus loin.
      const traitee = (e: EtapeGeo) => e.etat !== "À visiter";
      for (let i = 0; i < points.length - 1; i++) {
        const fait = traitee(etapes[i]) && traitee(etapes[i + 1]);
        L.polyline([points[i], points[i + 1]], {
          color: fait ? "#16a34a" : "#2563eb",
          weight: fait ? 4 : 3,
          opacity: fait ? 0.85 : 0.7,
          ...(fait ? {} : { dashArray: "8 8" }),
        }).addTo(groupe);
      }

      // Marqueurs numérotés dans l'ordre de passage.
      for (const e of etapes) {
        const estCourante = courante?.id === e.id;
        const couleur = COULEURS[e.etat] ?? "#64748b";
        const taille = estCourante ? 38 : 30;
        const icone = L.divIcon({
          className: "",
          html: `<div style="
            width:${taille}px;height:${taille}px;border-radius:50%;
            background:${couleur};color:#fff;display:flex;align-items:center;justify-content:center;
            font-weight:800;font-size:${estCourante ? 15 : 13}px;font-family:system-ui,sans-serif;
            border:3px solid ${estCourante ? "#facc15" : "#fff"};
            box-shadow:0 2px 8px rgba(0,0,0,.35);
          ">${e.numOrdre}</div>`,
          iconSize: [taille, taille],
          iconAnchor: [taille / 2, taille / 2],
        });

        L.marker([e.latitude, e.longitude], { icon: icone, zIndexOffset: estCourante ? 1000 : 0 })
          .addTo(groupe)
          .bindTooltip(
            `<b>${e.numOrdre}. ${e.nom}</b><br/>${e.heurePrevue ?? ""} · ${e.etat}` +
            (e.soldeFin > 0 ? `<br/>Solde : ${e.soldeFin.toFixed(0)} TND` : ""),
            { direction: "top", offset: [0, -taille / 2] },
          )
          .on("click", () => onSelectRef.current(e));
      }

      // Position du commercial : repère distinct du plan de visites.
      if (position) {
        L.circleMarker([position.lat, position.lng], {
          radius: 8, color: "#fff", weight: 3,
          fillColor: "#7c3aed", fillOpacity: 1,
        }).addTo(groupe).bindTooltip("Vous êtes ici", { direction: "top" });
      }

      // Cadrage sur l'ensemble du trajet, position comprise.
      const tous: [number, number][] = position ? [...points, [position.lat, position.lng]] : points;
      map.fitBounds(L.latLngBounds(tous).pad(0.18), { animate: false });
    });

    return () => { annule = true; };
  }, [etapes, courante, position]);

  // Nettoyage de l'instance Leaflet au démontage du composant.
  useEffect(() => () => {
    if (mapInstance.current) {
      mapInstance.current.remove();
      mapInstance.current = null;
    }
  }, []);

  return <div ref={mapRef} className="w-full h-full" />;
}
