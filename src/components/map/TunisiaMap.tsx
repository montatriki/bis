"use client";
import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import { X, Info } from "lucide-react";

// Supervision cartographique — trois couches, toutes alimentées par la base.
//
//   Trafic  : la flotte (`Vehicle`) avec sa dernière position connue
//   Clients : les clients géolocalisés, colorés selon leur solde
//   Zones   : les clients agrégés par gouvernorat (barycentre + volume)
//
// La version précédente affichait 4 véhicules et 6 clients codés en dur, et
// les trois boutons n'étaient reliés à rien.

type Couche = "trafic" | "clients" | "zones";

type Vehicule = {
  plate: string; brand: string | null; model: string | null;
  status: string; currentLat: number | null; currentLng: number | null;
  joursAvantEcheance: number | null; echeanceProche: string | null; alerte: boolean;
};
type ClientGeo = {
  id: number; raisonSocial: string | null; ville: string | null;
  gouvernorat: string | null; latitude: number; longitude: number; soldeFin: number;
};
type Zone = {
  gouvernorat: string; nb: number; latitude: number; longitude: number;
  solde: number; debiteurs: number;
};

/** Une tournée du jour avec son itinéraire planifié. */
type Etape = {
  numOrdre: number; clientNom: string | null; ville: string | null;
  etat: string; heurePrevue: string | null; objectif: number;
  solde: number | null; latitude: number; longitude: number;
};
type Tournee = {
  id: number; commercial: string | null; vehicule: string | null;
  etat: string | null; objectifCA: number;
  etapes: Etape[]; sansCoordonnees: number;
  progression: { total: number; faites: number; pct: number };
  position: { lat: number; lng: number; statut: string | null; maj: string | null;
              ageMinutes: number | null; perime: boolean } | null;
};

const fmt = (v: unknown) => new Intl.NumberFormat("fr-TN", { maximumFractionDigits: 0 }).format(Number(v) || 0);
const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

/** Zoom à partir duquel la couche Zones remplace les agrégats par les clients. */
const ZOOM_CLIENTS = 11;

