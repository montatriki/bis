"use client";
import { useState, useEffect, useCallback } from "react";
import { confirmer } from "@/lib/alertes";
import {
  Barcode, Plus, Trash2, Search, X, Loader2, Check, AlertTriangle,
  Download, ArrowRight, PackageSearch,
} from "lucide-react";

// Suivi des numéros de série — remplace l'écran « Module disponible » de VENTE.
// Trois vues : recherche/liste, traçabilité d'un numéro, saisie en lot.

type Serie = {
  id: number; numSerie: string; refArt: string; desArt: string | null;
  sens: string; refDoc: string | null; codeCli: number | null;
  tiersNom: string | null; dateDoc: string | null; createdAt: string;
};
type Trace = {
  numSerie: string; etat: string;
  article: { refArt: string; designation: string; unite: string | null; enStock: number } | null;
  rows: (Serie & { document: { typeDoc: string | null; dateDoc: string | null; etat: string | null; valide: boolean } | null })[];
};
type Article = { refArt: string; designation: string; enStock: number };

const fmtDate = (v: unknown) => (v ? new Date(String(v)).toLocaleDateString("fr-FR") : "—");
const fmtQ = (v: unknown) => new Intl.NumberFormat("fr-TN", { maximumFractionDigits: 3 }).format(Number(v) || 0);

const inputCls =
  "w-full px-2.5 py-1.5 rounded-lg text-xs bg-[var(--bg-primary)] border border-[var(--border-primary)] text-[var(--text-primary)]";

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

