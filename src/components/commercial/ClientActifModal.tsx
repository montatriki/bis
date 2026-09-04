"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { X, MapPin, Phone, Navigation, ShoppingCart, FileText, Crosshair, Loader2, Check, AlertTriangle } from "lucide-react";
import { useClientActif, type ClientActif } from "@/lib/client-actif";
import { coordValide, distanceM, formatDistance } from "@/lib/geo";
import { confirmer, succes, erreur } from "@/lib/alertes";

// Fiche rapide du client en cours, ouverte d'un tap sur son nom dans le
// bandeau. Même gabarit que la fiche d'étape du planning (Appeler,
// Itinéraire, Travailler sur ce client), plus la correction de la position :
// le commercial est devant la boutique, c'est le meilleur moment pour
// remplacer des coordonnées fausses par sa position GPS.

/** Précision GPS au-delà de laquelle on refuse d'enregistrer une position. */
const PRECISION_MAX_M = 100;

const fmt = (n?: number | null) =>
  new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(Number(n) || 0);

export default function ClientActifModal({ client, onClose }: { client: ClientActif; onClose: () => void }) {
  const router = useRouter();
  const { position, gpsEnCours, rafraichirPosition, choisir } = useClientActif();
  const [busy, setBusy] = useState(false);

  const tel = (client.tel ?? "").replace(/[^0-9+]/g, "");
  const geo = coordValide(client.latitude, client.longitude);
  const distance = geo && position ? distanceM(position.lat, position.lng, client.latitude!, client.longitude!) : null;
  const precisionOk = position != null && position.precision <= PRECISION_MAX_M;

  async function corrigerPosition() {
    if (!position) { rafraichirPosition(); return; }
    if (!precisionOk) {
      await erreur(`Signal GPS trop imprécis (±${Math.round(position.precision)} m). Sortez à découvert et réessayez.`, "Position non enregistrée");
      return;
    }
    const ok = await confirmer(
      geo
        ? `La position enregistrée de « ${client.raisonSocial} » sera remplacée par votre position actuelle (±${Math.round(position.precision)} m)${distance != null ? `, à ${formatDistance(distance)} de l'ancienne` : ""}.`
        : `Votre position actuelle (±${Math.round(position.precision)} m) deviendra la position de « ${client.raisonSocial} ».`,
      { titre: "Corriger la position du client", intitule: "Enregistrer ma position" },
    );
    if (!ok) return;
    setBusy(true);
    try {
      const r = await fetch("/api/clients", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: client.id, latitude: position.lat, longitude: position.lng }),
      });
      const d = await r.json();
      if (!r.ok) { await erreur(d.error ?? "Échec de l'enregistrement"); return; }
      // Le bandeau reflète aussitôt la nouvelle position : distance 0, « sur place ».
      choisir({ ...client, latitude: position.lat, longitude: position.lng, distance: 0 }, "gps");
      await succes("Position du client mise à jour.");
      onClose();
    } catch {
      await erreur("Réseau indisponible — réessayez");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 sm:p-4" onClick={onClose}>
      <motion.div className="bg-[var(--bg-card)] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }}>

        {/* En-tête */}
        <div className="p-4 border-b border-[var(--border-primary)]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase tracking-wider text-emerald-600">Client en cours · code {client.id}</div>
              <div className="font-bold text-base text-[var(--text-primary)] mt-0.5">{client.raisonSocial}</div>
              <div className="text-xs text-[var(--text-secondary)] mt-1 flex items-start gap-1.5">
                <MapPin size={12} className="shrink-0 mt-0.5" />
                <span>{client.adresse || client.ville || "Adresse non renseignée"}{client.gouvernorat ? ` — ${client.gouvernorat}` : ""}</span>
              </div>
              {client.soldeFin != null && client.soldeFin > 0 && (
                <div className="text-xs font-semibold text-red-600 mt-1">Solde dû : {fmt(client.soldeFin)} TND</div>
              )}
            </div>
            <button onClick={onClose} aria-label="Fermer" className="p-2 rounded-xl hover:bg-[var(--bg-primary)] text-[var(--text-secondary)]"><X size={18} /></button>
          </div>
        </div>

        <div className="p-4 space-y-2.5">
          {/* Actions, comme la fiche d'étape du planning */}
          <div className="grid grid-cols-2 gap-2">
            {tel ? (
              <a href={`tel:${tel}`} className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-[var(--border-primary)] text-sm font-semibold hover:bg-[var(--bg-primary)] transition">
                <Phone size={15} /> Appeler
              </a>
            ) : (
              <div className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-[var(--border-primary)] text-sm text-[var(--text-secondary)]">Sans tél.</div>
            )}
            {geo ? (
              <a href={`https://www.google.com/maps/dir/?api=1&destination=${client.latitude},${client.longitude}`} target="_blank" rel="noreferrer"
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-500 transition">
                <Navigation size={15} /> Itinéraire
              </a>
            ) : (
              <div className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-[var(--border-primary)] text-sm text-[var(--text-secondary)]">Non localisé</div>
            )}
          </div>
          <button onClick={() => { onClose(); router.push("/commercial/catalogue"); }}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-500 transition">
            <ShoppingCart size={15} /> Travailler sur ce client
          </button>
          <button onClick={() => { onClose(); router.push(`/commercial/clients/${client.id}`); }}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-[var(--border-primary)] text-sm font-semibold hover:bg-[var(--bg-primary)] transition">
            <FileText size={15} /> Fiche complète du mois
          </button>

          {/* Position du client : la seule chose modifiable ici */}
          <div className="pt-2 mt-1 border-t border-[var(--border-primary)]">
            <div className="text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)] mb-2">Position du client</div>
            <div className="text-xs text-[var(--text-secondary)] mb-2 flex items-start gap-1.5">
              {geo ? <Check size={13} className="text-emerald-600 shrink-0 mt-0.5" /> : <AlertTriangle size={13} className="text-amber-600 shrink-0 mt-0.5" />}
              <span>
                {geo ? "Position enregistrée" : "Aucune position enregistrée — impossible de la retrouver sur la carte"}
                {distance != null && ` · à ${formatDistance(distance)} de vous`}
                {position && ` · votre GPS ±${Math.round(position.precision)} m`}
                {!position && !gpsEnCours && " · position GPS inconnue"}
              </span>
            </div>
            <button onClick={corrigerPosition} disabled={busy || gpsEnCours}
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition disabled:opacity-50 ${
                geo ? "border border-amber-500/40 text-amber-700 bg-amber-500/10 hover:bg-amber-500/20" : "bg-amber-500 text-white hover:bg-amber-400"}`}>
              {busy || gpsEnCours ? <Loader2 size={15} className="animate-spin" /> : <Crosshair size={15} />}
              {position ? (geo ? "Corriger la position → ma position GPS" : "Enregistrer ma position comme position du client") : "Obtenir ma position GPS"}
            </button>
            <p className="text-[10px] text-[var(--text-secondary)] mt-1.5 leading-snug">
              À faire devant la boutique, signal GPS précis (≤ {PRECISION_MAX_M} m). Seule la position est modifiée ; l&apos;adresse et les autres informations restent inchangées.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
