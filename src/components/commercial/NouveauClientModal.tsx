"use client";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Camera, MapPin, Loader2, Check, Crosshair, RefreshCw, AlertTriangle } from "lucide-react";
import { usePositionGps } from "@/lib/client-actif";
import { coordValide } from "@/lib/geo";
import { compresserImage } from "@/lib/image";

// Création d'un point de vente depuis le terrain.
//
// Le commercial est devant la boutique : on capture sa position GPS (qui devient
// celle du client) et une photo de la devanture. Les visites suivantes pourront
// alors reconnaître le point de vente automatiquement.

export type ClientCree = {
  id: number; raisonSocial: string; ville: string | null;
  adresse: string | null; tel: string | null;
  latitude: number | null; longitude: number | null;
};


export default function NouveauClientModal({
  ouvert, onFermer, onCree,
}: {
  ouvert: boolean;
  onFermer: () => void;
  onCree: (c: ClientCree) => void;
}) {
  const { position, gpsEnCours, erreurGps, rafraichirPosition } = usePositionGps();
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    raisonSocial: "", adresse: "", ville: "", gouvernorat: "",
    tel: "", email: "", matriculeF: "", famille: "",
  });
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoErreur, setPhotoErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  // Client déjà enregistré à quelques mètres : le commercial est sur place et
  // tranche lui-même (même commerce, ou le voisin) plutôt que d'être bloqué.
  const [clientProche, setClientProche] = useState<{ id: number; raisonSocial: string; distance: number } | null>(null);
  const messagesRef = useRef<HTMLDivElement>(null);

  // Un message apparu en tête reste invisible si le formulaire est défilé :
  // on le ramène à l'écran, sinon le commercial croit que rien ne s'est passé.
  useEffect(() => {
    if (erreur || clientProche) messagesRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [erreur, clientProche]);
  // Adresse déduite de la position : "en cours" pendant l'appel, "ok" quand
  // les champs ont été remplis, "echec" si le service n'a pas répondu.
  const [adresseAuto, setAdresseAuto] = useState<"aucune" | "en cours" | "ok" | "echec">("aucune");

  // Chaque ouverture repart d'un formulaire vierge et d'une position fraîche.
  // La remise à zéro passe par la chaîne asynchrone : un `setState` synchrone
  // dans l'effet déclencherait un rendu en cascade.
  useEffect(() => {
    if (!ouvert) return;
    let annule = false;
    Promise.resolve().then(() => {
      if (annule) return;
      setForm({ raisonSocial: "", adresse: "", ville: "", gouvernorat: "", tel: "", email: "", matriculeF: "", famille: "" });
      setPhoto(null);
      setPhotoErreur(null);
      setErreur(null);
      setClientProche(null);
      if (!position) rafraichirPosition();
    });
    return () => { annule = true; };
  }, [ouvert]); // eslint-disable-line react-hooks/exhaustive-deps

  const maj = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  // À chaque nouvelle position (ouverture, clic sur « Actualiser »), l'adresse,
  // la ville et le gouvernorat sont déduits des coordonnées — comme sur
  // l'ancien mobile. Le commercial n'a plus qu'à saisir le nom et le téléphone.
  const lat = position?.lat, lng = position?.lng;
  useEffect(() => {
    if (!ouvert || !coordValide(lat, lng)) return;
    let annule = false;
    Promise.resolve().then(() => { if (!annule) setAdresseAuto("en cours"); });
    fetch(`/api/geo/adresse?lat=${lat}&lng=${lng}`)
      .then(async (r) => ({ ok: r.ok, d: await r.json() }))
      .then(({ ok, d }) => {
        if (annule) return;
        if (!ok || !d.adresse) { setAdresseAuto("echec"); return; }
        setForm((f) => ({ ...f, adresse: d.adresse, ville: d.ville || f.ville, gouvernorat: d.gouvernorat || f.gouvernorat }));
        setAdresseAuto("ok");
      })
      .catch(() => { if (!annule) setAdresseAuto("echec"); });
    return () => { annule = true; };
  }, [ouvert, lat, lng]);

  async function choisirPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoErreur(null);
    try {
      setPhoto(await compresserImage(file));
    } catch {
      setPhotoErreur("Image illisible — réessayez");
    } finally {
      // Permet de resélectionner le même fichier après une erreur.
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function enregistrer(forcer = false) {
    // Un point de vente créé sur le terrain doit être identifiable et
    // non dupliqué : les quatre champs ci-dessous sont donc exigés.
    if (!form.raisonSocial.trim()) { setErreur("La raison sociale est obligatoire"); return; }
    if (!form.tel.trim()) { setErreur("Le numéro de téléphone est obligatoire"); return; }
    if (!form.matriculeF.trim()) { setErreur("Le matricule fiscal est obligatoire"); return; }
    if (!photo) { setErreur("La photo du point de vente est obligatoire"); return; }
    if (!position) { setErreur("Position GPS absente — activez la localisation puis réessayez"); return; }
    setEnCours(true);
    setErreur(null);
    if (!forcer) setClientProche(null);
    try {
      const r = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          latitude: position?.lat ?? null,
          longitude: position?.lng ?? null,
          photo,
          ...(forcer ? { forcer: true } : {}),
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        // Voisin immédiat : on propose de confirmer plutôt que de refuser.
        if (d.code === "client-proche" && d.client) { setClientProche(d.client); setErreur(null); return; }
        setErreur(d.error ?? "Échec de la création");
        return;
      }
      onCree(d.client);
    } catch {
      setErreur("Réseau indisponible — réessayez");
    } finally {
      setEnCours(false);
    }
  }

  const aPosition = coordValide(position?.lat, position?.lng);

  return (
    <AnimatePresence>
      {ouvert && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onFermer}>
          <motion.div className="bg-[var(--bg-card)] rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>

            <div className="bg-emerald-700 text-white p-5 flex items-center justify-between">
              <div>
                <div className="font-bold text-lg">Nouveau point de vente</div>
                <div className="text-emerald-200 text-xs mt-0.5">
                  Position et photo capturées sur place
                </div>
              </div>
              <button onClick={onFermer} className="p-2 hover:bg-white/10 rounded-xl transition"><X size={18} /></button>
            </div>

            <div className="p-5 overflow-auto flex-1 space-y-4">
              {/* Messages en tête : sur mobile, une erreur affichée en bas du
                  formulaire défilant restait invisible — le commercial appuyait
                  sur « Créer » sans rien voir se passer. */}
              <div ref={messagesRef} />
              {erreur && (
                <div className="flex items-start gap-2 text-xs text-red-600 bg-red-500/10 border border-red-500/25 rounded-xl px-3 py-2.5">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" /> <span>{erreur}</span>
                </div>
              )}
              {clientProche && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 space-y-2">
                  <div className="flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300">
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                    <span>
                      <b>{clientProche.raisonSocial}</b> est déjà enregistré à {clientProche.distance} m
                      (code {clientProche.id}). S&apos;il s&apos;agit du même commerce, annulez et sélectionnez-le ;
                      sinon confirmez la création.
                    </span>
                  </div>
                  <button onClick={() => enregistrer(true)} disabled={enCours}
                    className="w-full flex items-center justify-center gap-2 text-xs font-bold bg-amber-500 text-white py-2 rounded-lg hover:bg-amber-400 transition disabled:opacity-50">
                    {enCours && <Loader2 className="animate-spin" size={13} />}
                    C&apos;est un autre commerce — créer quand même
                  </button>
                </div>
              )}

              {/* Position GPS */}
              <div className={`rounded-xl border p-3 ${aPosition ? "bg-emerald-500/10 border-emerald-500/30" : "bg-amber-500/10 border-amber-500/30"}`}>
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${aPosition ? "bg-emerald-500/20 text-emerald-600" : "bg-amber-500/20 text-amber-600"}`}>
                    {gpsEnCours ? <Loader2 size={15} className="animate-spin" /> : aPosition ? <Check size={15} /> : <MapPin size={15} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-[var(--text-primary)]">
                      {gpsEnCours ? "Acquisition de la position…" : aPosition ? "Position enregistrée" : "Position indisponible"}
                    </div>
                    <div className="text-[11px] text-[var(--text-secondary)] truncate">
                      {aPosition
                        ? `${position!.lat.toFixed(6)}, ${position!.lng.toFixed(6)} · ±${Math.round(position!.precision)} m`
                        : erreurGps ?? "Le client sera créé sans coordonnées GPS"}
                    </div>
                  </div>
                  <button onClick={rafraichirPosition} disabled={gpsEnCours}
                    className="text-[11px] font-bold border border-[var(--border-primary)] px-2.5 py-1.5 rounded-lg hover:bg-[var(--bg-primary)] transition flex items-center gap-1 shrink-0 disabled:opacity-50">
                    <Crosshair size={11} /> Actualiser
                  </button>
                </div>
              </div>

              {/* Photo de la devanture */}
              <div>
                <div className="text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                  Photo du point de vente *
                </div>
                {photo ? (
                  <div className="relative rounded-xl overflow-hidden border border-[var(--border-primary)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo} alt="Devanture du point de vente" className="w-full h-44 object-cover" />
                    <button onClick={() => { setPhoto(null); fileRef.current?.click(); }}
                      className="absolute bottom-2 right-2 bg-black/60 text-white text-[11px] font-bold px-2.5 py-1.5 rounded-lg backdrop-blur flex items-center gap-1 hover:bg-black/75 transition">
                      <RefreshCw size={11} /> Reprendre
                    </button>
                  </div>
                ) : (
                  <button onClick={() => fileRef.current?.click()}
                    className="w-full border-2 border-dashed border-[var(--border-primary)] rounded-xl py-7 flex flex-col items-center gap-2 text-[var(--text-secondary)] hover:border-emerald-500/50 hover:text-emerald-600 transition">
                    <Camera size={22} />
                    <span className="text-xs font-semibold">Prendre une photo de la devanture</span>
                    <span className="text-[10px] opacity-70">Obligatoire — aide à retrouver le point de vente</span>
                  </button>
                )}
                {/* `capture` ouvre l'appareil photo arrière sur mobile. */}
                <input ref={fileRef} type="file" accept="image/*" capture="environment"
                  onChange={choisirPhoto} className="hidden" />
                {photoErreur && <div className="text-[11px] text-red-600 mt-1.5">{photoErreur}</div>}
              </div>

              {/* Identité du client */}
              <div className="space-y-3">
                <Champ label="Raison sociale *" value={form.raisonSocial} onChange={maj("raisonSocial")}
                  placeholder="Nom du commerce" autoFocus />
                <div className="grid grid-cols-2 gap-3">
                  <Champ label="Téléphone *" value={form.tel} onChange={maj("tel")} placeholder="98 123 456" type="tel" />
                  <Champ label="Ville" value={form.ville} onChange={maj("ville")} placeholder="Sousse" />
                </div>
                <Champ label="Adresse" value={form.adresse} onChange={maj("adresse")} placeholder="Rue, quartier" />
                {adresseAuto !== "aucune" && (
                  <div className={`-mt-1.5 text-[11px] flex items-center gap-1.5 ${adresseAuto === "echec" ? "text-amber-600" : "text-[var(--text-secondary)]"}`}>
                    {adresseAuto === "en cours" && <><Loader2 size={11} className="animate-spin" /> Recherche de l&apos;adresse à partir de la position…</>}
                    {adresseAuto === "ok" && <><Check size={11} className="text-emerald-600" /> Adresse, ville et gouvernorat déduits de la position — modifiables.</>}
                    {adresseAuto === "echec" && <><AlertTriangle size={11} /> Adresse introuvable pour cette position — saisissez-la à la main.</>}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <Champ label="Gouvernorat" value={form.gouvernorat} onChange={maj("gouvernorat")} placeholder="Sousse" />
                  <Champ label="Matricule fiscal *" value={form.matriculeF} onChange={maj("matriculeF")} placeholder="1234567/A/M/000" />
                </div>
              </div>

            </div>

            <div className="flex gap-3 p-5 border-t border-[var(--border-primary)]">
              <button onClick={onFermer}
                className="flex-1 border border-[var(--border-primary)] text-[var(--text-secondary)] py-2.5 rounded-xl font-medium hover:bg-[var(--bg-primary)] transition text-sm">
                Annuler
              </button>
              <button onClick={() => enregistrer()} disabled={enCours || !form.raisonSocial.trim()}
                className="flex-1 bg-emerald-600 text-white py-2.5 rounded-xl font-medium hover:bg-emerald-500 transition text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                {enCours && <Loader2 className="animate-spin" size={15} />}
                Créer et démarrer la visite
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function Champ({
  label, value, onChange, placeholder, type = "text", autoFocus,
}: {
  label: string; value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string; type?: string; autoFocus?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-[var(--text-secondary)]">{label}</span>
      <input value={value} onChange={onChange} placeholder={placeholder} type={type} autoFocus={autoFocus}
        className="mt-1 w-full px-3 py-2 text-sm bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl focus:outline-none focus:border-emerald-500 text-[var(--text-primary)]" />
    </label>
  );
}
