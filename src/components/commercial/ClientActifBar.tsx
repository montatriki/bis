"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin, Crosshair, Loader2, X, Check, AlertTriangle, ChevronRight, Users, Route,
} from "lucide-react";
import { useClientActif, type ClientActif } from "@/lib/client-actif";
import ClientActifModal from "./ClientActifModal";
import { distanceM, formatDistance, type Proximite } from "@/lib/geo";

// Bandeau « client en cours » affiché en tête de tous les écrans commerciaux.
//
// Rôle : répondre en permanence à la question « pour quel client suis-je en
// train de travailler ? ». À l'ouverture, si la position GPS désigne un point de
// vente sans ambiguïté, le client est sélectionné automatiquement ; sinon on
// propose les clients proches, et à défaut on renvoie vers la liste complète.

type ClientProche = ClientActif & { distance: number; proximite: Proximite };

const fmt = (n?: number | null) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Number(n) || 0);

/** Libellé et couleur associés à un niveau de proximité. */
const STYLE_PROX: Record<Proximite, { label: string; classe: string }> = {
  "sur-place": { label: "Sur place", classe: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" },
  "proche": { label: "À proximité", classe: "bg-blue-500/15 text-blue-600 border-blue-500/30" },
  "zone": { label: "Dans la zone", classe: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
  "loin": { label: "Éloigné", classe: "bg-red-500/15 text-red-600 border-red-500/30" },
};

export default function ClientActifBar() {
  const router = useRouter();
  const { client, choisir, effacer, position, erreurGps, gpsEnCours, rafraichirPosition, pret } = useClientActif();

  const [proches, setProches] = useState<ClientProche[]>([]);
  const [chargement, setChargement] = useState(false);
  const [panneau, setPanneau] = useState(false);
  // Fiche rapide du client en cours (tap sur son nom).
  const [fiche, setFiche] = useState(false);
  // La détection automatique ne doit s'appliquer qu'une fois par tournée.
  const [autoFait, setAutoFait] = useState(false);

  // Position à laquelle la liste des clients proches a été calculée : sert à
  // décider s'il faut la recalculer après un déplacement.
  const derniereRecherche = useRef<{ lat: number; lng: number } | null>(null);

  const chercherProches = useCallback(async () => {
    if (!position) return [];
    setChargement(true);
    try {
      const r = await fetch(`/api/clients/proches?lat=${position.lat}&lng=${position.lng}`);
      const d = await r.json();
      derniereRecherche.current = { lat: position.lat, lng: position.lng };
      setProches(d.rows ?? []);
      return d.rows ?? [];
    } catch {
      return [];
    } finally {
      setChargement(false);
    }
  }, [position]);

  // Rafraîchissement de la liste quand le commercial se déplace.
  //
  // La liste n'était chargée qu'une fois, à la première position connue : elle
  // conservait ensuite les distances du point de départ pendant toute la
  // journée, alors que le planning, lui, recalcule en continu. Les deux écrans
  // affichaient donc des distances contradictoires pour le même client.
  useEffect(() => {
    if (!position || proches.length === 0) return;
    const ref = derniereRecherche.current;
    // 200 m : en deçà, le classement par distance ne change pas.
    if (ref && distanceM(ref.lat, ref.lng, position.lat, position.lng) < 200) return;
    derniereRecherche.current = { lat: position.lat, lng: position.lng };
    let annule = false;
    fetch(`/api/clients/proches?lat=${position.lat}&lng=${position.lng}`)
      .then((r) => r.json())
      .then((d) => { if (!annule) setProches(d.rows ?? []); })
      .catch(() => { /* hors couverture : on garde la liste précédente */ });
    return () => { annule = true; };
  }, [position, proches.length]);

  // Dès qu'une position est connue et qu'aucun client n'est actif, on tente la
  // reconnaissance du point de vente.
  useEffect(() => {
    if (!pret || !position || client || autoFait) return;
    let annule = false;
    (async () => {
      setChargement(true);
      try {
        const r = await fetch(`/api/clients/proches?lat=${position.lat}&lng=${position.lng}`);
        const d = await r.json();
        if (annule) return;
        derniereRecherche.current = { lat: position.lat, lng: position.lng };
        setProches(d.rows ?? []);
        if (d.auto) {
          // Position sans ambiguïté : on sélectionne directement.
          choisir({ ...d.auto, distance: d.auto.distance }, "gps");
        } else if ((d.rows ?? []).length > 0) {
          // Plusieurs candidats : on laisse le commercial trancher.
          setPanneau(true);
        }
      } catch {
        // Réseau indisponible : le commercial choisira manuellement.
      } finally {
        if (!annule) { setChargement(false); setAutoFait(true); }
      }
    })();
    return () => { annule = true; };
  }, [pret, position, client, autoFait, choisir]);

  if (!pret) return null;

  // ---- Aucun client actif : inviter à en choisir un -------------------------
  if (!client) {
    return (
      <>
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 mb-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-600 flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={17} />
            </div>
            <div className="flex-1 min-w-[180px]">
              <div className="font-bold text-sm text-[var(--text-primary)]">Aucun client sélectionné</div>
              <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                {gpsEnCours || chargement
                  ? "Recherche du point de vente le plus proche…"
                  : erreurGps
                    ? erreurGps
                    : proches.length > 0
                      ? `${proches.length} client(s) à proximité détecté(s)`
                      : "Sélectionnez le client pour lequel vous travaillez"}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {(gpsEnCours || chargement) && <Loader2 size={16} className="animate-spin text-amber-600" />}
              {proches.length > 0 && (
                <button onClick={() => setPanneau(true)}
                  className="text-xs font-bold bg-amber-500 text-white px-3 py-2 rounded-xl hover:bg-amber-400 transition flex items-center gap-1.5">
                  <Crosshair size={13} /> Clients proches
                </button>
              )}
              <button onClick={() => { rafraichirPosition(); setAutoFait(false); }}
                title="Relancer la détection GPS"
                className="text-xs font-bold border border-amber-500/40 text-amber-700 px-3 py-2 rounded-xl hover:bg-amber-500/10 transition flex items-center gap-1.5">
                <MapPin size={13} /> GPS
              </button>
              <button onClick={() => router.push("/commercial/clients")}
                className="text-xs font-bold bg-[var(--bg-card)] border border-[var(--border-primary)] text-[var(--text-primary)] px-3 py-2 rounded-xl hover:bg-[var(--bg-primary)] transition flex items-center gap-1.5">
                <Users size={13} /> Choisir <ChevronRight size={12} />
              </button>
            </div>
          </div>
        </div>

        <PanneauProches ouvert={panneau} onFermer={() => setPanneau(false)}
          proches={proches} chargement={chargement}
          onChoisir={(c) => { choisir(c, "gps"); setPanneau(false); }}
          onRecharger={chercherProches} />
      </>
    );
  }

  // ---- Client actif ---------------------------------------------------------
  const prox = client.distance != null
    ? (client.distance <= 120 ? "sur-place" : client.distance <= 500 ? "proche" : client.distance <= 5000 ? "zone" : "loin") as Proximite
    : null;

  return (
    <>
      <AnimatePresence>
        {fiche && <ClientActifModal client={client} onClose={() => setFiche(false)} />}
      </AnimatePresence>
      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-600 flex items-center justify-center flex-shrink-0 font-bold text-sm">
            {client.raisonSocial.charAt(0).toUpperCase()}
          </div>

          <div className="flex-1 min-w-[180px]">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600">Client en cours</span>
              {client.origine === "gps" && (
                <span className="text-[9px] font-bold bg-emerald-500/15 text-emerald-600 border border-emerald-500/30 px-1.5 py-0.5 rounded uppercase flex items-center gap-1">
                  <Crosshair size={9} /> détecté GPS
                </span>
              )}
              {prox && (
                <span className={`text-[9px] font-bold border px-1.5 py-0.5 rounded uppercase ${STYLE_PROX[prox].classe}`}>
                  {STYLE_PROX[prox].label} · {formatDistance(client.distance!)}
                </span>
              )}
            </div>
            <button onClick={() => setFiche(true)} title="Ouvrir la fiche du client"
              className="group flex items-center gap-1 max-w-full text-left font-bold text-sm text-[var(--text-primary)] mt-0.5 hover:text-emerald-700 transition">
              <span className="truncate underline decoration-emerald-500/40 decoration-dotted underline-offset-4 group-hover:decoration-emerald-600">{client.raisonSocial}</span>
              <ChevronRight size={14} className="shrink-0 text-emerald-600" />
            </button>
            <div className="text-xs text-[var(--text-secondary)] flex items-center gap-1.5 truncate">
              <MapPin size={10} className="shrink-0" />
              {client.ville || client.adresse || "—"}
              {client.soldeFin != null && client.soldeFin > 0 && (
                <span className="text-red-600 font-semibold">· solde {fmt(client.soldeFin)} TND</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => router.push("/commercial/catalogue")}
              className="text-xs font-bold bg-emerald-600 text-white px-3 py-2 rounded-xl hover:bg-emerald-500 transition">
              Commander
            </button>
            <button onClick={async () => { setPanneau(true); if (proches.length === 0) await chercherProches(); }}
              className="text-xs font-bold border border-emerald-500/40 text-emerald-700 px-3 py-2 rounded-xl hover:bg-emerald-500/10 transition flex items-center gap-1.5">
              <Crosshair size={13} /> Changer
            </button>
            <button onClick={effacer} title="Terminer la visite"
              className="w-8 h-8 flex items-center justify-center rounded-xl border border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-red-600 hover:border-red-300 transition">
              <X size={14} />
            </button>
          </div>
        </div>
      </div>

      <PanneauProches ouvert={panneau} onFermer={() => setPanneau(false)}
        proches={proches} chargement={chargement}
        onChoisir={(c) => { choisir(c, "gps"); setPanneau(false); }}
        onRecharger={chercherProches} />
    </>
  );
}

/** Liste des clients proches, triés par distance croissante. */
function PanneauProches({
  ouvert, onFermer, proches, chargement, onChoisir, onRecharger,
}: {
  ouvert: boolean; onFermer: () => void;
  proches: ClientProche[]; chargement: boolean;
  onChoisir: (c: ClientProche) => void;
  onRecharger: () => Promise<ClientProche[] | never[]>;
}) {
  const router = useRouter();
  return (
    <AnimatePresence>
      {ouvert && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onFermer}>
          <motion.div className="bg-[var(--bg-card)] rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
            <div className="p-5 border-b border-[var(--border-primary)] flex items-center justify-between">
              <div>
                <div className="font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <Crosshair size={16} className="text-emerald-600" /> Clients à proximité
                </div>
                <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Triés par distance depuis votre position
                </div>
              </div>
              <button onClick={onFermer} className="p-2 hover:bg-[var(--bg-primary)] rounded-xl transition">
                <X size={16} />
              </button>
            </div>

            <div className="overflow-auto flex-1 divide-y divide-[var(--border-primary)]/60">
              {chargement && (
                <div className="py-10 text-center text-[var(--text-secondary)]">
                  <Loader2 className="animate-spin inline" size={18} />
                </div>
              )}
              {!chargement && proches.length === 0 && (
                <div className="py-10 px-5 text-center text-sm text-[var(--text-secondary)]">
                  Aucun client référencé autour de vous.
                </div>
              )}
              {proches.map((c) => (
                <button key={c.id} onClick={() => onChoisir(c)}
                  className="w-full text-left px-5 py-3 hover:bg-[var(--accent-light)] transition flex items-center gap-3">
                  <div className={`text-[9px] font-black uppercase border px-1.5 py-1 rounded shrink-0 ${STYLE_PROX[c.proximite].classe}`}>
                    {formatDistance(c.distance)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-[var(--text-primary)] truncate">{c.raisonSocial}</div>
                    <div className="text-xs text-[var(--text-secondary)] truncate">
                      {c.ville || c.adresse || "—"}
                      {c.soldeFin != null && c.soldeFin > 0 && ` · solde ${fmt(c.soldeFin)} TND`}
                    </div>
                  </div>
                  <Check size={15} className="text-emerald-600 opacity-0 group-hover:opacity-100 shrink-0" />
                </button>
              ))}
            </div>

            <div className="p-4 border-t border-[var(--border-primary)] space-y-2">
              <button onClick={() => { onFermer(); router.push("/commercial/planning"); }}
                className="w-full text-xs font-bold bg-emerald-600 text-white py-2.5 rounded-xl hover:bg-emerald-500 transition flex items-center justify-center gap-1.5">
                <Route size={13} /> Voir ma tournée du jour
              </button>
              <div className="flex gap-2">
                <button onClick={() => onRecharger()}
                  className="flex-1 text-xs font-bold border border-[var(--border-primary)] text-[var(--text-secondary)] py-2.5 rounded-xl hover:bg-[var(--bg-primary)] transition">
                  Actualiser
                </button>
                <button onClick={() => { onFermer(); router.push("/commercial/clients"); }}
                  className="flex-1 text-xs font-bold bg-blue-600 text-white py-2.5 rounded-xl hover:bg-blue-500 transition">
                  Tous les clients
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