export default function SeriesView({ accent }: { accent: string }) {
  const [onglet, setOnglet] = useState<"liste" | "stock" | "saisie">("liste");
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [reload, setReload] = useState(0);
  const [trace, setTrace] = useState<Trace | null>(null);

  const flash = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 6000);
  }, []);

  const tracer = useCallback(async (numSerie: string) => {
    const r = await fetch(`/api/series?vue=tracabilite&numSerie=${encodeURIComponent(numSerie)}`);
    const d = await r.json();
    if (!r.ok) return flash(d.error ?? "Échec", false);
    setTrace(d);
  }, [flash]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: accent + "18", color: accent }}>
            <Barcode size={17} />
          </div>
          <div>
            <div className="font-bold text-[var(--text-primary)] text-sm">Suivi des numéros de série</div>
            <div className="text-xs text-[var(--text-secondary)]">Traçabilité de l&apos;achat à la vente</div>
          </div>
        </div>
        <div className="flex gap-1.5">
          {([["liste", "Tous les numéros"], ["stock", "En stock"], ["saisie", "Saisie"]] as const).map(([k, l]) => (
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

      {trace && <Tracabilite trace={trace} accent={accent} onClose={() => setTrace(null)} />}

      {onglet === "liste" && <Liste accent={accent} reload={reload} onTracer={tracer} onFlash={flash} />}
      {onglet === "stock" && <EnStock accent={accent} reload={reload} onTracer={tracer} />}
      {onglet === "saisie" && <Saisie accent={accent} onFlash={flash} onDone={() => setReload((k) => k + 1)} />}
    </div>
  );
}

function Tracabilite({ trace, accent, onClose }: { trace: Trace; accent: string; onClose: () => void }) {
  return (
    <div className="bg-[var(--bg-card)] border-2 rounded-xl p-4 space-y-3" style={{ borderColor: accent + "55" }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-[var(--text-secondary)]">Traçabilité</div>
          <div className="font-bold text-sm text-[var(--text-primary)] font-mono">{trace.numSerie}</div>
          <div className="text-xs text-[var(--text-secondary)]">
            {trace.article ? `${trace.article.refArt} — ${trace.article.designation}` : "Article inconnu"}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
            trace.etat === "Vendu" ? "bg-blue-500/15 text-blue-600"
              : trace.etat === "En stock" ? "bg-emerald-500/15 text-emerald-600"
              : "bg-slate-500/15 text-slate-500"
          }`}>{trace.etat}</span>
          <button onClick={onClose} className="text-[var(--text-secondary)]"><X size={15} /></button>
        </div>
      </div>

      {trace.rows.length === 0 ? (
        <div className="text-xs text-[var(--text-secondary)]">Aucun mouvement pour ce numéro.</div>
      ) : (
        <div className="space-y-1.5">
          {trace.rows.map((r, i) => (
            <div key={r.id} className="flex items-center gap-2 text-xs">
              <span className="text-[var(--text-secondary)] w-4">{i + 1}</span>
              <span className={`px-1.5 py-0.5 rounded font-semibold ${
                r.sens === "Achat" ? "bg-emerald-500/15 text-emerald-600" : "bg-blue-500/15 text-blue-600"
              }`}>{r.sens}</span>
              <ArrowRight size={11} className="text-[var(--text-secondary)]" />
              <span className="font-mono">{r.refDoc ?? "sans document"}</span>
              <span className="text-[var(--text-secondary)]">{fmtDate(r.dateDoc ?? r.createdAt)}</span>
              <span className="flex-1 truncate text-[var(--text-secondary)]">{r.tiersNom ?? ""}</span>
              {r.document && !r.document.valide && (
                <span className="text-amber-600" title="Document non validé">brouillon</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Liste({ accent, reload, onTracer, onFlash }: {
  accent: string; reload: number;
  onTracer: (n: string) => void; onFlash: (m: string, ok?: boolean) => void;
}) {
  const [rows, setRows] = useState<Serie[]>([]);
  const [load, setLoad] = useState(true);
  const [q, setQ] = useState("");
  const [sens, setSens] = useState("Tous");

  const charger = useCallback(() => {
    fetch(`/api/series?vue=liste&sens=${sens}${q ? `&q=${encodeURIComponent(q)}` : ""}`)
      .then((r) => r.json())
      .then((d) => setRows(d.rows ?? []))
      .finally(() => setLoad(false));
  }, [q, sens]);

  useEffect(() => {
    const t = setTimeout(charger, 250);
    return () => clearTimeout(t);
  }, [charger, reload]);

  const supprimer = async (id: number) => {
    if (!(await confirmer("Supprimer ce mouvement de numéro de série ?", { danger: true }))) return;
    const r = await fetch(`/api/series?id=${id}`, { method: "DELETE" });
    const d = await r.json();
    if (!r.ok) return onFlash(d.error ?? "Échec", false);
    onFlash(d.message ?? "Supprimé");
    charger();
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-2 items-center">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
            <input value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Numéro, article, document, tiers…"
              className="pl-8 pr-3 py-1.5 rounded-lg text-xs bg-[var(--bg-card)] border border-[var(--border-primary)] w-64" />
          </div>
          <select value={sens} onChange={(e) => setSens(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg text-xs bg-[var(--bg-card)] border border-[var(--border-primary)]">
            <option value="Tous">Tous les sens</option>
            <option value="Achat">Achat (entrée)</option>
            <option value="Vente">Vente (sortie)</option>
          </select>
        </div>
        <button onClick={() => csv("numeros-serie",
          ["Numéro", "Article", "Désignation", "Sens", "Document", "Tiers", "Date"],
          rows.map((r) => [r.numSerie, r.refArt, r.desArt ?? "", r.sens, r.refDoc ?? "", r.tiersNom ?? "", fmtDate(r.dateDoc)]))}
          disabled={rows.length === 0}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--border-primary)] flex items-center gap-1.5 disabled:opacity-40">
          <Download size={13} /> Export CSV
        </button>
      </div>

      <Tableau load={load}
        vide="Aucun numéro de série enregistré. Utilisez l'onglet Saisie pour en déclarer à la réception d'un achat."
        entetes={["Numéro", "Article", "Désignation", "Sens", "Document", "Tiers", "Date", ""]}>
        {rows.map((r) => (
          <tr key={r.id} className="border-b border-[var(--border-primary)]/60 hover:bg-[var(--accent-light)]">
            <td className="px-3 py-2 font-mono text-xs">
              <button onClick={() => onTracer(r.numSerie)} className="hover:underline" style={{ color: accent }}>
                {r.numSerie}
              </button>
            </td>
            <td className="px-3 py-2 font-mono text-xs">{r.refArt}</td>
            <td className="px-3 py-2">{r.desArt ?? "—"}</td>
            <td className="px-3 py-2">
              <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${
                r.sens === "Achat" ? "bg-emerald-500/15 text-emerald-600" : "bg-blue-500/15 text-blue-600"
              }`}>{r.sens}</span>
            </td>
            <td className="px-3 py-2 font-mono text-xs">{r.refDoc ?? "—"}</td>
            <td className="px-3 py-2 text-xs">{r.tiersNom ?? "—"}</td>
            <td className="px-3 py-2 text-xs">{fmtDate(r.dateDoc ?? r.createdAt)}</td>
            <td className="px-3 py-2 text-right">
              <button onClick={() => supprimer(r.id)} className="text-red-500 p-1"><Trash2 size={13} /></button>
            </td>
          </tr>
        ))}
      </Tableau>
    </div>
  );
}

