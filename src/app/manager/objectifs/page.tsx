"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Target, Loader2, Save, Check, TrendingUp, Users } from "lucide-react";

type Row = {
  vendeur: string; objectifCA: number; ca: number; docs: number; clients: number;
  pct: number | null; ecart: number | null;
};
type Data = { mois: number; annee: number; rows: Row[]; totalCA: number; totalObjectif: number; sansObjectif: number };

const fmt = (v: unknown) =>
  new Intl.NumberFormat("fr-TN", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(Number(v) || 0);
const fmt0 = (v: unknown) => new Intl.NumberFormat("fr-TN", { maximumFractionDigits: 0 }).format(Number(v) || 0);

const MOIS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

const ANNEE_COURANTE = new Date().getFullYear();
const ANNEES = [ANNEE_COURANTE, ANNEE_COURANTE - 1, ANNEE_COURANTE - 2];

export default function ObjectifsPage() {
  // Le mois n'est pas imposé au premier chargement : l'API se cale sur le
  // dernier mois ayant des ventes (la base ERP est un import figé, le mois
  // courant y est souvent vide). L'utilisateur reprend la main ensuite.
  const [mois, setMois] = useState<number | null>(null);
  const [annee, setAnnee] = useState<number | null>(null);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const qs = mois != null && annee != null ? `?mois=${mois}&annee=${annee}` : "";
    fetch(`/api/objectifs${qs}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setEdits({});
        setLoading(false);
        // Première réponse : on adopte la période choisie par l'API.
        if (mois == null && d?.mois) { setMois(d.mois); setAnnee(d.annee); }
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [mois, annee, reload]);

  // Période affichée : la sélection de l'utilisateur, sinon celle de l'API.
  const moisAffiche = mois ?? data?.mois ?? null;
  const anneeAffichee = annee ?? data?.annee ?? null;

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3000); };

  async function save(vendeur: string) {
    const val = Number(edits[vendeur]);
    if (!Number.isFinite(val) || val < 0) return;
    setBusy(vendeur);
    const r = await fetch("/api/objectifs", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      // Enregistre sur la période affichée, y compris celle choisie par l'API.
      body: JSON.stringify({ vendeur, mois: moisAffiche, annee: anneeAffichee, objectifCA: val }),
    }).then((x) => x.json()).catch(() => ({ error: "réseau" }));
    setBusy(null);
    if (r.ok) { flash(r.message ?? "Objectif enregistré"); setReload((k) => k + 1); }
    else flash(r.error ?? "Échec");
  }

  const rows = data?.rows ?? [];
  const pctGlobal = data && data.totalObjectif > 0 ? Math.round((data.totalCA / data.totalObjectif) * 100) : null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Objectifs &amp; performance</h1>
          <p className="text-[var(--text-secondary)] text-sm">
            {loading ? "Chargement…" : `${rows.length} vendeur(s) — ${MOIS[(moisAffiche ?? 1) - 1]} ${anneeAffichee ?? ""}`}
          </p>
        </div>
        <div className="flex gap-2">
          <select value={moisAffiche ?? ""} onChange={(e) => { setLoading(true); setMois(Number(e.target.value)); }}
            className="px-3 py-2 text-sm bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl focus:outline-none">
            {MOIS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <select value={anneeAffichee ?? ""} onChange={(e) => { setLoading(true); setAnnee(Number(e.target.value)); }}
            className="px-3 py-2 text-sm bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl focus:outline-none">
            {ANNEES.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {toast && (
        <div className="px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-sm font-medium flex items-center gap-2">
          <Check size={15} /> {toast}
        </div>
      )}

      {!loading && data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Kpi label="CA réalisé" value={`${fmt0(data.totalCA)} TND`} color="#2563eb" icon={TrendingUp} />
          <Kpi label="Objectif total" value={`${fmt0(data.totalObjectif)} TND`} color="#7c3aed" icon={Target} />
          <Kpi label="Atteinte globale" value={pctGlobal != null ? `${pctGlobal} %` : "—"}
            color={pctGlobal == null ? "#64748b" : pctGlobal >= 100 ? "#16a34a" : pctGlobal >= 80 ? "#2563eb" : "#f59e0b"} icon={Target} />
          <Kpi label="Sans objectif" value={String(data.sansObjectif)} color="#f59e0b" icon={Users} />
        </div>
      )}

      {data && data.sansObjectif > 0 && (
        <div className="px-4 py-2.5 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-400 text-sm">
          {data.sansObjectif} vendeur(s) sans objectif fixé pour ce mois — saisissez un montant pour activer le suivi.
        </div>
      )}

      {loading && <div className="py-16 text-center text-[var(--text-secondary)]"><Loader2 className="animate-spin inline" size={22} /></div>}

      {!loading && rows.length === 0 && (
        <div className="py-16 text-center text-sm text-[var(--text-secondary)]">
          Aucune activité commerciale sur {MOIS[(moisAffiche ?? 1) - 1]} {anneeAffichee ?? ""}.
        </div>
      )}

      <div className="grid gap-4">
        {!loading && rows.map((c, i) => {
          const pct = c.pct;
          const color = pct == null ? "#64748b" : pct >= 100 ? "#16a34a" : pct >= 80 ? "#2563eb" : "#f59e0b";
          const edited = edits[c.vendeur] !== undefined;
          return (
            <motion.div key={c.vendeur} className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-primary)] shadow-sm p-5"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.04, 0.3) }}>
              <div className="flex items-start justify-between mb-4 gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400 font-bold flex items-center justify-center text-sm shrink-0">
                    {c.vendeur.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-[var(--text-primary)] truncate">{c.vendeur}</div>
                    <div className="text-[var(--text-secondary)] text-xs">
                      {c.clients} client(s) · {c.docs} document(s)
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-2xl font-bold" style={{ color }}>{pct != null ? `${pct}%` : "—"}</div>
                  <div className="text-[var(--text-secondary)] text-xs">{pct != null ? "de l'objectif" : "sans objectif"}</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-4">
                <Cell label="CA réalisé" value={`${fmt(c.ca)} TND`} />
                <div className="bg-[var(--bg-primary)] rounded-xl p-3 text-center">
                  <div className="text-xs text-[var(--text-secondary)] mb-1">Objectif</div>
                  <div className="flex items-center gap-1">
                    <input type="number" step="any"
                      value={edits[c.vendeur] ?? String(c.objectifCA || "")}
                      onChange={(e) => setEdits((p) => ({ ...p, [c.vendeur]: e.target.value }))}
                      placeholder="0"
                      className="w-full px-2 py-1 text-sm text-center font-bold bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg focus:outline-none tabular-nums" />
                    <button onClick={() => save(c.vendeur)} disabled={!edited || busy === c.vendeur}
                      title="Enregistrer l'objectif"
                      className="p-1.5 rounded-lg text-white bg-blue-600 disabled:opacity-30 shrink-0">
                      {busy === c.vendeur ? <Loader2 className="animate-spin" size={13} /> : <Save size={13} />}
                    </button>
                  </div>
                </div>
                <Cell label="Écart" value={c.ecart != null ? `${fmt(c.ecart)} TND` : "—"}
                  color={c.ecart == null ? undefined : c.ecart >= 0 ? "text-emerald-600" : "text-red-600"} />
              </div>

              <div className="h-2 bg-[var(--bg-primary)] rounded-full overflow-hidden">
                <motion.div className="h-full rounded-full" style={{ background: color }}
                  initial={{ width: 0 }} animate={{ width: `${Math.min(100, pct ?? 0)}%` }} transition={{ duration: 0.8 }} />
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function Cell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-[var(--bg-primary)] rounded-xl p-3 text-center">
      <div className="text-xs text-[var(--text-secondary)] mb-1">{label}</div>
      <div className={`font-bold tabular-nums text-sm ${color ?? "text-[var(--text-primary)]"}`}>{value}</div>
    </div>
  );
}

function Kpi({ label, value, color, icon: Icon }: { label: string; value: string; color: string; icon: React.ElementType }) {
  return (
    <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-primary)] shadow-sm p-5">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: color + "18", color }}>
        <Icon size={18} />
      </div>
      <div className="text-xl font-bold" style={{ color }}>{value}</div>
      <div className="text-[var(--text-secondary)] text-sm mt-1">{label}</div>
    </div>
  );
}
