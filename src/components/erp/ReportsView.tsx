"use client";
import { useState, useEffect } from "react";
import { BarChart3, TrendingUp, FileText, Users } from "lucide-react";
import RapportsVente from "@/components/erp/RapportsVente";

type Report = {
  kpis: Record<string, number>;
  parType: { type: string; count: number; total: number }[];
  parMois: { mois: string; total: number }[];
  topTiers: { nom: string; total: number }[];
};
const fmt0 = (n: number) => new Intl.NumberFormat("fr-TN", { maximumFractionDigits: 0 }).format(n ?? 0);
const KPI_LABEL: Record<string, string> = {
  totalHT: "Total HT", totalTTC: "Total TTC", totalTVA: "Total TVA", nbDocuments: "Documents",
  nbTiers: "Tiers", soldeTiers: "Solde tiers", debit: "Débit", credit: "Crédit", nbCharges: "Charges",
  nbMissions: "Missions", kmTotal: "Km parcourus",
};

export default function ReportsView({ scope, accent }: { scope: string; accent: string }) {
  const [data, setData] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/erp?resource=reports&scope=${scope}`).then((r) => r.json()).then((d) => { if (!cancelled) { setData(d); setLoading(false); } });
    return () => { cancelled = true; };
  }, [scope]);

  // Le module Vente dispose des 5 axes détaillés de l'ERP source.
  if (scope === "vente") return <RapportsVente accent={accent} />;

  if (loading || !data) return <div className="p-12 text-center text-[var(--text-secondary)]">Génération du rapport…</div>;

  const kpiEntries = Object.entries(data.kpis);
  const maxType = Math.max(1, ...data.parType.map((t) => Math.abs(t.total || t.count)));
  const maxMois = Math.max(1, ...data.parMois.map((m) => m.total));
  const isMoney = scope === "vente" || scope === "achat" || scope === "charge";

  return (
    <div className="space-y-4">
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiEntries.map(([k, v]) => (
          <div key={k} className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-primary)] shadow-sm p-5">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: accent + "1a", color: accent }}>
              {k.startsWith("nb") ? <FileText size={18} /> : <TrendingUp size={18} />}
            </div>
            <div className="text-2xl font-extrabold tracking-tight" style={{ color: accent }}>{fmt0(v)}{/HT|TTC|TVA|solde|debit|credit/i.test(k) ? " TND" : ""}</div>
            <div className="text-[var(--text-secondary)] font-bold text-xs mt-1">{KPI_LABEL[k] ?? k}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Répartition par type / état */}
        <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-primary)] shadow-sm p-5">
          <h3 className="font-bold text-sm mb-4 flex items-center gap-2"><BarChart3 size={15} style={{ color: accent }} /> Répartition</h3>
          <div className="space-y-3">
            {data.parType.map((t) => (
              <div key={t.type}>
                <div className="flex justify-between text-xs mb-1"><span className="font-semibold">{t.type} <span className="opacity-60">({t.count})</span></span><span className="font-mono font-bold">{isMoney ? fmt0(t.total) + " TND" : t.count}</span></div>
                <div className="w-full bg-[var(--bg-primary)] h-2 rounded-full overflow-hidden border border-[var(--border-primary)]">
                  <div className="h-full rounded-full" style={{ width: `${(Math.abs(t.total || t.count) / maxType) * 100}%`, background: accent }} />
                </div>
              </div>
            ))}
            {data.parType.length === 0 && <p className="text-slate-400 text-xs py-6 text-center">Aucune donnée</p>}
          </div>
        </div>

        {/* Top tiers / commerciaux */}
        <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-primary)] shadow-sm p-5">
          <h3 className="font-bold text-sm mb-4 flex items-center gap-2"><Users size={15} style={{ color: accent }} /> Top {scope === "tourner" ? "commerciaux" : "tiers"}</h3>
          <div className="space-y-2">
            {data.topTiers.map((t, i) => (
              <div key={t.nom + i} className="flex items-center gap-3 py-1.5 border-b border-[var(--border-primary)]/40 last:border-0">
                <span className="w-6 h-6 rounded-lg bg-[var(--accent-light)] flex items-center justify-center text-xs font-black" style={{ color: accent }}>{i + 1}</span>
                <span className="flex-1 min-w-0 truncate text-xs font-medium">{t.nom}</span>
                <span className="font-mono font-bold text-xs" style={{ color: accent }}>{isMoney ? fmt0(t.total) + " TND" : t.total}</span>
              </div>
            ))}
            {data.topTiers.length === 0 && <p className="text-slate-400 text-xs py-6 text-center">Aucune donnée</p>}
          </div>
        </div>
      </div>

      {/* Evolution mensuelle */}
      {data.parMois.length > 0 && (
        <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-primary)] shadow-sm p-5">
          <h3 className="font-bold text-sm mb-4 flex items-center gap-2"><TrendingUp size={15} style={{ color: accent }} /> Évolution mensuelle (12 derniers mois)</h3>
          <div className="flex items-end gap-2 h-40">
            {data.parMois.map((m) => (
              <div key={m.mois} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                <div className="w-full rounded-t transition-all" style={{ height: `${(m.total / maxMois) * 100}%`, background: accent, minHeight: "2px" }} title={`${fmt0(m.total)} TND`} />
                <span className="text-[9px] text-[var(--text-secondary)] rotate-45 origin-left whitespace-nowrap mt-1">{m.mois}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
