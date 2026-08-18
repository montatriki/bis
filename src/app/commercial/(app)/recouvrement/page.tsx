"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, FileText, CreditCard, Banknote, Loader2, MessageCircle } from "lucide-react";

type Client = {
  id: number; raisonSocial: string; ville: string | null; gouvernorat: string | null;
  tel: string | null; soldeFin: number;
};
type Doc = {
  refDoc: string; typeDoc: string; dateDoc: string | null;
  ttcNet: number; soldeDoc: number; totalRegle: number; etat: string | null;
};

const fmt = (v: unknown) =>
  new Intl.NumberFormat("fr-TN", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(Number(v) || 0);

export default function RecouvrementPage() {
  const [search, setSearch] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [totalCreances, setTotalCreances] = useState(0);
  const [loading, setLoading] = useState(true);

  const [selected, setSelected] = useState<Client | null>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);

  const [showPayModal, setShowPayModal] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [mode, setMode] = useState("Espèces");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  // Clients avec solde débiteur, triés par créance décroissante.
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      fetch(`/api/clients?creances=1&limit=200${search ? `&search=${encodeURIComponent(search)}` : ""}`)
        .then((r) => r.json())
        .then((d) => {
          if (cancelled) return;
          setClients(d.rows ?? []);
          setTotalCreances(d.totalCreances ?? 0);
          setLoading(false);
        })
        .catch(() => { if (!cancelled) setLoading(false); });
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [search, reload]);

  // Documents du client sélectionné.
  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    fetch(`/api/clients?codeCli=${selected.id}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) { setDocs(d.docs ?? []); setDocsLoading(false); } })
      .catch(() => { if (!cancelled) setDocsLoading(false); });
    return () => { cancelled = true; };
  }, [selected]);

  /** Sélection d'un client : vide le détail précédent avant de recharger. */
  const selectClient = (c: Client | null) => {
    setSelected(c);
    setDocs([]);
    setDocsLoading(Boolean(c));
  };

  async function encaisser() {
    if (!selected) return;
    const montant = Number(payAmount);
    if (!Number.isFinite(montant) || montant <= 0) return;
    setSaving(true);
    const r = await fetch("/api/reglements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codeCli: selected.id, montant, mode }),
    }).then((x) => x.json()).catch(() => ({ error: "réseau" }));
    setSaving(false);
    if (r.ok) {
      setShowPayModal(false);
      selectClient(null);
      setToast(`Encaissement de ${fmt(montant)} TND enregistré`);
      setTimeout(() => setToast(null), 3000);
      setReload((k) => k + 1);
    } else {
      setToast(r.error ?? "Échec de l'encaissement");
      setTimeout(() => setToast(null), 3000);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Recouvrement</h1>
          <p className="text-[var(--text-secondary)] text-sm">
            {loading ? "Chargement…" : `${clients.length} client(s) avec solde débiteur`}
          </p>
        </div>
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/25 rounded-xl px-4 py-2 text-center">
          <div className="text-lg font-bold text-red-600">{fmt(totalCreances)} TND</div>
          <div className="text-red-400 text-xs">Créances totales</div>
        </div>
      </div>

      {toast && (
        <div className="px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-sm font-medium">{toast}</div>
      )}

      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={(e) => { setSearch(e.target.value); setLoading(true); }}
          className="pl-9 pr-4 py-2.5 text-sm bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl w-full focus:outline-none"
          placeholder="Rechercher un client…" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="space-y-3 max-h-[70vh] overflow-auto pr-1">
          {loading && <div className="py-12 text-center text-[var(--text-secondary)]"><Loader2 className="animate-spin inline" size={20} /></div>}
          {!loading && clients.length === 0 && (
            <div className="py-12 text-center text-sm text-[var(--text-secondary)]">Aucun client avec solde débiteur.</div>
          )}
          {clients.map((c, i) => {
            const tel = (c.tel ?? "").replace(/[^0-9]/g, "");
            const msg = encodeURIComponent(`Bonjour ${c.raisonSocial},\nVotre créance s'élève à ${fmt(c.soldeFin)} TND.\nCordialement.`);
            return (
              <motion.div key={c.id}
                className={`bg-[var(--bg-card)] rounded-2xl border shadow-sm p-4 cursor-pointer transition ${
                  selected?.id === c.id ? "border-blue-400 ring-2 ring-blue-100 dark:ring-blue-500/20" : "border-[var(--border-primary)] hover:border-slate-300"
                }`}
                onClick={() => selectClient(c)}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3) }}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-600 font-bold text-sm flex items-center justify-center flex-shrink-0">
                      {c.raisonSocial.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-[var(--text-primary)] text-sm truncate">{c.raisonSocial}</div>
                      <div className="text-[var(--text-secondary)] text-xs truncate">{c.ville || "—"} {c.gouvernorat ? `— ${c.gouvernorat}` : ""}</div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    <div className="font-bold text-red-600 text-sm tabular-nums">{fmt(c.soldeFin)} TND</div>
                    <div className="text-[var(--text-secondary)] text-xs">Solde débiteur</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  {tel && (
                    <a href={`https://wa.me/${tel.startsWith("216") ? tel : `216${tel}`}?text=${msg}`}
                      target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                      className="flex-1 text-xs py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-500/25 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 transition font-medium flex items-center justify-center gap-1">
                      <MessageCircle size={11} /> Relancer
                    </a>
                  )}
                  <button onClick={(e) => { e.stopPropagation(); selectClient(c); setShowPayModal(true); setPayAmount(String(c.soldeFin)); }}
                    className="flex-1 text-xs py-1.5 rounded-lg border border-blue-200 dark:border-blue-500/25 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 hover:bg-blue-100 transition font-medium flex items-center justify-center gap-1">
                    <CreditCard size={11} /> Encaisser
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>

        <AnimatePresence>
          {selected && (
            <motion.div className="bg-[var(--bg-card)] rounded-2xl border border-blue-200 dark:border-blue-500/25 shadow-sm overflow-hidden h-fit sticky top-4"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
              <div className="bg-slate-800 text-white p-4">
                <div className="font-bold">{selected.raisonSocial}</div>
                <div className="text-slate-400 text-xs mt-0.5">
                  {selected.ville || "—"} {selected.gouvernorat ? `— ${selected.gouvernorat}` : ""} · Code {selected.id}
                </div>
              </div>
              <div className="p-5">
                <h3 className="font-semibold text-[var(--text-secondary)] text-sm mb-3">Documents du client</h3>
                <div className="space-y-2 mb-4 max-h-64 overflow-auto">
                  {docsLoading && <div className="py-6 text-center text-[var(--text-secondary)]"><Loader2 className="animate-spin inline" size={16} /></div>}
                  {!docsLoading && docs.length === 0 && (
                    <div className="py-6 text-center text-sm text-[var(--text-secondary)]">Aucun document.</div>
                  )}
                  {docs.map((d) => (
                    <div key={d.refDoc} className="flex items-center justify-between p-3 bg-[var(--bg-primary)] rounded-xl text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText size={14} className="text-[var(--text-secondary)] shrink-0" />
                        <div className="min-w-0">
                          <div className="font-medium text-[var(--text-primary)] truncate">{d.refDoc}</div>
                          <div className="text-[var(--text-secondary)] text-xs">
                            {d.typeDoc}{d.dateDoc ? ` · ${new Date(d.dateDoc).toLocaleDateString("fr-FR")}` : ""}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <div className="font-bold text-sm tabular-nums text-[var(--text-primary)]">{fmt(d.ttcNet)}</div>
                        {d.soldeDoc > 0 && <div className="text-[10px] text-red-600">reste {fmt(d.soldeDoc)}</div>}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="border-t border-[var(--border-primary)] pt-3 mb-4">
                  <div className="flex justify-between font-bold text-sm">
                    <span className="text-[var(--text-secondary)]">Solde total</span>
                    <span className="text-red-600 tabular-nums">{fmt(selected.soldeFin)} TND</span>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => { setShowPayModal(true); setPayAmount(String(selected.soldeFin)); }}
                    className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 text-white py-2.5 rounded-xl font-medium hover:bg-emerald-400 transition text-sm">
                    <Banknote size={15} /> Encaisser
                  </button>
                  <button onClick={() => selectClient(null)}
                    className="px-4 border border-[var(--border-primary)] text-[var(--text-secondary)] py-2.5 rounded-xl hover:bg-[var(--bg-primary)] transition text-sm">
                    Fermer
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showPayModal && selected && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div className="bg-[var(--bg-card)] rounded-2xl shadow-2xl w-full max-w-sm p-6"
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-[var(--text-primary)]">Encaissement</h3>
                <button onClick={() => setShowPayModal(false)}><X size={18} className="text-[var(--text-secondary)]" /></button>
              </div>
              <div className="text-sm text-[var(--text-secondary)] mb-1">{selected.raisonSocial}</div>
              <div className="text-red-600 font-bold mb-4">Solde : {fmt(selected.soldeFin)} TND</div>
              <div className="mb-4">
                <label className="text-xs text-[var(--text-secondary)] mb-1 block">Montant encaissé (TND)</label>
                <input value={payAmount} onChange={(e) => setPayAmount(e.target.value)} type="number" step="any"
                  className="w-full px-4 py-3 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl text-lg font-bold focus:outline-none text-center" />
              </div>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {["Espèces", "Chèque", "Virement"].map((m) => (
                  <button key={m} onClick={() => setMode(m)}
                    className={`py-2 text-xs rounded-xl transition border ${
                      mode === m ? "bg-emerald-500 text-white border-transparent" : "border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]"
                    }`}>{m}</button>
                ))}
              </div>
              <button onClick={encaisser} disabled={saving}
                className="w-full bg-emerald-500 text-white py-3 rounded-xl font-bold hover:bg-emerald-400 transition disabled:opacity-60 flex items-center justify-center gap-2">
                {saving && <Loader2 className="animate-spin" size={16} />} Confirmer l&apos;encaissement
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
