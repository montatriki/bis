"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  ShoppingBag, FileText, TrendingUp, AlertTriangle, Package,
  ChevronRight, Loader2, CreditCard, MapPin,
} from "lucide-react";
import Link from "next/link";

type Resume = {
  client: {
    id: number; raisonSocial: string; ville: string | null; gouvernorat: string | null;
    tel: string | null; soldeFin: number; debit: number; credit: number;
    plafond: number; depassement: boolean;
  };
  kpis: { ca: number; nbDocuments: number; nbImpayes: number; totalImpaye: number };
  derniers: { refDoc: string; typeDoc: string; dateDoc: string | null; ttcNet: number; soldeDoc: number; etat: string | null }[];
  habituels: { refArt: string; designation: string; qte: number }[];
};

const fmt = (v: unknown) =>
  new Intl.NumberFormat("fr-TN", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(Number(v) || 0);
const fmtDate = (v: unknown) => (v ? new Date(String(v)).toLocaleDateString("fr-FR") : "—");

export default function ClientDashboardPage() {
  const [data, setData] = useState<Resume | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/espace-client?vue=resume")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.error) setError(d.error);
        else setData(d);
        setLoading(false);
      })
      .catch(() => { if (!cancelled) { setError("Chargement impossible"); setLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return <div className="py-24 text-center text-[var(--text-secondary)]"><Loader2 className="animate-spin mx-auto mb-3" size={26} /> Chargement…</div>;
  }
  if (error || !data) {
    return (
      <div className="p-6 rounded-2xl bg-amber-500/10 text-amber-700 dark:text-amber-400 text-sm flex items-center gap-2">
        <AlertTriangle size={16} /> {error ?? "Aucune donnée"}
      </div>
    );
  }

  const { client, kpis } = data;
  const creditPct = client.plafond > 0 ? Math.min((client.soldeFin / client.plafond) * 100, 100) : 0;

  return (
    <div className="space-y-6">
      <motion.div className="bg-gradient-to-r from-blue-700 to-blue-600 rounded-2xl p-6 text-white"
        initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="text-blue-200 text-sm mb-1">Bonjour,</div>
            <h1 className="text-2xl font-bold">{client.raisonSocial || `Client ${client.id}`}</h1>
            <div className="text-blue-200 text-sm mt-1 flex items-center gap-1.5">
              <MapPin size={12} />
              {client.ville || "—"}{client.gouvernorat ? ` — ${client.gouvernorat}` : ""} ·{" "}
              {new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
            </div>
          </div>
          <div className="bg-white/10 rounded-2xl p-4 min-w-[210px]">
            <div className="text-blue-200 text-xs mb-1 font-semibold uppercase tracking-wide">Solde du compte</div>
            <div className="font-bold text-xl">{fmt(client.soldeFin)} TND</div>
            <div className="text-blue-200 text-xs mt-1">Plafond : {fmt(client.plafond)} TND</div>
            <div className="h-1.5 bg-white/20 rounded-full overflow-hidden mt-2">
              <motion.div className={`h-full rounded-full ${creditPct >= 90 ? "bg-red-400" : creditPct >= 70 ? "bg-amber-300" : "bg-emerald-400"}`}
                initial={{ width: 0 }} animate={{ width: `${creditPct}%` }} transition={{ duration: 0.8 }} />
            </div>
          </div>
        </div>
      </motion.div>

      {client.depassement && (
        <div className="px-4 py-3 rounded-xl bg-red-500/10 text-red-600 text-sm font-medium flex items-center gap-2">
          <AlertTriangle size={16} /> Votre solde dépasse le plafond autorisé ({fmt(client.plafond)} TND).
          Merci de régulariser avant toute nouvelle commande.
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Chiffre d'affaires" value={`${fmt(kpis.ca)} TND`} sub="Total facturé" icon={TrendingUp} color="#2563eb" />
        <Kpi label="Documents" value={String(kpis.nbDocuments)} sub="Tous types" icon={FileText} color="#7c3aed" />
        <Kpi label="Impayés" value={String(kpis.nbImpayes)} sub="Documents non soldés" icon={AlertTriangle} color="#dc2626" />
        <Kpi label="Reste dû" value={`${fmt(kpis.totalImpaye)} TND`} sub="À régler" icon={CreditCard} color="#f59e0b" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-[var(--bg-card)] rounded-2xl border border-[var(--border-primary)] shadow-sm overflow-hidden">
          <div className="p-5 border-b border-[var(--border-primary)] flex items-center justify-between">
            <h2 className="font-bold text-[var(--text-primary)] flex items-center gap-2">
              <ShoppingBag size={16} className="text-blue-500" /> Derniers documents
            </h2>
            <Link href="/client/historique" className="text-blue-600 text-sm hover:text-blue-500 flex items-center gap-1">
              Tout voir <ChevronRight size={14} />
            </Link>
          </div>
          <div className="divide-y divide-[var(--border-primary)]/60">
            {data.derniers.length === 0 && (
              <div className="px-5 py-10 text-center text-sm text-[var(--text-secondary)]">Aucun document.</div>
            )}
            {data.derniers.map((d, i) => (
              <motion.div key={d.refDoc} className="flex items-center gap-4 px-5 py-3.5"
                initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400 shrink-0">
                  {d.typeDoc}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-[var(--text-primary)] text-sm truncate">{d.refDoc}</div>
                  <div className="text-[var(--text-secondary)] text-xs">{fmtDate(d.dateDoc)}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-bold text-[var(--text-primary)] text-sm tabular-nums">{fmt(d.ttcNet)} TND</div>
                  {d.soldeDoc > 0 && <div className="text-[10px] text-red-600">reste {fmt(d.soldeDoc)}</div>}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <Link href="/client/commander"
            className="bg-blue-600 text-white rounded-2xl p-4 hover:opacity-90 transition flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <ShoppingBag size={17} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm">Passer commande</div>
              <div className="text-xs opacity-70 mt-0.5">Catalogue et panier</div>
            </div>
            <ChevronRight size={15} className="opacity-40 group-hover:opacity-80 transition" />
          </Link>

          <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-primary)] shadow-sm p-4">
            <h4 className="font-bold text-[var(--text-secondary)] text-sm mb-3 flex items-center gap-2">
              <Package size={14} className="text-emerald-500" /> Vos articles habituels
            </h4>
            {data.habituels.length === 0 ? (
              <p className="text-xs text-[var(--text-secondary)] py-2">
                Aucun article encore commandé via le portail.
              </p>
            ) : (
              data.habituels.map((a) => (
                <div key={a.refArt} className="flex justify-between py-2 border-b border-[var(--border-primary)]/60 last:border-0 text-sm">
                  <span className="text-[var(--text-secondary)] truncate mr-2" title={a.designation}>{a.designation}</span>
                  <span className="font-bold text-[var(--text-primary)] shrink-0">{a.qte}</span>
                </div>
              ))
            )}
          </div>

          <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-primary)] shadow-sm p-4">
            <h4 className="font-bold text-[var(--text-secondary)] text-sm mb-3">Situation du compte</h4>
            {[
              ["Débit", `${fmt(client.debit)} TND`, "text-[var(--text-primary)]"],
              ["Crédit", `${fmt(client.credit)} TND`, "text-emerald-600"],
              ["Solde", `${fmt(client.soldeFin)} TND`, client.soldeFin > 0 ? "text-red-600" : "text-emerald-600"],
            ].map(([label, value, color]) => (
              <div key={label} className="flex justify-between py-2 border-b border-[var(--border-primary)]/60 last:border-0 text-sm">
                <span className="text-[var(--text-secondary)]">{label}</span>
                <span className={`font-bold tabular-nums ${color}`}>{value}</span>
              </div>
            ))}
          </div>
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