function EnStock({ accent, reload, onTracer }: {
  accent: string; reload: number; onTracer: (n: string) => void;
}) {
  const [rows, setRows] = useState<Serie[]>([]);
  const [total, setTotal] = useState(0);
  const [load, setLoad] = useState(true);

  useEffect(() => {
    fetch("/api/series?vue=non-vendus")
      .then((r) => r.json())
      .then((d) => { setRows(d.rows ?? []); setTotal(d.total ?? 0); })
      .finally(() => setLoad(false));
  }, [reload]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
        <PackageSearch size={13} />
        {total} numéro(s) entré(s) en stock et jamais sorti(s)
        {rows.length < total && ` — ${rows.length} affiché(s)`}
      </div>

      <Tableau load={load} vide="Aucun numéro en stock."
        entetes={["Numéro", "Article", "Désignation", "Document d'entrée", "Date"]}>
        {rows.map((r) => (
          <tr key={r.numSerie + r.refArt} className="border-b border-[var(--border-primary)]/60 hover:bg-[var(--accent-light)]">
            <td className="px-3 py-2 font-mono text-xs">
              <button onClick={() => onTracer(r.numSerie)} className="hover:underline" style={{ color: accent }}>
                {r.numSerie}
              </button>
            </td>
            <td className="px-3 py-2 font-mono text-xs">{r.refArt}</td>
            <td className="px-3 py-2">{r.desArt ?? "—"}</td>
            <td className="px-3 py-2 font-mono text-xs">{r.refDoc ?? "—"}</td>
            <td className="px-3 py-2 text-xs">{fmtDate(r.dateDoc)}</td>
          </tr>
        ))}
      </Tableau>
    </div>
  );
}

