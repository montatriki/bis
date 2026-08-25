"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin, Loader2, Check, AlertTriangle, Navigation, Phone, X,
  Route, Clock, RefreshCw, ChevronRight, Play, ShoppingBag,
} from "lucide-react";
import { useClientActif } from "@/lib/client-actif";
import PointageVisite from "@/components/commercial/PointageVisite";
import { formatDistance, distanceM, SEUILS } from "@/lib/geo";
import type { EtapeGeo } from "@/components/map/TourneeMap";

// Tournée du jour — plan de travail géographique.
//
// Le commercial suit une ligne sur la carte : les clients sont ordonnés en
// trajet, il traite l'étape courante puis passe à la suivante. Sélectionner une
// étape la définit comme client actif : tout le reste de l'application (panier,
// catalogue, commande) travaille alors sur ce client-là.

const TourneeMap = dynamic(() => import("@/components/map/TourneeMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-slate-100 rounded-2xl animate-pulse flex items-center justify-center text-slate-400 text-sm">
      Chargement de la carte…
    </div>
  ),
});

type Etape = EtapeGeo & {
  adresse: string | null; tel: string | null;
  commentaire: string | null; distanceDepuisPrec: number;
};
type Stats = {
  total: number; visitees: number; restantes: number; reportees: number; absentes: number;
  progression: number; distanceTotale: number; distanceApproche: number;
};
type Tournee = {
  date: string; commercial: string;
  mission: { id: number; etat: string | null; vehicule: string | null } | null;
  etapes: Etape[]; courante: Etape | null; stats: Stats;
};

const fmt0 = (n: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n ?? 0);
const iso = (d: Date) => d.toISOString().slice(0, 10);

