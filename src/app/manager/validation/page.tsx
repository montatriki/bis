"use client";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, XCircle, Eye, Loader2, AlertTriangle, FileText, RefreshCw } from "lucide-react";

type Doc = {
  refDoc: string; typeDoc: string; libDoc: string | null; dateDoc: string | null;
  codeCli: number | null; raisonSocial: string | null;
  commercial: string | null; utilisateur: string | null;
  thtBrut: number; totRemise: number; thtNet: number; totTva: number; ttcNet: number;
  etat: string | null; nbLignes: number; tauxRemise: number;
  horsNorme: boolean; sansLignes: boolean;
};

const fmt = (v: unknown) =>
  new Intl.NumberFormat("fr-TN", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(Number(v) || 0);
const fmtDate = (v: unknown) => (v ? new Date(String(v)).toLocaleDateString("fr-FR") : "—");

export default function ValidationPage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [selected, setSelected] = useState<Doc | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [seuil, setSeuil] = useState(12);
  const [montantTotal, setMontantTotal] = useState(0);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/validation")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setDocs(d.rows ?? []);
        setSeuil(d.seuilRemise ?? 12);
        setMontantTotal(d.montantTotal ?? 0);
        setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [reload]);

  const flash = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }, []);

  async function action(refDoc: string, act: "approuver" | "rejeter") {
    setBusy(refDoc);
    const r = await fetch("/api/validation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refDoc, action: act }),
    }).then((x) => x.json()).catch(() => ({ ok: false, message: "réseau" }));
    setBusy(null);
    if (r.ok) {
      flash(r.message ?? "Document traité");
      setSelected(null);
      setReload((k) => k + 1);
    } else {
      flash(r.message ?? r.error ?? "Échec", false);
    }
  }

  const horsNorme = docs.filter((d) => d.horsNorme);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Validation des documents</h1>
          <p className="text-[var(--text-secondary)] text-sm">
            {loading ? "Chargement…" : `${docs.length} document(s) en attente · ${fmt(montantTotal)} TND`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {horsNorme.length > 0 && (
            <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/25 rounded-xl px-3 py-2">
              <AlertTriangle size={14} className="text-amber-600" />
              <span className="text-amber-700 dark:text-amber-400 font-medium text-sm">
                {horsNorme.length} remise(s) &gt; {seuil}%
              </span>
            </div>
          )}
          <button onClick={() => { setLoading(true); setReload((k) => k + 1); }}
            className="p-2 rounded-xl border border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-[var(--accent-light)]">
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {toast && (
        <div className={`px-4 py-2 rounded-xl text-sm font-medium ${
          toast.ok ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-red-500/10 text-red-600"
        }`}>{toast.msg}</div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-3 max-h-[75vh] overflow-auto pr-1">
          {loading && <div className="py-16 text-center text-[var(--text-secondary)]"><Loader2 className="animate-spin inline" size={22} /></div>}
          {!loading && docs.length === 0 && (
            <div className="text-center py-16 text-[var(--text-secondary)]">
              <CheckCircle size={36} className="mx-auto mb-3 opacity-30" />
              <div className="font-medium">Aucun document en attente</div>
              <p className="text-sm mt-1 opacity-70">Tout est validé.</p>
            </div>
          )}
          {!loading && docs.map((d, i) => (
            <motion.div key={d.refDoc} layout
              className={`bg-[var(--bg-card)] rounded-2xl border shadow-sm p-4 cursor-pointer transition ${
                selected?.refDoc === d.refDoc ? "border-blue-400 ring-2 ring-blue-100 dark:ring-blue-500/20"
                : d.horsNorme ? "border-amber-300 dark:border-amber-500/30"
                : "border-[var(--border-primary)] hover:border-slate-300"
              }`}
              onClick={() => setSelected(d)}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3) }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-[var(--text-secondary)]">{d.refDoc}</span>
                    <span className="text-[10px] bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full font-bold">
                      {d.typeDoc}
                    </span>
                    {d.horsNorme && (
                      <span className="text-[10px] bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full font-medium">
                        Remise {d.tauxRemise}%
                      </span>
                    )}
                    {d.sansLignes && (
                      <span className="text-[10px] bg-red-100 dark:bg-red-500/15 text-red-600 px-2 py-0.5 rounded-full font-medium">
                        Sans lignes
                      </span>
                    )}
                  </div>
                  <div className="font-semibold text-[var(--text-primary)] mt-1 truncate">
                    {d.raisonSocial || `Client ${d.codeCli ?? "?"}`}
                  </div>
                  <div className="text-[var(--text-secondary)] text-xs truncate">
                    {d.commercial || d.utilisateur || "—"} · {fmtDate(d.dateDoc)} · {d.nbLignes} ligne(s)
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-bold text-[var(--text-primary)] tabular-nums">{fmt(d.ttcNet)} TND</div>
                  <div className="text-[var(--text-secondary)] text-xs">HT {fmt(d.thtNet)}</div>
                </div>
              </div>

              <div className="flex gap-2 mt-3">
                <motion.button onClick={(e) => { e.stopPropagation(); action(d.refDoc, "approuver"); }}
                  disabled={busy === d.refDoc || d.sansLignes}
                  title={d.sansLignes ? "Impossible : document sans lignes" : "Applique stock et solde"}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/25 py-2 rounded-xl hover:bg-emerald-100 transition font-medium disabled:opacity-40"
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  {busy === d.refDoc ? <Loader2 className="animate-spin" size={13} /> : <CheckCircle size={13} />} Approuver
                </motion.button>
                <motion.button onClick={(e) => { e.stopPropagation(); action(d.refDoc, "rejeter"); }}
                  disabled={busy === d.refDoc}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs bg-red-50 dark:bg-red-500/10 text-red-600 border border-red-200 dark:border-red-500/25 py-2 rounded-xl hover:bg-red-100 transition font-medium disabled:opacity-40"
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <XCircle size={13} /> Rejeter
                </motion.button>
              </div>
            </motion.div>
          ))}
        </div>

        <AnimatePresence>
          {selected && (
            <motion.div className="bg-[var(--bg-card)] rounded-2xl border border-blue-200 dark:border-blue-500/25 shadow-sm p-5 h-fit sticky top-4"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
              <h3 className="font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                <Eye size={16} className="text-blue-500" /> Aperçu — {selected.refDoc}
              </h3>
              <div className="space-y-0.5">
                {[
                  ["Type", selected.typeDoc],
                  ["Client", selected.raisonSocial || `Client ${selected.codeCli ?? "?"}`],
                  ["Commercial", selected.commercial || selected.utilisateur || "—"],
                  ["Date", fmtDate(selected.dateDoc)],
                  ["Lignes", `${selected.nbLignes}`],
                  ["Total brut", `${fmt(selected.thtBrut)} TND`],
                  ["Remise", selected.totRemise > 0 ? `${fmt(selected.totRemise)} TND (${selected.tauxRemise}%)` : "Aucune"],
                  ["Total HT", `${fmt(selected.thtNet)} TND`],
                  ["TVA", `${fmt(selected.totTva)} TND`],
                  ["Total TTC", `${fmt(selected.ttcNet)} TND`],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between py-2 border-b border-[var(--border-primary)]/60">
                    <span className="text-[var(--text-secondary)] text-sm">{label}</span>
                    <span className="font-medium text-[var(--text-primary)] text-sm tabular-nums">{value}</span>
                  </div>
                ))}
              </div>

              {selected.libDoc && selected.libDoc !== selected.typeDoc && (
                <div className="mt-4 bg-[var(--bg-primary)] rounded-xl p-3">
                  <div className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-1">Remarque</div>
                  <p className="text-sm text-[var(--text-primary)]">{selected.libDoc}</p>
                </div>
              )}

              {selected.horsNorme && (
                <div className="mt-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/25 rounded-xl p-3">
                  <div className="font-medium text-amber-800 dark:text-amber-400 text-sm flex items-center gap-1.5">
                    <AlertTriangle size={14} /> Remise hors norme
                  </div>
                  <p className="text-amber-700 dark:text-amber-500 text-xs mt-1">
                    La remise ({selected.tauxRemise}%) dépasse le seuil habituel (≤{seuil}%). Vérification recommandée.
                  </p>
                </div>
              )}

              {selected.sansLignes && (
                <div className="mt-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/25 rounded-xl p-3">
                  <div className="font-medium text-red-700 dark:text-red-400 text-sm flex items-center gap-1.5">
                    <FileText size={14} /> Document sans lignes
                  </div>
                  <p className="text-red-600 dark:text-red-500 text-xs mt-1">
                    Impossible d&apos;approuver : aucun article n&apos;est rattaché à ce document.
                  </p>
                </div>
              )}

              <div className="mt-4 text-[11px] text-[var(--text-secondary)] leading-relaxed">
                L&apos;approbation applique les mouvements de stock et met à jour le solde du client,
                selon le type de document.
              </div>

              <div className="flex gap-3 mt-4">
                <button onClick={() => action(selected.refDoc, "approuver")}
                  disabled={busy === selected.refDoc || selected.sansLignes}
                  className="flex-1 bg-emerald-500 text-white py-2.5 rounded-xl font-medium hover:bg-emerald-400 transition text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                  {busy === selected.refDoc ? <Loader2 className="animate-spin" size={15} /> : <CheckCircle size={15} />} Approuver
                </button>
                <button onClick={() => action(selected.refDoc, "rejeter")}
                  disabled={busy === selected.refDoc}
                  className="flex-1 bg-red-500 text-white py-2.5 rounded-xl font-medium hover:bg-red-400 transition text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                  <XCircle size={15} /> Rejeter
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
