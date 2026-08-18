"use client";
import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Truck, Boxes, Plus, Trash2, Search, X, Loader2, Check,
  AlertTriangle, ArrowRight, History, Package,
} from "lucide-react";

// Bons de sortie / transfert / retour — module Gestion Tourner.
// Le même écran sert les 4 types, le sens de déplacement change.

type Empl = { code: string; label: string };
type Ligne = { key: string; refArt: string; designation: string; quantite: number; dispo?: number };
type EtatRow = {
  refArt: string; designation: string; emplacement: string; quantite: number; valeur: number;
};
type Historique = {
  id: number; refDoc: string | null; typeDoc: string | null; refArt: string;
  designation: string | null; quantite: number; source: string | null;
  destination: string | null; createdAt: string;
};
type Article = { refArt: string; designation: string; enStock: number };

const fmt = (v: unknown) =>
  new Intl.NumberFormat("fr-TN", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(Number(v) || 0);
const fmtDate = (v: unknown) => (v ? new Date(String(v)).toLocaleDateString("fr-FR") : "—");

let seq = 0;
const newKey = () => `l${++seq}`;

/** Configuration d'affichage par type de bon. */
const CONFIG: Record<string, { titre: string; source: "depot" | "vehicule"; destination: "depot" | "vehicule"; couleur: string }> = {
  BST: { titre: "Bon de sortie", source: "depot", destination: "vehicule", couleur: "#dc2626" },
  BTR: { titre: "Bon de transfert", source: "depot", destination: "depot", couleur: "#2563eb" },
  BTV: { titre: "Transfert entre véhicules", source: "vehicule", destination: "vehicule", couleur: "#7c3aed" },
  BRT: { titre: "Bon de retour", source: "vehicule", destination: "depot", couleur: "#16a34a" },
};

export default function MouvementDepotView({ accent, typeDoc }: { accent: string; typeDoc: string }) {
  const cfg = CONFIG[typeDoc] ?? CONFIG.BTR;
  const [onglet, setOnglet] = useState<"saisie" | "etat" | "historique">("saisie");
  const [depots, setDepots] = useState<Empl[]>([]);
  const [vehicules, setVehicules] = useState<Empl[]>([]);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [reload, setReload] = useState(0);

  const flash = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 5000);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/mouvements-depot?vue=emplacements")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setDepots(d.depots ?? []);
        setVehicules(d.vehicules ?? []);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const listeSource = cfg.source === "depot" ? depots : vehicules;
  const listeDest = cfg.destination === "depot" ? depots : vehicules;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: cfg.couleur + "18", color: cfg.couleur }}>
            <Truck size={17} />
          </div>
          <div>
            <div className="font-bold text-[var(--text-primary)] text-sm">{cfg.titre}</div>
            <div className="text-xs text-[var(--text-secondary)] flex items-center gap-1">
              {cfg.source === "depot" ? "Dépôt" : "Véhicule"}
              <ArrowRight size={11} />
              {cfg.destination === "depot" ? "Dépôt" : "Véhicule"}
            </div>
          </div>
        </div>
        <div className="flex gap-1.5">
          {([["saisie", "Saisie"], ["etat", "État du stock"], ["historique", "Historique"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setOnglet(k)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                onglet === k ? "text-white border-transparent shadow-sm"
                  : "bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border-primary)]"
              }`}
              style={onglet === k ? { background: accent } : undefined}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {toast && (
        <div className={`px-4 py-2 rounded-xl text-sm font-medium flex items-start gap-2 ${
          toast.ok ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-red-500/10 text-red-600"
        }`}>
          {toast.ok ? <Check size={15} className="mt-0.5 shrink-0" /> : <AlertTriangle size={15} className="mt-0.5 shrink-0" />}
          <span className="whitespace-pre-line">{toast.msg}</span>
        </div>
      )}

      {onglet === "saisie" && (
        <Saisie typeDoc={typeDoc} cfg={cfg} accent={accent}
          listeSource={listeSource} listeDest={listeDest}
          onFlash={flash} onDone={() => setReload((k) => k + 1)} />
      )}
      {onglet === "etat" && <Etat accent={accent} reload={reload} depots={depots} vehicules={vehicules} />}
      {onglet === "historique" && <Histo accent={accent} reload={reload} />}
    </div>
  );
}

/* --------------------------------- Saisie --------------------------------- */

function Saisie({ typeDoc, cfg, accent, listeSource, listeDest, onFlash, onDone }: {
  typeDoc: string;
  cfg: { titre: string; source: string; destination: string; couleur: string };
  accent: string; listeSource: Empl[]; listeDest: Empl[];
  onFlash: (m: string, ok?: boolean) => void; onDone: () => void;
}) {
  const [source, setSource] = useState("");
  const [destination, setDestination] = useState("");
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [picker, setPicker] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dispos, setDispos] = useState<Record<string, number>>({});

  // Disponibilité des articles à la source, pour éviter les saisies impossibles.
  useEffect(() => {
    if (!source) return;
    let cancelled = false;
    fetch(`/api/mouvements-depot?vue=etat&emplacement=${encodeURIComponent(source)}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const m: Record<string, number> = {};
        for (const r of (d.rows ?? []) as EtatRow[]) m[r.refArt] = r.quantite;
        setDispos(m);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [source]);

  const ajouter = () =>
    setLignes((l) => [...l, { key: newKey(), refArt: "", designation: "", quantite: 1 }]);
  const retirer = (key: string) => setLignes((l) => l.filter((x) => x.key !== key));
  const patch = (key: string, champ: keyof Ligne, val: unknown) =>
    setLignes((l) => l.map((x) => (x.key === key ? { ...x, [champ]: val } : x)));

  async function valider() {
    if (!destination) return onFlash("Sélectionnez la destination", false);
    if (lignes.length === 0) return onFlash("Ajoutez au moins une ligne", false);
    setBusy(true);
    const r = await fetch("/api/mouvements-depot", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        typeDoc, source: source || null, destination,
        lignes: lignes.map(({ refArt, designation, quantite }) => ({ refArt, designation, quantite })),
      }),
    }).then((x) => x.json()).catch(() => ({ ok: false, message: "réseau" }));
    setBusy(false);

    if (r.ok) {
      const alertes = r.alertes?.length ? `\n${r.alertes.join("\n")}` : "";
      onFlash((r.message ?? "Bon créé") + alertes);
      setLignes([]);
      onDone();
    } else {
      onFlash(r.message ?? r.error ?? "Échec", false);
    }
  }

  const total = lignes.reduce((s, l) => s + (Number(l.quantite) || 0), 0);

  return (
    <div className="space-y-3">
      <div className="grid sm:grid-cols-3 gap-3 p-3 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)]">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-[var(--text-secondary)]">
            Source ({cfg.source === "depot" ? "dépôt" : "véhicule"})
            {typeDoc !== "BRT" && <span className="text-red-500"> *</span>}
          </span>
          <select value={source} onChange={(e) => { setDispos({}); setSource(e.target.value); }}
            className="px-2.5 py-1.5 text-sm bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg focus:outline-none">
            <option value="">— Sélectionner —</option>
            {listeSource.map((e) => <option key={e.code} value={e.code}>{e.label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-[var(--text-secondary)]">
            Destination ({cfg.destination === "depot" ? "dépôt" : "véhicule"})
            <span className="text-red-500"> *</span>
          </span>
          <select value={destination} onChange={(e) => setDestination(e.target.value)}
            className="px-2.5 py-1.5 text-sm bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg focus:outline-none">
            <option value="">— Sélectionner —</option>
            {listeDest.filter((e) => e.code !== source).map((e) => <option key={e.code} value={e.code}>{e.label}</option>)}
          </select>
        </label>
        <div className="flex items-end">
          <button onClick={ajouter}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-white"
            style={{ background: accent }}>
            <Plus size={14} /> Ajouter une ligne
          </button>
        </div>
      </div>

      <div className="overflow-auto rounded-xl border border-[var(--border-primary)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--bg-primary)] border-b border-[var(--border-primary)]">
            <tr className="text-[11px] uppercase tracking-wide text-[var(--text-secondary)]">
              <th className="px-3 py-2.5 text-left font-semibold">Référence</th>
              <th className="px-3 py-2.5 text-left font-semibold">Désignation</th>
              {source && <th className="px-3 py-2.5 text-right font-semibold w-24">Dispo</th>}
              <th className="px-3 py-2.5 text-right font-semibold w-28">Quantité</th>
              <th className="px-3 py-2.5 w-12" />
            </tr>
          </thead>
          <tbody>
            {lignes.length === 0 && (
              <tr><td colSpan={source ? 5 : 4} className="py-10 text-center text-sm text-[var(--text-secondary)]">
                Aucune ligne — cliquez sur « Ajouter une ligne ».
              </td></tr>
            )}
            {lignes.map((l) => {
              const dispo = dispos[l.refArt];
              const insuffisant = source && l.refArt && (dispo ?? 0) < l.quantite;
              return (
                <tr key={l.key} className="border-b border-[var(--border-primary)]/60">
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-1">
                      <input value={l.refArt} onChange={(e) => patch(l.key, "refArt", e.target.value)}
                        className="w-28 px-2 py-1 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-md focus:outline-none" />
                      <button onClick={() => setPicker(l.key)} title="Rechercher un article"
                        className="p-1 rounded-md hover:bg-[var(--bg-primary)] text-[var(--text-secondary)]">
                        <Search size={14} />
                      </button>
                    </div>
                  </td>
                  <td className="px-3 py-1.5">
                    <input value={l.designation} onChange={(e) => patch(l.key, "designation", e.target.value)}
                      className="w-full px-2 py-1 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-md focus:outline-none" />
                  </td>
                  {source && (
                    <td className={`px-3 py-1.5 text-right tabular-nums ${insuffisant ? "text-red-600 font-bold" : "text-[var(--text-secondary)]"}`}>
                      {l.refArt ? (dispo ?? 0) : "—"}
                    </td>
                  )}
                  <td className="px-3 py-1.5">
                    <input type="number" step="any" min={0} value={String(l.quantite)}
                      onChange={(e) => patch(l.key, "quantite", e.target.value === "" ? 0 : Number(e.target.value))}
                      className={`w-full px-2 py-1 text-right tabular-nums bg-[var(--bg-primary)] border rounded-md focus:outline-none ${
                        insuffisant ? "border-red-400" : "border-[var(--border-primary)]"
                      }`} />
                  </td>
                  <td className="px-3 py-1.5">
                    <button onClick={() => retirer(l.key)} className="p-1 rounded-md text-red-600 hover:bg-red-500/10">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="text-sm text-[var(--text-secondary)]">
          {lignes.length} ligne(s) · quantité totale <b className="text-[var(--text-primary)]">{fmt(total)}</b>
        </div>
        <button onClick={valider} disabled={busy || lignes.length === 0 || !destination}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
          style={{ background: cfg.couleur }}>
          {busy ? <Loader2 className="animate-spin" size={15} /> : <Truck size={15} />} Valider le bon
        </button>
      </div>

      <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
        {typeDoc === "BST" && "La sortie diminue le stock global de l'article et l'affecte au véhicule."}
        {typeDoc === "BTR" && "Le transfert déplace la marchandise entre dépôts : le stock global reste inchangé."}
        {typeDoc === "BTV" && "Le transfert entre véhicules ne modifie pas le stock global."}
        {typeDoc === "BRT" && "Le retour réintègre la marchandise au dépôt et augmente le stock global."}
      </p>

      {picker && (
        <ArticlePicker accent={accent} onClose={() => setPicker(null)}
          onPick={(a) => {
            setLignes((ls) => ls.map((l) => l.key === picker
              ? { ...l, refArt: a.refArt, designation: a.designation } : l));
            setPicker(null);
          }} />
      )}
    </div>
  );
}

/* ----------------------------- État du stock ------------------------------ */

function Etat({ accent, reload, depots, vehicules }: {
  accent: string; reload: number; depots: Empl[]; vehicules: Empl[];
}) {
  const [rows, setRows] = useState<EtatRow[]>([]);
  const [parEmpl, setParEmpl] = useState<{ emplacement: string; refs: number; quantite: number; valeur: number }[]>([]);
  const [valeurTotale, setValeurTotale] = useState(0);
  const [filtre, setFiltre] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/mouvements-depot?vue=etat${filtre ? `&emplacement=${encodeURIComponent(filtre)}` : ""}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setRows(d.rows ?? []);
        setParEmpl(d.parEmplacement ?? []);
        setValeurTotale(d.valeurTotale ?? 0);
        setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [filtre, reload]);

  const tous = [...depots, ...vehicules];

  if (loading) return <Spin />;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Boxes size={16} style={{ color: accent }} />
        <select value={filtre} onChange={(e) => { setLoading(true); setFiltre(e.target.value); }}
          className="px-3 py-2 text-sm bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl">
          <option value="">Tous les emplacements</option>
          {tous.map((e) => <option key={e.code} value={e.code}>{e.label}</option>)}
        </select>
        <span className="ml-auto text-sm font-bold" style={{ color: accent }}>
          Valeur totale {fmt(valeurTotale)} TND
        </span>
      </div>

      {!filtre && parEmpl.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {parEmpl.slice(0, 8).map((e) => (
            <div key={e.emplacement} className="rounded-xl border border-[var(--border-primary)] px-3 py-2 bg-[var(--bg-card)]">
              <div className="text-xs font-bold text-[var(--text-primary)] truncate" title={e.emplacement}>{e.emplacement}</div>
              <div className="text-[10px] text-[var(--text-secondary)]">{e.refs} réf · {fmt(e.quantite)} u</div>
              <div className="text-sm font-bold tabular-nums" style={{ color: accent }}>{fmt(e.valeur)}</div>
            </div>
          ))}
        </div>
      )}

      <div className="overflow-auto rounded-xl border border-[var(--border-primary)] max-h-[50vh]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--bg-primary)] border-b border-[var(--border-primary)] sticky top-0 z-10">
            <tr className="text-[11px] uppercase tracking-wide text-[var(--text-secondary)]">
              <th className="px-4 py-2.5 text-left font-semibold">Emplacement</th>
              <th className="px-4 py-2.5 text-left font-semibold">Référence</th>
              <th className="px-4 py-2.5 text-left font-semibold">Désignation</th>
              <th className="px-4 py-2.5 text-right font-semibold">Quantité</th>
              <th className="px-4 py-2.5 text-right font-semibold">Valeur</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={5} className="py-12 text-center text-sm text-[var(--text-secondary)]">
                Aucun stock ventilé par emplacement. Créez un bon de sortie ou de transfert pour commencer.
              </td></tr>
            )}
            {rows.map((r) => (
              <tr key={`${r.emplacement}-${r.refArt}`} className="border-b border-[var(--border-primary)]/60 hover:bg-[var(--accent-light)]">
                <td className="px-4 py-2 font-medium text-[var(--text-primary)]">{r.emplacement}</td>
                <td className="px-4 py-2 font-mono text-xs">{r.refArt}</td>
                <td className="px-4 py-2 text-[var(--text-secondary)] truncate max-w-xs">{r.designation}</td>
                <td className={`px-4 py-2 text-right tabular-nums font-semibold ${r.quantite < 0 ? "text-red-600" : ""}`}>
                  {fmt(r.quantite)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">{fmt(r.valeur)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* -------------------------------- Historique ------------------------------ */

function Histo({ accent, reload }: { accent: string; reload: number }) {
  const [rows, setRows] = useState<Historique[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/mouvements-depot?vue=historique")
      .then((r) => r.json())
      .then((d) => { if (!cancelled) { setRows(d.rows ?? []); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [reload]);

  if (loading) return <Spin />;

  return (
    <div className="overflow-auto rounded-xl border border-[var(--border-primary)] max-h-[55vh]">
      <table className="w-full text-sm">
        <thead className="bg-[var(--bg-primary)] border-b border-[var(--border-primary)] sticky top-0 z-10">
          <tr className="text-[11px] uppercase tracking-wide text-[var(--text-secondary)]">
            <th className="px-4 py-2.5 text-left font-semibold">Bon</th>
            <th className="px-4 py-2.5 text-left font-semibold">Type</th>
            <th className="px-4 py-2.5 text-left font-semibold">Article</th>
            <th className="px-4 py-2.5 text-left font-semibold">Trajet</th>
            <th className="px-4 py-2.5 text-right font-semibold">Quantité</th>
            <th className="px-4 py-2.5 text-left font-semibold">Date</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={6} className="py-12 text-center text-sm text-[var(--text-secondary)]">
              Aucun mouvement enregistré.
            </td></tr>
          )}
          {rows.map((m) => (
            <motion.tr key={m.id} className="border-b border-[var(--border-primary)]/60 hover:bg-[var(--accent-light)]"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <td className="px-4 py-2 font-mono text-xs font-bold" style={{ color: accent }}>{m.refDoc ?? "—"}</td>
              <td className="px-4 py-2">
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-[var(--accent-light)] text-[var(--accent-primary)]">
                  {m.typeDoc ?? "—"}
                </span>
              </td>
              <td className="px-4 py-2">
                <div className="font-mono text-xs">{m.refArt}</div>
                <div className="text-[10px] text-[var(--text-secondary)] truncate max-w-[16rem]">{m.designation ?? ""}</div>
              </td>
              <td className="px-4 py-2 text-xs text-[var(--text-secondary)]">
                <span className="inline-flex items-center gap-1">
                  {m.source ?? "—"} <ArrowRight size={10} /> {m.destination ?? "—"}
                </span>
              </td>
              <td className="px-4 py-2 text-right tabular-nums font-semibold">{fmt(m.quantite)}</td>
              <td className="px-4 py-2 text-[var(--text-secondary)] text-xs">{fmtDate(m.createdAt)}</td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* -------------------------------- Communs --------------------------------- */

function ArticlePicker({ accent, onClose, onPick }: {
  accent: string; onClose: () => void; onPick: (a: Article) => void;
}) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      fetch(`/api/catalogue?limit=60${q ? `&search=${encodeURIComponent(q)}` : ""}`)
        .then((r) => r.json())
        .then((d) => { if (!cancelled) { setRows(d.rows ?? []); setLoading(false); } })
        .catch(() => { if (!cancelled) setLoading(false); });
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q]);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border-primary)]">
          <Search size={16} className="text-[var(--text-secondary)]" />
          <input autoFocus value={q} onChange={(e) => { setQ(e.target.value); setLoading(true); }}
            placeholder="Rechercher un article…"
            className="flex-1 px-2 py-1.5 text-sm bg-transparent focus:outline-none text-[var(--text-primary)]" />
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--bg-primary)] text-[var(--text-secondary)]">
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-auto">
          {loading && <div className="py-8 text-center text-sm text-[var(--text-secondary)]">Recherche…</div>}
          {!loading && rows.length === 0 && (
            <div className="py-8 text-center text-sm text-[var(--text-secondary)]">Aucun article trouvé.</div>
          )}
          {rows.map((a) => (
            <button key={a.refArt} onClick={() => onPick(a)}
              className="w-full text-left px-4 py-2.5 border-b border-[var(--border-primary)] hover:bg-[var(--bg-primary)] flex items-center gap-3">
              <Package size={14} className="text-[var(--text-secondary)] shrink-0" />
              <span className="text-xs font-mono text-[var(--text-secondary)] w-24 shrink-0 truncate">{a.refArt}</span>
              <span className="flex-1 text-sm text-[var(--text-primary)] truncate">{a.designation}</span>
              <span className="text-xs tabular-nums" style={{ color: accent }}>stock {a.enStock}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Spin() {
  return <div className="p-12 text-center text-[var(--text-secondary)]"><Loader2 className="animate-spin inline" size={20} /></div>;
}