function Saisie({ accent, onFlash, onDone }: {
  accent: string; onFlash: (m: string, ok?: boolean) => void; onDone: () => void;
}) {
  const [sens, setSens] = useState("Achat");
  const [refArt, setRefArt] = useState("");
  const [refDoc, setRefDoc] = useState("");
  const [texte, setTexte] = useState("");
  const [busy, setBusy] = useState(false);
  const [articles, setArticles] = useState<Article[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    const t = setTimeout(() => {
      fetch(`/api/gpao?vue=articles${q ? `&q=${encodeURIComponent(q)}` : ""}`)
        .then((r) => r.json())
        .then((d) => setArticles(d.rows ?? []))
        .catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  // Un numéro par ligne : le collage depuis un scanner ou un tableur marche tel quel.
  const numeros = texte.split(/[\n,;\t]+/).map((x) => x.trim()).filter(Boolean);

  const enregistrer = async () => {
    if (!refArt) return onFlash("Sélectionnez un article", false);
    if (numeros.length === 0) return onFlash("Saisissez au moins un numéro de série", false);

    setBusy(true);
    try {
      const r = await fetch("/api/series", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sens, refArt, refDoc: refDoc || null,
          numeros: numeros.map((n) => ({ numSerie: n, refArt })),
        }),
      });
      const d = await r.json();
      if (!r.ok) return onFlash(d.error ?? "Échec", false);
      onFlash([d.message, ...(d.alertes ?? [])].filter(Boolean).join("\n"), (d.alertes ?? []).length === 0);
      setTexte("");
      onDone();
    } finally { setBusy(false); }
  };

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl p-4 space-y-3">
      <div className="grid md:grid-cols-3 gap-3">
        <label className="block">
          <span className="block text-[10px] uppercase tracking-wide text-[var(--text-secondary)] mb-1">Sens</span>
          <select value={sens} onChange={(e) => setSens(e.target.value)} className={inputCls}>
            <option value="Achat">Achat — entrée en stock</option>
            <option value="Vente">Vente — sortie</option>
          </select>
        </label>
        <label className="block">
          <span className="block text-[10px] uppercase tracking-wide text-[var(--text-secondary)] mb-1">Article *</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher…"
            className={`${inputCls} mb-1`} />
          <select value={refArt} onChange={(e) => setRefArt(e.target.value)} className={inputCls}>
            <option value="">— Sélectionner —</option>
            {articles.map((a) => (
              <option key={a.refArt} value={a.refArt}>{a.refArt} — {a.designation} ({fmtQ(a.enStock)})</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-[10px] uppercase tracking-wide text-[var(--text-secondary)] mb-1">
            Document (optionnel)
          </span>
          <input value={refDoc} onChange={(e) => setRefDoc(e.target.value)} placeholder="Réf. du document"
            className={inputCls} />
          <span className="text-[10px] text-[var(--text-secondary)] mt-1 block">
            Renseigné, le tiers et la date sont relus du document.
          </span>
        </label>
      </div>

      <label className="block">
        <span className="block text-[10px] uppercase tracking-wide text-[var(--text-secondary)] mb-1">
          Numéros de série — un par ligne
        </span>
        <textarea value={texte} onChange={(e) => setTexte(e.target.value)} rows={8}
          placeholder={"SN-0001\nSN-0002\nSN-0003"}
          className={`${inputCls} font-mono resize-y`} />
      </label>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-xs text-[var(--text-secondary)]">
          {numeros.length} numéro(s) détecté(s)
          {sens === "Achat" && " — les doublons d'entrée seront ignorés"}
        </div>
        <button onClick={enregistrer} disabled={busy || numeros.length === 0}
          className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 disabled:opacity-50"
          style={{ background: accent }}>
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Enregistrer
        </button>
      </div>
    </div>
  );
}

function Tableau({ load, vide, entetes, children }: {
  load: boolean; vide: string; entetes: string[]; children: React.ReactNode;
}) {
  const rows = Array.isArray(children) ? children.flat().filter(Boolean) : children;
  const estVide = Array.isArray(rows) ? rows.length === 0 : !rows;

  if (load) {
    return (
      <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)] py-8 justify-center">
        <Loader2 size={16} className="animate-spin" /> Chargement…
      </div>
    );
  }

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--bg-primary)]/60 border-b border-[var(--border-primary)]">
              {entetes.map((h, i) => (
                <th key={i} className="px-3 py-2 text-left text-[10px] uppercase tracking-wide text-[var(--text-secondary)] font-semibold whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-[var(--text-primary)]">{rows}</tbody>
        </table>
      </div>
      {estVide && <div className="px-4 py-6 text-center text-xs text-[var(--text-secondary)]">{vide}</div>}
    </div>
  );
}
