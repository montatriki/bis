"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Search, X, Loader2, Check, AlertTriangle, Trash2, Edit3,
  Truck, User, Calendar, Flag, MapPin, Target, ListChecks, Lock,
} from "lucide-react";

// Gestion des ordres de mission — reprend l'écran « Gestion ordres missions »
// de l'ERP source (liste + création/édition avec sélection de clients).
//
// Partagé par l'administration et le management : mêmes droits sur l'API,
// seul le titre change.

type Mission = {
  id: number; commercial: string | null; vehicule: string | null;
  dateOrdre: string | null; etat: string | null; objectifCA: number;
  /** Bornes de la tournée (départ / retour). */
  du?: string | null; au?: string | null;
  kmDepart: number; kmArrive: number;
  nbVisites: number; nbDocuments: number; nbReglements: number;
};
type ClientRef = {
  id: number; raisonSocial: string | null; ville: string | null;
  gouvernorat: string | null; tel: string | null; soldeFin: number;
  commercial: string | null;
};
type Visite = {
  id?: number; codeCli: number; clientNom: string;
  motif: string; objectif: number; numOrdre: number; etat?: string;
};
type Referentiels = {
  gouvernorats: string[]; villes: string[];
  villesParGouvernorat: Record<string, string[]>;
  commerciaux: string[]; vehicules: string[];
};

const ETATS = ["Planifiée", "En cours", "Clôturée", "Annulée"] as const;

