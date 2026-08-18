"use client";
import { useState, useEffect } from "react";
import { Download, Loader2, Package, Users, UserCheck, Map, Tags } from "lucide-react";

// Rapports de vente sur 5 axes — reprend `vente-module/rapports` de l'ERP source.
// CA = Σ(BL, TIC, FC) − Σ(BR, AV), calculé côté serveur.

const AXES = [
  { key: "article", label: "Par article", icon: Package },
  { key: "client", label: "Par client", icon: Users },
  { key: "commercial", label: "Par commercial", icon: UserCheck },
  { key: "gouvernorat", label: "Par gouvernorat", icon: Map },
  { key: "famille", label: "Par famille client", icon: Tags },
] as const;

type Ligne = { cle: string; libelle: string; qte: number; ht: number; ttc: number; docs: number };
type Resultat = {
  axe: string; rows: Ligne[]; total: number;
  totalHT: number; totalTTC: number; totalDocs: number;
  sansLignes?: boolean;
};

const fmt = (v: number) =>
  new Intl.NumberFormat("fr-TN", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(Number(v) || 0);

/** Premier jour du mois, 12 mois en arrière. */
function defautDu() {
  const d = new Date();
  d.setMonth(d.getMonth() - 11, 1);
  return d.toISOString().slice(0, 10);
}

export default function RapportsVente({ accent }: { accent: string }) {
  const [axe, setAxe] = useState<string>("client");
  const [du, setDu] = useState(defautDu());
  const [au, setAu] = useState(new Date().toISOString().slice(0, 10));
  const [applied, setApplied] = useState({ du: defautDu(), au: new Date().toISOString().slice(0, 10) });
  const [data, setData] = useState<Resultat | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/rapports-vente?axe=${axe}&du=${applied.du}&au=${applied.au}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) { setData(d); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [axe, applied]);

  function exportCsv() {
    if (!data) return;
    const head = ["Code", "Libellé", ...(axe === "article" ? ["Quantité"] : []), "Documents", "Total HT", "Total TTC"].join(";");
    const lines = data.rows.map((r) =>
      [r.cle, r.libelle.replace(/;/g, ","), ...(axe === "article" ? [r.qte] : []), r.docs, r.ht, r.ttc].join(";")
    );
    const csv = "﻿" + [head, ...lines].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = `rapport-vente-${axe}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const max = Math.max(1, ...(data?.rows ?? []).map((r) => Math.abs(r.ttc)));

  return (
    <div className="space-y-4">
      {/* Axes */}
      <div className="flex gap-1.5 flex-wrap">
        {AXES.map((a) => (
          <button key={a.key} onClick={() => { setLoading(true); setAxe(a.key); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
              axe === a.key ? "text-white border-transparent shadow-sm" : "bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border-primary)] hover:text-[var(--text-primary)]"
            }`}
            style={axe === a.key ? { background: accent } : undefined}>
            <a.icon size={13} /> {a.label}
          </button>
        ))}
      </div>

      {/* Période */}
      <div className="flex items-end gap-2 flex-wrap bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl p-3">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-[var(--text-secondary)]">Du</span>
          <input type="date" value={du} onChange={(e) => setDu(e.target.value)}
            className="px-2.5 py-1.5 text-sm bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg focus:outline-none" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-[var(--text-secondary)]">Au</span>
          <input type="date" value={au} onChange={(e) => setAu(e.target.value)}
            className="px-2.5 py-1.5 text-sm bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg focus:outline-none" />
        </label>
        <button onClick={() => { setLoading(true); setApplied({ du, au }); }}
          className="px-4 py-1.5 text-sm font-semibold text-white rounded-lg" style={{ background: accent }}>
          Appliquer
        </button>
        <button onClick={exportCsv} disabled={!data?.rows?.length}
          className="flex items-center gap-1.5 border border-[var(--border-primary)] text-emerald-600 px-3 py-1.5 rounded-lg text-sm disabled:opacity-40">
          <Download size={14} /> Excel
        </button>
      </div>

      {/* Totaux */}
      {data && !loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Tile label="Lignes" value={String(data.total)} accent={accent} />
          <Tile label="Documents" value={String(data.totalDocs)} accent={accent} />
          <Tile label="Total HT" value={`${fmt(data.totalHT)} TND`} accent={accent} />
          <Tile label="Total TTC" value={`${fmt(data.totalTTC)} TND`} accent={accent} strong />
        </div>
      )}

      {data?.sansLignes && (
        <div className="px-3 py-2 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 text-sm">
          Aucune ligne de document en base : le rapport par article se remplira au fur et à mesure
          de la saisie des lignes. Les autres axes fonctionnent sur les entêtes.
        </div>
      )}

      {/* Tableau */}
      <div className="overflow-auto rounded-xl border border-[var(--border-primary)] max-h-[55vh]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--bg-primary)] border-b border-[var(--border-primary)] sticky top-0 z-10">
            <tr className="text-[11px] uppercase tracking-wide text-[var(--text-secondary)]">
              <th className="px-3 py-2.5 text-left font-semibold">Code</th>
              <th className="px-3 py-2.5 text-left font-semibold">Libellé</th>
              {axe === "article" && <th className="px-3 py-2.5 text-right font-semibold">Qté</th>}
              <th className="px-3 py-2.5 text-right font-semibold">Docs</th>
              <th className="px-3 py-2.5 text-right font-semibold">Total HT</th>
              <th className="px-3 py-2.5 text-right font-semibold">Total TTC</th>
              <th className="px-3 py-2.5 w-32 font-semibold">Part</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} className="py-12 text-center text-[var(--text-secondary)]">
                <Loader2 className="animate-spin inline mr-2" size={18} /> Génération du rapport…
              </td></tr>
            )}
            {!loading && (data?.rows ?? []).length === 0 && (
              <tr><td colSpan={7} className="py-12 text-center text-[var(--text-secondary)] text-sm">
                Aucune donnée sur cette période.
              </td></tr>
            )}
            {!loading && (data?.rows ?? []).map((r) => (
              <tr key={r.cle} className="border-b border-[var(--border-primary)]/60 hover:bg-[var(--accent-light)]">
                <td className="px-3 py-2 font-mono text-xs text-[var(--text-secondary)]">{r.cle}</td>
                <td className="px-3 py-2 font-medium text-[var(--text-primary)]">{r.libelle}</td>
                {axe === "article" && <td className="px-3 py-2 text-right tabular-nums">{r.qte}</td>}
                <td className="px-3 py-2 text-right tabular-nums text-[var(--text-secondary)]">{r.docs}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmt(r.ht)}</td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold">{fmt(r.ttc)}</td>
                <td className="px-3 py-2">
                  <div className="h-1.5 rounded-full bg-[var(--bg-primary)] overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(Math.abs(r.ttc) / max) * 100}%`, background: accent }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Tile({ label, value, accent, strong }: { label: string; value: string; accent: string; strong?: boolean }) {
  return (
    <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-primary)] px-4 py-3">
      <div className="text-[10px] uppercase tracking-wide text-[var(--text-secondary)] font-semibold">{label}</div>
      <div className={`tabular-nums ${strong ? "text-lg font-extrabold" : "text-base font-bold"}`} style={strong ? { color: accent } : undefined}>
        {value}
      </div>
    </div>
  );
}
