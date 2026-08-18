"use client";
import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { ClientGeo } from "@/app/commercial/(app)/map/page";

// Carte des clients réels — remplace `TunisiaMap` et ses véhicules codés en dur.
// Les marqueurs viennent de `partners.latitude/longitude` (2 283 clients
// géolocalisés). Un client de la tournée du jour est mis en évidence.

const COULEURS: Record<string, string> = {
  "Visité": "#16a34a",
  "À visiter": "#2563eb",
  "Reporté": "#f59e0b",
  "Absent": "#dc2626",
};

export default function ClientsMap({ clients, onSelect }: {
  clients: ClientGeo[];
  onSelect: (c: ClientGeo) => void;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstance = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const layerRef = useRef<any>(null);
  // Les marqueurs sont redessinés à chaque changement de filtre : la référence
  // évite de recréer la carte entière (et son animation) à chaque fois.
  const onSelectRef = useRef(onSelect);
  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let annule = false;

    import("leaflet").then((L) => {
      if (annule || !mapRef.current) return;

      if (!mapInstance.current) {
        const map = L.map(mapRef.current, {
          center: [35.9, 10.0],
          zoom: 7,
          zoomControl: false,
          attributionControl: false,
        });
        mapInstance.current = map;
        L.control.zoom({ position: "bottomright" }).addTo(map);
        L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
          maxZoom: 18, subdomains: "abcd",
        }).addTo(map);
        setTimeout(() => map.invalidateSize(), 60);
      }

      const map = mapInstance.current;
      if (layerRef.current) map.removeLayer(layerRef.current);
      const groupe = L.layerGroup().addTo(map);
      layerRef.current = groupe;

      for (const c of clients) {
        // Un client de la tournée est plus gros et coloré selon l'état de visite ;
        // les autres restent discrets pour ne pas noyer l'information utile.
        const couleur = c.dansTournee
          ? (COULEURS[c.etatVisite ?? "À visiter"] ?? "#2563eb")
          : c.soldeFin > 0 ? "#f87171" : "#94a3b8";
        const taille = c.dansTournee ? 16 : 9;

        const icon = L.divIcon({
          className: "",
          html: `<div style="width:${taille}px;height:${taille}px;border-radius:50%;background:${couleur};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;color:#fff;font-size:9px;font-weight:700">${
            c.dansTournee && c.numOrdre != null ? c.numOrdre : ""
          }</div>`,
          iconSize: [taille, taille],
          iconAnchor: [taille / 2, taille / 2],
        });

        const m = L.marker([c.latitude, c.longitude], { icon }).addTo(groupe);
        m.bindTooltip(
          `<b>${c.raisonSocial ?? `Client ${c.id}`}</b>` +
            (c.ville ? `<br/>${c.ville}` : "") +
            (c.soldeFin > 0 ? `<br/>Solde ${c.soldeFin.toFixed(3)} TND` : ""),
          { direction: "top" }
        );
        m.on("click", () => onSelectRef.current(c));
      }

      // Cadrage sur les marqueurs affichés, quand il y en a.
      if (clients.length > 0) {
        const bornes = L.latLngBounds(clients.map((c) => [c.latitude, c.longitude] as [number, number]));
        map.fitBounds(bornes, { padding: [30, 30], maxZoom: 12 });
      }
    });

    return () => { annule = true; };
  }, [clients]);

  useEffect(() => {
    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  return <div ref={mapRef} className="w-full h-full rounded-2xl" />;
}