const ETAT_CFG: Record<string, { bg: string; text: string; border: string }> = {
  "Planifiée": { bg: "bg-blue-50",    text: "text-blue-700",    border: "border-blue-200" },
  "En cours":  { bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200" },
  "Clôturée":  { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  "Annulée":   { bg: "bg-red-50",     text: "text-red-600",     border: "border-red-200" },
};

/**
 * Les 2 500 tournées importées portent l'orthographe de l'ERP source
 * (« Cloturé », sans accent ni accord) là où l'application écrit « Clôturée ».
 * On ramène les deux à une même clé plutôt que de réécrire l'historique.
 */
function etatNormalise(etat: string | null): string {
  const e = (etat ?? "").trim();
  if (/^cl[oô]tur/i.test(e)) return "Clôturée";
  if (/^planif/i.test(e)) return "Planifiée";
  if (/^annul/i.test(e)) return "Annulée";
  return e || "Planifiée";
}

/** Une tournée clôturée n'est plus modifiable, quelle que soit la graphie. */
const estCloturee = (etat: string | null) => etatNormalise(etat) === "Clôturée";

const fmt0 = (n: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n ?? 0);
const fmt3 = (n: number) =>
  new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(n ?? 0);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const fmtDate = (v: string | null) => (v ? new Date(v).toLocaleDateString("fr-FR") : "—");

export default function GestionMissions({ titre }: { titre: string }) {
  const [rows, setRows] = useState<Mission[]>([]);
  // L'historique compte 2 631 tournées : la liste est paginée côté serveur.
  const [page, setPage] = useState(0);
  const [meta, setMeta] = useState<{ total: number; pages: number }>({ total: 0, pages: 0 });
  const [refs, setRefs] = useState<Referentiels | null>(null);
  const [load, setLoad] = useState(true);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  // Filtres de la liste.
  const [fCommercial, setFCommercial] = useState("");
  const [fEtat, setFEtat] = useState("Tous");
  const [fDu, setFDu] = useState("");
  const [fAu, setFAu] = useState("");

  // Formulaire (création ou édition).
  const [form, setForm] = useState<Mission | null>(null);
  const [suppression, setSuppression] = useState<Mission | null>(null);

  const flash = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4500);
  }, []);

  const charger = useCallback(() => {
    const qs = new URLSearchParams({ vue: "liste", page: String(page) });
    if (fCommercial) qs.set("commercial", fCommercial);
    if (fEtat !== "Tous") qs.set("etat", fEtat);
    if (fDu) qs.set("du", fDu);
    if (fAu) qs.set("au", fAu);
    // `setLoad` passe par la chaîne asynchrone : un appel synchrone dans
    // l'effet déclencherait un rendu en cascade.
    Promise.resolve()
      .then(() => setLoad(true))
      .then(() => fetch(`/api/missions?${qs}`).then((r) => r.json()))
      .then((d) => {
        setRows(d.rows ?? []);
        setMeta({ total: d.total ?? 0, pages: d.pages ?? 1 });
      })
      .catch(() => flash("Chargement impossible", false))
      .finally(() => setLoad(false));
  }, [fCommercial, fEtat, fDu, fAu, page, flash]);

  useEffect(charger, [charger]);

  useEffect(() => {
    fetch("/api/missions?vue=referentiels")
      .then((r) => r.json())
      .then(setRefs)
      .catch(() => {});
  }, []);

  async function supprimer(m: Mission) {
    const r = await fetch(`/api/missions?vue=tournee&id=${m.id}`, { method: "DELETE" })
      .then((x) => x.json()).catch(() => ({ error: "réseau" }));
    setSuppression(null);
    if (r.error) return flash(r.error, false);
    flash(r.message ?? "Tournée supprimée");
    charger();
  }

  const totaux = useMemo(() => ({
    missions: rows.length,
    visites: rows.reduce((s, r) => s + r.nbVisites, 0),
    objectif: rows.reduce((s, r) => s + r.objectifCA, 0),
    enCours: rows.filter((r) => r.etat === "En cours").length,
  }), [rows]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">{titre}</h1>
          <p className="text-[var(--text-secondary)] text-sm">
            {load ? "Chargement…" : `${rows.length} ordre(s) de mission · ${totaux.visites} visite(s) planifiée(s)`}
          </p>
        </div>
        <button onClick={() => setForm({
          id: 0, commercial: "", vehicule: "", dateOrdre: new Date().toISOString(),
          etat: "Planifiée", objectifCA: 0, kmDepart: 0, kmArrive: 0,
          nbVisites: 0, nbDocuments: 0, nbReglements: 0,
        })}
          className="flex items-center gap-1.5 text-sm font-semibold bg-emerald-600 text-white px-4 py-2.5 rounded-xl hover:bg-emerald-500 transition">
          <Plus size={16} /> Créer une mission
        </button>
      </div>

      {toast && (
        <div className={`px-4 py-2.5 rounded-xl text-sm font-medium flex items-start gap-2 ${
          toast.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
          {toast.ok ? <Check size={15} className="mt-0.5 shrink-0" /> : <AlertTriangle size={15} className="mt-0.5 shrink-0" />}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Indicateurs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Ordres de mission", value: fmt0(totaux.missions), icon: ListChecks, tone: "text-blue-600", bg: "bg-blue-50" },
          { label: "En cours", value: fmt0(totaux.enCours), icon: Flag, tone: "text-amber-600", bg: "bg-amber-50" },
          { label: "Visites planifiées", value: fmt0(totaux.visites), icon: MapPin, tone: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Objectif cumulé", value: `${fmt0(totaux.objectif)} TND`, icon: Target, tone: "text-purple-600", bg: "bg-purple-50" },
        ].map((k) => (
          <div key={k.label} className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-primary)] p-4 flex items-center gap-3">
            <div className={`w-10 h-10 ${k.bg} rounded-xl flex items-center justify-center shrink-0`}>
              <k.icon size={18} className={k.tone} />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] uppercase font-bold tracking-wide text-[var(--text-secondary)] truncate">{k.label}</div>
              <div className="font-extrabold text-lg tabular-nums">{k.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-2 bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-2xl px-4 py-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] opacity-70" />
          <input value={fCommercial} onChange={(e) => { setFCommercial(e.target.value); setPage(0); }}
            list="ref-commerciaux" placeholder="Filtrer par commercial…"
            className="w-full pl-9 pr-3 py-2 text-xs bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg focus:outline-none focus:border-emerald-500 text-[var(--text-primary)]" />
          <datalist id="ref-commerciaux">
            {refs?.commerciaux.map((c) => <option key={c} value={c} />)}
          </datalist>
        </div>
        <select value={fEtat} onChange={(e) => { setFEtat(e.target.value); setPage(0); }}
          className="text-xs bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg px-3 py-2 focus:outline-none">
          <option>Tous</option>
          {ETATS.map((e) => <option key={e}>{e}</option>)}
        </select>
        <input type="date" value={fDu} onChange={(e) => { setFDu(e.target.value); setPage(0); }}
          className="text-xs bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg px-2.5 py-2" />
        <span className="text-[10px] text-[var(--text-secondary)]">au</span>
        <input type="date" value={fAu} onChange={(e) => { setFAu(e.target.value); setPage(0); }}
          className="text-xs bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg px-2.5 py-2" />
        {(fCommercial || fEtat !== "Tous" || fDu || fAu) && (
          <button onClick={() => { setFCommercial(""); setFEtat("Tous"); setFDu(""); setFAu(""); setPage(0); }}
            className="text-[11px] font-bold text-emerald-600 px-2.5 py-2 rounded-lg hover:bg-emerald-50 transition">
            Réinitialiser
          </button>
        )}
      </div>

      {/* Liste */}
      <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-primary)] overflow-hidden">
        {load ? (
          <div className="py-16 text-center text-[var(--text-secondary)]"><Loader2 className="animate-spin inline" size={22} /></div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-sm text-[var(--text-secondary)]">Aucun ordre de mission pour ces critères.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-[var(--bg-primary)]/50 text-[var(--text-secondary)]">
                <tr className="text-[10px] uppercase tracking-wider">
                  <th className="text-left font-black px-4 py-2.5">N°</th>
                  <th className="text-left font-black px-3 py-2.5">Commercial</th>
                  <th className="text-left font-black px-3 py-2.5">Date</th>
                  <th className="text-left font-black px-3 py-2.5">Véhicule</th>
                  <th className="text-right font-black px-3 py-2.5">Visites</th>
                  <th className="text-right font-black px-3 py-2.5">Objectif</th>
                  <th className="text-left font-black px-3 py-2.5">État</th>
                  <th className="text-right font-black px-4 py-2.5">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-primary)]">
                {rows.map((m) => {
                  const cfg = ETAT_CFG[etatNormalise(m.etat)] ?? ETAT_CFG["Planifiée"];
                  const verrouillee = estCloturee(m.etat);
                  return (
                    <tr key={m.id} className="hover:bg-[var(--accent-light)]/40 transition">
                      <td className="px-4 py-2.5 font-mono font-bold">{m.id}</td>
                      <td className="px-3 py-2.5 font-semibold truncate max-w-[180px]">{m.commercial || "—"}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {fmtDate(m.dateOrdre)}
                        {/* Retour affiché seulement s'il diffère du départ :
                            la plupart des tournées tiennent sur la journée. */}
                        {m.au && fmtDate(m.au) !== fmtDate(m.dateOrdre) && (
                          <span className="text-[var(--text-secondary)]"> → {fmtDate(m.au)}</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 font-mono">{m.vehicule || "—"}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-bold">{m.nbVisites}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{fmt3(m.objectifCA)}</td>
                      <td className="px-3 py-2.5">
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-lg border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                          {m.etat || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={() => setForm(m)}
                            title={verrouillee ? "Consulter" : "Modifier"}
                            className="w-7 h-7 rounded-lg border border-[var(--border-primary)] flex items-center justify-center text-[var(--text-secondary)] hover:text-blue-600 hover:border-blue-300 transition">
                            {verrouillee ? <Lock size={12} /> : <Edit3 size={12} />}
                          </button>
                          <button onClick={() => setSuppression(m)}
                            title="Supprimer"
                            className="w-7 h-7 rounded-lg border border-[var(--border-primary)] flex items-center justify-center text-[var(--text-secondary)] hover:text-red-600 hover:border-red-300 transition">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination : 2 631 tournées en historique. */}
        {!load && meta.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border-primary)] text-xs text-[var(--text-secondary)]">
            <span>{meta.total} tournée{meta.total > 1 ? "s" : ""}</span>
            <div className="flex items-center gap-2">
              <button type="button" disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="px-2.5 py-1 rounded-lg border border-[var(--border-primary)] disabled:opacity-40 hover:bg-[var(--accent-light)]">
                Précédent
              </button>
              <span>Page {page + 1} / {meta.pages}</span>
              <button type="button" disabled={page + 1 >= meta.pages}
                onClick={() => setPage((p) => p + 1)}
                className="px-2.5 py-1 rounded-lg border border-[var(--border-primary)] disabled:opacity-40 hover:bg-[var(--accent-light)]">
                Suivant
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Formulaire de mission */}
      <AnimatePresence>
        {form && (
          <FormulaireMission
            mission={form} refs={refs}
            onFermer={() => setForm(null)}
            onEnregistre={(msg) => { setForm(null); flash(msg); charger(); }}
            onErreur={(msg) => flash(msg, false)}
          />
        )}
      </AnimatePresence>

      {/* Confirmation de suppression */}
      <AnimatePresence>
        {suppression && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSuppression(null)}>
            <motion.div className="bg-[var(--bg-card)] rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
              <div className="p-5">
                <div className="w-11 h-11 rounded-2xl bg-red-500/15 text-red-600 flex items-center justify-center mb-3">
                  <Trash2 size={19} />
                </div>
                <div className="font-bold text-[var(--text-primary)]">Supprimer la mission n° {suppression.id} ?</div>
                <p className="text-sm text-[var(--text-secondary)] mt-1.5">
                  {suppression.commercial} — {fmtDate(suppression.dateOrdre)}.
                  Cette action est définitive.
                </p>
              </div>
              <div className="flex gap-2 p-4 border-t border-[var(--border-primary)]">
                <button onClick={() => setSuppression(null)}
                  className="flex-1 border border-[var(--border-primary)] text-[var(--text-secondary)] py-2.5 rounded-xl font-medium hover:bg-[var(--bg-primary)] transition text-sm">
                  Annuler
                </button>
                <button onClick={() => supprimer(suppression)}
                  className="flex-1 bg-red-600 text-white py-2.5 rounded-xl font-medium hover:bg-red-500 transition text-sm">
                  Supprimer
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Création ou édition d'un ordre de mission, avec sélection des clients. */
function FormulaireMission({
  mission, refs, onFermer, onEnregistre, onErreur,
}: {
  mission: Mission; refs: Referentiels | null;
  onFermer: () => void;
  onEnregistre: (msg: string) => void;
  onErreur: (msg: string) => void;
}) {
  const creation = mission.id === 0;
  const verrouillee = estCloturee(mission.etat);

  const [commercial, setCommercial] = useState(mission.commercial ?? "");
  const [vehicule, setVehicule] = useState(mission.vehicule ?? "");
  const [dateOrdre, setDateOrdre] = useState(
    mission.dateOrdre ? iso(new Date(mission.dateOrdre)) : iso(new Date()),
  );
  // Une tournée peut s'étaler sur plusieurs jours : on saisit le départ et le
  // retour. `dateOrdre` suit le départ — c'est la date de rattachement des
  // ventes et la clé d'unicité (une tournée par commercial et par jour).
  const [dateRetour, setDateRetour] = useState(
    mission.au ? iso(new Date(mission.au))
      : mission.dateOrdre ? iso(new Date(mission.dateOrdre)) : iso(new Date()),
  );
  const [etat, setEtat] = useState(etatNormalise(mission.etat));
  const [kmDepart, setKmDepart] = useState(String(mission.kmDepart || ""));
  const [kmArrive, setKmArrive] = useState(String(mission.kmArrive || ""));

  const [visites, setVisites] = useState<Visite[]>([]);
  const [enregistre, setEnregistre] = useState(false);

  // Sélection des clients : les trois modes de l'ERP source.
  const [mode, setMode] = useState<"tous" | "commercial" | "zone">("commercial");
  const [gouvernorat, setGouvernorat] = useState("");
  const [ville, setVille] = useState("");
  const [recherche, setRecherche] = useState("");
  const [clients, setClients] = useState<ClientRef[]>([]);
  const [totalClients, setTotalClients] = useState(0);
  const [chargeClients, setChargeClients] = useState(false);

  // Planning existant d'une mission en édition.
  useEffect(() => {
    if (creation) return;
    fetch(`/api/missions?vue=detail&id=${mission.id}`)
      .then((r) => r.json())
      .then((d) => {
        const lignes = d.mission?.lignes ?? d.lignes ?? [];
        setVisites(lignes
          .filter((l: Record<string, unknown>) => l.codeCli != null)
          .map((l: Record<string, unknown>) => ({
            id: l.id as number,
            codeCli: l.codeCli as number,
            clientNom: (l.clientNom as string) ?? `Client ${l.codeCli}`,
            motif: (l.motif as string) ?? "",
            objectif: (l.objectif as number) ?? 0,
            numOrdre: (l.numOrdre as number) ?? 0,
            etat: l.etat as string,
          })));
      })
      .catch(() => {});
  }, [creation, mission.id]);

  // Recherche de clients selon le mode retenu.
  useEffect(() => {
    const t = setTimeout(() => {
      const qs = new URLSearchParams({ vue: "clients" });
      if (mode === "commercial" && commercial) qs.set("clientsCommercial", commercial);
      if (mode === "zone") {
        if (gouvernorat) qs.set("gouvernorat", gouvernorat);
        if (ville) qs.set("ville", ville);
      }
      if (recherche) qs.set("q", recherche);
      setChargeClients(true);
      fetch(`/api/missions?${qs}`)
        .then((r) => r.json())
        .then((d) => { setClients(d.rows ?? []); setTotalClients(d.total ?? 0); })
        .catch(() => {})
        .finally(() => setChargeClients(false));
    }, 300);
    return () => clearTimeout(t);
  }, [mode, commercial, gouvernorat, ville, recherche]);

  const choisis = useMemo(() => new Set(visites.map((v) => v.codeCli)), [visites]);

  function basculer(c: ClientRef) {
    setVisites((prev) => {
      const existe = prev.find((v) => v.codeCli === c.id);
      if (existe) {
        // Une visite déjà réalisée ne se retire pas : le terrain fait foi.
        if (existe.etat && existe.etat !== "À visiter") return prev;
        return prev
          .filter((v) => v.codeCli !== c.id)
          .map((v, i) => ({ ...v, numOrdre: i + 1 }));
      }
      return [...prev, {
        codeCli: c.id,
        clientNom: (c.raisonSocial || "").trim() || `Client ${c.id}`,
        motif: c.soldeFin > 0 ? "Recouvrement" : "Visite commerciale",
        objectif: 0,
        numOrdre: prev.length + 1,
      }];
    });
  }

  function majVisite(codeCli: number, champ: "motif" | "objectif", valeur: string) {
    setVisites((prev) => prev.map((v) =>
      v.codeCli === codeCli
        ? { ...v, [champ]: champ === "objectif" ? Number(valeur) || 0 : valeur }
        : v));
  }

  function ajouterTous() {
    setVisites((prev) => {
      const connus = new Set(prev.map((v) => v.codeCli));
      const ajouts = clients
        .filter((c) => !connus.has(c.id))
        .map((c, i) => ({
          codeCli: c.id,
          clientNom: (c.raisonSocial || "").trim() || `Client ${c.id}`,
          motif: c.soldeFin > 0 ? "Recouvrement" : "Visite commerciale",
          objectif: 0,
          numOrdre: prev.length + i + 1,
        }));
      return [...prev, ...ajouts];
    });
  }

  const totalObjectif = visites.reduce((s, v) => s + (v.objectif || 0), 0);

  async function enregistrer() {
    if (!commercial.trim()) return onErreur("Le commercial est obligatoire");
    setEnregistre(true);
    try {
      if (creation) {
        const r = await fetch("/api/missions", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            vue: "tournee", commercial, vehicule, dateOrdre,
            du: dateOrdre, au: dateRetour,
            kmDepart: Number(kmDepart) || 0,
            objectifCA: totalObjectif,
            visites: visites.map((v, i) => ({ ...v, numOrdre: i + 1 })),
          }),
        }).then((x) => x.json());
        if (!r.ok) return onErreur(r.message ?? r.error ?? "Échec de la création");
        // L'état demandé peut différer de « Planifiée » posé à la création.
        if (etat !== "Planifiée" && r.dayId) {
          await fetch("/api/missions", {
            method: "PUT", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ vue: "tournee", id: r.dayId, etat }),
          });
        }
        onEnregistre(r.message ?? "Mission créée");
      } else {
        const maj = await fetch("/api/missions", {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            vue: "tournee", id: mission.id, etat, vehicule,
            objectifCA: totalObjectif,
            kmDepart: Number(kmDepart) || 0,
            kmArrive: Number(kmArrive) || 0,
          }),
        }).then((x) => x.json());
        if (maj.error) return onErreur(maj.error);

        const plan = await fetch("/api/missions", {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            vue: "planning", id: mission.id,
            visites: visites.map((v, i) => ({ ...v, numOrdre: i + 1 })),
          }),
        }).then((x) => x.json());
        if (plan.error) return onErreur(plan.error);

        onEnregistre("Mission enregistrée");
      }
    } catch {
      onErreur("Réseau indisponible");
    } finally {
      setEnregistre(false);
    }
  }

  const villesDispo = gouvernorat
    ? (refs?.villesParGouvernorat[gouvernorat] ?? [])
    : (refs?.villes ?? []);

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onFermer}>
      <motion.div className="bg-[var(--bg-card)] rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}>

        <div className="bg-slate-800 text-white p-5 flex items-center justify-between">
          <div>
            <div className="font-bold text-lg">
              {creation ? "Nouvel ordre de mission" : `Mission n° ${mission.id}`}
            </div>
            <div className="text-slate-400 text-xs mt-0.5">
              {verrouillee
                ? "Tournée clôturée — consultation seule"
                : "Affectez un commercial, un véhicule et les clients à visiter"}
            </div>
          </div>
          <button onClick={onFermer} className="p-2 hover:bg-white/10 rounded-xl transition"><X size={18} /></button>
        </div>

        <div className="p-5 overflow-auto flex-1 space-y-5">
          {/* En-tête de mission */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <Champ label="Commercial *" icon={User}>
              <input value={commercial} onChange={(e) => setCommercial(e.target.value)}
                list="form-commerciaux" disabled={!creation || verrouillee}
                placeholder="Nom du commercial"
                className="w-full px-3 py-2 text-sm bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl focus:outline-none focus:border-emerald-500 disabled:opacity-60" />
              <datalist id="form-commerciaux">
                {refs?.commerciaux.map((c) => <option key={c} value={c} />)}
              </datalist>
            </Champ>

            <Champ label="Véhicule" icon={Truck}>
              <input value={vehicule} onChange={(e) => setVehicule(e.target.value)}
                list="form-vehicules" disabled={verrouillee} placeholder="Matricule"
                className="w-full px-3 py-2 text-sm bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl focus:outline-none focus:border-emerald-500 disabled:opacity-60" />
              <datalist id="form-vehicules">
                {refs?.vehicules.map((v) => <option key={v} value={v} />)}
              </datalist>
            </Champ>

            <Champ label="Départ de la tournée" icon={Calendar}>
              <input type="date" value={dateOrdre}
                onChange={(e) => {
                  setDateOrdre(e.target.value);
                  // Un retour antérieur au départ n'a pas de sens : on le
                  // repousse plutôt que d'attendre l'erreur à l'enregistrement.
                  if (dateRetour && e.target.value > dateRetour) setDateRetour(e.target.value);
                }}
                disabled={!creation || verrouillee}
                className="w-full px-3 py-2 text-sm bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl focus:outline-none focus:border-emerald-500 disabled:opacity-60" />
            </Champ>

            <Champ label="Retour de la tournée" icon={Calendar}>
              <input type="date" value={dateRetour} min={dateOrdre}
                onChange={(e) => setDateRetour(e.target.value)}
                disabled={verrouillee}
                className="w-full px-3 py-2 text-sm bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl focus:outline-none focus:border-emerald-500 disabled:opacity-60" />
            </Champ>

            <Champ label="État" icon={Flag}>
              <select value={etat} onChange={(e) => setEtat(e.target.value)} disabled={verrouillee}
                className="w-full px-3 py-2 text-sm bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl focus:outline-none focus:border-emerald-500 disabled:opacity-60">
                {ETATS.map((e) => <option key={e}>{e}</option>)}
              </select>
            </Champ>

            <Champ label="Km départ">
              <input type="number" value={kmDepart} onChange={(e) => setKmDepart(e.target.value)} disabled={verrouillee}
                className="w-full px-3 py-2 text-sm bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl focus:outline-none focus:border-emerald-500 disabled:opacity-60" />
            </Champ>

            <Champ label="Km arrivée">
              <input type="number" value={kmArrive} onChange={(e) => setKmArrive(e.target.value)}
                disabled={creation || verrouillee}
                className="w-full px-3 py-2 text-sm bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl focus:outline-none focus:border-emerald-500 disabled:opacity-60" />
            </Champ>
          </div>

          {!verrouillee && (
            <>
              {/* Modes de sélection des clients */}
              <div className="border-t border-[var(--border-primary)] pt-4">
                <div className="text-xs font-black uppercase tracking-wide text-[var(--text-secondary)] mb-2">
                  Clients à visiter
                </div>
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  {([
                    { v: "tous", l: "Tous les clients" },
                    { v: "commercial", l: "Clients du commercial" },
                    { v: "zone", l: "Par zone" },
                  ] as const).map((m) => (
                    <button key={m.v} onClick={() => setMode(m.v)}
                      className={`text-xs font-bold px-3 py-2 rounded-xl border transition ${
                        mode === m.v
                          ? "bg-emerald-600 text-white border-emerald-600"
                          : "border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]"}`}>
                      {m.l}
                    </button>
                  ))}

                  {mode === "zone" && (
                    <>
                      <select value={gouvernorat} onChange={(e) => { setGouvernorat(e.target.value); setVille(""); }}
                        className="text-xs bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg px-2.5 py-2">
                        <option value="">Toute la Tunisie</option>
                        {refs?.gouvernorats.map((g) => <option key={g}>{g}</option>)}
                      </select>
                      <select value={ville} onChange={(e) => setVille(e.target.value)}
                        className="text-xs bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg px-2.5 py-2">
                        <option value="">Toutes les villes</option>
                        {villesDispo.map((v) => <option key={v}>{v}</option>)}
                      </select>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2 mb-2">
                  <div className="relative flex-1">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] opacity-70" />
                    <input value={recherche} onChange={(e) => setRecherche(e.target.value)}
                      placeholder="Rechercher un client…"
                      className="w-full pl-9 pr-3 py-2 text-xs bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg focus:outline-none focus:border-emerald-500" />
                  </div>
                  <button onClick={ajouterTous}
                    className="text-[11px] font-bold border border-emerald-500/40 text-emerald-700 px-3 py-2 rounded-lg hover:bg-emerald-50 transition whitespace-nowrap">
                    Ajouter les {clients.length} affichés
                  </button>
                </div>

                <div className="text-[10px] text-[var(--text-secondary)] mb-1.5">
                  {chargeClients ? "Recherche…" : `${clients.length} affiché(s) sur ${totalClients} client(s)`}
                </div>

                <div className="border border-[var(--border-primary)] rounded-xl max-h-52 overflow-auto divide-y divide-[var(--border-primary)]/60">
                  {clients.map((c) => {
                    const pris = choisis.has(c.id);
                    return (
                      <button key={c.id} onClick={() => basculer(c)}
                        className={`w-full text-left px-3 py-2 flex items-center gap-2.5 transition ${pris ? "bg-emerald-50/70" : "hover:bg-[var(--accent-light)]/40"}`}>
                        <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                          pris ? "bg-emerald-600 border-emerald-600" : "border-[var(--border-primary)]"}`}>
                          {pris && <Check size={11} className="text-white" />}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-xs font-semibold truncate">
                            {(c.raisonSocial || "").trim() || `Client ${c.id}`}
                          </span>
                          <span className="block text-[10px] text-[var(--text-secondary)] truncate">
                            {/* Adresse absente : le client reste visitable, on
                                l'indique plutôt que d'afficher un tiret muet. */}
                            {[c.ville, c.gouvernorat].filter(Boolean).join(" · ") || "Toute la Tunisie"}
                            {c.soldeFin > 0 && ` · solde ${fmt0(c.soldeFin)} TND`}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                  {!chargeClients && clients.length === 0 && (
                    <div className="px-3 py-6 text-center text-xs text-[var(--text-secondary)]">
                      Aucun client pour ces critères.
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Planning retenu */}
          <div className="border-t border-[var(--border-primary)] pt-4">
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <div className="text-xs font-black uppercase tracking-wide text-[var(--text-secondary)]">
                Planning — {visites.length} visite(s)
              </div>
              <div className="text-xs font-bold text-[var(--text-primary)]">
                Total objectif : {fmt3(totalObjectif)} TND
              </div>
            </div>

            {visites.length === 0 ? (
              <div className="py-8 text-center text-xs text-[var(--text-secondary)] border border-dashed border-[var(--border-primary)] rounded-xl">
                Aucun client sélectionné.
              </div>
            ) : (
              <div className="border border-[var(--border-primary)] rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-[var(--bg-primary)]/60 text-[var(--text-secondary)] sticky top-0">
                    <tr className="text-[10px] uppercase">
                      <th className="text-left font-black px-3 py-2">N°</th>
                      <th className="text-left font-black px-2 py-2">Client</th>
                      <th className="text-left font-black px-2 py-2">Motif</th>
                      <th className="text-right font-black px-2 py-2">Objectif</th>
                      <th className="px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-primary)]/60">
                    {visites.map((v, i) => (
                      <tr key={v.codeCli}>
                        <td className="px-3 py-1.5 font-bold tabular-nums">{i + 1}</td>
                        <td className="px-2 py-1.5 truncate max-w-[190px]">
                          {v.clientNom}
                          {v.etat && v.etat !== "À visiter" && (
                            <span className="ml-1.5 text-[9px] font-bold text-emerald-600">({v.etat})</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5">
                          <input value={v.motif} onChange={(e) => majVisite(v.codeCli, "motif", e.target.value)}
                            disabled={verrouillee}
                            className="w-full px-2 py-1 text-xs bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg focus:outline-none disabled:opacity-60" />
                        </td>
                        <td className="px-2 py-1.5">
                          <input type="number" value={v.objectif || ""} onChange={(e) => majVisite(v.codeCli, "objectif", e.target.value)}
                            disabled={verrouillee}
                            className="w-20 px-2 py-1 text-xs text-right bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg focus:outline-none disabled:opacity-60" />
                        </td>
                        <td className="px-2 py-1.5">
                          {!verrouillee && (!v.etat || v.etat === "À visiter") && (
                            <button onClick={() => setVisites((p) => p.filter((x) => x.codeCli !== v.codeCli))}
                              className="text-[var(--text-secondary)] hover:text-red-600 transition">
                              <X size={13} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3 p-5 border-t border-[var(--border-primary)]">
          <button onClick={onFermer}
            className="flex-1 border border-[var(--border-primary)] text-[var(--text-secondary)] py-2.5 rounded-xl font-medium hover:bg-[var(--bg-primary)] transition text-sm">
            {verrouillee ? "Fermer" : "Annuler"}
          </button>
          {!verrouillee && (
            <button onClick={enregistrer} disabled={enregistre || !commercial.trim()}
              className="flex-1 bg-emerald-600 text-white py-2.5 rounded-xl font-medium hover:bg-emerald-500 transition text-sm disabled:opacity-50 flex items-center justify-center gap-2">
              {enregistre && <Loader2 className="animate-spin" size={15} />}
              {creation ? "Créer la mission" : "Enregistrer"}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function Champ({ label, icon: Icon, children }: {
  label: string; icon?: React.ElementType; children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold text-[var(--text-secondary)] flex items-center gap-1 mb-1">
        {Icon && <Icon size={11} />} {label}
      </span>
      {children}
    </label>
  );
}
