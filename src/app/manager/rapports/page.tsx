"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { BarChart3, Download, TrendingUp, Users, AlertCircle, Package, Map, Loader2 } from "lucide-react";

type Ligne = { cle: string; libelle: string; qte: number; ht: number; ttc: number; docs: number };
type Resultat = { axe: string; rows: Ligne[]; total: number; totalHT: number; totalTTC: number; totalDocs: number };

const fmt = (v: unknown) =>
  new Intl.NumberFormat("fr-TN", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(Number(v) || 0);

/**
 * Rapports du manager — tous alimentés par `/api/rapports-vente`.
 * `unite` décrit ce que porte la colonne `qte` selon l'axe.
 */
const RAPPORTS = [
  { axe: "commercial", title: "Performance commerciaux", icon: TrendingUp, color: "#2563eb", desc: "CA et nombre de documents par commercial", colCle: "Commercial", unite: null },
  { axe: "creances", title: "Recouvrement & créances", icon: AlertCircle, color: "#dc2626", desc: "Balance âgée : <30j · 30–60j · 60–90j · >90j", colCle: "Tranche", unite: null },
  { axe: "article", title: "Produits les plus vendus", icon: Package, color: "#7c3aed", desc: "Classement des articles par chiffre d'affaires", colCle: "Référence", unite: "Qté" },
  { axe: "inactifs", title: "Clients inactifs", icon: Users, color: "#f59e0b", desc: "Sans achat depuis 30 jours ou plus", colCle: "Client", unite: "Jours" },
  { axe: "gouvernorat", title: "Ventes par région", icon: Map, color: "#16a34a", desc: "Répartition du CA par gouvernorat", colCle: "Gouvernorat", unite: null },
] as const;

function defautDu() {
  const d = new Date();
  d.setMonth(d.getMonth() - 11, 1);
  return d.toISOString().slice(0, 10);
}

export default function RapportsPage() {
  const [axe, setAxe] = useState<string>("commercial");
  const [du, setDu] = useState(defautDu());
  const [au, setAu] = useState(new Date().toISOString().slice(0, 10));
  const [applied, setApplied] = useState({ du: defautDu(), au: new Date().toISOString().slice(0, 10) });
  const [data, setData] = useState<Resultat | null>(null);
  const [loading, setLoading] = useState(true);

  const rapport = RAPPORTS.find((r) => r.axe === axe)!;

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
    const head = [rapport.colCle, "Libellé", ...(rapport.unite ? [rapport.unite] : []), "Documents", "Montant"].join(";");
    const lines = data.rows.map((r) =>
      [r.cle, r.libelle.replace(/;/g, ","), ...(rapport.unite ? [r.qte] : []), r.docs, r.ttc].join(";")
    );
    const csv = "﻿" + [head, ...lines].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = `rapport-${axe}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const max = Math.max(1, ...(data?.rows ?? []).map((r) => Math.abs(r.ttc)));
  // La période ne s'applique pas aux créances (photo à l'instant T).
  const periodePertinente = axe !== "creances";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Rapports</h1>
          <p className="text-[var(--text-secondary)] text-sm">Générés depuis les données réelles de l&apos;ERP</p>
        </div>
        <button onClick={exportCsv} disabled={!data?.rows?.length}
          className="flex items-center gap-1.5 border border-[var(--border-primary)] text-emerald-600 px-3 py-2 rounded-xl text-sm disabled:opacity-40">
          <Download size={15} /> Exporter Excel
        </button>
      </div>

      {/* Choix du rapport */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {RAPPORTS.map((r) => {
          const on = axe === r.axe;
          return (
            <button key={r.axe} onClick={() => { setLoading(true); setAxe(r.axe); }}
              className={`text-left p-4 rounded-2xl border transition ${
                on ? "border-transparent shadow-md text-white" : "bg-[var(--bg-card)] border-[var(--border-primary)] hover:shadow-sm"
              }`}
              style={on ? { background: r.color } : undefined}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2 ${on ? "bg-white/20" : ""}`}
                style={on ? undefined : { background: r.color + "18", color: r.color }}>
                <r.icon size={17} />
              </div>
              <div className="font-bold text-sm">{r.title}</div>
              <div className={`text-xs mt-0.5 leading-snug ${on ? "opacity-80" : "text-[var(--text-secondary)]"}`}>{r.desc}</div>
            </button>
          );
        })}
      </div>

      {/* Période */}
      <div className="flex items-end gap-2 flex-wrap bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl p-3">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-[var(--text-secondary)]">Du</span>
          <input type="date" value={du} onChange={(e) => setDu(e.target.value)} disabled={!periodePertinente}
            className="px-2.5 py-1.5 text-sm bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg focus:outline-none disabled:opacity-50" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-[var(--text-secondary)]">Au</span>
          <input type="date" value={au} onChange={(e) => setAu(e.target.value)} disabled={!periodePertinente}
            className="px-2.5 py-1.5 text-sm bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg focus:outline-none disabled:opacity-50" />
        </label>
        <button onClick={() => { setLoading(true); setApplied({ du, au }); }} disabled={!periodePertinente}
          className="px-4 py-1.5 text-sm font-semibold text-white rounded-lg disabled:opacity-50" style={{ background: rapport.color }}>
          Appliquer
        </button>
        {!periodePertinente && (
          <span className="text-xs text-[var(--text-secondary)] pb-1.5">
            Les créances sont une photo à l&apos;instant présent — la période ne s&apos;applique pas.
          </span>
        )}
      </div>

      {/* Totaux */}
      {data && !loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Tile label="Lignes" value={String(data.total)} color={rapport.color} />
          <Tile label="Documents" value={String(data.totalDocs)} color={rapport.color} />
          <Tile label={axe === "creances" ? "Total créances" : "Total TTC"} value={`${fmt(data.totalTTC)} TND`} color={rapport.color} strong />
        </div>
      )}

      {/* Tableau */}
      <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-primary)] shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--border-primary)] flex items-center gap-2">
          <BarChart3 size={16} style={{ color: rapport.color }} />
          <span className="font-bold text-[var(--text-primary)] text-sm">{rapport.title}</span>
        </div>
        <div className="overflow-auto max-h-[55vh]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg-primary)] border-b border-[var(--border-primary)] sticky top-0 z-10">
              <tr className="text-[11px] uppercase tracking-wide text-[var(--text-secondary)]">
                <th className="px-4 py-2.5 text-left font-semibold">{rapport.colCle}</th>
                {rapport.unite && <th className="px-4 py-2.5 text-right font-semibold">{rapport.unite}</th>}
                <th className="px-4 py-2.5 text-right font-semibold">Documents</th>
                <th className="px-4 py-2.5 text-right font-semibold">Montant</th>
                <th className="px-4 py-2.5 w-32 font-semibold">Part</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={5} className="py-12 text-center text-[var(--text-secondary)]">
                  <Loader2 className="animate-spin inline mr-2" size={18} /> Génération du rapport…
                </td></tr>
              )}
              {!loading && (data?.rows ?? []).length === 0 && (
                <tr><td colSpan={5} className="py-12 text-center text-sm text-[var(--text-secondary)]">
                  {axe === "article"
                    ? "Aucune ligne de document en base : ce rapport se remplira à mesure de la saisie."
                    : "Aucune donnée sur cette période."}
                </td></tr>
              )}
              {!loading && (data?.rows ?? []).map((r, i) => (
                <motion.tr key={r.cle} className="border-b border-[var(--border-primary)]/60 hover:bg-[var(--accent-light)]"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.015, 0.25) }}>
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-[var(--text-primary)] truncate max-w-xs" title={r.libelle}>{r.libelle}</div>
                    {r.cle !== r.libelle && <div className="text-[10px] font-mono text-[var(--text-secondary)]">{r.cle}</div>}
                  </td>
                  {rapport.unite && (
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {axe === "inactifs" ? `${r.qte} j` : r.qte}
                    </td>
                  )}
                  <td className="px-4 py-2.5 text-right tabular-nums text-[var(--text-secondary)]">{r.docs}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold">{fmt(r.ttc)}</td>
                  <td className="px-4 py-2.5">
                    <div className="h-1.5 rounded-full bg-[var(--bg-primary)] overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(Math.abs(r.ttc) / max) * 100}%`, background: rapport.color }} />
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Tile({ label, value, color, strong }: { label: string; value: string; color: string; strong?: boolean }) {
  return (
    <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-primary)] px-4 py-3">
      <div className="text-[10px] uppercase tracking-wide text-[var(--text-secondary)] font-semibold">{label}</div>
      <div className={`tabular-nums ${strong ? "text-lg font-extrabold" : "text-base font-bold"}`} style={strong ? { color } : undefined}>
        {value}
      </div>
    </div>
  );
}
