"use client";
import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  BookOpen, Scale, FileText, Loader2, Check, AlertTriangle,
  Play, RotateCcw, Download, Settings, Info,
} from "lucide-react";

// Intégration comptable : documents commerciaux → écritures, balance, grand livre.

type DocAInt = {
  refDoc: string; typeDoc: string; dateDoc: string | null; raisonSocial: string | null;
  thtNet: number; totTva: number; ttcNet: number; valide: boolean;
};
type BalanceRow = {
  numCompte: string; libelleCompte: string; classe: number;
  debit: number; credit: number; soldeDebiteur: number; soldeCrediteur: number; nbEcritures: number;
};
type Ecriture = {
  id: number; numPiece: string; numOrdre: number; numCompte: string; libelleCompte: string | null;
  libelleEcriture: string | null; dateEcriture: string; refDoc: string | null;
  debit: number; credit: number; codeJournal: string;
};
type Exercice = { id: number; libelle: string; annee: number; cloture: boolean; courant: boolean };

const fmt = (v: unknown) =>
  new Intl.NumberFormat("fr-TN", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(Number(v) || 0);
const fmtDate = (v: unknown) => (v ? new Date(String(v)).toLocaleDateString("fr-FR") : "—");

const CLASSE_COULEUR: Record<number, string> = {
  1: "#8b5cf6", 2: "#3b82f6", 3: "#f59e0b", 4: "#ec4899", 5: "#10b981", 6: "#ef4444", 7: "#22c55e",
};

const VUES = ["À intégrer", "Balance", "Journal", "Grand livre", "Résultat", "Bilan", "Plan standard"] as const;
type Vue = (typeof VUES)[number];

type LigneBilan = {
  id: number; libelle: string; formule: string; type: string;
  rubrique: string | null; numOrdre: number; montant: number;
  comptes: { numCompte: string; solde: number }[]; alerte?: string;
};
type BilanData = {
  actif: LigneBilan[]; passif: LigneBilan[];
  totalActif: number; totalPassif: number; ecart: number;
  equilibre: boolean; resultat: number; alertes: string[];
};

export default function IntegrationCompta({ accent }: { accent: string }) {
  const [vue, setVue] = useState<Vue>("À intégrer");
  const [exercices, setExercices] = useState<Exercice[]>([]);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);

  const flash = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4500);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/comptabilite?vue=exercices")
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setExercices(d.rows ?? []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [reload]);

  async function initPlan() {
    setBusy(true);
    const r = await fetch("/api/comptabilite", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "init-plan" }),
    }).then((x) => x.json());
    setBusy(false);
    flash(r.message ?? "Plan initialisé", Boolean(r.ok));
    setReload((k) => k + 1);
  }

  async function creerExercice() {
    const annee = new Date().getFullYear();
    setBusy(true);
    const r = await fetch("/api/comptabilite", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "exercice", annee, courant: true }),
    }).then((x) => x.json());
    setBusy(false);
    flash(r.message ?? "Exercice créé", Boolean(r.ok));
    setReload((k) => k + 1);
  }

  const sansExercice = exercices.length === 0;

  return (
    <div className="space-y-4">
      {toast && (
        <div className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 ${
          toast.ok ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-red-500/10 text-red-600"
        }`}>
          {toast.ok ? <Check size={15} /> : <AlertTriangle size={15} />} {toast.msg}
        </div>
      )}

      {sansExercice && (
        <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-500/25 bg-amber-50 dark:bg-amber-500/10">
          <div className="font-semibold text-amber-800 dark:text-amber-400 text-sm mb-1">
            Aucun exercice comptable
          </div>
          <p className="text-amber-700 dark:text-amber-500 text-xs mb-3">
            Créez l&apos;exercice courant et initialisez le plan comptable pour pouvoir intégrer les documents.
          </p>
          <div className="flex gap-2">
            <button onClick={creerExercice} disabled={busy}
              className="px-3 py-1.5 text-xs font-semibold text-white rounded-lg disabled:opacity-50" style={{ background: accent }}>
              Créer l&apos;exercice {new Date().getFullYear()}
            </button>
            <button onClick={initPlan} disabled={busy}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-[var(--border-primary)] text-[var(--text-secondary)] disabled:opacity-50">
              <Settings size={12} className="inline mr-1" /> Initialiser le plan
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-1.5 flex-wrap">
          {VUES.map((v) => (
            <button key={v} onClick={() => setVue(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                vue === v ? "text-white border-transparent shadow-sm"
                  : "bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border-primary)] hover:text-[var(--text-primary)]"
              }`}
              style={vue === v ? { background: accent } : undefined}>
              {v}
            </button>
          ))}
        </div>
        {!sansExercice && (
          <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            {exercices.filter((e) => e.courant).map((e) => (
              <span key={e.id} className="px-2 py-1 rounded-lg bg-[var(--accent-light)] text-[var(--accent-primary)] font-semibold">
                {e.libelle}{e.cloture ? " (clôturé)" : ""}
              </span>
            ))}
            <button onClick={initPlan} disabled={busy} title="Réinitialiser journaux et plan"
              className="p-1.5 rounded-lg border border-[var(--border-primary)]"><Settings size={13} /></button>
          </div>
        )}
      </div>

      {vue === "À intégrer" && <AIntegrer accent={accent} onFlash={flash} reload={reload} onDone={() => setReload((k) => k + 1)} />}
      {vue === "Balance" && <Balance accent={accent} reload={reload} />}
      {vue === "Journal" && <Journal accent={accent} reload={reload} onFlash={flash} onDone={() => setReload((k) => k + 1)} />}
      {vue === "Grand livre" && <GrandLivre accent={accent} reload={reload} />}
      {vue === "Résultat" && <Resultat accent={accent} reload={reload} />}
      {vue === "Bilan" && <Bilan accent={accent} reload={reload} onFlash={flash} />}
      {vue === "Plan standard" && <PlanStandard accent={accent} onFlash={flash} />}
    </div>
  );
}

