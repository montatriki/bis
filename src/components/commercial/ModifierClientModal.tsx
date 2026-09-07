"use client";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, Crosshair, Check, AlertTriangle, MapPin, Camera, RefreshCw, Trash2, ImageOff } from "lucide-react";
import { coordValide } from "@/lib/geo";
import { usePositionGps } from "@/lib/client-actif";
import { compresserImage } from "@/lib/image";

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
  /** 4e segment du matricule fiscal : n° d'établissement. */
  etabTva?: string | null;
  /** Devanture du point de vente (data URL). Chargée à l'ouverture du modal. */
  photo?: string | null;
};

type Form = {
  raisonSocial: string; codeTva: string; cletva: string; categorieTva: string; etabTva: string; registreCom: string;
  famille: string; adresse: string; tel: string; email: string; longitude: string; latitude: string;
  gouvernorat: string; ville: string;
};

function depuisClient(c: ClientModifiable): Form {
  return {
    raisonSocial: c.raisonSocial ?? "", codeTva: c.codeTva ?? "", cletva: c.cletva ?? "", categorieTva: c.categorieTva ?? "",
    etabTva: c.etabTva ?? "",
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
  // Devanture : `undefined` tant qu'on ne l'a pas chargée, `null` si le client
  // n'en a pas. Elle n'est pas dans la liste (200 images base64 alourdiraient
  // la page) : on la lit à l'ouverture.
  const [photo, setPhoto] = useState<string | null | undefined>(undefined);
  const [photoErreur, setPhotoErreur] = useState<string | null>(null);
  const [photoModifiee, setPhotoModifiee] = useState(false);
  const fichierRef = useRef<HTMLInputElement>(null);

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
      setPhoto(client?.photo !== undefined ? client.photo : undefined);
      setPhotoErreur(null); setPhotoModifiee(false);
    });
    return () => { annule = true; };
  }, [client]); // eslint-disable-line react-hooks/exhaustive-deps

  // La photo n'accompagne pas la liste : on la lit à l'ouverture, seulement si
  // l'appelant ne l'a pas déjà fournie.
  useEffect(() => {
    if (!client || client.photo !== undefined) return;
    let annule = false;
    fetch(`/api/clients?codeCli=${client.id}`)
      .then((r) => r.json())
      .then((d) => { if (!annule) setPhoto(d.client?.photo ?? null); })
      .catch(() => { if (!annule) setPhoto(null); });
    return () => { annule = true; };
  }, [client]);

  /** Photo prise ou choisie : compressée avant d'entrer dans le formulaire. */
  async function choisirPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoErreur(null);
    try {
      setPhoto(await compresserImage(file));
      setPhotoModifiee(true);
    } catch {
      setPhotoErreur("Image illisible — réessayez");
    } finally {
      // Permet de resélectionner le même fichier après une erreur.
      if (fichierRef.current) fichierRef.current.value = "";
    }
  }

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
          ...(photoModifiee ? { photo } : {}),
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={onFermer}>
          {/* Feuille glissante sur mobile (le pouce atteint les actions),
              carte centrée sur bureau. `h-[100dvh]` et non `vh` : la barre
              d'adresse mobile rognait l'en-tête. */}
          <motion.div
            className="bg-[var(--bg-card)] shadow-2xl w-full sm:max-w-lg
                       max-h-[92dvh] sm:max-h-[90vh] rounded-t-3xl sm:rounded-2xl
                       flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, y: 32, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 32, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}>

            {/* Bannière : le commercial voit d'abord CHEZ QUI il est. La photo
                de la devanture en devient le fond — c'est le repère du point
                de vente, pas une pièce jointe reléguée dans le formulaire. */}
            <div className={`relative shrink-0 overflow-hidden transition-[min-height] duration-300 ${photo ? "min-h-[168px] sm:min-h-[184px]" : ""}`}>
              {photo ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo} alt="Devanture du point de vente" className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/25" />
                </>
              ) : (
                <div className="absolute inset-0"
                  style={{ background: "linear-gradient(135deg, var(--accent-primary), color-mix(in srgb, var(--accent-primary) 70%, #000))" }} />
              )}

              {/* Poignée posée SUR la bannière : au-dessus, sur fond blanc,
                  elle coupait l'image d'une bande claire. */}
              <div className="sm:hidden absolute inset-x-0 top-2 flex justify-center z-10">
                <span className="h-1 w-10 rounded-full bg-white/45" />
              </div>

              <div className={`relative px-5 pb-3.5 flex items-start justify-between gap-3 ${photo ? "pt-14 sm:pt-16" : "pt-5 sm:pt-4"}`}>
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/70">
                    Modifier un client
                  </div>
                  <div className="text-white font-black text-[17px] leading-tight truncate mt-1"
                    title={client.raisonSocial}>
                    {client.raisonSocial}
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 text-[11px] text-white/75">
                    <span className="font-mono">#{client.id}</span>
                    {(client.ville || client.gouvernorat) && (
                      <span className="flex items-center gap-1 truncate">
                        <MapPin size={10} className="shrink-0" />
                        {[client.ville, client.gouvernorat].filter(Boolean).join(" — ")}
                      </span>
                    )}
                  </div>
                </div>
                <button onClick={onFermer} aria-label="Fermer"
                  className="p-2 -mr-1 -mt-0.5 rounded-xl text-white/85 hover:bg-white/15 hover:text-white transition shrink-0">
                  <X size={18} />
                </button>
              </div>

              {/* Actions photo, posées sur la bannière. */}
              <div className="relative px-5 pb-4 flex flex-wrap items-center gap-2">
                <button onClick={() => fichierRef.current?.click()}
                  className="flex items-center gap-1.5 text-[11px] font-bold px-3 h-8 rounded-xl
                             bg-white/15 text-white backdrop-blur-sm border border-white/25 hover:bg-white/25 transition">
                  {photo ? <><RefreshCw size={12} /> Remplacer la photo</> : <><Camera size={12} /> Prendre la photo</>}
                </button>
                {photo && (
                  <button onClick={() => { setPhoto(null); setPhotoModifiee(true); }}
                    aria-label="Supprimer la photo"
                    className="flex items-center justify-center w-8 h-8 rounded-xl bg-white/15 text-white backdrop-blur-sm
                               border border-white/25 hover:bg-red-500/70 transition">
                    <Trash2 size={13} />
                  </button>
                )}
                {photo === undefined && <Loader2 size={14} className="animate-spin text-white/70" />}
                {photo === null && (
                  <span className="text-[11px] text-white/70 flex items-center gap-1">
                    <ImageOff size={11} /> Aucune photo enregistrée
                  </span>
                )}
                {photoModifiee && photo && (
                  <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-lg bg-white text-[var(--accent-primary)]">
                    Nouvelle photo
                  </span>
                )}
              </div>

              {photoErreur && (
                <div className="relative px-5 pb-3 text-[11px] text-white font-semibold">{photoErreur}</div>
              )}
            </div>

            <div className="px-5 py-4 overflow-y-auto flex-1 min-h-0 space-y-4">
              {/* `capture` ouvre l'appareil photo arrière sur mobile ; sur
                  ordinateur, le sélecteur de fichiers habituel. Déclenché
                  depuis la bannière. */}
              <input ref={fichierRef} type="file" accept="image/*" capture="environment"
                onChange={choisirPhoto} className="hidden" />

              <Section titre="Identité">
                <Champ label="Raison sociale" obligatoire value={form.raisonSocial} onChange={maj("raisonSocial")} autoFocus />
                {/* 3 colonnes serrées devenaient illisibles sur mobile : le
                    code TVA y prend toute la largeur, clé et catégorie se
                    partagent la ligne suivante. */}
                {/* Matricule fiscal en quatre segments, comme la saisie de
                    l'ERP d'origine et le formulaire de création. */}
                <div>
                  <span className={classeLabel}>Matricule fiscal</span>
                  <div className="mt-1.5 grid grid-cols-6 gap-1.5 sm:gap-2">
                    <input value={form.codeTva} onChange={maj("codeTva")}
                      placeholder="1234567" aria-label="Code TVA"
                      className={`${classeChampSegment} col-span-3`} />
                    <input value={form.cletva} onChange={maj("cletva")}
                      placeholder="Clé" aria-label="Clé" maxLength={1}
                      className={`${classeChampSegment} text-center uppercase`} />
                    <input value={form.categorieTva} onChange={maj("categorieTva")}
                      placeholder="Cat" aria-label="Catégorie" maxLength={1}
                      className={`${classeChampSegment} text-center uppercase`} />
                    <input value={form.etabTva} onChange={maj("etabTva")}
                      placeholder="000" aria-label="Établissement" maxLength={3}
                      className={`${classeChampSegment} text-center`} />
                  </div>
                  <div className="mt-1 text-[10px] text-[var(--text-secondary)] opacity-75">
                    Code · Clé · Catégorie · Établissement
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <Champ label="Registre de commerce" value={form.registreCom} onChange={maj("registreCom")} />
                  <label className="block">
                    <span className={classeLabel}>Famille client</span>
                    <select value={form.famille} onChange={maj("famille")} className={classeChamp}>
                      <option value="">—</option>
                      {familleOptions.map((f) => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </label>
                </div>
              </Section>

              <Section titre="Coordonnées">
              <Champ label="Adresse" value={form.adresse} onChange={maj("adresse")} />
              {adresseAuto !== "aucune" && (
                <div className={`-mt-1.5 text-[11px] flex items-center gap-1.5 ${adresseAuto === "echec" ? "text-amber-600" : "text-[var(--text-secondary)]"}`}>
                  {adresseAuto === "en cours" && <><Loader2 size={11} className="animate-spin" /> Recherche de l&apos;adresse à partir de la position…</>}
                  {adresseAuto === "ok" && <><Check size={11} className="text-emerald-600" /> Adresse, ville et gouvernorat déduits de la position — modifiables.</>}
                  {adresseAuto === "echec" && <><AlertTriangle size={11} /> Adresse introuvable pour cette position — saisissez-la à la main.</>}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <Champ label="Téléphone" value={form.tel} onChange={maj("tel")} type="tel" placeholder="20 123 456" />
                <Champ label="E-mail" value={form.email} onChange={maj("email")} type="email" placeholder="contact@exemple.tn" />
              </div>
              </Section>

              {/* Position */}
              <Section titre="Emplacement">
                {/* Bloc distingué : sur le terrain, « Utiliser ma position »
                    est l'action la plus fréquente de ce formulaire. */}
                <div className="rounded-2xl border border-[var(--accent-primary)]/20 bg-[var(--accent-light)] p-3.5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                      <MapPin size={13} className="text-[var(--accent-primary)]" /> Position du point de vente
                    </span>
                    <button onClick={utiliserMaPosition} disabled={gpsAttente}
                      className="text-[11px] font-bold px-3 h-9 rounded-xl text-white transition flex items-center gap-1.5 disabled:opacity-50
                                 shadow-[0_8px_18px_-12px_var(--shadow-hover)]"
                      style={{ background: "linear-gradient(135deg, var(--accent-primary), color-mix(in srgb, var(--accent-primary) 78%, #000))" }}>
                      {gpsAttente ? <Loader2 size={12} className="animate-spin" /> : <Crosshair size={12} />} Utiliser ma position
                    </button>
                  </div>
                  {demandeA != null && !gpsEnCours && erreurGps && (
                    <div className="text-[11px] text-amber-700 flex items-center gap-1.5">
                      <AlertTriangle size={11} className="shrink-0" /> {erreurGps}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2.5">
                    <Champ label="Longitude" value={form.longitude} onChange={maj("longitude")} onBlur={validerCoordsManuelles} placeholder="10.18" />
                    <Champ label="Latitude" value={form.latitude} onChange={maj("latitude")} onBlur={validerCoordsManuelles} placeholder="36.88" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <label className="block">
                    <span className={classeLabel}>Gouvernorat</span>
                    <select value={form.gouvernorat} onChange={maj("gouvernorat")} className={classeChamp}>
                      <option value="">—</option>
                      {govOptions.map((g) => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </label>
                  <Champ label="Ville" value={form.ville} onChange={maj("ville")} />
                </div>

              </Section>

              {erreur && (
                <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" /> {erreur}
                </div>
              )}
            </div>

            {/* Barre d'actions : `pb-[max(...)]` réserve la zone du geste
                d'accueil iOS, sinon « Enregistrer » tombe dessous. Le dégradé
                au-dessus montre que le formulaire continue derrière — sans
                lui, le contenu se coupait net et rien n'invitait à défiler. */}
            <div className="relative flex gap-2.5 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-4
                            border-t border-[var(--border-primary)] bg-[var(--bg-card)] shrink-0">
              <div className="pointer-events-none absolute inset-x-0 -top-8 h-8 bg-gradient-to-t from-[var(--bg-card)] to-transparent" />
              <button onClick={onFermer}
                className="flex-1 h-11 rounded-xl font-bold text-sm border border-[var(--border-primary)]
                           text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)] transition">
                Annuler
              </button>
              <button onClick={enregistrer} disabled={enCours || !form.raisonSocial.trim()}
                className="flex-[1.4] h-11 rounded-xl font-bold text-sm text-white transition-all
                           disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2
                           shadow-[0_10px_24px_-14px_var(--shadow-hover)] hover:shadow-[0_14px_30px_-14px_var(--shadow-hover)]"
                style={{ background: "linear-gradient(135deg, var(--accent-primary), color-mix(in srgb, var(--accent-primary) 78%, #000))" }}>
                {enCours ? <Loader2 className="animate-spin" size={15} /> : <Check size={15} />}
                Enregistrer
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

const classeLabel =
  "block text-[11px] font-bold uppercase tracking-wide text-[var(--text-secondary)] opacity-75";

// `h-11` : 44 px, la cible tactile minimale — les champs de 36 px étaient
// difficiles à viser au pouce sur le terrain.
const classeChamp =
  "mt-1.5 w-full h-11 px-3.5 text-sm rounded-xl bg-[var(--bg-primary)] " +
  "border border-[var(--border-primary)] text-[var(--text-primary)] " +
  "placeholder:text-[var(--text-secondary)]/45 transition " +
  "hover:border-[var(--accent-primary)]/25 " +
  "focus:outline-none focus:bg-[var(--bg-card)] focus:border-[var(--accent-primary)]/55 " +
  "focus:ring-2 focus:ring-[var(--accent-primary)]/12";

/** Groupe de champs sous un intitulé : le formulaire se lit par blocs. */
function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--accent-primary)]">{titre}</span>
        <span className="flex-1 h-px bg-[var(--border-primary)]" />
      </div>
      {children}
    </section>
  );
}

function Champ({
  label, value, onChange, onBlur, placeholder, type = "text", autoFocus, obligatoire, className = "",
}: {
  label: string; value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: () => void;
  placeholder?: string; type?: string; autoFocus?: boolean;
  obligatoire?: boolean; className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className={classeLabel}>
        {label}{obligatoire && <span className="text-red-500 ml-0.5">*</span>}
      </span>
      <input value={value} onChange={onChange} onBlur={onBlur} placeholder={placeholder} type={type} autoFocus={autoFocus} className={classeChamp} />
    </label>
  );
}

/** Style des quatre segments du matricule fiscal. */
const classeChampSegment =
  "h-11 min-w-0 px-2 text-sm rounded-xl bg-[var(--bg-primary)] " +
  "border border-[var(--border-primary)] text-[var(--text-primary)] " +
  "placeholder:text-[var(--text-secondary)]/45 transition " +
  "focus:outline-none focus:bg-[var(--bg-card)] focus:border-[var(--accent-primary)]/55 " +
  "focus:ring-2 focus:ring-[var(--accent-primary)]/12";
