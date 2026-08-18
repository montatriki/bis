"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { FileText, Search, Download, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";

type Doc = {
  refDoc: string; typeDoc: string; dateDoc: string | null;
  thtNet: number; totTva: number; ttcNet: number;
  soldeDoc: number; totalRegle: number; etat: string | null; valide: boolean;
};
type TypeCount = { type: string; count: number };

const fmt = (v: unknown) =>
  new Intl.NumberFormat("fr-TN", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(Number(v) || 0);
const fmtDate = (v: unknown) => (v ? new Date(String(v)).toLocaleDateString("fr-FR") : "—");

/** Libellés des types de documents réellement présents dans les données. */
const TYPE_LABEL: Record<string, string> = {
  TIC: "Ticket", BL: "Bon de livraison", FC: "Facture", FAC: "Facture",
  AV: "Avoir", BR: "Retour", BRE: "Bon de retour", COM: "Commande",
  DEV: "Devis", INV: "Inventaire",
};
const TYPE_STYLE: Record<string, string> = {
  TIC: "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400",
  BL: "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400",
  FC: "bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400",
  FAC: "bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400",
  AV: "bg-red-50 dark:bg-red-500/10 text-red-600",
  BR: "bg-red-50 dark:bg-red-500/10 text-red-600",
  COM: "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400",
};

export default function HistoriquePage() {
  const [tab, setTab] = useState("ALL");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<Doc[]>([]);
  const [types, setTypes] = useState<TypeCount[]>([]);
  const [client, setClient] = useState<{ raisonSocial: string; soldeFin: number } | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      const qs = new URLSearchParams({ vue: "documents", type: tab });
      if (search) qs.set("search", search);
      fetch(`/api/espace-client?${qs}`)
        .then((r) => r.json())
        .then((d) => {
          if (cancelled) return;
          if (d.error) setError(d.error);
          else {
            setRows(d.rows ?? []);
            setTotal(d.total ?? 0);
            setClient(d.client ?? null);
            if (d.types?.length) setTypes(d.types);
          }
          setLoading(false);
        })
        .catch(() => { if (!cancelled) { setError("Chargement impossible"); setLoading(false); } });
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [tab, search]);

  function exportCsv() {
    const head = ["Référence", "Type", "Date", "Total HT", "TVA", "Total TTC", "Reste dû", "État"].join(";");
    const lines = rows.map((d) =>
      [d.refDoc, d.typeDoc, fmtDate(d.dateDoc), d.thtNet, d.totTva, d.ttcNet, d.soldeDoc, d.etat ?? ""].join(";")
    );
    const csv = "﻿" + [head, ...lines].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = "mes-documents.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  if (error) {
    return (
      <div className="p-6 rounded-2xl bg-amber-500/10 text-amber-700 dark:text-amber-400 text-sm flex items-center gap-2">
        <AlertTriangle size={16} /> {error}
      </div>
    );
  }

  const totalTTC = rows.reduce((s, d) => s + d.ttcNet, 0);
  const totalDu = rows.reduce((s, d) => s + d.soldeDoc, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Mes documents</h1>
          <p className="text-[var(--text-secondary)] text-sm">
            {loading ? "Chargement…" : `${total} document(s)${client ? ` — ${client.raisonSocial}` : ""}`}
          </p>
        </div>
        <button onClick={exportCsv} disabled={rows.length === 0}
          className="flex items-center gap-1.5 border border-[var(--border-primary)] text-emerald-600 px-3 py-2 rounded-xl text-sm disabled:opacity-40">
          <Download size={15} /> Excel
        </button>
      </div>

      {/* Onglets par type réellement présent */}
      <div className="flex gap-1.5 flex-wrap">
        <TabBtn id="ALL" label="Tous" count={types.reduce((s, t) => s + t.count, 0)} active={tab} onClick={setTab} />
        {types.sort((a, b) => b.count - a.count).map((t) => (
          <TabBtn key={t.type} id={t.type} label={TYPE_LABEL[t.type] ?? t.type} count={t.count} active={tab} onClick={setTab} />
        ))}
      </div>

      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={(e) => { setSearch(e.target.value); setLoading(true); }}
          className="pl-9 pr-4 py-2.5 text-sm bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl w-full focus:outline-none"
          placeholder="Rechercher une référence…" />
      </div>

      <div className="overflow-auto rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-card)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--bg-primary)] border-b border-[var(--border-primary)]">
            <tr className="text-[11px] uppercase tracking-wide text-[var(--text-secondary)]">
              <th className="px-4 py-2.5 text-left font-semibold">Référence</th>
              <th className="px-4 py-2.5 text-left font-semibold">Type</th>
              <th className="px-4 py-2.5 text-left font-semibold">Date</th>
              <th className="px-4 py-2.5 text-right font-semibold">Total HT</th>
              <th className="px-4 py-2.5 text-right font-semibold">TVA</th>
              <th className="px-4 py-2.5 text-right font-semibold">Total TTC</th>
              <th className="px-4 py-2.5 text-right font-semibold">Reste dû</th>
              <th className="px-4 py-2.5 text-center font-semibold">État</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={8} className="py-12 text-center text-[var(--text-secondary)]">
                <Loader2 className="animate-spin inline mr-2" size={18} /> Chargement…
              </td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={8} className="py-12 text-center text-sm text-[var(--text-secondary)]">
                Aucun document{tab !== "ALL" ? " de ce type" : ""}.
              </td></tr>
            )}
            {!loading && rows.map((d, i) => (
              <motion.tr key={d.refDoc} className="border-b border-[var(--border-primary)]/60 hover:bg-[var(--accent-light)]"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.02, 0.3) }}>
                <td className="px-4 py-2.5 font-medium text-[var(--text-primary)]">{d.refDoc}</td>
                <td className="px-4 py-2.5">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${TYPE_STYLE[d.typeDoc] ?? "bg-slate-100 dark:bg-slate-500/15 text-slate-600"}`}>
                    {TYPE_LABEL[d.typeDoc] ?? d.typeDoc}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-[var(--text-secondary)]">{fmtDate(d.dateDoc)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{fmt(d.thtNet)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-[var(--text-secondary)]">{fmt(d.totTva)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums font-semibold">{fmt(d.ttcNet)}</td>
                <td className={`px-4 py-2.5 text-right tabular-nums ${d.soldeDoc > 0 ? "text-red-600 font-semibold" : "text-[var(--text-secondary)]"}`}>
                  {d.soldeDoc > 0 ? fmt(d.soldeDoc) : "—"}
                </td>
                <td className="px-4 py-2.5 text-center">
                  {d.valide ? (
                    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/12 text-emerald-600">
                      <CheckCircle2 size={10} /> Validé
                    </span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-500/12 text-[var(--text-secondary)]">
                      {d.etat || "En cours"}
                    </span>
                  )}
                </td>
              </motion.tr>
            ))}
          </tbody>
          {!loading && rows.length > 0 && (
            <tfoot className="bg-[var(--bg-primary)] border-t-2 border-[var(--border-primary)]">
              <tr>
                <td colSpan={5} className="px-4 py-2.5 font-bold text-xs uppercase tracking-wide text-[var(--text-primary)]">
                  Total ({rows.length} document{rows.length > 1 ? "s" : ""})
                </td>
                <td className="px-4 py-2.5 text-right font-black tabular-nums">{fmt(totalTTC)}</td>
                <td className="px-4 py-2.5 text-right font-black tabular-nums text-red-600">{totalDu > 0 ? fmt(totalDu) : "—"}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

function TabBtn({ id, label, count, active, onClick }: {
  id: string; label: string; count: number; active: string; onClick: (v: string) => void;
}) {
  const on = active === id;
  return (
    <button onClick={() => onClick(id)}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
        on ? "bg-blue-600 text-white border-transparent shadow-sm"
           : "bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border-primary)] hover:text-[var(--text-primary)]"
      }`}>
      <FileText size={12} /> {label}
      <span className={`text-[10px] px-1.5 rounded-full ${on ? "bg-white/20" : "bg-[var(--bg-primary)]"}`}>{count}</span>
    </button>
  );
}
