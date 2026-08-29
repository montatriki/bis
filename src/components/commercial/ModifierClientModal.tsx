"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, Crosshair, Check, AlertTriangle, MapPin } from "lucide-react";
import { coordValide } from "@/lib/geo";
import { usePositionGps } from "@/lib/client-actif";

// Modification d'un client depuis le terrain — l'écran « Modifier un client »
// de l'ancien mobile : identité, matricule (code TVA / clé / catégorie),
// famille, adresse, téléphone, coordonnées GPS, gouvernorat, ville.
//
// « Utiliser ma position » reprend la position GPS actuelle du commercial et
// en déduit l'adresse, la ville et le gouvernorat (même source que la création).
// Corriger la longitude/latitude à la main déclenche la même déduction.

export type ClientModifiable = {
  id: number; raisonSocial: string; adresse: string | null; tel: string | null; email: string | null;
  ville: string | null; gouvernorat: string | null; famille: string | null; matriculeF: string | null;
  latitude: number | null; longitude: number | null;
  codeTva?: string | null; cletva?: string | null; categorieTva?: string | null; registreCom?: string | null;
};

type Form = {
  raisonSocial: string; codeTva: string; cletva: string; categorieTva: string; registreCom: string;
  famille: string; adresse: string; tel: string; email: string; longitude: string; latitude: string;
  gouvernorat: string; ville: string;
};

function depuisClient(c: ClientModifiable): Form {
  return {
    raisonSocial: c.raisonSocial ?? "", codeTva: c.codeTva ?? "", cletva: c.cletva ?? "", categorieTva: c.categorieTva ?? "",
    registreCom: c.registreCom ?? "", famille: c.famille ?? "", adresse: c.adresse ?? "", tel: c.tel ?? "", email: c.email ?? "",
    longitude: c.longitude != null && !(c.latitude === 0 && c.longitude === 0) ? String(c.longitude) : "",
    latitude: c.latitude != null && !(c.latitude === 0 && c.longitude === 0) ? String(c.latitude) : "",
    gouvernorat: c.gouvernorat ?? "", ville: c.ville ?? "",
  };
}