/* ------------------------------- À intégrer ------------------------------- */

function AIntegrer({ accent, onFlash, reload, onDone }: {
  accent: string; onFlash: (m: string, ok?: boolean) => void; reload: number; onDone: () => void;
}) {
  const [rows, setRows] = useState<DocAInt[]>([]);
  const [total, setTotal] = useState(0);
  const [dejaIntegres, setDeja] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/comptabilite?vue=a-integrer")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setRows(d.rows ?? []); setTotal(d.total ?? 0); setDeja(d.dejaIntegres ?? 0); setSel(new Set());
        setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [reload]);

  async function integrer(refs: string[]) {
    if (refs.length === 0) return;
    setBusy(true);
    const r = await fetch("/api/comptabilite", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "integrer", refDocs: refs }),
    }).then((x) => x.json());
    setBusy(false);
    onFlash(r.message ?? "Intégration terminée", Boolean(r.ok));
    onDone();
  }

  const toggle = (ref: string) =>
    setSel((p) => { const n = new Set(p); n.has(ref) ? n.delete(ref) : n.add(ref); return n; });

  return (
    <div className="space-y-3">
      {/* À quoi sert cet écran.
          « Intégrer » ne dit pas où va le document : sans cette explication,
          l'utilisateur clique sans savoir ce qu'il déclenche ni où regarder
          ensuite. On décrit donc l'opération, sa destination et sa
          réversibilité, avec la contrepartie effectivement appliquée. */}
      <details className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)] overflow-hidden">
        <summary className="px-4 py-2.5 cursor-pointer text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
          <Info size={14} style={{ color: accent }} />
          À quoi sert l&apos;intégration comptable ?
        </summary>
        <div className="px-4 pb-4 pt-1 text-xs text-[var(--text-secondary)] space-y-2.5 leading-relaxed">
          <p>
            Vos factures et tickets vivent dans <b>Vente</b> et <b>Achat</b>. La comptabilité,
            elle, raisonne en <b>écritures</b> : chaque document doit devenir un mouvement
            équilibré entre comptes (débit = crédit). <b>Intégrer</b> fait cette traduction
            automatiquement.
          </p>
          <div className="rounded-lg bg-[var(--bg-card)] border border-[var(--border-primary)] p-3">
            <div className="font-bold text-[var(--text-primary)] mb-1.5">
              Exemple — un ticket de 982,578 TND TTC
            </div>
            <table className="w-full">
              <tbody className="divide-y divide-[var(--border-primary)]">
                <tr><td className="py-1">411000 · Client</td>
                    <td className="py-1 text-right font-semibold">débit 982,578</td></tr>
                <tr><td className="py-1">707000 · Ventes de marchandises</td>
                    <td className="py-1 text-right font-semibold">crédit 821,712</td></tr>
                <tr><td className="py-1">436700 · TVA collectée</td>
                    <td className="py-1 text-right font-semibold">crédit 160,866</td></tr>
              </tbody>
            </table>
            <div className="mt-1.5 text-[11px]">
              Le client doit 982,578 ; l&apos;entreprise a gagné 821,712 et doit 160,866 de TVA à l&apos;État.
            </div>
          </div>
          <p>
            <b>Où cela va-t-il ?</b> Les écritures créées alimentent les onglets
            <b> Écritures</b>, <b>Balance</b>, <b>État de résultat</b> et <b>Bilan</b>{" "}
            de cet écran — c&apos;est ce qui fait passer le résultat de l&apos;exercice de 0 à sa
            valeur réelle.
          </p>
          <p>
            <b>Réversible :</b>{" "}un document intégré peut être décomptabilisé ; ses écritures
            sont alors supprimées. Rien n&apos;est modifié dans les documents de vente ou d&apos;achat.
          </p>
        </div>
      </details>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm text-[var(--text-secondary)]">
          {loading ? "Chargement…" : `${total} document(s) à intégrer · ${dejaIntegres} déjà comptabilisé(s)`}
        </div>
        <div className="flex gap-2">
          <button onClick={() => integrer([...sel])} disabled={busy || sel.size === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-40" style={{ background: accent }}>
            {busy ? <Loader2 className="animate-spin" size={14} /> : <Play size={14} />} Intégrer la sélection ({sel.size})
          </button>
          <button onClick={() => integrer(rows.slice(0, 50).map((r) => r.refDoc))} disabled={busy || rows.length === 0}
            className="px-3 py-2 rounded-xl text-sm font-semibold border border-[var(--border-primary)] text-[var(--text-secondary)] disabled:opacity-40">
            Intégrer les 50 premiers
          </button>
        </div>
      </div>

      <div className="overflow-auto rounded-xl border border-[var(--border-primary)] max-h-[55vh]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--bg-primary)] border-b border-[var(--border-primary)] sticky top-0 z-10">
            <tr className="text-[11px] uppercase tracking-wide text-[var(--text-secondary)]">
              <th className="px-3 py-2.5 w-10">
                <input type="checkbox"
                  checked={rows.length > 0 && sel.size === rows.length}
                  onChange={(e) => setSel(e.target.checked ? new Set(rows.map((r) => r.refDoc)) : new Set())}
                  style={{ accentColor: accent }} />
              </th>
              <th className="px-3 py-2.5 text-left font-semibold">Référence</th>
              <th className="px-3 py-2.5 text-left font-semibold">Type</th>
              <th className="px-3 py-2.5 text-left font-semibold">Date</th>
              <th className="px-3 py-2.5 text-left font-semibold">Client</th>
              <th className="px-3 py-2.5 text-right font-semibold">HT</th>
              <th className="px-3 py-2.5 text-right font-semibold">TVA</th>
              <th className="px-3 py-2.5 text-right font-semibold">TTC</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={8} className="py-12 text-center text-[var(--text-secondary)]"><Loader2 className="animate-spin inline" size={18} /></td></tr>}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={8} className="py-12 text-center text-sm text-[var(--text-secondary)]">
                Tous les documents sont comptabilisés.
              </td></tr>
            )}
            {rows.map((d) => (
              <tr key={d.refDoc} className="border-b border-[var(--border-primary)]/60 hover:bg-[var(--accent-light)]">
                <td className="px-3 py-2 text-center">
                  <input type="checkbox" checked={sel.has(d.refDoc)} onChange={() => toggle(d.refDoc)} style={{ accentColor: accent }} />
                </td>
                <td className="px-3 py-2 font-medium text-[var(--text-primary)]">{d.refDoc}</td>
                <td className="px-3 py-2">
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-[var(--accent-light)] text-[var(--accent-primary)]">{d.typeDoc}</span>
                </td>
                <td className="px-3 py-2 text-[var(--text-secondary)]">{fmtDate(d.dateDoc)}</td>
                <td className="px-3 py-2 text-[var(--text-secondary)] truncate max-w-xs">{d.raisonSocial || "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmt(d.thtNet)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-[var(--text-secondary)]">{fmt(d.totTva)}</td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold">{fmt(d.ttcNet)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* --------------------------------- Balance -------------------------------- */

function Balance({ accent, reload }: { accent: string; reload: number }) {
  const [rows, setRows] = useState<BalanceRow[]>([]);
  const [meta, setMeta] = useState<{ totalDebit: number; totalCredit: number; equilibre: boolean } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/comptabilite?vue=balance")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setRows(d.rows ?? []);
        setMeta({ totalDebit: d.totalDebit ?? 0, totalCredit: d.totalCredit ?? 0, equilibre: Boolean(d.equilibre) });
        setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [reload]);

  function exportCsv() {
    const head = ["Compte", "Intitulé", "Débit", "Crédit", "Solde débiteur", "Solde créditeur"].join(";");
    const lines = rows.map((r) => [r.numCompte, r.libelleCompte.replace(/;/g, ","), r.debit, r.credit, r.soldeDebiteur, r.soldeCrediteur].join(";"));
    const csv = "﻿" + [head, ...lines].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "balance.csv"; a.click(); URL.revokeObjectURL(url);
  }

  if (loading) return <div className="py-12 text-center text-[var(--text-secondary)]"><Loader2 className="animate-spin inline" size={20} /></div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        {meta && (
          <div className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${
            meta.equilibre ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-red-500/10 text-red-600"
          }`}>
            {meta.equilibre ? "✓ Balance équilibrée" : "✗ Balance déséquilibrée"} — débit {fmt(meta.totalDebit)} / crédit {fmt(meta.totalCredit)}
          </div>
        )}
        <button onClick={exportCsv} disabled={rows.length === 0}
          className="flex items-center gap-1.5 border border-[var(--border-primary)] text-emerald-600 px-3 py-1.5 rounded-lg text-sm disabled:opacity-40">
          <Download size={14} /> Excel
        </button>
      </div>

      <div className="overflow-auto rounded-xl border border-[var(--border-primary)] max-h-[55vh]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--bg-primary)] border-b border-[var(--border-primary)] sticky top-0 z-10">
            <tr className="text-[11px] uppercase tracking-wide text-[var(--text-secondary)]">
              <th className="px-4 py-2.5 text-left font-semibold">Compte</th>
              <th className="px-4 py-2.5 text-left font-semibold">Intitulé</th>
              <th className="px-4 py-2.5 text-center font-semibold">Cl.</th>
              <th className="px-4 py-2.5 text-right font-semibold">Débit</th>
              <th className="px-4 py-2.5 text-right font-semibold">Crédit</th>
              <th className="px-4 py-2.5 text-right font-semibold">Solde débiteur</th>
              <th className="px-4 py-2.5 text-right font-semibold">Solde créditeur</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={7} className="py-12 text-center text-sm text-[var(--text-secondary)]">
                Aucune écriture. Intégrez des documents depuis l&apos;onglet « À intégrer ».
              </td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.numCompte} className="border-b border-[var(--border-primary)]/60 hover:bg-[var(--accent-light)]">
                <td className="px-4 py-2 font-mono text-xs font-semibold">{r.numCompte}</td>
                <td className="px-4 py-2 text-[var(--text-primary)]">{r.libelleCompte}</td>
                <td className="px-4 py-2 text-center">
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold text-white"
                    style={{ background: CLASSE_COULEUR[r.classe] ?? "#64748b" }}>{r.classe}</span>
                </td>
                <td className="px-4 py-2 text-right tabular-nums">{fmt(r.debit)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{fmt(r.credit)}</td>
                <td className="px-4 py-2 text-right tabular-nums font-semibold">{r.soldeDebiteur > 0 ? fmt(r.soldeDebiteur) : "—"}</td>
                <td className="px-4 py-2 text-right tabular-nums font-semibold">{r.soldeCrediteur > 0 ? fmt(r.soldeCrediteur) : "—"}</td>
              </tr>
            ))}
          </tbody>
          {meta && rows.length > 0 && (
            <tfoot className="bg-[var(--bg-primary)] border-t-2 border-[var(--border-primary)] sticky bottom-0">
              <tr>
                <td colSpan={3} className="px-4 py-2.5 font-bold text-xs uppercase tracking-wide">Totaux</td>
                <td className="px-4 py-2.5 text-right font-black tabular-nums" style={{ color: accent }}>{fmt(meta.totalDebit)}</td>
                <td className="px-4 py-2.5 text-right font-black tabular-nums" style={{ color: accent }}>{fmt(meta.totalCredit)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

/* --------------------------------- Journal -------------------------------- */

function Journal({ accent, reload, onFlash, onDone }: {
  accent: string; reload: number; onFlash: (m: string, ok?: boolean) => void; onDone: () => void;
}) {
  const [rows, setRows] = useState<Ecriture[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/comptabilite?vue=ecritures")
      .then((r) => r.json())
      .then((d) => { if (!cancelled) { setRows(d.rows ?? []); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [reload]);

  async function annuler(refDoc: string) {
    if (!confirm(`Annuler la pièce du document ${refDoc} ?`)) return;
    const r = await fetch("/api/comptabilite", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "annuler", refDoc }),
    }).then((x) => x.json());
    onFlash(r.message ?? "Annulée", Boolean(r.ok));
    onDone();
  }

  if (loading) return <div className="py-12 text-center text-[var(--text-secondary)]"><Loader2 className="animate-spin inline" size={20} /></div>;

  // Regroupement par pièce comptable.
  const pieces = new Map<string, Ecriture[]>();
  for (const e of rows) {
    const l = pieces.get(e.numPiece) ?? [];
    l.push(e);
    pieces.set(e.numPiece, l);
  }

  return (
    <div className="space-y-3">
      {pieces.size === 0 && (
        <div className="py-12 text-center text-sm text-[var(--text-secondary)]">Aucune écriture enregistrée.</div>
      )}
      {[...pieces.entries()].map(([numPiece, lignes]) => {
        const td = lignes.reduce((s, l) => s + l.debit, 0);
        const tc = lignes.reduce((s, l) => s + l.credit, 0);
        const eq = Math.abs(td - tc) < 0.001;
        return (
          <motion.div key={numPiece} className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-primary)] overflow-hidden"
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center justify-between px-4 py-2.5 bg-[var(--bg-primary)] border-b border-[var(--border-primary)]">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-mono text-xs font-bold" style={{ color: accent }}>{numPiece}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-[var(--accent-light)] text-[var(--accent-primary)]">
                  {lignes[0].codeJournal}
                </span>
                <span className="text-xs text-[var(--text-secondary)] truncate">
                  {lignes[0].libelleEcriture} · {fmtDate(lignes[0].dateEcriture)}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  eq ? "bg-emerald-500/12 text-emerald-600" : "bg-red-500/12 text-red-600"
                }`}>{eq ? "Équilibrée" : "Déséquilibrée"}</span>
                {lignes[0].refDoc && (
                  <button onClick={() => annuler(lignes[0].refDoc!)} title="Annuler la pièce"
                    className="p-1 rounded-lg text-red-600 hover:bg-red-500/10"><RotateCcw size={13} /></button>
                )}
              </div>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {lignes.sort((a, b) => a.numOrdre - b.numOrdre).map((l) => (
                  <tr key={l.id} className="border-b border-[var(--border-primary)]/40 last:border-0">
                    <td className="px-4 py-1.5 font-mono text-xs w-24">{l.numCompte}</td>
                    <td className="px-4 py-1.5 text-[var(--text-secondary)]">{l.libelleCompte}</td>
                    <td className="px-4 py-1.5 text-right tabular-nums w-32">{l.debit > 0 ? fmt(l.debit) : ""}</td>
                    <td className="px-4 py-1.5 text-right tabular-nums w-32">{l.credit > 0 ? fmt(l.credit) : ""}</td>
                  </tr>
                ))}
                <tr className="bg-[var(--bg-primary)] font-bold">
                  <td colSpan={2} className="px-4 py-1.5 text-xs uppercase tracking-wide">Total</td>
                  <td className="px-4 py-1.5 text-right tabular-nums">{fmt(td)}</td>
                  <td className="px-4 py-1.5 text-right tabular-nums">{fmt(tc)}</td>
                </tr>
              </tbody>
            </table>
          </motion.div>
        );
      })}
    </div>
  );
}

