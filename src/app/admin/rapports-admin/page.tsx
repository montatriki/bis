"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { TrendingUp, Users, Package, Download, Printer, Loader2, Map, AlertCircle } from "lucide-react";

// Rapports de direction — alimentés par les API réelles :
//   /api/dashboard (CA, stock, créances) et /api/rapports-vente (axes détaillés).

type Ligne = { cle: string; libelle: string; qte: number; ht: number; ttc: number; docs: number };
type Resultat = { rows: Ligne[]; total: number; totalHT: number; totalTTC: number; totalDocs: number };
type Dash = {
  kpis: { ca: number; nbDocs: number; valeurStock: number; creances: number; encaissements: number;
    nbClients: number; nbArticles: number; ruptures: number; sousMini: number; tauxRupture: number };
  serie: { mois: string; ca: number; docs: number }[];
  topRuptures?: { refArt: string; designation: string; enStock: number; stMin: number }[];
};

const RAPPORTS = [
  { id: "ca_mensuel", axe: null, title: "CA mensuel global", icon: TrendingUp, color: "#2563eb", desc: "Évolution du chiffre d'affaires sur 12 mois" },
  { id: "soldes_clients", axe: "creances", title: "État des créances", icon: AlertCircle, color: "#dc2626", desc: "Balance âgée par ancienneté" },
  { id: "stock_rapport", axe: null, title: "Valorisation du stock", icon: Package, color: "#16a34a", desc: "Valeur, ruptures et articles sous minimum" },
  { id: "perf_commerciaux", axe: "commercial", title: "Performance commerciaux", icon: Users, color: "#f59e0b", desc: "CA et documents par vendeur" },
  { id: "ventes_region", axe: "gouvernorat", title: "Ventes par région", icon: Map, color: "#7c3aed", desc: "Répartition géographique du CA" },
] as const;