export default function ModifierClientModal({
  client, familles, gouvernorats, onFermer, onModifie,
}: {
  client: ClientModifiable | null;
  familles: string[];
  gouvernorats: string[];
  onFermer: () => void;
  onModifie: (c: ClientModifiable) => void;
}) {
  const [form, setForm] = useState<Form | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  // Position : celle du fournisseur commun à l'application (même précision,
  // même remontée au serveur). On ne retient qu'un fix obtenu APRÈS le clic.
  const { position, gpsEnCours, erreurGps, rafraichirPosition } = usePositionGps();
  const [demandeA, setDemandeA] = useState<number | null>(null);
  const [adresseAuto, setAdresseAuto] = useState<"aucune" | "en cours" | "ok" | "echec">("aucune");
  // Coordonnées pour lesquelles l'adresse doit être déduite (position GPS ou
  // saisie manuelle validée). Nulles tant que l'utilisateur n'a rien changé :
  // ouvrir la fiche ne réécrit pas l'adresse existante.
  const [aDeduire, setADeduire] = useState<{ lat: number; lng: number } | null>(null);

  /** Graphie déjà présente en base pour ce gouvernorat (« TUNIS » vs « Tunis »), pour que le filtre de la liste le retrouve. */
  const graphieGouvernorat = (v: string) => gouvernorats.find((g) => g.toLowerCase() === v.trim().toLowerCase()) ?? v;

  // Chaque ouverture repart des valeurs du client (via la chaîne asynchrone :
  // pas de setState synchrone dans l'effet).
  useEffect(() => {
    let annule = false;
    Promise.resolve().then(() => {
      if (annule) return;
      setForm(client ? { ...depuisClient(client), gouvernorat: graphieGouvernorat(client.gouvernorat ?? "") } : null);
      setErreur(null); setDemandeA(null); setAdresseAuto("aucune"); setADeduire(null);
    });
    return () => { annule = true; };
  }, [client]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!aDeduire) return;
    let annule = false;
    Promise.resolve().then(() => { if (!annule) setAdresseAuto("en cours"); });
    fetch(`/api/geo/adresse?lat=${aDeduire.lat}&lng=${aDeduire.lng}`)
      .then(async (r) => ({ ok: r.ok, d: await r.json() }))
      .then(({ ok, d }) => {
        if (annule) return;
        if (!ok || !d.adresse) { setAdresseAuto("echec"); return; }
        setForm((f) => f && ({ ...f, adresse: d.adresse, ville: d.ville || f.ville, gouvernorat: d.gouvernorat ? graphieGouvernorat(d.gouvernorat) : f.gouvernorat }));
        setAdresseAuto("ok");
      })
      .catch(() => { if (!annule) setAdresseAuto("echec"); });
    return () => { annule = true; };
  }, [aDeduire]); // eslint-disable-line react-hooks/exhaustive-deps

  const maj = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => f && ({ ...f, [k]: e.target.value }));

  /** Coordonnées saisies à la main : dès qu'elles sont valides, on en déduit l'adresse. */
  const validerCoordsManuelles = () => {
    if (!form) return;
    const lat = Number(form.latitude), lng = Number(form.longitude);
    if (coordValide(lat, lng)) setADeduire({ lat, lng });
  };

  const utiliserMaPosition = () => {
    setDemandeA(Date.now());
    rafraichirPosition();
  };

  // Le fix demandé est arrivé : coordonnées + adresse déduite.
  useEffect(() => {
    if (demandeA == null || !position || position.horodatage < demandeA - 2000) return;
    if (!coordValide(position.lat, position.lng)) return;
    const { lat, lng } = position;
    Promise.resolve().then(() => {
      setForm((f) => f && ({ ...f, latitude: String(lat), longitude: String(lng) }));
      setADeduire({ lat, lng });
      setDemandeA(null);
    });
  }, [position, demandeA]);
  const gpsAttente = demandeA != null && gpsEnCours;

  async function enregistrer() {
    if (!form || !client) return;
    if (!form.raisonSocial.trim()) { setErreur("La raison sociale est obligatoire"); return; }
    const aLat = form.latitude.trim() !== "", aLng = form.longitude.trim() !== "";
    if (aLat !== aLng) { setErreur("Renseignez la latitude ET la longitude, ou aucune des deux"); return; }
    if (aLat && !coordValide(Number(form.latitude), Number(form.longitude))) { setErreur("Coordonnées GPS invalides"); return; }
    setEnCours(true); setErreur(null);
    try {
      const r = await fetch("/api/clients", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: client.id, ...form,
          latitude: aLat ? Number(form.latitude) : null,
          longitude: aLng ? Number(form.longitude) : null,
        }),
      });
      const d = await r.json();
      if (!r.ok) { setErreur(d.error ?? "Échec de la modification"); return; }
      onModifie(d.client);
    } catch {
      setErreur("Réseau indisponible — réessayez");
    } finally {
      setEnCours(false);
    }
  }

  const familleOptions = form && form.famille && !familles.includes(form.famille) ? [form.famille, ...familles] : familles;
  const govOptions = form && form.gouvernorat && !gouvernorats.some((g) => g.toLowerCase() === form.gouvernorat.toLowerCase())
    ? [form.gouvernorat, ...gouvernorats] : gouvernorats;

  return (
    <AnimatePresence>
      {client && form && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onFermer}>
          <motion.div className="bg-[var(--bg-card)] rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>

            <div className="bg-blue-700 text-white p-5 flex items-center justify-between">
              <div>
                <div className="font-bold text-lg">Modifier un client</div>
                <div className="text-blue-200 text-xs mt-0.5">Code {client.id}</div>
              </div>
              <button onClick={onFermer} className="p-2 hover:bg-white/10 rounded-xl transition"><X size={18} /></button>
            </div>

            <div className="p-5 overflow-auto flex-1 space-y-3">
              <Champ label="Raison sociale *" value={form.raisonSocial} onChange={maj("raisonSocial")} autoFocus />
              <div className="grid grid-cols-3 gap-2">
                <Champ label="Code TVA" value={form.codeTva} onChange={maj("codeTva")} placeholder="1428436/F" />
                <Champ label="Clé" value={form.cletva} onChange={maj("cletva")} placeholder="A" />
                <Champ label="Catégorie" value={form.categorieTva} onChange={maj("categorieTva")} placeholder="M" />
              </div>
              <Champ label="Registre de commerce" value={form.registreCom} onChange={maj("registreCom")} />
              <label className="block">
                <span className="text-xs font-semibold text-[var(--text-secondary)]">Famille client</span>
                <select value={form.famille} onChange={maj("famille")} className={classeChamp}>
                  <option value="">—</option>
                  {familleOptions.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </label>
              <Champ label="Adresse" value={form.adresse} onChange={maj("adresse")} />
              {adresseAuto !== "aucune" && (
                <div className={`-mt-1.5 text-[11px] flex items-center gap-1.5 ${adresseAuto === "echec" ? "text-amber-600" : "text-[var(--text-secondary)]"}`}>
                  {adresseAuto === "en cours" && <><Loader2 size={11} className="animate-spin" /> Recherche de l&apos;adresse à partir de la position…</>}
                  {adresseAuto === "ok" && <><Check size={11} className="text-emerald-600" /> Adresse, ville et gouvernorat déduits de la position — modifiables.</>}
                  {adresseAuto === "echec" && <><AlertTriangle size={11} /> Adresse introuvable pour cette position — saisissez-la à la main.</>}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <Champ label="Téléphone" value={form.tel} onChange={maj("tel")} type="tel" />
                <Champ label="E-mail" value={form.email} onChange={maj("email")} type="email" />
              </div>

              {/* Position */}
              <div className="rounded-xl border border-[var(--border-primary)] p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[var(--text-secondary)] flex items-center gap-1.5"><MapPin size={12} /> Position du point de vente</span>
                  <button onClick={utiliserMaPosition} disabled={gpsAttente}
                    className="text-[11px] font-bold border border-[var(--border-primary)] px-2.5 py-1.5 rounded-lg hover:bg-[var(--bg-primary)] transition flex items-center gap-1 disabled:opacity-50">
                    {gpsAttente ? <Loader2 size={11} className="animate-spin" /> : <Crosshair size={11} />} Utiliser ma position
                  </button>
                </div>
                {demandeA != null && !gpsEnCours && erreurGps && <div className="text-[11px] text-amber-600">{erreurGps}</div>}
                <div className="grid grid-cols-2 gap-2">
                  <Champ label="Longitude" value={form.longitude} onChange={maj("longitude")} onBlur={validerCoordsManuelles} placeholder="10.18" />
                  <Champ label="Latitude" value={form.latitude} onChange={maj("latitude")} onBlur={validerCoordsManuelles} placeholder="36.88" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-semibold text-[var(--text-secondary)]">Gouvernorat</span>
                  <select value={form.gouvernorat} onChange={maj("gouvernorat")} className={classeChamp}>
                    <option value="">—</option>
                    {govOptions.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </label>
                <Champ label="Ville" value={form.ville} onChange={maj("ville")} />
              </div>

              {erreur && (
                <div className="flex items-center gap-2 text-xs text-red-600 bg-red-500/10 border border-red-500/25 rounded-xl px-3 py-2.5">
                  <AlertTriangle size={14} className="shrink-0" /> {erreur}
                </div>
              )}
            </div>

            <div className="flex gap-3 p-5 border-t border-[var(--border-primary)]">
              <button onClick={onFermer}
                className="flex-1 border border-[var(--border-primary)] text-[var(--text-secondary)] py-2.5 rounded-xl font-medium hover:bg-[var(--bg-primary)] transition text-sm">
                Annuler
              </button>
              <button onClick={enregistrer} disabled={enCours || !form.raisonSocial.trim()}
                className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl font-medium hover:bg-blue-500 transition text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                {enCours && <Loader2 className="animate-spin" size={15} />}
                Modifier
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

const classeChamp = "mt-1 w-full px-3 py-2 text-sm bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl focus:outline-none focus:border-blue-500 text-[var(--text-primary)]";

function Champ({
  label, value, onChange, onBlur, placeholder, type = "text", autoFocus,
}: {
  label: string; value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: () => void;
  placeholder?: string; type?: string; autoFocus?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-[var(--text-secondary)]">{label}</span>
      <input value={value} onChange={onChange} onBlur={onBlur} placeholder={placeholder} type={type} autoFocus={autoFocus} className={classeChamp} />
    </label>
  );
}