/* ------------------------------- Grand livre ------------------------------ */

function GrandLivre({ accent, reload }: { accent: string; reload: number }) {
  const [comptes, setComptes] = useState<BalanceRow[]>([]);
  const [compte, setCompte] = useState("");
  const [rows, setRows] = useState<(Ecriture & { solde: number })[]>([]);
  const [meta, setMeta] = useState<{ totalDebit: number; totalCredit: number; soldeFinal: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/comptabilite?vue=balance")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const cs: BalanceRow[] = d.rows ?? [];
        setComptes(cs);
        if (!compte && cs[0]) setCompte(cs[0].numCompte);
        setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload]);

  useEffect(() => {
    if (!compte) return;
    let cancelled = false;
    fetch(`/api/comptabilite?vue=grand-livre&compte=${encodeURIComponent(compte)}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setRows(d.rows ?? []);
        setMeta({ totalDebit: d.totalDebit ?? 0, totalCredit: d.totalCredit ?? 0, soldeFinal: d.soldeFinal ?? 0 });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [compte, reload]);

  if (loading) return <div className="py-12 text-center text-[var(--text-secondary)]"><Loader2 className="animate-spin inline" size={20} /></div>;

  if (comptes.length === 0) {
    return <div className="py-12 text-center text-sm text-[var(--text-secondary)]">Aucun compte mouvementé.</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <BookOpen size={16} style={{ color: accent }} />
        <select value={compte} onChange={(e) => setCompte(e.target.value)}
          className="px-3 py-2 text-sm bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl focus:outline-none">
          {comptes.map((c) => <option key={c.numCompte} value={c.numCompte}>{c.numCompte} — {c.libelleCompte}</option>)}
        </select>
        {meta && (
          <span className="ml-auto text-sm font-semibold" style={{ color: accent }}>
            Solde : {fmt(meta.soldeFinal)} TND
          </span>
        )}
      </div>

      <div className="overflow-auto rounded-xl border border-[var(--border-primary)] max-h-[55vh]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--bg-primary)] border-b border-[var(--border-primary)] sticky top-0 z-10">
            <tr className="text-[11px] uppercase tracking-wide text-[var(--text-secondary)]">
              <th className="px-4 py-2.5 text-left font-semibold">Date</th>
              <th className="px-4 py-2.5 text-left font-semibold">Pièce</th>
              <th className="px-4 py-2.5 text-left font-semibold">Libellé</th>
              <th className="px-4 py-2.5 text-left font-semibold">Document</th>
              <th className="px-4 py-2.5 text-right font-semibold">Débit</th>
              <th className="px-4 py-2.5 text-right font-semibold">Crédit</th>
              <th className="px-4 py-2.5 text-right font-semibold">Solde</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={7} className="py-12 text-center text-sm text-[var(--text-secondary)]">Aucun mouvement sur ce compte.</td></tr>
            )}
            {rows.map((e) => (
              <tr key={e.id} className="border-b border-[var(--border-primary)]/60 hover:bg-[var(--accent-light)]">
                <td className="px-4 py-2 text-[var(--text-secondary)]">{fmtDate(e.dateEcriture)}</td>
                <td className="px-4 py-2 font-mono text-xs">{e.numPiece}</td>
                <td className="px-4 py-2 text-[var(--text-primary)]">{e.libelleCompte}</td>
                <td className="px-4 py-2 text-[var(--text-secondary)] text-xs">{e.refDoc ?? "—"}</td>
                <td className="px-4 py-2 text-right tabular-nums">{e.debit > 0 ? fmt(e.debit) : ""}</td>
                <td className="px-4 py-2 text-right tabular-nums">{e.credit > 0 ? fmt(e.credit) : ""}</td>
                <td className="px-4 py-2 text-right tabular-nums font-semibold">{fmt(e.solde)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* -------------------------------- Résultat -------------------------------- */

function Resultat({ accent, reload }: { accent: string; reload: number }) {
  const [data, setData] = useState<{
    charges: number; produits: number; resultat: number;
    detailCharges: BalanceRow[]; detailProduits: BalanceRow[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/comptabilite?vue=resultat")
      .then((r) => r.json())
      .then((d) => { if (!cancelled) { setData(d); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [reload]);

  if (loading) return <div className="py-12 text-center text-[var(--text-secondary)]"><Loader2 className="animate-spin inline" size={20} /></div>;
  if (!data) return null;

  const benefice = data.resultat >= 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card label="Produits (classe 7)" value={fmt(data.produits)} color="#22c55e" icon={FileText} />
        <Card label="Charges (classe 6)" value={fmt(data.charges)} color="#ef4444" icon={Scale} />
        <Card label={benefice ? "Bénéfice" : "Perte"} value={fmt(Math.abs(data.resultat))}
          color={benefice ? "#16a34a" : "#dc2626"} icon={Scale} strong />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <DetailTable titre="Produits" rows={data.detailProduits} accent="#22c55e" sens="credit" />
        <DetailTable titre="Charges" rows={data.detailCharges} accent="#ef4444" sens="debit" />
      </div>
    </div>
  );
}

function DetailTable({ titre, rows, accent, sens }: {
  titre: string; rows: BalanceRow[]; accent: string; sens: "debit" | "credit";
}) {
  return (
    <div className="rounded-xl border border-[var(--border-primary)] overflow-hidden">
      <div className="px-4 py-2.5 bg-[var(--bg-primary)] border-b border-[var(--border-primary)] font-bold text-sm" style={{ color: accent }}>
        {titre}
      </div>
      <table className="w-full text-sm">
        <tbody>
          {rows.length === 0 && (
            <tr><td className="px-4 py-6 text-center text-xs text-[var(--text-secondary)]">Aucun compte mouvementé.</td></tr>
          )}
          {rows.map((r) => (
            <tr key={r.numCompte} className="border-b border-[var(--border-primary)]/40 last:border-0">
              <td className="px-4 py-1.5 font-mono text-xs w-24">{r.numCompte}</td>
              <td className="px-4 py-1.5 text-[var(--text-secondary)]">{r.libelleCompte}</td>
              <td className="px-4 py-1.5 text-right tabular-nums font-semibold">
                {fmt(sens === "credit" ? r.credit - r.debit : r.debit - r.credit)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Card({ label, value, color, icon: Icon, strong }: {
  label: string; value: string; color: string; icon: React.ElementType; strong?: boolean;
}) {
  return (
    <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-primary)] p-4">
      <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-2" style={{ background: color + "18", color }}>
        <Icon size={16} />
      </div>
      <div className={`tabular-nums ${strong ? "text-xl font-extrabold" : "text-lg font-bold"}`} style={{ color }}>
        {value} TND
      </div>
      <div className="text-[var(--text-secondary)] text-xs mt-0.5">{label}</div>
    </div>
  );
}

/* ----------------------------------- Bilan ---------------------------------- */

// Bilan actif / passif construit depuis les formules paramétrées.
// Chaque ligne agrège des comptes ; le résultat de l'exercice est ajouté au
// passif, sinon le bilan ne pourrait pas s'équilibrer.
function Bilan({ accent, reload, onFlash }: {
  accent: string; reload: number; onFlash: (m: string, ok?: boolean) => void;
}) {
  const [data, setData] = useState<BilanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [modele, setModele] = useState(false);
  const [lignes, setLignes] = useState<LigneBilan[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/comptabilite?vue=bilan")
      .then((r) => r.json())
      .then((d) => { if (!cancelled) { setData(d.error ? null : d); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [reload, tick]);

  useEffect(() => {
    if (!modele) return;
    let cancelled = false;
    fetch("/api/comptabilite?vue=param-bilan")
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setLignes(d.rows ?? []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [modele, tick]);

  const action = async (body: Record<string, unknown>) => {
    setBusy(true);
    try {
      const r = await fetch("/api/comptabilite", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const d = await r.json();
      onFlash(d.message ?? d.error ?? "Terminé", r.ok);
      if (r.ok) setTick((k) => k + 1);
    } finally { setBusy(false); }
  };

  const majFormule = async (id: number, formule: string) => {
    const r = await fetch("/api/comptabilite", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vue: "param-bilan", id, formule }),
    });
    if (!r.ok) return onFlash("Échec de la modification", false);
    setTick((k) => k + 1);
  };

  const exporter = () => {
    if (!data) return;
    const rows = [
      ...data.actif.map((l) => ["ACTIF", l.rubrique ?? "", l.libelle, l.montant]),
      ["", "", "TOTAL ACTIF", data.totalActif],
      ...data.passif.map((l) => ["PASSIF", l.rubrique ?? "", l.libelle, l.montant]),
      ["", "", "TOTAL PASSIF", data.totalPassif],
    ];
    const esc = (v: string | number) => {
      const t = String(v ?? "");
      return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
    };
    const contenu = [["Type", "Rubrique", "Libellé", "Montant"].join(";"),
      ...rows.map((r) => r.map(esc).join(";"))].join("\n");
    const url = URL.createObjectURL(new Blob([`﻿${contenu}`], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = "bilan.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className="py-12 text-center text-[var(--text-secondary)]"><Loader2 className="animate-spin inline" size={20} /></div>;
  }
  if (!data) {
    return (
      <div className="py-10 text-center space-y-3">
        <div className="text-sm text-[var(--text-secondary)]">
          Aucun exercice courant — créez-en un dans l&apos;onglet « À intégrer ».
        </div>
      </div>
    );
  }

  const parRubrique = (ls: LigneBilan[]) => {
    const m = new Map<string, LigneBilan[]>();
    for (const l of ls) {
      const k = l.rubrique ?? "Autres";
      m.set(k, [...(m.get(k) ?? []), l]);
    }
    return [...m.entries()];
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-2 items-center">
          <button onClick={() => action({ action: "init-bilan" })} disabled={busy}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--border-primary)] flex items-center gap-1.5 disabled:opacity-50">
            <Settings size={13} /> Initialiser le modèle
          </button>
          <button onClick={() => setModele((v) => !v)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--border-primary)]">
            {modele ? "Masquer" : "Paramétrer"} les formules
          </button>
        </div>
        <div className="flex gap-2">
          <button onClick={exporter}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--border-primary)] flex items-center gap-1.5">
            <Download size={13} /> CSV
          </button>
          <button onClick={() => action({ action: "figer-bilan" })} disabled={busy}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 disabled:opacity-50"
            style={{ background: accent }}>
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Arrêter le bilan
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card label="Total actif" value={fmt(data.totalActif)} color="#3b82f6" icon={Scale} />
        <Card label="Total passif" value={fmt(data.totalPassif)} color="#8b5cf6" icon={Scale} />
        <Card label={data.equilibre ? "Équilibré" : `Écart de ${fmt(data.ecart)}`}
          value={data.equilibre ? "✓" : fmt(Math.abs(data.ecart))}
          color={data.equilibre ? "#16a34a" : "#dc2626"} icon={data.equilibre ? Check : AlertTriangle} strong />
      </div>

      {data.alertes.length > 0 && (
        <div className="px-3 py-2 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs space-y-1">
          {data.alertes.map((a, i) => (
            <div key={i} className="flex items-start gap-2">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {a}
            </div>
          ))}
        </div>
      )}

      {modele && (
        <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl overflow-hidden">
          <div className="px-3 py-2 border-b border-[var(--border-primary)] text-xs text-[var(--text-secondary)]">
            Formule : comptes signés séparés par « ; » — par exemple <code>+21;-281</code>.
            Un préfixe agrège ses sous-comptes ; le préfixe le plus précis l&apos;emporte,
            donc un compte n&apos;est jamais compté deux fois.
          </div>
          <div className="overflow-x-auto max-h-72 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[var(--bg-primary)]">
                <tr className="text-[10px] uppercase tracking-wide text-[var(--text-secondary)]">
                  <th className="px-3 py-2 text-left font-semibold">Type</th>
                  <th className="px-3 py-2 text-left font-semibold">Libellé</th>
                  <th className="px-3 py-2 text-left font-semibold">Formule</th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((l) => (
                  <tr key={l.id} className="border-b border-[var(--border-primary)]/60">
                    <td className="px-3 py-1.5 text-xs">{l.type}</td>
                    <td className="px-3 py-1.5 text-xs">{l.libelle}</td>
                    <td className="px-3 py-1.5">
                      <input defaultValue={l.formule}
                        onBlur={(e) => e.target.value !== l.formule && majFormule(l.id, e.target.value)}
                        className="w-full px-2 py-1 rounded text-xs font-mono bg-[var(--bg-primary)] border border-[var(--border-primary)]" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <ColonneBilan titre="ACTIF" groupes={parRubrique(data.actif)} total={data.totalActif} couleur="#3b82f6" />
        <ColonneBilan titre="PASSIF" groupes={parRubrique(data.passif)} total={data.totalPassif} couleur="#8b5cf6" />
      </div>
    </div>
  );
}

function ColonneBilan({ titre, groupes, total, couleur }: {
  titre: string; groupes: [string, LigneBilan[]][]; total: number; couleur: string;
}) {
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl overflow-hidden">
      <div className="px-3 py-2 border-b border-[var(--border-primary)] font-bold text-xs uppercase tracking-wide"
        style={{ color: couleur }}>
        {titre}
      </div>
      <table className="w-full text-sm">
        <tbody>
          {groupes.length === 0 && (
            <tr><td className="px-3 py-6 text-center text-xs text-[var(--text-secondary)]">
              Aucune ligne paramétrée.
            </td></tr>
          )}
          {groupes.map(([rubrique, ls]) => (
            <>
              <tr key={rubrique} className="bg-[var(--bg-primary)]/50">
                <td colSpan={2} className="px-3 py-1.5 text-[10px] uppercase tracking-wide font-semibold text-[var(--text-secondary)]">
                  {rubrique}
                </td>
              </tr>
              {ls.map((l) => (
                <tr key={`${rubrique}-${l.id}`} className="border-b border-[var(--border-primary)]/50">
                  <td className="px-3 py-1.5 pl-5 text-xs" title={l.formule}>
                    {l.libelle}
                    {l.comptes.length > 0 && (
                      <span className="text-[var(--text-secondary)] ml-1.5">({l.comptes.length})</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{fmt(l.montant)}</td>
                </tr>
              ))}
            </>
          ))}
          <tr className="border-t-2" style={{ borderColor: couleur }}>
            <td className="px-3 py-2 font-bold text-xs">TOTAL {titre}</td>
            <td className="px-3 py-2 text-right font-bold tabular-nums" style={{ color: couleur }}>
              {fmt(total)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------ Plan standard ------------------------------ */

// Plan comptable standard : modèle réutilisable d'un exercice à l'autre
// (`plan_comptable_standard` de l'ERP source). La copie vers l'exercice
// n'ajoute que les comptes absents, sans écraser un compte déjà utilisé.
function PlanStandard({ accent, onFlash }: {
  accent: string; onFlash: (m: string, ok?: boolean) => void;
}) {
  const [rows, setRows] = useState<{ id: number; numCompte: string; intitule: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<{ numCompte: string; intitule: string } | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/comptabilite?vue=plan-standard")
      .then((r) => r.json())
      .then((d) => { if (!cancelled) { setRows(d.rows ?? []); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tick]);

  const action = async (body: Record<string, unknown>) => {
    setBusy(true);
    try {
      const r = await fetch("/api/comptabilite", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const d = await r.json();
      onFlash(d.message ?? d.error ?? "Terminé", r.ok);
      if (r.ok) { setTick((k) => k + 1); setForm(null); }
    } finally { setBusy(false); }
  };

  if (loading) {
    return <div className="py-12 text-center text-[var(--text-secondary)]"><Loader2 className="animate-spin inline" size={20} /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs text-[var(--text-secondary)] max-w-2xl">
          Le plan standard sert de modèle réutilisable. La copie vers l&apos;exercice
          n&apos;ajoute que les comptes <b>absents</b> : un compte déjà paramétré et utilisé
          par des écritures n&apos;est jamais écrasé.
        </p>
        <div className="flex gap-2">
          <button onClick={() => action({ action: "plan-standard", depuisExercice: true })} disabled={busy}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--border-primary)] disabled:opacity-50">
            Reprendre le plan de l&apos;exercice
          </button>
          <button onClick={() => action({ action: "copier-plan-standard" })} disabled={busy || rows.length === 0}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 disabled:opacity-50"
            style={{ background: accent }}>
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Copier vers l&apos;exercice
          </button>
          <button onClick={() => setForm({ numCompte: "", intitule: "" })}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--border-primary)]">
            + Compte
          </button>
        </div>
      </div>

      {form && (
        <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl p-4 flex flex-wrap gap-3 items-end">
          <label className="block">
            <span className="block text-[10px] uppercase tracking-wide text-[var(--text-secondary)] mb-1">N° compte *</span>
            <input value={form.numCompte} onChange={(e) => setForm({ ...form, numCompte: e.target.value })}
              placeholder="411000"
              className="px-2.5 py-1.5 rounded-lg text-xs bg-[var(--bg-primary)] border border-[var(--border-primary)] w-32" />
          </label>
          <label className="block flex-1 min-w-48">
            <span className="block text-[10px] uppercase tracking-wide text-[var(--text-secondary)] mb-1">Intitulé *</span>
            <input value={form.intitule} onChange={(e) => setForm({ ...form, intitule: e.target.value })}
              className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-[var(--bg-primary)] border border-[var(--border-primary)]" />
          </label>
          <button onClick={() => action({ action: "plan-standard", ...form })} disabled={busy}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
            style={{ background: accent }}>
            Ajouter
          </button>
          <button onClick={() => setForm(null)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--border-primary)] text-[var(--text-secondary)]">
            Annuler
          </button>
        </div>
      )}

      <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl overflow-hidden">
        <div className="px-3 py-2 border-b border-[var(--border-primary)] text-xs text-[var(--text-secondary)]">
          {rows.length} compte(s) au modèle standard
        </div>
        <div className="max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-[var(--bg-primary)]">
              <tr className="text-[10px] uppercase tracking-wide text-[var(--text-secondary)]">
                <th className="px-3 py-2 text-left font-semibold">N° compte</th>
                <th className="px-3 py-2 text-left font-semibold">Intitulé</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={2} className="px-4 py-6 text-center text-xs text-[var(--text-secondary)]">
                  Modèle vide — reprenez le plan de l&apos;exercice courant pour l&apos;initialiser.
                </td></tr>
              )}
              {rows.map((c) => (
                <tr key={c.id} className="border-b border-[var(--border-primary)]/60">
                  <td className="px-3 py-1.5 font-mono text-xs">{c.numCompte}</td>
                  <td className="px-3 py-1.5">{c.intitule}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