const ETAT_CFG: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  "Visité":    { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500" },
  "À visiter": { bg: "bg-blue-50",    text: "text-blue-700",    border: "border-blue-200",    dot: "bg-blue-500" },
  "Reporté":   { bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200",   dot: "bg-amber-500" },
  "Absent":    { bg: "bg-red-50",     text: "text-red-600",     border: "border-red-200",     dot: "bg-red-500" },
};

export default function PlanningPage() {
  const router = useRouter();
  const { client: clientActif, choisir, position } = useClientActif();

  const [date, setDate] = useState(iso(new Date()));
  const [tournee, setTournee] = useState<Tournee | null>(null);
  const [load, setLoad] = useState(true);
  const [gen, setGen] = useState(false);
  const [sel, setSel] = useState<Etape | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const flash = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4500);
  }, []);

  // Numéro de la dernière requête émise : le GPS met quelques secondes à
  // répondre, si bien qu'un premier appel part sans position et un second
  // avec. Sans ce garde-fou, la réponse la plus lente écrase la plus récente
  // et l'écran affichait « 116,7 km d'approche » (le trajet depuis le dépôt
  // de Sousse) alors que le commercial était à 360 m de sa première visite.
  const requete = useRef(0);

  /** Dernière position connue, lisible depuis un appel différé. */
  const positionRef = useRef<typeof position>(null);
  useEffect(() => { positionRef.current = position; }, [position]);

  const charger = useCallback(() => {
    const numero = ++requete.current;
    // La position du commercial sert à mesurer le vrai trajet d'approche :
    // sans elle, le serveur repart du dépôt et affiche un kilométrage qui ne
    // correspond pas à sa situation réelle.
    const qs = new URLSearchParams({ date });
    if (position) { qs.set("lat", String(position.lat)); qs.set("lng", String(position.lng)); }
    fetch(`/api/tournee?${qs}`)
      .then((r) => r.json())
      .then((d) => {
        if (numero !== requete.current) return;
        setTournee(d.error ? null : d);
      })
      .catch(() => { if (numero === requete.current) flash("Chargement impossible", false); })
      .finally(() => { if (numero === requete.current) setLoad(false); });
  }, [date, position, flash]);

  useEffect(() => { charger(); }, [charger]);

  /** Génère le plan du jour depuis la position courante, sinon depuis le dépôt. */
  async function genererTournee() {
    setGen(true);
    // La position est lue **au moment de l'appel** : la génération automatique
    // est différée d'un tour, et la closure figeait la valeur du rendu où le
    // GPS n'avait pas encore répondu — le plan repartait alors du dépôt et
    // envoyait le commercial à 186 km.
    const p = positionRef.current;
    const r = await fetch("/api/tournee", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date,
        taille: 12,
        depart: p ? { lat: p.lat, lng: p.lng } : undefined,
      }),
    }).then((x) => x.json()).catch(() => ({ error: "réseau" }));
    setGen(false);
    if (r.error) return flash(r.error, false);
    flash(r.message ?? "Tournée générée");
    charger();
  }

  // Génération automatique du plan du jour.
  //
  // Le commercial ne devait pas avoir à réclamer sa tournée : s'il ouvre
  // l'écran sans plan pour aujourd'hui, on le construit depuis sa position
  // réelle. On attend d'avoir le GPS — un plan bâti depuis le dépôt de Sousse
  // enverrait le commercial à l'opposé de là où il se trouve.
  const autoGen = useRef(false);
  useEffect(() => {
    if (load || gen || autoGen.current) return;
    if (!position) return;                       // sans position, on ne devine pas
    if (date !== new Date().toISOString().slice(0, 10)) return;  // seulement aujourd'hui
    if (tournee && (tournee.etapes?.length ?? 0) > 0) return;    // un plan existe déjà
    autoGen.current = true;
    // Différé d'un tour : la génération met à jour l'état, l'appeler dans le
    // corps de l'effet déclencherait un rendu en cascade.
    //
    // Le timeout n'est **pas** annulé au nettoyage : l'effet se relance à
    // chaque changement de `tournee` ou de `position`, et l'annuler faisait
    // sauter la génération tout en laissant le garde-fou armé — le commercial
    // ouvrait alors un planning vide qui ne se remplissait jamais.
    setTimeout(() => { genererTournee(); }, 0);
    // `genererTournee` est stable au sein d'un rendu ; la garde `autoGen`
    // empêche toute régénération en boucle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, gen, position, date, tournee]);

  /** Fait avancer une étape et rafraîchit le plan. */
  async function majEtape(e: Etape, etat: string) {
    const r = await fetch("/api/tournee", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ligneId: e.id, etat,
        lat: position?.lat, lng: position?.lng,
      }),
    }).then((x) => x.json()).catch(() => ({ error: "réseau" }));
    if (r.error) return flash(r.error, false);
    flash(r.message ?? "Mis à jour");
    setSel(null);
    charger();
  }

  /**
   * Démarre le travail sur une étape : le client devient le client actif de
   * l'application, si bien que le catalogue et le panier ne portent que sur lui.
   */
  function travailler(e: Etape, aller = false) {
    const d = position
      ? Math.round(distanceM(position.lat, position.lng, e.latitude, e.longitude))
      : null;
    choisir({
      id: e.codeCli, raisonSocial: e.nom, ville: e.ville, adresse: e.adresse,
      tel: e.tel, soldeFin: e.soldeFin, latitude: e.latitude, longitude: e.longitude,
      distance: d,
    }, d != null && d <= SEUILS.SUR_PLACE ? "gps" : "manuel");
    setSel(null);
    if (aller) router.push("/commercial/catalogue");
  }

  const etapes = tournee?.etapes ?? [];
  const st = tournee?.stats;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Tournée du jour</h1>
          <p className="text-[var(--text-secondary)] text-sm">
            {load ? "Chargement…"
              : etapes.length === 0 ? "Aucun plan de travail pour cette date"
              : `${etapes.length} visites · ${formatDistance(st?.distanceTotale ?? 0)} de trajet entre clients`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="px-3 py-2 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-card)] text-sm" />
          <button onClick={genererTournee} disabled={gen}
            className="flex items-center gap-1.5 text-sm font-semibold bg-emerald-600 text-white px-4 py-2 rounded-xl hover:bg-emerald-500 transition disabled:opacity-50">
            {gen ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            {etapes.length ? "Regénérer" : "Générer le plan"}
          </button>
        </div>
      </div>

      {toast && (
        <div className={`px-4 py-2 rounded-xl text-sm font-medium flex items-start gap-2 ${
          toast.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
          {toast.ok ? <Check size={15} className="mt-0.5 shrink-0" /> : <AlertTriangle size={15} className="mt-0.5 shrink-0" />}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Plan bâti loin d'où se trouve le commercial.
          Une tournée reste valable toute la journée : on ne la refait pas
          d'office, mais on prévient quand elle ne correspond manifestement
          plus à la position — sinon le commercial part à 60 km alors que ses
          clients sont à 1 km. */}
      {st && etapes.length > 0 && position && st.distanceApproche > 20_000 && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-sm">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <div className="flex-1">
            <div className="font-semibold">
              Cette tournée commence à {formatDistance(st.distanceApproche)} de vous
            </div>
            <div className="text-xs opacity-80 mt-0.5">
              Elle a été planifiée depuis un autre point de départ. Régénérez-la pour
              visiter les clients autour de votre position actuelle.
            </div>
          </div>
          <button onClick={genererTournee} disabled={gen}
            className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-semibold disabled:opacity-50">
            {gen ? "…" : "Regénérer ici"}
          </button>
        </div>
      )}

      {/* Avancement de la journée */}
      {st && etapes.length > 0 && (
        <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-primary)] p-4">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <div className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
              <Route size={16} className="text-emerald-600" />
              Avancement : {st.visitees}/{st.total} visites
            </div>
            <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)]">
              <span>{formatDistance(st.distanceApproche)} d&apos;approche</span>
              <span>·</span>
              <span>{formatDistance(st.distanceTotale)} entre clients</span>
            </div>
          </div>
          <div className="h-2 bg-[var(--bg-primary)] rounded-full overflow-hidden">
            <motion.div className="h-full bg-emerald-500 rounded-full"
              initial={{ width: 0 }} animate={{ width: `${st.progression}%` }} transition={{ duration: 0.6 }} />
          </div>
        </div>
      )}

      {/* Carte du trajet */}
      <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-primary)] overflow-hidden" style={{ height: 420 }}>
        {load ? (
          <div className="w-full h-full flex items-center justify-center text-slate-400">
            <Loader2 className="animate-spin" size={22} />
          </div>
        ) : etapes.length === 0 ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-[var(--text-secondary)] gap-3 px-6 text-center">
            <MapPin size={30} className="opacity-30" />
            <div className="text-sm">Aucun plan de travail pour cette date.</div>
            <button onClick={genererTournee} disabled={gen}
              className="text-sm font-semibold bg-emerald-600 text-white px-4 py-2 rounded-xl hover:bg-emerald-500 transition disabled:opacity-50">
              Générer la tournée du jour
            </button>
          </div>
        ) : (
          <TourneeMap
            etapes={etapes}
            courante={tournee?.courante ?? null}
            position={position ? { lat: position.lat, lng: position.lng } : null}
            onSelect={(e) => setSel(etapes.find((x) => x.id === e.id) ?? null)}
          />
        )}
      </div>

      {/* Liste ordonnée des étapes */}
      {etapes.length > 0 && (
        <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-primary)] overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--border-primary)] text-sm font-bold text-[var(--text-primary)]">
            Ordre de passage
          </div>
          <div className="divide-y divide-[var(--border-primary)]/60">
            {etapes.map((e) => {
              const cfg = ETAT_CFG[e.etat] ?? ETAT_CFG["À visiter"];
              const estCourante = tournee?.courante?.id === e.id;
              const estActif = clientActif?.id === e.codeCli;
              const d = position
                ? Math.round(distanceM(position.lat, position.lng, e.latitude, e.longitude))
                : null;
              return (
                <div key={e.id}
                  className={`flex items-center gap-3 px-4 py-3 transition ${estCourante ? "bg-amber-50/60" : ""} ${estActif ? "bg-emerald-50/60" : ""}`}>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm text-white shrink-0 ${cfg.dot}`}>
                    {e.numOrdre}
                  </div>

                  <button onClick={() => setSel(e)} className="flex-1 min-w-0 text-left">
                    <div className="font-semibold text-sm text-[var(--text-primary)] truncate flex items-center gap-2">
                      {e.nom}
                      {estCourante && (
                        <span className="text-[9px] font-black uppercase bg-amber-500 text-white px-1.5 py-0.5 rounded">
                          Prochaine
                        </span>
                      )}
                      {estActif && (
                        <span className="text-[9px] font-black uppercase bg-emerald-600 text-white px-1.5 py-0.5 rounded">
                          En cours
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[var(--text-secondary)] flex items-center gap-2 truncate">
                      <Clock size={10} className="shrink-0" /> {e.heurePrevue ?? "—"}
                      <span className="opacity-40">·</span>
                      <MapPin size={10} className="shrink-0" /> {e.ville || "—"}
                      {d != null && <><span className="opacity-40">·</span><span>{formatDistance(d)}</span></>}
                      {e.soldeFin > 0 && (
                        <><span className="opacity-40">·</span>
                        <span className="text-red-600 font-semibold">{fmt0(e.soldeFin)} TND</span></>
                      )}
                    </div>
                  </button>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-lg border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                      {e.etat}
                    </span>
                    {e.etat === "À visiter" && (
                      <button onClick={() => travailler(e)}
                        title="Travailler sur ce client"
                        className="text-xs font-bold bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-500 transition flex items-center gap-1">
                        <Play size={11} /> Visiter
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Détail d'une étape */}
      <AnimatePresence>
        {sel && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4"
            onClick={() => setSel(null)}>
            <motion.div initial={{ y: 30 }} animate={{ y: 0 }} exit={{ y: 30 }}
              className="bg-[var(--bg-card)] rounded-2xl w-full max-w-md overflow-hidden"
              onClick={(ev) => ev.stopPropagation()}>

              <div className="p-5 border-b border-[var(--border-primary)] flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] font-black uppercase tracking-wider text-emerald-600">
                    Étape {sel.numOrdre} · {sel.heurePrevue ?? "—"}
                  </div>
                  <div className="font-bold text-[var(--text-primary)] truncate mt-0.5">{sel.nom}</div>
                  <div className="text-xs text-[var(--text-secondary)] flex items-center gap-1 mt-0.5">
                    <MapPin size={11} className="shrink-0" /> {sel.adresse || sel.ville || "—"}
                  </div>
                </div>
                <button onClick={() => setSel(null)} className="text-[var(--text-secondary)] shrink-0"><X size={18} /></button>
              </div>

              <div className="p-5 space-y-3">
                {sel.soldeFin > 0 && (
                  <div className="px-3 py-2 rounded-xl bg-red-50 text-red-600 text-xs font-semibold">
                    Solde débiteur : {fmt0(sel.soldeFin)} TND — pensez au recouvrement
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  {sel.tel && (
                    <a href={`tel:${sel.tel}`}
                      className="px-3 py-2.5 rounded-xl text-sm font-semibold bg-[var(--bg-primary)] text-[var(--text-primary)] text-center flex items-center justify-center gap-1.5">
                      <Phone size={14} /> Appeler
                    </a>
                  )}
                  <a href={`https://www.google.com/maps/dir/?api=1&destination=${sel.latitude},${sel.longitude}`}
                    target="_blank" rel="noopener noreferrer"
                    className="px-3 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 text-white text-center flex items-center justify-center gap-1.5">
                    <Navigation size={14} /> Itinéraire
                  </a>
                </div>

                {/* Pointage d'arrivée : démarre l'enregistrement de la visite
                    et bascule l'étape en « En cours ». */}
                <PointageVisite
                  ligneId={sel.id}
                  clientNom={sel.nom}
                  position={position ? { lat: position.lat, lng: position.lng } : null}
                  onChange={charger}
                />

                {/* Travailler sur ce client : il devient le client actif */}
                <button onClick={() => travailler(sel, true)}
                  className="w-full px-3 py-3 rounded-xl text-sm font-bold bg-emerald-600 text-white flex items-center justify-center gap-2 hover:bg-emerald-500 transition">
                  <ShoppingBag size={15} /> Travailler sur ce client
                  <ChevronRight size={15} />
                </button>

                <div className="pt-2 border-t border-[var(--border-primary)]">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)] mb-2">
                    Résultat de la visite
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {(["Visité", "Reporté", "Absent"] as const).map((etat) => {
                      const cfg = ETAT_CFG[etat];
                      return (
                        <button key={etat} onClick={() => majEtape(sel, etat)}
                          className={`px-2 py-2 rounded-xl text-xs font-bold border transition ${cfg.bg} ${cfg.text} ${cfg.border} hover:opacity-80 ${sel.etat === etat ? "ring-2 ring-offset-1 ring-current" : ""}`}>
                          {etat}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
