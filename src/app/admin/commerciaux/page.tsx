"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FileText, AlertTriangle, ArrowUpRight, ArrowRightLeft, X, Loader2 } from "lucide-react";
import { confirmer } from "@/lib/alertes";

type Ligne = { vendeur: string; ca: number; docs: number; clients: number; impaye: number };

const fmt0 = (n: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n ?? 0);

export default function CommerciauxPage() {
  const [rows, setRows] = useState<Ligne[]>([]);
  // Transfert de portefeuille d'un commercial vers un autre (ADMIN).
  const [transfert, setTransfert] = useState(false);
  const [totalCA, setTotalCA] = useState(0);
  const [loading, setLoading] = useState(true);

  // Rechargé après un transfert de portefeuille : les compteurs de clients
  // par commercial changent.
  const charger = useCallback(() => {
    fetch("/api/commerciaux")
      .then((r) => r.json())
      .then((d) => { setRows(d.rows ?? []); setTotalCA(d.totalCA ?? 0); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(charger, [charger]);

  const maxCA = Math.max(1, ...rows.map((r) => r.ca));

  return (
    <div className="space-y-6 animate-fade-in text-[var(--text-primary)]">
      <div className="flex items-center justify-between border-b border-[var(--border-primary)] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight">Commerciaux</h1>
            <span className="text-[10px] font-extrabold bg-[var(--accent-light)] text-[var(--accent-primary)] px-2.5 py-0.5 rounded-full border border-[var(--border-primary)] uppercase tracking-wider">
              {rows.length} vendeurs
            </span>
          </div>
          <p className="text-[var(--text-secondary)] opacity-80 text-xs mt-1">
            Cliquez sur un commercial pour ouvrir sa fiche d&apos;activité — 12 derniers mois
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => setTransfert(true)}
            className="px-3.5 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-1.5"
            style={{ background: "var(--accent-primary)" }}>
            <ArrowRightLeft size={14} /> Transférer un portefeuille
          </button>
          <div className="text-right">
            <div className="text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)]">CA cumulé</div>
            <div className="text-lg font-extrabold tabular-nums">{fmt0(totalCA)} TND</div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-40 bg-[var(--bg-primary)] rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-center text-xs text-[var(--text-secondary)] py-16 opacity-70">
          Aucune vente enregistrée sur la période.
        </p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map((r, i) => (
            <Link key={r.vendeur} href={`/admin/commerciaux/${encodeURIComponent(r.vendeur)}`}
              className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-primary)] shadow-sm p-5 hover:shadow-md hover:border-[var(--accent-primary)]/40 transition-all group animate-fade-in"
              style={{ animationDelay: `${i * 0.04}s` }}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-sm flex-shrink-0"
                    style={{ background: "var(--accent-primary)" }}>
                    {r.vendeur.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="font-extrabold text-sm truncate" title={r.vendeur}>{r.vendeur}</div>
                    <div className="text-[10px] text-[var(--text-secondary)] opacity-70">{fmt0(r.clients)} clients</div>
                  </div>
                </div>
                <ArrowUpRight size={15} className="text-[var(--text-secondary)] opacity-40 group-hover:opacity-100 group-hover:text-[var(--accent-primary)] transition flex-shrink-0" />
              </div>

              <div className="text-xl font-extrabold tabular-nums">{fmt0(r.ca)} <span className="text-xs font-bold text-[var(--text-secondary)]">TND</span></div>
              <div className="w-full bg-[var(--bg-primary)] h-1.5 rounded-full overflow-hidden border border-[var(--border-primary)] mt-2 mb-3">
                <div className="bg-gradient-primary h-full rounded-full" style={{ width: `${(r.ca / maxCA) * 100}%` }} />
              </div>

              <div className="flex items-center justify-between text-[10px] text-[var(--text-secondary)]">
                <span className="flex items-center gap-1"><FileText size={11} /> {fmt0(r.docs)} docs</span>
                {r.impaye > 0 && (
                  <span className="flex items-center gap-1 text-amber-500 font-bold">
                    <AlertTriangle size={11} /> {fmt0(r.impaye)} TND dus
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      {transfert && (
        <TransfertPortefeuille
          vendeurs={rows}
          onClose={() => setTransfert(false)}
          onFait={() => { setTransfert(false); charger(); }}
        />
      )}
    </div>
  );
}

/**
 * Réaffectation d'un portefeuille client d'un commercial à un autre.
 *
 * Seul le rattachement (`Partner.commercial`) change : l'historique des ventes
 * reste au commercial qui les a réalisées, sinon le CA par vendeur et les
 * commissions déjà versées deviendraient faux.
 */
function TransfertPortefeuille({
  vendeurs, onClose, onFait,
}: {
  vendeurs: Ligne[];
  onClose: () => void;
  onFait: () => void;
}) {
  const [source, setSource] = useState("");
  const [cible, setCible] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const nbSource = vendeurs.find((v) => v.vendeur === source)?.clients ?? 0;

  async function valider() {
    setErreur(null);
    if (!source || !cible) { setErreur("Choisissez le commercial source et le commercial cible"); return; }
    if (source === cible) { setErreur("Source et cible sont le même commercial"); return; }
    if (!(await confirmer(`Transférer les ${nbSource} client(s) de « ${source} » vers « ${cible} » ?`, { danger: true }))) return;

    setEnvoi(true);
    const r = await fetch("/api/commerciaux", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vue: "transfert", source, cible }),
    }).then((x) => x.json()).catch(() => ({ error: "réseau" }));
    setEnvoi(false);
    if (r.ok) onFait(); else setErreur(r.error ?? "Échec du transfert");
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[var(--bg-card)] rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-primary)]">
          <div className="flex items-center gap-2">
            <ArrowRightLeft size={16} style={{ color: "var(--accent-primary)" }} />
            <div className="font-bold text-sm">Transférer un portefeuille</div>
          </div>
          <button onClick={onClose} aria-label="Fermer"
            className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--accent-light)]">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <label className="block">
            <span className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Commercial source</span>
            <select value={source} onChange={(e) => setSource(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[var(--border-primary)] text-sm bg-[var(--bg-primary)]">
              <option value="">— Choisir —</option>
              {vendeurs.map((v) => (
                <option key={v.vendeur} value={v.vendeur}>{v.vendeur} ({v.clients} clients)</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Commercial cible</span>
            <select value={cible} onChange={(e) => setCible(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[var(--border-primary)] text-sm bg-[var(--bg-primary)]">
              <option value="">— Choisir —</option>
              {vendeurs.filter((v) => v.vendeur !== source).map((v) => (
                <option key={v.vendeur} value={v.vendeur}>{v.vendeur} ({v.clients} clients)</option>
              ))}
            </select>
          </label>

          {source && (
            <div className="text-[11px] text-[var(--text-secondary)] bg-[var(--bg-primary)] rounded-xl px-3 py-2">
              {nbSource} client(s) seront rattachés à leur nouveau commercial.
              L&apos;historique des ventes reste au vendeur d&apos;origine.
            </div>
          )}

          {erreur && (
            <div className="text-xs text-red-600 bg-red-500/10 border border-red-500/25 rounded-xl px-3 py-2 flex items-start gap-2">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" /> {erreur}
            </div>
          )}
        </div>

        <div className="flex gap-3 px-5 py-4 border-t border-[var(--border-primary)]">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-[var(--border-primary)] text-[var(--text-secondary)]">
            Annuler
          </button>
          <button onClick={valider} disabled={envoi || !source || !cible}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ background: "var(--accent-primary)" }}>
            {envoi && <Loader2 size={15} className="animate-spin" />} Transférer
          </button>
        </div>
      </div>
    </div>
  );
}
