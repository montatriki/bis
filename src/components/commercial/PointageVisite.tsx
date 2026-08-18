"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { MapPin, Mic, Square, Loader2, AlertTriangle } from "lucide-react";
import { distanceM } from "@/lib/geo";

// Pointage d'arrivée chez un client, avec enregistrement vocal de la visite.
//
// Le commercial confirme sa présence d'un clic : la visite passe « En cours »
// et le micro démarre. L'enregistrement s'arrête tout seul dès que le GPS
// constate qu'il a quitté les lieux — plus rien à penser une fois parti.
//
// Pourquoi un clic et non un démarrage 100 % automatique : passer devant un
// client sans s'arrêter déclencherait un enregistrement inutile, et capter du
// son à l'insu du commercial n'est pas acceptable.

/** Éloignement au-delà duquel la visite est considérée terminée. */
const RAYON_PRESENCE_M = 150;

/**
 * Durée pendant laquelle l'éloignement doit se confirmer avant de couper.
 * Un point GPS isolé peut sauter de 200 m en ville : sans ce délai,
 * l'enregistrement s'arrêterait au milieu d'une visite.
 */
const CONFIRMATION_MS = 60_000;

type Enr = { id: number; ligneId: number; clientNom: string | null; debut: string };

export default function PointageVisite({
  ligneId, clientNom, position, onChange,
}: {
  ligneId: number;
  clientNom: string | null;
  /** Position courante du commercial, fournie par l'écran. */
  position: { lat: number; lng: number } | null;
  onChange?: () => void;
}) {
  const [enr, setEnr] = useState<Enr | null>(null);
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [secondes, setSecondes] = useState(0);
  // Refus de pointage pour cause d'éloignement : on propose de forcer plutôt
  // que de bloquer, mais l'écart constaté reste affiché.
  const [refus, setRefus] = useState<{ message: string; distance: number | null } | null>(null);

  const media = useRef<MediaRecorder | null>(null);
  const morceaux = useRef<Blob[]>([]);
  const depart = useRef<{ lat: number; lng: number } | null>(null);
  const loinDepuis = useRef<number | null>(null);

  /** Clôture côté serveur, avec l'audio capté s'il y en a. */
  const cloturer = useCallback(async (id: number, motif: string, audio?: string | null) => {
    await fetch("/api/enregistrements", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, motifFin: motif, audio: audio ?? undefined }),
    }).catch(() => {});
    setEnr(null);
    setSecondes(0);
    depart.current = null;
    loinDepuis.current = null;
    onChange?.();
  }, [onChange]);

  /** Arrête le micro puis clôture — l'audio n'est prêt qu'après `onstop`. */
  const arreter = useCallback((motif: string) => {
    const id = enr?.id;
    if (!id) return;
    const mr = media.current;
    if (mr && mr.state !== "inactive") {
      mr.onstop = async () => {
        const blob = new Blob(morceaux.current, { type: "audio/webm" });
        morceaux.current = [];
        // Au-delà de ~3 Mo on ne transmet que la trace : l'essentiel est de
        // savoir que la visite a eu lieu et combien de temps.
        let audio: string | null = null;
        if (blob.size > 0 && blob.size < 3_000_000) {
          audio = await new Promise<string>((res) => {
            const fr = new FileReader();
            fr.onloadend = () => res(String(fr.result));
            fr.readAsDataURL(blob);
          });
        }
        await cloturer(id, motif, audio);
      };
      mr.stop();
      mr.stream.getTracks().forEach((t) => t.stop());
      media.current = null;
    } else {
      void cloturer(id, motif);
    }
  }, [enr, cloturer]);

  // Reprend un enregistrement resté ouvert (rechargement de page, veille).
  useEffect(() => {
    let annule = false;
    fetch("/api/enregistrements?vue=encours")
      .then((r) => r.json())
      .then((d) => { if (!annule && d?.row?.ligneId === ligneId) setEnr(d.row); })
      .catch(() => {});
    return () => { annule = true; };
  }, [ligneId]);

  // Compteur de durée.
  useEffect(() => {
    if (!enr) return;
    const t = setInterval(() => {
      setSecondes(Math.max(0, Math.round((Date.now() - new Date(enr.debut).getTime()) / 1000)));
    }, 1000);
    return () => clearInterval(t);
  }, [enr]);

  // Arrêt automatique à l'éloignement, confirmé sur la durée.
  useEffect(() => {
    if (!enr || !position || !depart.current) return;
    const d = distanceM(depart.current.lat, depart.current.lng, position.lat, position.lng);
    if (d > RAYON_PRESENCE_M) {
      if (loinDepuis.current == null) loinDepuis.current = Date.now();
      else if (Date.now() - loinDepuis.current >= CONFIRMATION_MS) arreter("eloignement");
    } else {
      // Retour sur place : l'éloignement n'était qu'un saut de GPS.
      loinDepuis.current = null;
    }
  }, [position, enr, arreter]);

  async function demarrer(forcer = false) {
    setErreur(null);
    if (forcer) setRefus(null);
    setBusy(true);
    const r = await fetch("/api/enregistrements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vue: "demarrer", ligneId,
        latitude: position?.lat, longitude: position?.lng,
        forcer,
      }),
    }).then((x) => x.json()).catch(() => ({ error: "réseau" }));
    setBusy(false);

    // Trop loin du client, ou position inconnue : le serveur refuse et
    // explique pourquoi. Le commercial peut passer outre en connaissance de
    // cause (coordonnées client fausses, livraison sur un autre site).
    if (r.code === "trop-loin" || r.code === "sans-position") {
      setRefus({ message: r.error, distance: r.distance ?? null });
      return;
    }
    if (!r.ok) { setErreur(r.error ?? "Échec du pointage"); return; }
    setRefus(null);
    setEnr(r.row);
    depart.current = position;
    loinDepuis.current = null;
    onChange?.();

    // Le micro est optionnel : un refus d'autorisation ne doit pas empêcher
    // le pointage, qui reste la preuve du passage.
    try {
      const flux = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(flux);
      morceaux.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) morceaux.current.push(e.data); };
      mr.start();
      media.current = mr;
    } catch {
      setErreur("Micro indisponible — la visite est pointée sans enregistrement");
    }
  }

  const mmss = `${String(Math.floor(secondes / 60)).padStart(2, "0")}:${String(secondes % 60).padStart(2, "0")}`;

  return (
    <div className="space-y-1.5">
      {!enr ? (
        <button onClick={() => demarrer()} disabled={busy}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold
                     text-white bg-emerald-600 hover:bg-emerald-500 transition disabled:opacity-50">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}
          Je suis chez ce client
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/25">
            <Mic size={14} className="text-red-600 animate-pulse" />
            <span className="text-xs font-bold text-red-600">Visite en cours</span>
            <span className="ml-auto text-xs font-mono font-bold text-red-600">{mmss}</span>
          </div>
          <button onClick={() => arreter("manuel")} title="Terminer la visite"
            className="px-3 py-2.5 rounded-xl bg-red-600 text-white hover:bg-red-500 transition">
            <Square size={13} />
          </button>
        </div>
      )}

      {enr && (
        <p className="text-[10px] text-[var(--text-secondary)] leading-snug">
          L&apos;enregistrement s&apos;arrête seul dès que vous quittez le client
          {clientNom ? ` (${clientNom})` : ""}.
        </p>
      )}

      {refus && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 space-y-1.5">
          <div className="text-[10px] text-amber-800 flex items-start gap-1.5 leading-snug">
            <AlertTriangle size={11} className="shrink-0 mt-0.5" /> {refus.message}
          </div>
          <button onClick={() => demarrer(true)} disabled={busy}
            className="w-full px-2.5 py-1.5 rounded-lg text-[10px] font-bold border border-amber-600/40
                       text-amber-800 hover:bg-amber-500/15 transition disabled:opacity-50">
            Pointer quand même
          </button>
        </div>
      )}

      {erreur && (
        <div className="text-[10px] text-amber-700 bg-amber-500/10 border border-amber-500/25 rounded-lg px-2.5 py-1.5 flex items-start gap-1.5">
          <AlertTriangle size={11} className="shrink-0 mt-0.5" /> {erreur}
        </div>
      )}
    </div>
  );
}
