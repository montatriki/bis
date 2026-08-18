"use client";
import { useState } from "react";
import { Search, Printer, TrendingUp, TrendingDown, Wallet } from "lucide-react";

type Mode = { mode: string; montant: number; nb: number };
type Result = {
  encaissements: number; nbEncaissements: number;
  decaissements: number; nbDecaissements: number;
  solde: number; nbComptes: number;
  parModeEnc: Mode[]; parModeDec: Mode[];
};
const fmt = (n: number) => new Intl.NumberFormat("fr-TN", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(n ?? 0);

export default function BalanceGlobale({ accent }: { accent: string }) {
  const [du, setDu] = useState("");
  const [au, setAu] = useState("");
  const [data, setData] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [ran, setRan] = useState(false);

  async function run() {
    setLoading(true);
    const parts = ["resource=tresobalance"];
    if (du) parts.push(`dateDu=${du}`);
    if (au) parts.push(`dateAu=${au}`);
    const d = await fetch(`/api/erp?${parts.join("&")}`).then((r) => r.json());
    setData(d); setRan(true); setLoading(false);
  }

  return (
    <div className="space-y-4">
      {/* Filter row (Du / Au / RESULTAT / IMPRIMER) */}
      <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-primary)] shadow-sm p-4">
        <div className="flex items-end gap-4 flex-wrap">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-bold text-[var(--text-secondary)]">Du :</span>
            <input type="date" value={du} onChange={(e) => setDu(e.target.value)} className="px-3 py-2 text-sm bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg focus:outline-none" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-bold text-[var(--text-secondary)]">Au :</span>
            <input type="date" value={au} onChange={(e) => setAu(e.target.value)} className="px-3 py-2 text-sm bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg focus:outline-none" />
          </label>
          <button onClick={run} disabled={loading} className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50" style={{ background: accent }}>
            <Search size={15} /> {loading ? "…" : "RÉSULTAT"}
          </button>
          <button onClick={() => window.print()} className="flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg border border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-[var(--accent-light)]">
            <Printer size={15} /> IMPRIMER
          </button>
        </div>
      </div>

      {/* Results */}
      {!ran && <div className="text-center text-[var(--text-secondary)] py-16 opacity-70">Sélectionnez une période et cliquez sur RÉSULTAT.</div>}

      {ran && data && (
        <div className="space-y-4">
          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Total encaissements", value: data.encaissements, count: data.nbEncaissements, icon: TrendingUp, color: "#10b981" },
              { label: "Total décaissements", value: data.decaissements, count: data.nbDecaissements, icon: TrendingDown, color: "#ef4444" },
              { label: "Solde net", value: data.solde, count: undefined, icon: Wallet, color: accent },
              { label: "Comptes", value: data.nbComptes, count: undefined, icon: Wallet, color: "#3b82f6", isCount: true },
            ].map((k) => (
              <div key={k.label} className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-primary)] shadow-sm p-5">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: k.color + "1a", color: k.color }}>
                  <k.icon size={19} />
                </div>
                <div className="text-2xl font-extrabold tracking-tight" style={{ color: k.color }}>
                  {k.isCount ? k.value : fmt(k.value)} {!k.isCount && <span className="text-sm font-bold text-[var(--text-secondary)]">TND</span>}
                </div>
                <div className="text-[var(--text-secondary)] font-bold text-xs mt-1">{k.label}{k.count != null ? ` · ${k.count} op.` : ""}</div>
              </div>
            ))}
          </div>

          {/* Breakdown by payment mode */}
          <div className="grid lg:grid-cols-2 gap-4">
            {[
              { title: "Encaissements par mode", rows: data.parModeEnc, color: "#10b981" },
              { title: "Décaissements par mode", rows: data.parModeDec, color: "#ef4444" },
            ].map((sec) => (
              <div key={sec.title} className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-primary)] shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-[var(--border-primary)] font-bold text-sm" style={{ color: sec.color }}>{sec.title}</div>
                <table className="w-full text-sm">
                  <thead className="bg-[var(--bg-primary)] border-b border-[var(--border-primary)]">
                    <tr>{["Mode", "Nb", "Montant"].map((h) => <th key={h} className={`px-4 py-2 text-xs font-semibold text-[var(--text-secondary)] uppercase ${h === "Montant" ? "text-right" : "text-left"}`}>{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-primary)]">
                    {sec.rows.length === 0 && <tr><td colSpan={3} className="px-4 py-6 text-center text-slate-400 text-sm">Aucune opération</td></tr>}
                    {sec.rows.map((r) => (
                      <tr key={r.mode} className="hover:bg-[var(--accent-light)]">
                        <td className="px-4 py-2.5 font-medium text-[var(--text-primary)]">{r.mode}</td>
                        <td className="px-4 py-2.5 text-[var(--text-secondary)]">{r.nb}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-medium">{fmt(r.montant)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-[var(--bg-primary)] border-t-2 border-[var(--border-primary)]">
                    <tr>
                      <td className="px-4 py-2.5 font-bold uppercase text-xs">Total</td><td />
                      <td className="px-4 py-2.5 text-right font-black tabular-nums" style={{ color: sec.color }}>{fmt(sec.rows.reduce((s, r) => s + r.montant, 0))}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
