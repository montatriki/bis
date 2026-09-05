"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { X, MapPin, Check, Loader2, AlertTriangle, Crosshair, History } from "lucide-react";
import { coordValide, distanceM, formatDistance } from "@/lib/geo";

// Pointage d'une visite terrain : le commercial déclare « je suis là », et
// l'application vérifie qu'il se trouve bien à l'adresse du client avant
// d'enregistrer le passage dans le journal (`visites_client`).
//
// Trois situations, toutes enregistrées — un passage refusé serait pire qu'un
// passage tracé comme « à distance » :
//   sur place ......... distance ≤ seuil, rien à faire ;
//   trop loin ......... on propose de corriger la position du client ;
//   sans position ..... GPS refusé ou client non géolocalisé.

type ClientVisite = {
  id: number; raisonSocial: string;
  ville?: string | null; gouvernorat?: string | null; adresse?: string | null;
  latitude?: number | null; longitude?: number | null;
};

type Visite = {
  id: number; visiteLe: string; commercialNom: string;
  distanceM: number | null; surPlace: boolean; positionCorrigee: boolean;
  commentaire: string | null;
};

export default function VisiteModal({
  client, onFermer, onEnregistre,
}: {
  client: ClientVisite;
  onFermer: () => void;
  /** Position corrigée : la liste doit rafraîchir ses coordonnées. */
  onEnregistre: (corrige: boolean, position?: { lat: number; lng: number }) => void;
}) {
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [geoErreur, setGeoErreur] = useState<string | null>(null);
  const [localise, setLocalise] = useState(true);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [commentaire, setCommentaire] = useState("");
  const [journal, setJournal] = useState<Visite[]>([]);
  const [seuil, setSeuil] = useState(150);

  // Une demande de position à la fois : deux `getCurrentPosition` concurrents
  // (double montage en développement, double clic sur « Réessayer ») restent
  // sans réponse sur certains navigateurs — ni succès ni erreur, l'écran
  // tournait indéfiniment.
  const enCours = useRef(false);

  const localiser = useCallback(() => {
    if (enCours.current) return;
    if (!navigator.geolocation) {
      // Différé : appelée depuis un effet, une écriture d'état synchrone
      // déclencherait un rendu en cascade.
      queueMicrotask(() => {
        setGeoErreur("Ce navigateur ne fournit pas la position.");
        setLocalise(false);
      });
      return;
    }
    enCours.current = true;
    // Garde-fou : certains navigateurs ne rappellent ni le succès ni l'erreur
    // (WebView, position bloquée en sous-sol). Sans ce délai, l'écran resterait
    // sur « Localisation en cours » et le commercial ne pourrait plus pointer.
    const abandon = setTimeout(() => {
      if (!enCours.current) return;
      enCours.current = false;
      setGeoErreur("Position indisponible pour le moment.");
      setLocalise(false);
    }, 14_000);

    navigator.geolocation.getCurrentPosition(
      (p) => {
        clearTimeout(abandon);
        if (!enCours.current) return;
        enCours.current = false;
        setPosition({ lat: p.coords.latitude, lng: p.coords.longitude });
        setLocalise(false);
      },
      (e) => {
        clearTimeout(abandon);
        if (!enCours.current) return;
        enCours.current = false;
        setGeoErreur(e.code === e.PERMISSION_DENIED
          ? "Position refusée. Autorisez la géolocalisation pour vérifier votre présence."
          : "Position indisponible pour le moment.");
        setLocalise(false);
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 0 },
    );
  }, []);

  // Le GPS se déclenche à l'ouverture : le commercial pointe en arrivant.
  // L'appelant monte ce composant avec une clé par client, donc l'état naît
  // vierge — inutile (et interdit par le compilateur React) de le remettre à
  // zéro depuis l'effet.
  const clientId = client.id;
  useEffect(() => {
    let annule = false;
    localiser();
    fetch(`/api/visites?clientId=${clientId}&limit=5`)
      .then((r) => r.json())
      .then((d) => {
        if (annule) return;
        setJournal(d.rows ?? []);
        if (d.seuilM) setSeuil(d.seuilM);
      })
      .catch(() => {});
    return () => { annule = true; };
  }, [clientId, localiser]);

  const clientGeo = coordValide(client.latitude, client.longitude);
  const distance = position && clientGeo
    ? Math.round(distanceM(position.lat, position.lng, client.latitude as number, client.longitude as number))
    : null;
  const surPlace = distance !== null && distance <= seuil;

  async function pointer(corrigerPosition: boolean) {
    setEnvoi(true); setErreur(null);
    try {
      const r = await fetch("/api/visites", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: client.id,
          latitude: position?.lat, longitude: position?.lng,
          corrigerPosition, commentaire,
        }),
      });
      const d = await r.json();
      if (!r.ok) { setErreur(d.error ?? "Enregistrement impossible"); return; }
      onEnregistre(corrigerPosition, position ?? undefined);
      onFermer();
    } catch {
      setErreur("Réseau indisponible");
    } finally {
      setEnvoi(false);
    }
  }

  const lieu = [client.ville, client.gouvernorat].filter(Boolean).join(" — ") || client.adresse || "—";

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
      onClick={onFermer}>
      <motion.div onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
        className="w-full sm:max-w-md bg-[var(--bg-card)] rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[92vh] overflow-y-auto">

        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 p-4 border-b border-[var(--border-primary)] bg-[var(--bg-card)]">
          <div className="min-w-0">
            <div className="font-black text-[var(--text-primary)] leading-tight truncate">{client.raisonSocial}</div>
            <div className="text-xs text-[var(--text-secondary)] flex items-center gap-1 mt-0.5">
              <MapPin size={11} /> {lieu}
            </div>
          </div>
          <button onClick={onFermer} aria-label="Fermer"
            className="p-2 -mr-1 rounded-xl text-[var(--text-secondary)] hover:bg-[var(--accent-light)] transition">
            <X size={17} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {/* Vérification de présence */}
          {localise && (
            <div className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-primary)] text-sm text-[var(--text-secondary)]">
              <Loader2 size={16} className="animate-spin" /> Localisation en cours…
            </div>
          )}

          {!localise && surPlace && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200">
              <Check size={17} className="text-emerald-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <div className="font-bold text-emerald-800">Vous êtes sur place</div>
                <div className="text-emerald-700 text-xs mt-0.5">
                  À {formatDistance(distance!)} de la position enregistrée du client.
                </div>
              </div>
            </div>
          )}

          {!localise && distance !== null && !surPlace && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-amber-50 border border-amber-200">
              <AlertTriangle size={17} className="text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <div className="font-bold text-amber-800">Vous êtes à {formatDistance(distance)} du client</div>
                <div className="text-amber-700 text-xs mt-0.5">
                  Si vous êtes bien devant le commerce, la position enregistrée est fausse :
                  corrigez-la pour les prochaines tournées.
                </div>
              </div>
            </div>
          )}

          {!localise && position && !clientGeo && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-amber-50 border border-amber-200">
              <MapPin size={17} className="text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <div className="font-bold text-amber-800">Client sans position</div>
                <div className="text-amber-700 text-xs mt-0.5">
                  Ce client n&apos;a jamais été géolocalisé. Enregistrez votre position pour le situer.
                </div>
              </div>
            </div>
          )}

          {geoErreur && (
            <div className="flex items-start justify-between gap-2 p-3.5 rounded-2xl bg-red-50 border border-red-200">
              <div className="flex items-start gap-2.5 text-sm min-w-0">
                <AlertTriangle size={17} className="text-red-500 mt-0.5 flex-shrink-0" />
                <span className="text-red-700">{geoErreur}</span>
              </div>
              <button onClick={() => { setGeoErreur(null); setLocalise(true); localiser(); }}
                className="text-xs font-bold text-red-700 underline shrink-0">
                Réessayer
              </button>
            </div>
          )}

          <textarea value={commentaire} onChange={(e) => setCommentaire(e.target.value)}
            placeholder="Commentaire (facultatif) : client absent, commande à venir…"
            rows={2}
            className="w-full px-3 py-2.5 text-sm rounded-xl bg-[var(--bg-primary)] border border-[var(--border-primary)]
                       text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/55
                       focus:outline-none focus:border-[var(--accent-primary)]/50 resize-none" />

          {erreur && <div className="text-sm text-red-600 font-medium">{erreur}</div>}

          {/* Actions */}
          <div className="space-y-2">
            <button onClick={() => pointer(false)} disabled={envoi || localise}
              className="w-full flex items-center justify-center gap-2 text-white py-3 rounded-xl font-bold text-sm
                         transition-all disabled:opacity-40 shadow-[0_10px_24px_-14px_var(--shadow-hover)]"
              style={{ background: "linear-gradient(135deg, var(--accent-primary), color-mix(in srgb, var(--accent-primary) 78%, #000))" }}>
              {envoi ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
              Je suis là — enregistrer la visite
            </button>

            {/* Proposée seulement quand elle a un sens : position connue et
                client mal placé (ou pas placé du tout). */}
            {position && !surPlace && (
              <button onClick={() => pointer(true)} disabled={envoi}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm
                           bg-[var(--accent-light)] text-[var(--accent-primary)] border border-[var(--accent-primary)]/25
                           transition disabled:opacity-40">
                <Crosshair size={14} />
                Corriger la position du client et enregistrer
              </button>
            )}
          </div>

          {/* Derniers passages : le commercial voit s'il est déjà venu. */}
          {journal.length > 0 && (
            <div className="pt-1">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--text-secondary)] opacity-70 mb-1.5">
                <History size={12} /> Derniers passages
              </div>
              <div className="space-y-1">
                {journal.map((v) => (
                  <div key={v.id} className="flex items-center justify-between gap-2 text-xs px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-primary)]">
                    <span className="text-[var(--text-primary)] font-medium">
                      {new Date(v.visiteLe).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span className={`font-bold ${v.surPlace ? "text-emerald-600" : "text-amber-600"}`}>
                      {v.distanceM === null ? "Position inconnue" : v.surPlace ? "Sur place" : formatDistance(v.distanceM)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
