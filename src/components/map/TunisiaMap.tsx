"use client";
import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

const VEHICLES = [
  { id: 1, name: "Mokhtar Trabelsi", plate: "206TU7140", lat: 36.7257, lng: 9.1817, status: "active", ca: 3506, clients: 14, total: 17, speed: 0 },
  { id: 2, name: "HICHEM", plate: "238TU1019", lat: 36.8190, lng: 10.1658, status: "offline", ca: 2100, clients: 8, total: 14, speed: 0 },
  { id: 3, name: "FOUED", plate: "243TU3251", lat: 35.8254, lng: 10.6360, status: "moving", ca: 4200, clients: 11, total: 15, speed: 62 },
  { id: 4, name: "Anis", plate: "TN07649", lat: 35.5047, lng: 11.0622, status: "stopped", ca: 1800, clients: 6, total: 12, speed: 0 },
];

const CLIENTS = [
  { name: "AGIL BEJA SUD", lat: 36.7257, lng: 9.1817, visited: true, balance: 4428 },
  { name: "AGIL BEJA NORD", lat: 36.7357, lng: 9.1917, visited: true, balance: 4291 },
  { name: "librairie saphir", lat: 36.8100, lng: 10.1800, visited: false, balance: 2738 },
  { name: "AGIL MAHDIA", lat: 35.5047, lng: 11.0622, visited: false, balance: 3408 },
  { name: "Ste Anouar express", lat: 36.4000, lng: 10.6167, visited: true, balance: 418 },
  { name: "AGIL SIDI KHLIFA", lat: 34.7606, lng: 10.7803, visited: false, balance: 3659 },
];

export default function TunisiaMap() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);

  useEffect(() => {
    if (typeof window === "undefined" || mapInstance.current) return;

    import("leaflet").then((L) => {
      if (!mapRef.current || mapInstance.current) return;

      // Initialize Leaflet Map Centered Perfectly on Northern/Coastal Tunisia
      const map = L.map(mapRef.current!, {
        center: [36.15, 10.15],
        zoom: 8,
        zoomControl: false,
        attributionControl: false
      });
      mapInstance.current = map;

      L.control.zoom({ position: "bottomright" }).addTo(map);

      // CartoDB Voyager Tile Layer (Yandex / Google style Street Map)
      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        maxZoom: 18,
        subdomains: 'abcd'
      }).addTo(map);

      // Fix Leaflet 0-size initialization viewport shift
      setTimeout(() => {
        map.invalidateSize();
        map.setView([36.15, 10.15], 8);
      }, 250);

      // Vehicle Custom Telemetry Markers
      VEHICLES.forEach((v) => {
        const color = v.status === "active" ? "#6e8b3d" : v.status === "moving" ? "#b56e2d" : v.status === "stopped" ? "#e09f3e" : "#8c7662";
        const pulsingClass = v.status === "moving" || v.status === "active" ? "animate-pulse-dot" : "";
        const initial = v.name.substring(0, 2).toUpperCase();

        const icon = L.divIcon({
          className: "",
          html: `
            <div style="position:relative;display:flex;flex-direction:column;align-items:center;">
              <!-- Pulsing Radar Ring -->
              <div class="${pulsingClass}" style="position:absolute;width:40px;height:40px;border-radius:50%;background:${color};opacity:0.25;top:-2px;left:-2px;pointer-events:none;"></div>
              
              <!-- Core Marker Circle -->
              <div style="width:36px;height:36px;border-radius:50%;background:${color};border:2px solid #ffffff;box-shadow:0 4px 15px rgba(139,90,43,0.2);display:flex;align-items:center;justify-content:center;color:#ffffff;font-weight:bold;font-size:11px;z-index:2;">
                ${initial}
              </div>
              
              <!-- Micro Indicator Tag -->
              <div style="background:#2c1b0c;color:#ffffff;font-size:8px;font-family:monospace;padding:1px 4px;border-radius:4px;margin-top:2px;white-space:nowrap;box-shadow:0 2px 5px rgba(0,0,0,0.2);font-weight:bold;z-index:3;">
                ${v.speed > 0 ? `${v.speed} km/h` : 'STOP'}
              </div>
            </div>
          `,
          iconSize: [40, 50],
          iconAnchor: [20, 20],
        });

        const marker = L.marker([v.lat, v.lng], { icon }).addTo(map);
        marker.bindPopup(`
          <div style="min-width:220px;font-family:'Outfit','Inter',sans-serif;padding:6px;color:#36220f;">
            <div style="display:flex;align-items:center;justify-content:between;border-bottom:1px solid #ebdcc9;padding-bottom:6px;margin-bottom:8px;">
              <span style="font-weight:800;font-size:13px;">${v.name}</span>
              <span style="font-size:9px;font-family:monospace;background:#f3efe6;padding:1px 5px;border-radius:4px;font-weight:bold;margin-left:auto;">${v.plate}</span>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:11px;">
              <div>📦 CA: <strong>${v.ca} TND</strong></div>
              <div>👥 Clients: <strong>${v.clients}/${v.total}</strong></div>
              <div>⚡ Vitesse: <strong>${v.speed} km/h</strong></div>
              <div style="display:flex;align-items:center;gap:4px;">
                <span style="width:6px;height:6px;border-radius:50%;background:${color};display:inline-block;"></span>
                <span>${v.status === 'active' ? 'En mission' : v.status === 'moving' ? 'En route' : v.status === 'stopped' ? 'Arrêté' : 'Hors ligne'}</span>
              </div>
            </div>
          </div>
        `);
      });

      // Client Markers (Precision Target Pins)
      CLIENTS.forEach((c) => {
        const color = c.visited ? "#6e8b3d" : "#b84a39";
        const icon = L.divIcon({
          className: "",
          html: `
            <div style="position:relative;display:flex;align-items:center;justify-content:center;">
              <div style="width:12px;height:12px;border-radius:50%;background:${color};border:2px solid #ffffff;box-shadow:0 2px 6px rgba(0,0,0,0.25)"></div>
            </div>
          `,
          iconSize: [12, 12],
          iconAnchor: [6, 6],
        });

        const marker = L.marker([c.lat, c.lng], { icon }).addTo(map);
        marker.bindPopup(`
          <div style="min-width:180px;font-family:'Outfit','Inter',sans-serif;padding:4px;color:#36220f;">
            <div style="font-weight:800;font-size:12px;border-bottom:1px solid #ebdcc9;padding-bottom:4px;margin-bottom:6px;">${c.name}</div>
            <div style="font-size:11px;color:${c.balance > 0 ? "#b84a39" : "#6e8b3d"};">Solde: <strong>${c.balance} TND</strong></div>
            <div style="font-size:11px;margin-top:2px;">Statut: <strong>${c.visited ? "✅ Visité" : "⏳ Planifié"}</strong></div>
          </div>
        `);
      });
    });

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden">
      <div ref={mapRef} className="w-full h-full" />
      
      {/* Dynamic Telemetry Legend */}
      <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-md rounded-xl p-3 shadow-lg z-10 border border-slate-100">
        <div className="text-[10px] font-bold text-slate-800 uppercase tracking-wider mb-2">Légende Flotte</div>
        <div className="space-y-1.5">
          {[
            { color: "#6e8b3d", label: "En mission (Actif)" },
            { color: "#b56e2d", label: "En route (Déplacement)" },
            { color: "#e09f3e", label: "Arrêté (Pause)" },
            { color: "#8c7662", label: "Hors ligne" },
          ].map(l => (
            <div key={l.label} className="flex items-center gap-2 text-[10px] font-semibold text-slate-650">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: l.color }} />
              {l.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
