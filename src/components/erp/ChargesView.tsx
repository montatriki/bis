"use client";
import { useState, useEffect, useCallback } from "react";
import { confirmer } from "@/lib/alertes";
import {
  Receipt, Plus, Trash2, Loader2, Check, AlertTriangle, Download,
  TrendingDown, Split, RotateCcw,
} from "lucide-react";

// Charges fixes et marge nette réelle par article.
// La ventilation d'une charge sur les lignes vendues est ce qui permet de voir
// qu'un article rentable en marge brute peut être déficitaire une fois les
// frais de structure imputés.

type Charge = {
  id: number; libelle: string | null; du: string; au: string;
  montant: number; montantJr: number; nbJour: number;
  etat: string; dateRepartition: string | null; lignesTouchees: number;
};
type LigneMarge = {
  refArt: string; designation: string; qte: number; ca: number;
  cout: number; charges: number; margeBrute: number; margeNette: number;
  tauxMarge: number | null;
};

const fmt = (v: unknown) =>
  new Intl.NumberFormat("fr-TN", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(Number(v) || 0);
const fmtQ = (v: unknown) => new Intl.NumberFormat("fr-TN", { maximumFractionDigits: 3 }).format(Number(v) || 0);
const fmtDate = (v: unknown) => (v ? new Date(String(v)).toLocaleDateString("fr-FR") : "—");
const iso = (d: Date) => d.toISOString().slice(0, 10);

function csv(nom: string, entetes: string[], lignes: (string | number)[][]) {
  const esc = (v: string | number) => {
    const t = String(v ?? "");
    return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const contenu = [entetes.join(";"), ...lignes.map((l) => l.map(esc).join(";"))].join("\n");
  const url = URL.createObjectURL(new Blob([`﻿${contenu}`], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = `${nom}.csv`; a.click();
  URL.revokeObjectURL(url);
}

export default function ChargesView({ accent }: { accent: string }) {
  const [onglet, setOnglet] = useState<"charges" | "marge">("charges");
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [reload, setReload] = useState(0);

  const flash = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 8000);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: accent + "18", color: accent }}>
            <Receipt size={17} />
          </div>
          <div>
            <div className="font-bold text-[var(--text-primary)] text-sm">Charges fixes</div>
            <div className="text-xs text-[var(--text-secondary)]">
              Ventilation analytique et marge nette par article
            </div>
          </div>
        </div>
        <div className="flex gap-1.5">
          {([["charges", "Charges"], ["marge", "Marge par article"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setOnglet(k)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                onglet === k ? "text-white border-transparent shadow-sm"
                  : "bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border-primary)]"
              }`}
              style={onglet === k ? { background: accent } : undefined}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {toast && (
        <div className={`px-4 py-2 rounded-xl text-sm font-medium flex items-start gap-2 ${
          toast.ok ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-red-500/10 text-red-600"
        }`}>
          {toast.ok ? <Check size={15} className="mt-0.5 shrink-0" /> : <AlertTriangle size={15} className="mt-0.5 shrink-0" />}
          <span className="whitespace-pre-line">{toast.msg}</span>
        </div>
      )}

      {onglet === "charges"
        ? <Charges accent={accent} onFlash={flash} reload={reload} onDone={() => setReload((k) => k + 1)} />
        : <Marge accent={accent} reload={reload} />}
    </div>
  );
}

function Charges({ accent, onFlash, reload, onDone }: {
  accent: string; onFlash: (m: string, ok?: boolean) => void; reload: number; onDone: () => void;
}) {
  const [rows, setRows] = useState<Charge[]>([]);
  const [load, setLoad] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const [form, setForm] = useState<{ libelle: string; du: string; au: string; montant: number } | null>(null);

  const charger = useCallback(() => {
    fetch("/api/charges?vue=liste")
      .then((r) => r.json())
      .then((d) => setRows(d.rows ?? []))
      .catch(() => onFlash("Chargement impossible", false))
      .finally(() => setLoad(false));
  }, [onFlash]);

  useEffect(() => { charger(); }, [charger, reload]);

  const action = async (id: number, vue: "repartir" | "annuler") => {
    setBusy(id);
    try {
      const r = await fetch("/api/charges", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vue, id }),
      });
      const d = await r.json();
      onFlash([d.message ?? d.error, ...(d.alertes ?? [])].filter(Boolean).join("\n"), r.ok);
      if (r.ok) { charger(); onDone(); }
    } finally { setBusy(null); }
  };

  const creer = async () => {
    if (!form) return;
    const r = await fetch("/api/charges", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vue: "charge", ...form }),
    });
    const d = await r.json();
    if (!r.ok) return onFlash(d.error ?? "Échec", false);
    onFlash(d.message ?? "Créée");
    setForm(null);
    charger();
  };

  const supprimer = async (c: Charge) => {
    if (!(await confirmer(`Supprimer la charge ${c.libelle ?? c.id} ?`, { danger: true }))) return;
    const r = await fetch(`/api/charges?id=${c.id}`, { method: "DELETE" });
    const d = await r.json();
    onFlash(d.message ?? d.error, r.ok);
    if (r.ok) charger();
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <p className="text-xs text-[var(--text-secondary)] max-w-2xl">
          Une charge est ventilée sur chaque ligne vendue, au prorata de son poids dans le
          chiffre du jour. Le montant est divisé par les journées <b>ayant eu des ventes</b> :
          une journée fermée n&apos;absorbe rien.
        </p>
        <button onClick={() => setForm({ libelle: "", du: iso(new Date(new Date().getFullYear(), new Date().getMonth(), 1)), au: iso(new Date()), montant: 0 })}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5"
          style={{ background: accent }}>
          <Plus size={13} /> Nouvelle charge
        </button>
      </div>

      {form && (
        <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl p-4 space-y-3">
          <div className="grid sm:grid-cols-4 gap-3">
            <div className="sm:col-span-2">
              <Champ label="Libellé">
                <input value={form.libelle} onChange={(e) => setForm({ ...form, libelle: e.target.value })}
                  placeholder="Loyer, salaires, énergie…" className={inputCls} />
              </Champ>
            </div>
            <Champ label="Du"><input type="date" value={form.du}
              onChange={(e) => setForm({ ...form, du: e.target.value })} className={inputCls} /></Champ>
            <Champ label="Au"><input type="date" value={form.au}
              onChange={(e) => setForm({ ...form, au: e.target.value })} className={inputCls} /></Champ>
            <Champ label="Montant à ventiler *"><input type="number" step="0.001" value={form.montant}
              onChange={(e) => setForm({ ...form, montant: Number(e.target.value) })} className={inputCls} /></Champ>
          </div>
          <div className="flex gap-2">
            <button onClick={creer}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5"
              style={{ background: accent }}>
              <Check size={13} /> Enregistrer
            </button>
            <button onClick={() => setForm(null)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--border-primary)] text-[var(--text-secondary)]">
              Annuler
            </button>
          </div>
        </div>
      )}

      {load ? (
        <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)] py-8 justify-center">
          <Loader2 size={16} className="animate-spin" /> Chargement…
        </div>
      ) : (
        <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--bg-primary)]/60 border-b border-[var(--border-primary)]">
                  {["Libellé", "Période", "Montant", "Jours", "Lignes", "État", ""].map((h, i) => (
                    <th key={i} className="px-3 py-2 text-left text-[10px] uppercase tracking-wide text-[var(--text-secondary)] font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-[var(--text-primary)]">
                {rows.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-6 text-center text-xs text-[var(--text-secondary)]">
                    Aucune charge. Sans ventilation, la marge affichée ignore les frais de structure.
                  </td></tr>
                )}
                {rows.map((c) => (
                  <tr key={c.id} className="border-b border-[var(--border-primary)]/60">
                    <td className="px-3 py-2">{c.libelle ?? `Charge ${c.id}`}</td>
                    <td className="px-3 py-2 text-xs">{fmtDate(c.du)} → {fmtDate(c.au)}</td>
                    <td className="px-3 py-2 text-right">{fmt(c.montant)}</td>
                    <td className="px-3 py-2 text-right text-xs">{c.nbJour || "—"}</td>
                    <td className="px-3 py-2 text-right text-xs">{c.lignesTouchees || "—"}</td>
                    <td className="px-3 py-2">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${
                        c.etat === "Répartie" ? "bg-emerald-500/15 text-emerald-600" : "bg-amber-500/15 text-amber-600"
                      }`}>{c.etat}</span>
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {c.etat === "Répartie" ? (
                        <button onClick={() => action(c.id, "annuler")} disabled={busy === c.id}
                          className="text-xs px-2 py-1 rounded border border-[var(--border-primary)] flex items-center gap-1 inline-flex disabled:opacity-50">
                          {busy === c.id ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />} Annuler
                        </button>
                      ) : (
                        <>
                          <button onClick={() => action(c.id, "repartir")} disabled={busy === c.id}
                            className="text-xs px-2 py-1 rounded text-white mr-1 inline-flex items-center gap-1 disabled:opacity-50"
                            style={{ background: accent }}>
                            {busy === c.id ? <Loader2 size={11} className="animate-spin" /> : <Split size={11} />} Ventiler
                          </button>
                          <button onClick={() => supprimer(c)} className="text-red-500 p-1"><Trash2 size={13} /></button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Marge({ accent, reload }: { accent: string; reload: number }) {
  const [rows, setRows] = useState<LigneMarge[]>([]);
  const [totaux, setTotaux] = useState({ ca: 0, cout: 0, charges: 0, margeNette: 0 });
  const [ventilees, setVentilees] = useState(false);
  const [load, setLoad] = useState(true);
  const [du, setDu] = useState(iso(new Date(new Date().getFullYear(), 0, 1)));
  const [au, setAu] = useState(iso(new Date()));

  useEffect(() => {
    fetch(`/api/charges?vue=marge&du=${du}&au=${au}`)
      .then((r) => r.json())
      .then((d) => {
        setRows(d.rows ?? []);
        setTotaux(d.totaux ?? { ca: 0, cout: 0, charges: 0, margeNette: 0 });
        setVentilees(Boolean(d.chargesVentilees));
      })
      .catch(() => {})
      .finally(() => setLoad(false));
  }, [du, au, reload]);

  const deficitaires = rows.filter((r) => r.margeNette < 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3 items-end justify-between">
        <div className="flex gap-3 items-end">
          <Champ label="Du"><input type="date" value={du} onChange={(e) => setDu(e.target.value)} className={inputCls} /></Champ>
          <Champ label="Au"><input type="date" value={au} onChange={(e) => setAu(e.target.value)} className={inputCls} /></Champ>
        </div>
        <button onClick={() => csv("marge-articles",
          ["Référence", "Désignation", "Qté", "CA HT", "Coût", "Charges", "Marge brute", "Marge nette", "Taux %"],
          rows.map((r) => [r.refArt, r.designation, r.qte, r.ca, r.cout, r.charges, r.margeBrute, r.margeNette, r.tauxMarge ?? ""]))}
          disabled={rows.length === 0}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--border-primary)] flex items-center gap-1.5 disabled:opacity-40">
          <Download size={13} /> Export CSV
        </button>
      </div>

      {!ventilees && rows.length > 0 && (
        <div className="px-3 py-2 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs flex items-start gap-2">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          Aucune charge n&apos;est ventilée sur cette période : la marge nette est égale à la
          marge brute et <b>ignore les frais de structure</b>. Ventilez une charge pour obtenir
          la rentabilité réelle.
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="CA HT" val={fmt(totaux.ca)} accent={accent} />
        <Kpi label="Coût d'achat" val={fmt(totaux.cout)} accent="#64748b" />
        <Kpi label="Charges ventilées" val={fmt(totaux.charges)} accent="#f59e0b" />
        <Kpi label="Marge nette" val={fmt(totaux.margeNette)}
          accent={totaux.margeNette < 0 ? "#dc2626" : "#16a34a"} />
      </div>

      {deficitaires.length > 0 && (
        <div className="px-3 py-2 rounded-lg bg-red-500/10 text-red-600 text-xs flex items-start gap-2">
          <TrendingDown size={13} className="mt-0.5 shrink-0" />
          <b>{deficitaires.length} article(s) vendus à perte</b> une fois les charges imputées —
          invisible en marge brute.
        </div>
      )}

      {load ? (
        <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)] py-8 justify-center">
          <Loader2 size={16} className="animate-spin" /> Chargement…
        </div>
      ) : (
        <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--bg-primary)]/60 border-b border-[var(--border-primary)]">
                  {["Référence", "Désignation", "Qté", "CA HT", "Coût", "Charges", "Marge brute", "Marge nette", "Taux"].map((h, i) => (
                    <th key={i} className="px-3 py-2 text-left text-[10px] uppercase tracking-wide text-[var(--text-secondary)] font-semibold whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-[var(--text-primary)]">
                {rows.length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-6 text-center text-xs text-[var(--text-secondary)]">
                    Aucune ligne de vente sur la période.
                  </td></tr>
                )}
                {rows.map((r) => (
                  <tr key={r.refArt}
                    className={`border-b border-[var(--border-primary)]/60 ${r.margeNette < 0 ? "bg-red-500/5" : ""}`}>
                    <td className="px-3 py-2 font-mono text-xs">{r.refArt}</td>
                    <td className="px-3 py-2">{r.designation}</td>
                    <td className="px-3 py-2 text-right text-xs">{fmtQ(r.qte)}</td>
                    <td className="px-3 py-2 text-right">{fmt(r.ca)}</td>
                    <td className="px-3 py-2 text-right text-[var(--text-secondary)]">{fmt(r.cout)}</td>
                    <td className="px-3 py-2 text-right text-amber-600">{fmt(r.charges)}</td>
                    <td className="px-3 py-2 text-right">{fmt(r.margeBrute)}</td>
                    <td className="px-3 py-2 text-right font-semibold"
                      style={{ color: r.margeNette < 0 ? "#dc2626" : "#16a34a" }}>
                      {fmt(r.margeNette)}
                    </td>
                    <td className="px-3 py-2 text-right text-xs">
                      {r.tauxMarge == null ? "—" : `${fmt(r.tauxMarge)} %`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

const inputCls =
  "w-full px-2.5 py-1.5 rounded-lg text-xs bg-[var(--bg-primary)] border border-[var(--border-primary)] text-[var(--text-primary)]";

function Champ({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-wide text-[var(--text-secondary)] mb-1">{label}</span>
      {children}
    </label>
  );
}

function Kpi({ label, val, accent }: { label: string; val: string; accent: string }) {
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl p-3">
      <div className="text-[10px] uppercase tracking-wide text-[var(--text-secondary)]">{label}</div>
      <div className="text-lg font-bold mt-0.5" style={{ color: accent }}>{val}</div>
    </div>
  );
}
