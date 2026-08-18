"use client";
import { motion } from "framer-motion";
import { TrendingUp, CheckSquare, AlertTriangle, Users, ArrowRight, FileText, Target, Loader2, Package } from "lucide-react";
import Link from "next/link";
import { useDashboard, fmtMoney, fmtCompact, fmtInt } from "@/lib/use-dashboard";

export default function ManagerDashboard() {
  const { data, loading, error } = useDashboard("manager");

  if (loading) {
    return <div className="py-24 text-center text-[var(--text-secondary)]"><Loader2 className="animate-spin mx-auto mb-3" size={26} /> Chargement des données…</div>;
  }
  if (error) {
    return <div className="p-6 rounded-2xl bg-red-500/10 text-red-600 text-sm">{error}</div>;
  }

  const k = data?.kpis;
  const aValider = data?.aValider ?? [];
  const parCom = data?.parCommercial ?? [];
  const maxCA = Math.max(1, ...parCom.map((c) => c.ca));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Tableau de bord Manager</h1>
          <p className="text-[var(--text-secondary)] text-sm">
            {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} — Supervision
          </p>
        </div>
        {(data?.docsNonValides ?? 0) > 0 && (
          <div className="flex items-center gap-2 bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 px-4 py-2 rounded-xl text-sm font-semibold">
            <AlertTriangle size={15} /> {fmtInt(data?.docsNonValides)} document(s) en attente de validation
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="CA (12 mois)" value={`${fmtCompact(k?.ca)} TND`} sub={`${fmtInt(k?.nbDocs)} documents`} icon={TrendingUp} color="#2563eb" />
        <Kpi label="Créances clients" value={`${fmtCompact(k?.creances)} TND`} sub={`${fmtInt(k?.nbClients)} clients`} icon={Target} color="#dc2626" />
        <Kpi label="Encaissements" value={`${fmtCompact(k?.encaissements)} TND`} sub="Règlements clients" icon={CheckSquare} color="#16a34a" />
        <Kpi label="Valeur du stock" value={`${fmtCompact(k?.valeurStock)} TND`} sub={`${fmtInt(k?.ruptures)} ruptures`} icon={Package} color="#f59e0b" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Documents à valider */}
        <div className="lg:col-span-2 bg-[var(--bg-card)] rounded-2xl border border-[var(--border-primary)] shadow-sm overflow-hidden">
          <div className="p-5 border-b border-[var(--border-primary)] flex items-center justify-between">
            <h2 className="font-bold text-[var(--text-primary)] flex items-center gap-2">
              <FileText size={16} className="text-amber-500" /> Documents à valider
            </h2>
            <Link href="/manager/validation" className="text-blue-600 text-sm hover:text-blue-500 flex items-center gap-1">
              Tout voir <ArrowRight size={14} />
            </Link>
          </div>
          <div className="divide-y divide-[var(--border-primary)]/60">
            {aValider.length === 0 && (
              <div className="px-5 py-10 text-center text-sm text-[var(--text-secondary)]">
                Aucun document en attente. Tout est validé.
              </div>
            )}
            {aValider.map((d, i) => (
              <motion.div key={d.refDoc} className="flex items-center gap-4 px-5 py-3.5 hover:bg-[var(--accent-light)] transition"
                initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
                <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400 shrink-0">
                  {d.typeDoc}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-[var(--text-primary)] text-sm truncate">{d.refDoc}</div>
                  <div className="text-[var(--text-secondary)] text-xs truncate">
                    {d.raisonSocial || "—"}
                    {d.dateDoc ? ` · ${new Date(d.dateDoc).toLocaleDateString("fr-FR")}` : ""}
                  </div>
                </div>
                <span className="font-bold text-[var(--text-primary)] text-sm tabular-nums shrink-0">{fmtMoney(d.ttcNet)} TND</span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Performance par commercial */}
        <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-primary)] shadow-sm overflow-hidden">
          <div className="p-5 border-b border-[var(--border-primary)]">
            <h2 className="font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Users size={16} className="text-emerald-500" /> Par commercial
            </h2>
          </div>
          <div className="p-4 space-y-3">
            {parCom.length === 0 && <div className="py-6 text-center text-sm text-[var(--text-secondary)]">Aucune donnée.</div>}
            {parCom.slice(0, 8).map((c) => (
              <div key={c.commercial} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--text-primary)] font-medium truncate">{c.commercial}</span>
                  <span className="font-bold tabular-nums text-[var(--text-primary)]">{fmtCompact(c.ca)}</span>
                </div>
                <div className="h-1.5 bg-[var(--bg-primary)] rounded-full overflow-hidden">
                  <motion.div className="h-full rounded-full bg-emerald-500"
                    initial={{ width: 0 }} animate={{ width: `${(c.ca / maxCA) * 100}%` }} transition={{ duration: 0.7 }} />
                </div>
                <div className="text-[10px] text-[var(--text-secondary)]">{c.docs} document(s)</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Évolution mensuelle */}
      <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-primary)] shadow-sm p-5">
        <h2 className="font-bold text-[var(--text-primary)] flex items-center gap-2 mb-4">
          <TrendingUp size={16} className="text-blue-500" /> Évolution du chiffre d&apos;affaires
        </h2>
        <MiniChart serie={data?.serie ?? []} />
      </div>

      {/* Top clients */}
      <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-primary)] shadow-sm overflow-hidden">
        <div className="p-5 border-b border-[var(--border-primary)]">
          <h2 className="font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Target size={16} className="text-purple-500" /> Meilleurs clients
          </h2>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg-primary)] border-b border-[var(--border-primary)]">
              <tr className="text-[11px] uppercase tracking-wide text-[var(--text-secondary)]">
                <th className="px-5 py-2.5 text-left font-semibold">Client</th>
                <th className="px-5 py-2.5 text-right font-semibold">Documents</th>
                <th className="px-5 py-2.5 text-right font-semibold">Chiffre d&apos;affaires</th>
              </tr>
            </thead>
            <tbody>
              {(data?.topClients ?? []).map((c) => (
                <tr key={String(c.codeCli ?? c.nom)} className="border-b border-[var(--border-primary)]/60 hover:bg-[var(--accent-light)]">
                  <td className="px-5 py-2.5 font-medium text-[var(--text-primary)]">{c.nom}</td>
                  <td className="px-5 py-2.5 text-right text-[var(--text-secondary)] tabular-nums">{c.docs}</td>
                  <td className="px-5 py-2.5 text-right font-bold tabular-nums">{fmtMoney(c.ca)} TND</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, icon: Icon, color }: {
  label: string; value: string; sub: string; icon: React.ElementType; color: string;
}) {
  return (
    <motion.div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-primary)] shadow-sm p-5"
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: color + "18", color }}>
        <Icon size={18} />
      </div>
      <div className="text-xl font-bold" style={{ color }}>{value}</div>
      <div className="text-[var(--text-secondary)] text-sm mt-1">{label}</div>
      <div className="text-[var(--text-secondary)] opacity-70 text-xs mt-0.5">{sub}</div>
    </motion.div>
  );
}