const fmt = (v: unknown) =>
  new Intl.NumberFormat("fr-TN", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(Number(v) || 0);
const fmt0 = (v: unknown) => new Intl.NumberFormat("fr-TN", { maximumFractionDigits: 0 }).format(Number(v) || 0);

export default function RapportsAdminPage() {
  const [active, setActive] = useState<string>("ca_mensuel");
  const [dash, setDash] = useState<Dash | null>(null);
  const [detail, setDetail] = useState<Resultat | null>(null);
  const [loading, setLoading] = useState(true);

  const rapport = RAPPORTS.find((r) => r.id === active)!;

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard?scope=admin")
      .then((r) => r.json())
      .then((d) => { if (!cancelled) { setDash(d); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!rapport.axe) return;
    let cancelled = false;
    fetch(`/api/rapports-vente?axe=${rapport.axe}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setDetail(d); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [rapport.axe]);

  function selectRapport(id: string) {
    setActive(id);
    setDetail(null);
  }

  function exportCsv() {
    let head = "";
    let lines: string[] = [];
    if (rapport.id === "ca_mensuel" && dash) {
      head = ["Mois", "CA", "Documents"].join(";");
      lines = dash.serie.map((m) => [m.mois, m.ca, m.docs].join(";"));
    } else if (rapport.id === "stock_rapport" && dash) {
      head = ["Référence", "Désignation", "Stock", "Stock mini"].join(";");
      lines = (dash.topRuptures ?? []).map((a) => [a.refArt, a.designation.replace(/;/g, ","), a.enStock, a.stMin].join(";"));
    } else if (detail) {
      head = ["Code", "Libellé", "Documents", "Montant"].join(";");
      lines = detail.rows.map((r) => [r.cle, r.libelle.replace(/;/g, ","), r.docs, r.ttc].join(";"));
    }
    if (!head) return;
    const csv = "﻿" + [head, ...lines].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = `${rapport.id}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return <div className="py-24 text-center text-[var(--text-secondary)]"><Loader2 className="animate-spin mx-auto mb-3" size={26} /> Chargement…</div>;
  }

  const k = dash?.kpis;
  const maxSerie = Math.max(1, ...(dash?.serie ?? []).map((x) => Math.abs(x.ca)));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Rapports &amp; analyses</h1>
          <p className="text-[var(--text-secondary)] text-sm">Synthèse calculée sur les données réelles de l&apos;ERP</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCsv}
            className="flex items-center gap-1.5 border border-[var(--border-primary)] text-emerald-600 px-3 py-2 rounded-xl text-sm">
            <Download size={15} /> Excel
          </button>
          <button onClick={() => window.print()}
            className="flex items-center gap-1.5 border border-[var(--border-primary)] text-[var(--text-secondary)] px-3 py-2 rounded-xl text-sm">
            <Printer size={15} /> Imprimer
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Chiffre d'affaires" value={`${fmt0(k?.ca)} TND`} sub={`${fmt0(k?.nbDocs)} documents`} color="#2563eb" icon={TrendingUp} />
        <Kpi label="Créances clients" value={`${fmt0(k?.creances)} TND`} sub={`${fmt0(k?.nbClients)} clients`} color="#dc2626" icon={AlertCircle} />
        <Kpi label="Valeur du stock" value={`${fmt0(k?.valeurStock)} TND`} sub={`${fmt0(k?.nbArticles)} articles`} color="#16a34a" icon={Package} />
        <Kpi label="Encaissements" value={`${fmt0(k?.encaissements)} TND`} sub="Règlements clients" color="#7c3aed" icon={Users} />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {RAPPORTS.map((r) => {
          const on = active === r.id;
          return (
            <button key={r.id} onClick={() => selectRapport(r.id)}
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

      <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-primary)] shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--border-primary)] flex items-center gap-2">
          <rapport.icon size={16} style={{ color: rapport.color }} />
          <span className="font-bold text-[var(--text-primary)] text-sm">{rapport.title}</span>
        </div>

        {rapport.id === "ca_mensuel" && (
          <div className="p-5">
            <div className="flex items-end gap-1.5 h-48 overflow-x-auto mb-4">
              {(dash?.serie ?? []).map((m) => (
                <div key={m.mois} className="flex-1 min-w-[42px] flex flex-col items-center gap-1 group">
                  <span className="text-[9px] text-[var(--text-secondary)] opacity-0 group-hover:opacity-100 transition tabular-nums">
                    {fmt0(m.ca)}
                  </span>
                  <motion.div className="w-full rounded-t-md" style={{ background: rapport.color, opacity: 0.85 }}
                    initial={{ height: 0 }} animate={{ height: `${Math.max(2, (Math.abs(m.ca) / maxSerie) * 100)}%` }}
                    transition={{ duration: 0.6 }} title={`${m.mois} : ${fmt(m.ca)} TND`} />
                  <span className="text-[9px] text-[var(--text-secondary)] whitespace-nowrap">{m.mois}</span>
                </div>
              ))}
            </div>
            <table className="w-full text-sm">
              <thead className="bg-[var(--bg-primary)] border-y border-[var(--border-primary)]">
                <tr className="text-[11px] uppercase tracking-wide text-[var(--text-secondary)]">
                  <th className="px-4 py-2 text-left font-semibold">Mois</th>
                  <th className="px-4 py-2 text-right font-semibold">Documents</th>
                  <th className="px-4 py-2 text-right font-semibold">Chiffre d&apos;affaires</th>
                </tr>
              </thead>
              <tbody>
                {(dash?.serie ?? []).map((m) => (
                  <tr key={m.mois} className="border-b border-[var(--border-primary)]/60">
                    <td className="px-4 py-2 font-medium text-[var(--text-primary)]">{m.mois}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-[var(--text-secondary)]">{m.docs}</td>
                    <td className="px-4 py-2 text-right tabular-nums font-semibold">{fmt(m.ca)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {rapport.id === "stock_rapport" && (
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Tile label="Valeur totale" value={`${fmt0(k?.valeurStock)} TND`} color={rapport.color} strong />
              <Tile label="Articles" value={fmt0(k?.nbArticles)} color={rapport.color} />
              <Tile label="Ruptures" value={fmt0(k?.ruptures)} color="#dc2626" />
              <Tile label="Taux de rupture" value={`${k?.tauxRupture ?? 0} %`} color="#dc2626" />
            </div>
            <div>
              <div className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2">
                Articles en rupture
              </div>
              <table className="w-full text-sm">
                <thead className="bg-[var(--bg-primary)] border-y border-[var(--border-primary)]">
                  <tr className="text-[11px] uppercase tracking-wide text-[var(--text-secondary)]">
                    <th className="px-4 py-2 text-left font-semibold">Référence</th>
                    <th className="px-4 py-2 text-left font-semibold">Désignation</th>
                    <th className="px-4 py-2 text-right font-semibold">Stock</th>
                    <th className="px-4 py-2 text-right font-semibold">Minimum</th>
                  </tr>
                </thead>
                <tbody>
                  {(dash?.topRuptures ?? []).length === 0 && (
                    <tr><td colSpan={4} className="py-8 text-center text-sm text-[var(--text-secondary)]">Aucune rupture.</td></tr>
                  )}
                  {(dash?.topRuptures ?? []).map((a) => (
                    <tr key={a.refArt} className="border-b border-[var(--border-primary)]/60">
                      <td className="px-4 py-2 font-mono text-xs">{a.refArt}</td>
                      <td className="px-4 py-2 text-[var(--text-primary)]">{a.designation}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-red-600 font-semibold">{a.enStock}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-[var(--text-secondary)]">{a.stMin}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {rapport.axe && (
          <div className="overflow-auto max-h-[55vh]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--bg-primary)] border-b border-[var(--border-primary)] sticky top-0">
                <tr className="text-[11px] uppercase tracking-wide text-[var(--text-secondary)]">
                  <th className="px-4 py-2.5 text-left font-semibold">Libellé</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Documents</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Montant</th>
                  <th className="px-4 py-2.5 w-32 font-semibold">Part</th>
                </tr>
              </thead>
              <tbody>
                {!detail && (
                  <tr><td colSpan={4} className="py-12 text-center text-[var(--text-secondary)]">
                    <Loader2 className="animate-spin inline mr-2" size={18} /> Génération…
                  </td></tr>
                )}
                {detail?.rows.length === 0 && (
                  <tr><td colSpan={4} className="py-12 text-center text-sm text-[var(--text-secondary)]">Aucune donnée.</td></tr>
                )}
                {detail?.rows.map((r) => {
                  const max = Math.max(1, ...detail.rows.map((x) => Math.abs(x.ttc)));
                  return (
                    <tr key={r.cle} className="border-b border-[var(--border-primary)]/60 hover:bg-[var(--accent-light)]">
                      <td className="px-4 py-2.5 font-medium text-[var(--text-primary)]">{r.libelle}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-[var(--text-secondary)]">{r.docs}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-semibold">{fmt(r.ttc)}</td>
                      <td className="px-4 py-2.5">
                        <div className="h-1.5 rounded-full bg-[var(--bg-primary)] overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${(Math.abs(r.ttc) / max) * 100}%`, background: rapport.color }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {detail && detail.rows.length > 0 && (
                <tfoot className="bg-[var(--bg-primary)] border-t-2 border-[var(--border-primary)]">
                  <tr>
                    <td className="px-4 py-2.5 font-bold text-xs uppercase tracking-wide">Total</td>
                    <td className="px-4 py-2.5 text-right font-bold tabular-nums">{detail.totalDocs}</td>
                    <td className="px-4 py-2.5 text-right font-black tabular-nums" style={{ color: rapport.color }}>
                      {fmt(detail.totalTTC)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, color, icon: Icon }: {
  label: string; value: string; sub: string; color: string; icon: React.ElementType;
}) {
  return (
    <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-primary)] shadow-sm p-5">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: color + "18", color }}>
        <Icon size={18} />
      </div>
      <div className="text-xl font-bold" style={{ color }}>{value}</div>
      <div className="text-[var(--text-secondary)] text-sm mt-1">{label}</div>
      <div className="text-[var(--text-secondary)] opacity-70 text-xs mt-0.5">{sub}</div>
    </div>
  );
}

function Tile({ label, value, color, strong }: { label: string; value: string; color: string; strong?: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--border-primary)] px-4 py-3">
      <div className="text-[10px] uppercase tracking-wide text-[var(--text-secondary)] font-semibold">{label}</div>
      <div className={`tabular-nums ${strong ? "text-lg font-extrabold" : "text-base font-bold"}`} style={strong ? { color } : undefined}>
        {value}
      </div>
    </div>
  );
}