export default function TunisiaMap({ couche = "trafic" }: { couche?: Couche }) {
  const mapRef = useRef<HTMLDivElement>(null);
  // `any` assumé : Leaflet est chargé dynamiquement (pas de rendu serveur).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstance = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const calque = useRef<any>(null);
  const observateur = useRef<ResizeObserver | null>(null);

  const [vehicules, setVehicules] = useState<Vehicule[]>([]);
  const [clients, setClients] = useState<ClientGeo[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  // Niveau de zoom courant : la couche Zones change de nature en zoomant.
  const [zoomCarte, setZoomCarte] = useState(7);
  // Signature du dernier cadrage : on ne recadre qu'au changement de couche ou
  // de données — jamais parce que l'utilisateur a zoomé (le redessin déclenché
  // par le zoom rendrait sinon la carte incontrôlable).
  const cadragePour = useRef<string>("");
  const [tournees, setTournees] = useState<Tournee[]>([]);
  /** Plaques des véhicules sans position GPS connue, telles que l'API les liste. */
  const [sansPosition, setSansPosition] = useState<string[]>([]);
  /** Tournées ouvertes mais non traçables : ni étape planifiée, ni véhicule localisé. */
  const [sansTrace, setSansTrace] = useState<{ id: number; commercial: string | null }[]>([]);
  // La légende occupe un tiers de la carte et masque des points : elle se
  // replie en une pastille, l'utilisateur choisit ce qu'il veut voir.
  const [legendeOuverte, setLegendeOuverte] = useState(true);
  // La carte se construit de façon asynchrone (`import("leaflet")`). Sans ce
  // témoin, l'effet de dessin s'exécutait avant que la carte n'existe, sortait
  // en silence et n'était jamais relancé : les données étaient chargées mais
  // rien ne s'affichait.
  const [carteVivante, setCarteVivante] = useState(false);

  // Données des trois couches : chargées une fois, la bascule est instantanée.
  useEffect(() => {
    let annule = false;
    Promise.all([
      fetch("/api/erp?resource=vehicules").then((r) => r.json()).catch(() => ({})),
      fetch("/api/missions?vue=geo").then((r) => r.json()).catch(() => ({})),
      fetch("/api/missions?vue=zones").then((r) => r.json()).catch(() => ({})),
      fetch("/api/missions?vue=trafic").then((r) => r.json()).catch(() => ({})),
    ]).then(([v, c, z, t]) => {
      if (annule) return;
      setVehicules(v.rows ?? []);
      setClients(c.rows ?? []);
      setZones(z.rows ?? []);
      setTournees(t.rows ?? []);
      // L'API renvoie la liste des plaques, pas un compteur.
      setSansPosition(Array.isArray(t.vehiculesSansPosition) ? t.vehiculesSansPosition : []);
      setSansTrace(Array.isArray(t.tourneesSansTrace) ? t.tourneesSansTrace : []);
    });
    return () => { annule = true; };
  }, []);

  // Création de la carte (une seule fois).
  useEffect(() => {
    if (typeof window === "undefined" || mapInstance.current) return;
    import("leaflet").then((L) => {
      if (!mapRef.current || mapInstance.current) return;
      const map = L.map(mapRef.current, {
        center: [35.9, 10.0], zoom: 7, zoomControl: false, attributionControl: false,
      });
      mapInstance.current = map;
      L.control.zoom({ position: "bottomright" }).addTo(map);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      }).addTo(map);
      // `featureGroup` et non `layerGroup` : seul le premier expose
      // `getBounds()`, indispensable pour cadrer la carte sur les données.
      calque.current = L.featureGroup().addTo(map);
      map.on("zoomend", () => setZoomCarte(map.getZoom()));
      setCarteVivante(true);
      // Leaflet mesure mal un conteneur encore masqué à l'initialisation.
      setTimeout(() => map.invalidateSize(), 250);
      // Le panneau change de taille (repli du menu, onglet révélé) : sans
      // remesure la carte garde des dimensions périmées et un cadrage faux.
      if (typeof ResizeObserver !== "undefined" && mapRef.current) {
        const ro = new ResizeObserver(() => map.invalidateSize({ animate: false }));
        ro.observe(mapRef.current);
        observateur.current = ro;
      }
    });
    return () => {
      observateur.current?.disconnect();
      observateur.current = null;
      if (mapInstance.current) { mapInstance.current.remove(); mapInstance.current = null; }
    };
  }, []);

  // Redessine la couche active à chaque changement d'onglet ou de données.
  useEffect(() => {
    if (!mapInstance.current || !calque.current) return;
    import("leaflet").then((L) => {
      const map = mapInstance.current;
      const groupe = calque.current;
      if (!map || !groupe) return;
      groupe.clearLayers();

      const pastille = (couleur: string, taille: number, contenu = "") =>
        L.divIcon({
          className: "",
          html: `<div style="width:${taille}px;height:${taille}px;border-radius:50%;background:${couleur};
                 border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.28);display:flex;
                 align-items:center;justify-content:center;color:#fff;font:700 10px/1 Outfit,Inter,sans-serif;">${contenu}</div>`,
          iconSize: [taille, taille],
          iconAnchor: [taille / 2, taille / 2],
        });

      if (couche === "trafic") {
        // Couleur par tournée : deux vans côte à côte doivent rester
        // distinguables, y compris quand leurs itinéraires se croisent.
        const PALETTE = ["#b56e2d", "#3b82c4", "#6e8b3d", "#8e44ad", "#c0392b", "#16a085"];

        // Les mêmes clients reviennent dans plusieurs tournées : 61 étapes ne
        // portent que 14 positions distinctes, jusqu'à 10 empilées au même
        // point. Superposées, elles ne forment qu'une pastille illisible. On
        // dispose les doublons en petite couronne autour du point réel — un
        // décalage de quelques dizaines de mètres, sans effet sur la lecture
        // de l'itinéraire.
        const occurrences = new Map<string, number>();
        const ecarter = (lat: number, lng: number): [number, number] => {
          const cle = `${lat.toFixed(4)},${lng.toFixed(4)}`;
          const rang = occurrences.get(cle) ?? 0;
          occurrences.set(cle, rang + 1);
          if (rang === 0) return [lat, lng];
          // ~700 m par anneau : c'est le décalage minimal encore lisible au
          // niveau de zoom que l'étendue des tournées impose (Bizerte-Nabeul).
          const angle = (rang * 2 * Math.PI) / 8;
          const rayon = 0.0065 * (1 + Math.floor(rang / 8));
          return [lat + rayon * Math.sin(angle), lng + rayon * Math.cos(angle)];
        };

        tournees.forEach((t, idx) => {
          const couleur = PALETTE[idx % PALETTE.length];
          // Positions écartées, réutilisées pour le tracé comme pour les
          // pastilles : le trait doit relier les marqueurs réellement affichés.
          const places = t.etapes.map((e) => ecarter(e.latitude, e.longitude));
          const points = places;

          // L'itinéraire planifié, dans l'ordre de passage. C'est le « plan de
          // travail » : sans ce tracé la carte ne montre que des punaises.
          if (points.length > 1) {
            L.polyline(points, {
              color: couleur, weight: 3, opacity: 0.75,
              // Pointillés tant que la tournée n'est pas commencée : on
              // distingue le prévisionnel du réalisé.
              dashArray: t.progression.faites === 0 ? "6 8" : undefined,
            }).addTo(groupe);
          }

          t.etapes.forEach((e, i) => {
            const [lat, lng] = places[i];
            const fait = e.etat === "Visité";
            const manque = e.etat === "Absent" || e.etat === "Reporté";
            // Vert = visité, rouge = manqué, couleur de tournée = à faire.
            const fond = fait ? "#6e8b3d" : manque ? "#b84a39" : couleur;
            L.marker([lat, lng], {
              icon: pastille(fond, fait ? 20 : 24, String(e.numOrdre)),
            })
              .addTo(groupe)
              .bindPopup(
                `<div style="min-width:200px;font-family:Outfit,Inter,sans-serif;color:#36220f;padding:2px">
                  <div style="font-weight:800;font-size:12px">${esc(e.numOrdre)}. ${esc(e.clientNom ?? "Client")}</div>
                  <div style="font-size:11px;opacity:.8">${esc(e.ville ?? "")}</div>
                  <div style="font-size:11px;margin-top:4px">
                    ${e.heurePrevue ? `Prévu à <b>${esc(e.heurePrevue)}</b> · ` : ""}
                    <span style="color:${fond};font-weight:700">${esc(e.etat)}</span>
                  </div>
                  ${e.objectif > 0 ? `<div style="font-size:11px">Objectif : ${fmt(e.objectif)} TND</div>` : ""}
                  ${e.solde != null && e.solde > 0
                    ? `<div style="font-size:11px;color:#b84a39">Solde dû : ${fmt(e.solde)} TND</div>` : ""}
                  <div style="font-size:10px;margin-top:5px;opacity:.65">
                    Tournée n° ${esc(t.id)} — ${esc(t.commercial ?? "")}
                  </div>
                </div>`,
              );
          });

          // Position réelle du véhicule, reliée à la tournée qu'il exécute.
          if (t.position) {
            // Position périmée : on la montre en gris, jamais comme du direct.
            const teinte = t.position.perime ? "#8c7662" : couleur;
            L.marker([t.position.lat, t.position.lng], { icon: pastille(teinte, 30, "🚚") })
              .addTo(groupe)
              .bindPopup(
                `<div style="min-width:200px;font-family:Outfit,Inter,sans-serif;color:#36220f;padding:2px">
                  <div style="font-weight:800;font-size:12px">${esc(t.vehicule ?? "Véhicule")}</div>
                  <div style="font-size:11px;opacity:.8">${esc(t.commercial ?? "")}</div>
                  <div style="font-size:11px;margin-top:4px">Statut : <b>${esc(t.position.statut ?? "—")}</b></div>
                  <div style="font-size:11px">Avancement : <b>${t.progression.faites}/${t.progression.total}</b>
                    (${t.progression.pct}%)</div>
                  ${t.position.perime
                    ? `<div style="font-size:11px;color:#b84a39;margin-top:4px">
                         Position non actualisée${t.position.maj
                           ? ` — dernier relevé le ${esc(new Date(t.position.maj).toLocaleString("fr-FR"))}`
                           : " — aucun relevé GPS"}
                       </div>`
                    : `<div style="font-size:10px;opacity:.65;margin-top:4px">Relevé il y a ${
                        esc(t.position.ageMinutes)} min</div>`}
                </div>`,
              );
            // Trait entre le van et sa prochaine étape : on voit où il va.
            const prochaine = t.etapes.find((e) => e.etat === "À visiter");
            if (prochaine && !t.position.perime) {
              const idx = t.etapes.indexOf(prochaine);
              L.polyline(
                [[t.position.lat, t.position.lng], places[idx] ?? [prochaine.latitude, prochaine.longitude]],
                { color: couleur, weight: 2, opacity: 0.5, dashArray: "3 6" },
              ).addTo(groupe);
            }
          }
        });

        // Véhicules de la flotte sans tournée du jour : ils existent, mais ne
        // roulent pour personne — l'exploitant doit les voir aussi.
        const enTournee = new Set(
          tournees.map((t) => (t.vehicule ?? "").trim().toLowerCase()).filter(Boolean),
        );
        for (const v of vehicules) {
          if (v.currentLat == null || v.currentLng == null) continue;
          if (enTournee.has(v.plate.trim().toLowerCase())) continue;
          L.marker([v.currentLat, v.currentLng], { icon: pastille("#8c7662", 24, "🚚") })
            .addTo(groupe)
            .bindPopup(
              `<div style="min-width:180px;font-family:Outfit,Inter,sans-serif;color:#36220f;padding:2px">
                <div style="font-weight:800;font-size:12px">${esc(v.plate)}</div>
                <div style="font-size:11px;opacity:.8">${esc([v.brand, v.model].filter(Boolean).join(" "))}</div>
                <div style="font-size:11px;margin-top:4px">Statut : <b>${esc(v.status)}</b></div>
                <div style="font-size:11px;color:#8c7662">Aucune tournée en cours</div>
                ${v.joursAvantEcheance != null
                  ? `<div style="font-size:11px;color:${v.alerte ? "#b84a39" : "#6e8b3d"}">
                       ${esc(v.echeanceProche)} : ${v.joursAvantEcheance < 0
                         ? `expirée depuis ${-v.joursAvantEcheance} j`
                         : `dans ${v.joursAvantEcheance} j`}
                     </div>` : ""}
              </div>`,
            );
        }
      }

      if (couche === "clients") {
        for (const c of clients) {
          // Rouge = créance ouverte, vert = compte soldé : c'est l'information
          // que l'exploitant cherche sur une carte de clients.
          const couleur = c.soldeFin > 0 ? "#b84a39" : "#6e8b3d";
          L.circleMarker([c.latitude, c.longitude], {
            radius: 4, color: "#fff", weight: 1, fillColor: couleur, fillOpacity: 0.9,
          })
            .addTo(groupe)
            .bindPopup(
              `<div style="min-width:180px;font-family:Outfit,Inter,sans-serif;color:#36220f;padding:2px">
                <div style="font-weight:800;font-size:12px">${esc(c.raisonSocial || `Client ${c.id}`)}</div>
                <div style="font-size:11px;opacity:.8">${esc([c.ville, c.gouvernorat].filter(Boolean).join(" · "))}</div>
                <div style="font-size:11px;margin-top:4px;color:${couleur}">Solde : <b>${fmt(c.soldeFin)} TND</b></div>
                <a href="/admin/modules/vente/clients/${c.id}" style="display:inline-block;margin-top:6px;font-size:11px;font-weight:700;color:#1d4ed8">Ouvrir la fiche client →</a>
              </div>`,
            );
        }
      }

      if (couche === "zones" && map.getZoom() >= ZOOM_CLIENTS) {
        // Assez zoomé pour distinguer les points de vente : les agrégats par
        // gouvernorat laissent place aux clients de la zone visible, et la
        // bulle mène à la fiche.
        const visibles = map.getBounds().pad(0.3);
        for (const c of clients) {
          if (!visibles.contains([c.latitude, c.longitude])) continue;
          const couleur = c.soldeFin > 0 ? "#b84a39" : "#6e8b3d";
          L.circleMarker([c.latitude, c.longitude], {
            radius: 6, color: "#fff", weight: 1.5, fillColor: couleur, fillOpacity: 0.9,
          })
            .addTo(groupe)
            .bindPopup(
              `<div style="min-width:190px;font-family:Outfit,Inter,sans-serif;color:#36220f;padding:2px">
                <div style="font-weight:800;font-size:12px">${esc(c.raisonSocial || `Client ${c.id}`)}</div>
                <div style="font-size:11px;opacity:.8">${esc([c.ville, c.gouvernorat].filter(Boolean).join(" · "))}</div>
                <div style="font-size:11px;margin-top:4px;color:${couleur}">Solde : <b>${fmt(c.soldeFin)} TND</b></div>
                <a href="/admin/modules/vente/clients/${c.id}" style="display:inline-block;margin-top:6px;font-size:11px;font-weight:700;color:#1d4ed8">Ouvrir la fiche client →</a>
              </div>`,
            );
        }
      } else if (couche === "zones") {
        const maxNb = Math.max(1, ...zones.map((z) => z.nb));
        for (const z of zones) {
          // Rayon proportionnel à la racine du volume : l'aire du disque reste
          // alors proportionnelle au nombre de clients, ce que l'œil compare.
          const rayon = 8_000 + Math.sqrt(z.nb / maxNb) * 22_000;
          L.circle([z.latitude, z.longitude], {
            radius: rayon, color: "#b56e2d", weight: 1.5,
            fillColor: "#b56e2d", fillOpacity: 0.18,
          })
            .addTo(groupe)
            .bindPopup(
              `<div style="min-width:190px;font-family:Outfit,Inter,sans-serif;color:#36220f;padding:2px">
                <div style="font-weight:800;font-size:12px">${esc(z.gouvernorat)}</div>
                <div style="font-size:11px;margin-top:4px"><b>${fmt(z.nb)}</b> client(s)</div>
                <div style="font-size:11px">${fmt(z.debiteurs)} avec solde débiteur</div>
                <div style="font-size:11px;color:#b84a39">Créances : <b>${fmt(z.solde)} TND</b></div>
                <div style="font-size:10px;margin-top:4px;opacity:.7">Zoomez sur la zone pour voir chaque client</div>
              </div>`,
            );
          L.marker([z.latitude, z.longitude], { icon: pastille("#b56e2d", 24, String(z.nb)) }).addTo(groupe);
        }
      }

      // Cadrage sur ce qui est réellement affiché. Sans cela la carte reste
      // sur la vue nationale et les tournées, groupées sur une agglomération,
      // se réduisent à quelques pixels indistincts.
      // Cadrage sur les étapes des tournées : une position de véhicule
      // périmée, restée à l'autre bout du pays, étirerait la vue et
      // écraserait l'itinéraire réel en un amas illisible.
      const points = couche === "trafic"
        ? tournees.flatMap((t) => [
            ...t.etapes.map((e) => [e.latitude, e.longitude] as [number, number]),
            ...(t.position && !t.position.perime
              ? [[t.position.lat, t.position.lng] as [number, number]] : []),
          ])
        : [];
      // Cadrage sur le cœur de l'activité. Deux ou trois étapes isolées à
      // l'autre bout du pays suffisent à imposer un zoom national, où les
      // dizaines de visites groupées sur une agglomération se réduisent à un
      // amas de quelques pixels. On cadre donc sur la zone médiane (5e-95e
      // centile) : l'essentiel devient lisible, et les points écartés restent
      // atteignables en dézoomant.
      const centile = (valeurs: number[], q: number) => {
        const tri = [...valeurs].sort((a, b) => a - b);
        return tri[Math.min(tri.length - 1, Math.max(0, Math.floor(tri.length * q)))];
      };
      let bornes = points.length > 0 ? L.latLngBounds(points) : groupe.getBounds?.();
      if (points.length >= 8) {
        const lats = points.map((p) => p[0]);
        const lngs = points.map((p) => p[1]);
        bornes = L.latLngBounds(
          [centile(lats, 0.05), centile(lngs, 0.05)],
          [centile(lats, 0.95), centile(lngs, 0.95)],
        );
      }
      console.log("[GIS] couche=",couche,"couches=",groupe.getLayers?.().length,"bornes valides=",bornes?.isValid?.(),"taille=",map.getSize?.());
      const signature = `${couche}|${vehicules.length}|${clients.length}|${zones.length}|${tournees.length}`;
      const memeVue = cadragePour.current === signature;
      cadragePour.current = signature;
      if (!memeVue && bornes?.isValid()) {
        // Le conteneur n'a pas toujours sa taille définitive à cet instant
        // (panneau encore replié, police en cours de chargement) : Leaflet
        // cadrerait alors sur une surface nulle et resterait sur la vue
        // nationale. On remesure puis on ajuste au tour suivant, une fois la
        // mise en page stabilisée.
        const cadrer = () => {
          map.invalidateSize({ animate: false });
          map.fitBounds(bornes, { padding: [40, 40], maxZoom: 13, animate: false });
        };
        cadrer();
        setTimeout(cadrer, 400);
      }
    });
  }, [couche, vehicules, clients, zones, tournees, carteVivante, zoomCarte]);

  const legende =
    couche === "trafic"
      ? [
          { color: "#6e8b3d", label: "Client visité" },
          { color: "#b56e2d", label: "Étape à faire (n° d'ordre)" },
          { color: "#b84a39", label: "Absent / reporté" },
          { color: "#8c7662", label: "Véhicule sans tournée" },
        ]
      : couche === "clients"
        ? [
            { color: "#b84a39", label: "Solde débiteur" },
            { color: "#6e8b3d", label: "Compte soldé" },
          ]
        : zoomCarte >= ZOOM_CLIENTS
          ? [
              { color: "#b84a39", label: "Solde débiteur — cliquez pour la fiche" },
              { color: "#6e8b3d", label: "Compte soldé — cliquez pour la fiche" },
            ]
          : [{ color: "#b56e2d", label: "Volume de clients par gouvernorat — zoomez pour voir chaque client" }];

  // Ce que la couche montre réellement : des tournées, pas des punaises.
  const etapesTotal = tournees.reduce((n, t) => n + t.etapes.length, 0);
  const vehiculesLocalises = vehicules.filter((v) => v.currentLat != null && v.currentLng != null).length;
  const compte =
    couche === "trafic"
      ? `${tournees.length} tracée(s) sur ${tournees.length + sansTrace.length} · ${etapesTotal} étape(s)`
    : couche === "clients" ? `${fmt(clients.length)} client(s)`
    : `${zones.length} zone(s)`;

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden">
      <div ref={mapRef} className="w-full h-full" />

      {/* Repliée, la légende ne laisse qu'une pastille : la carte se lit en
          entier. Le compteur reste visible dans les deux états. */}
      {!legendeOuverte && (
        <button onClick={() => setLegendeOuverte(true)}
          className="absolute bottom-4 left-4 z-10 flex items-center gap-2 bg-white/95 backdrop-blur-md
                     rounded-xl px-3 py-2 shadow-lg border border-slate-100 hover:bg-white transition"
          title="Afficher la légende">
          <Info size={13} className="text-slate-500 shrink-0" />
          <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">
            {couche === "trafic" ? "Tournées" : couche === "clients" ? "Clients" : "Zones"}
          </span>
          <span className="text-[10px] font-semibold text-slate-500">{compte}</span>
        </button>
      )}

      <div className={`absolute bottom-4 left-4 bg-white/95 backdrop-blur-md rounded-xl p-3 shadow-lg z-10 border border-slate-100
                       max-h-[70%] overflow-y-auto ${legendeOuverte ? "" : "hidden"}`}>
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="text-[10px] font-bold text-slate-800 uppercase tracking-wider">
            {couche === "trafic" ? "Tournées du jour" : couche === "clients" ? "Légende clients" : "Légende zones"}
            <span className="ml-1.5 font-semibold text-slate-500 normal-case">· {compte}</span>
          </div>
          <button onClick={() => setLegendeOuverte(false)}
            aria-label="Masquer la légende"
            className="-mt-0.5 -mr-0.5 p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition shrink-0">
            <X size={13} />
          </button>
        </div>
        <div className="space-y-1.5">
          {legende.map((l) => (
            <div key={l.label} className="flex items-center gap-2 text-[10px] font-semibold text-slate-650">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: l.color }} />
              {l.label}
            </div>
          ))}
        </div>

        {/* Une carte presque vide n'est pas forcément en panne : la flotte
            n'est localisée que si l'application terrain remonte sa position.
            Sans cette note, l'écran laissait croire à un dysfonctionnement. */}
        {couche === "trafic" && sansPosition.length > 0 && (
          <div className="mt-2 pt-2 border-t border-slate-100 text-[10px] leading-snug text-slate-500 max-w-[16rem]">
            <span className="font-bold text-slate-700">{vehiculesLocalises} véhicule(s) localisé(s)</span>
            {" · "}{sansPosition.length} sans position GPS
            <div className="mt-1 opacity-85 font-mono text-[9px]">{sansPosition.join(" · ")}</div>
            <div className="mt-1 opacity-80">
              Un véhicule n&apos;apparaît qu&apos;après la première remontée de position
              depuis l&apos;application du commercial.
            </div>
          </div>
        )}

        {/* Tournées ouvertes mais introuvables sur la carte : sans cette
            mention, on croyait la carte fausse alors qu'il manque le plan de
            visite côté ERP. */}
        {couche === "trafic" && sansTrace.length > 0 && (
          <div className="mt-2 pt-2 border-t border-slate-100 text-[10px] leading-snug text-slate-500 max-w-[16rem]">
            <span className="font-bold text-amber-700">
              {sansTrace.length} tournée(s) sans plan de visite
            </span>
            <div className="mt-0.5 opacity-85">
              {sansTrace.map((t) => t.commercial || `OM-${t.id}`).join(" · ")}
            </div>
            <div className="mt-0.5 opacity-80">
              Aucune étape planifiée dans l&apos;ERP et aucun véhicule localisé :
              rien à tracer.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