/** Histogramme du CA mensuel — sans dépendance externe. */
function MiniChart({ serie }: { serie: { mois: string; ca: number }[] }) {
  if (serie.length === 0) return <div className="py-8 text-center text-sm text-[var(--text-secondary)]">Aucune donnée.</div>;
  const max = Math.max(1, ...serie.map((s) => Math.abs(s.ca)));

  return (
    <div className="flex items-end gap-1.5 h-40 overflow-x-auto">
      {serie.map((s) => (
        <div key={s.mois} className="flex-1 min-w-[38px] flex flex-col items-center gap-1 group">
          <span className="text-[9px] text-[var(--text-secondary)] opacity-0 group-hover:opacity-100 transition tabular-nums">
            {fmtCompact(s.ca)}
          </span>
          <motion.div className="w-full rounded-t-md bg-blue-500/80 hover:bg-blue-500 transition"
            initial={{ height: 0 }}
            animate={{ height: `${Math.max(2, (Math.abs(s.ca) / max) * 100)}%` }}
            transition={{ duration: 0.6 }}
            title={`${s.mois} : ${fmtMoney(s.ca)} TND`} />
          <span className="text-[9px] text-[var(--text-secondary)] whitespace-nowrap">{s.mois}</span>
        </div>
      ))}
    </div>
  );
}
