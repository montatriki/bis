"use client";
import { useState, useEffect, useCallback } from "react";
import { confirmer } from "@/lib/alertes";
import {
  ClipboardList, Plus, Trash2, Search, X, Loader2, Check, AlertTriangle,
  Download, ChevronRight, PackageCheck, TrendingDown, TrendingUp,
} from "lucide-react";

// Inventaire physique — comptage, écarts, régularisation du stock.
// Remplace la logique d'inventaire de `inventoryModule` de l'ERP source.

type InvRow = {
  id: number; reference: string; libelle: string | null;
  emplacement: string | null; dateInv: string; etat: string;
  utilisateur: string | null; nbLignes: number; nbEcarts: number; valeurEcart: number;
};
type Ligne = {
  id: number; refArt: string; designation: string | null;
  qteTheorique: number; qteComptee: number; ecart: number;
  pmp: number; valeurEcart: number;
};
type Detail = {
  inventaire: InvRow & { observation: string | null };
  lignes: Ligne[];
  avecEcart: Ligne[];
  manquants: Ligne[];
  excedents: Ligne[];
  valeurManquants: number;
  valeurExcedents: number;
  valeurNette: number;
};
type ArticleInv = {
  refArt: string; designation: string | null; unite: string | null;
  qteTheorique: number; pmp: number;
};
type Empl = { code: string; label: string };

const fmt = (v: unknown) =>
  new Intl.NumberFormat("fr-TN", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(Number(v) || 0);
const fmtQ = (v: unknown) => new Intl.NumberFormat("fr-TN", { maximumFractionDigits: 3 }).format(Number(v) || 0);
const fmtDate = (v: unknown) => (v ? new Date(String(v)).toLocaleDateString("fr-FR") : "—");

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

export default function InventaireView({ accent }: { accent: string }) {
  const [rows, setRows] = useState<InvRow[]>([]);
  const [load, setLoad] = useState(true);
  const [sel, setSel] = useState<number | null>(null);
  const [creer, setCreer] = useState(false);
  const [filtre, setFiltre] = useState("Tous");
  const [page, setPage] = useState(0);
  const [meta, setMeta] = useState<{ total: number; pages: number }>({ total: 0, pages: 0 });
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const flash = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 7000);
  }, []);

  const charger = useCallback(() => {
    fetch(`/api/inventaire?vue=liste&etat=${filtre}&page=${page}`)
      .then((r) => r.json())
      .then((d) => {
        setRows(d.rows ?? []);
        setMeta({ total: d.total ?? 0, pages: d.pages ?? 0 });
      })
      .catch(() => flash("Chargement impossible", false))
      .finally(() => setLoad(false));
  }, [filtre, page, flash]);

  useEffect(charger, [charger]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: accent + "18", color: accent }}>
            <ClipboardList size={17} />
          </div>
          <div>
            <div className="font-bold text-[var(--text-primary)] text-sm">Inventaire physique</div>
            <div className="text-xs text-[var(--text-secondary)]">
              Comptage, écarts et régularisation du stock
            </div>
          </div>
        </div>
        {sel == null && !creer && (
          <div className="flex gap-2 items-center">
            <select value={filtre} onChange={(e) => { setFiltre(e.target.value); setPage(0); }}
              className="px-2.5 py-1.5 rounded-lg text-xs bg-[var(--bg-card)] border border-[var(--border-primary)]">
              <option value="Tous">Tous les états</option>
              <option value="Brouillon">Brouillon</option>
              <option value="Validé">Validé</option>
            </select>
            <button onClick={() => setCreer(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5"
              style={{ background: accent }}>
              <Plus size={13} /> Nouvel inventaire
            </button>
          </div>
        )}
      </div>

      {toast && (
        <div className={`px-4 py-2 rounded-xl text-sm font-medium flex items-start gap-2 ${
          toast.ok ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-red-500/10 text-red-600"
        }`}>
          {toast.ok ? <Check size={15} className="mt-0.5 shrink-0" /> : <AlertTriangle size={15} className="mt-0.5 shrink-0" />}
          <span className="whitespace-pre-line">{toast.msg}</span>
        </div>
      )}

      {creer ? (
        <Saisie accent={accent} onFlash={flash}
          onClose={(id) => { setCreer(false); charger(); if (id) setSel(id); }} />
      ) : sel != null ? (
        <DetailInv id={sel} accent={accent} onFlash={flash}
          onClose={() => { setSel(null); charger(); }} />
      ) : load ? (
        <Chargement />
      ) : (
        <Tableau vide="Aucun inventaire. Créez-en un pour comparer le stock théorique au comptage réel."
          entetes={["Référence", "Libellé", "Emplacement", "Date", "Lignes", "Écarts", "Valeur écart", "État", ""]}>
          {rows.map((i) => (
            <tr key={i.id} onClick={() => setSel(i.id)}
              className="border-b border-[var(--border-primary)]/60 hover:bg-[var(--accent-light)] cursor-pointer">
              <td className="px-3 py-2 font-mono text-xs">{i.reference}</td>
              <td className="px-3 py-2">{i.libelle ?? "—"}</td>
              <td className="px-3 py-2 text-xs">{i.emplacement ?? "Global"}</td>
              <td className="px-3 py-2 text-xs">{fmtDate(i.dateInv)}</td>
              <td className="px-3 py-2 text-right text-xs">{i.nbLignes}</td>
              <td className="px-3 py-2 text-right text-xs"
                style={{ color: i.nbEcarts > 0 ? "#dc2626" : undefined }}>{i.nbEcarts}</td>
              <td className="px-3 py-2 text-right"
                style={{ color: i.valeurEcart < 0 ? "#dc2626" : i.valeurEcart > 0 ? "#16a34a" : undefined }}>
                {fmt(i.valeurEcart)}
              </td>
              <td className="px-3 py-2">
                <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${
                  i.etat === "Validé" ? "bg-emerald-500/15 text-emerald-600" : "bg-amber-500/15 text-amber-600"
                }`}>{i.etat}</span>
              </td>
              <td className="px-3 py-2 text-right">
                <ChevronRight size={14} className="inline text-[var(--text-secondary)]" />
              </td>
            </tr>
          ))}
        </Tableau>
      )}

      {/* Pagination : l'historique compte plusieurs centaines d'inventaires. */}
      {!creer && sel == null && !load && meta.pages > 1 && (
        <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
          <span>{meta.total} inventaire{meta.total > 1 ? "s" : ""}</span>
          <div className="flex items-center gap-2">
            <button type="button" disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="px-2.5 py-1 rounded-lg border border-[var(--border-primary)] disabled:opacity-40 hover:bg-[var(--accent-light)]">
              Précédent
            </button>
            <span>Page {page + 1} / {meta.pages}</span>
            <button type="button" disabled={page + 1 >= meta.pages}
              onClick={() => setPage((p) => p + 1)}
              className="px-2.5 py-1 rounded-lg border border-[var(--border-primary)] disabled:opacity-40 hover:bg-[var(--accent-light)]">
              Suivant
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------- Saisie --------------------------------- */

function Saisie({ accent, onFlash, onClose }: {
  accent: string; onFlash: (m: string, ok?: boolean) => void; onClose: (id?: number) => void;
}) {
  const [libelle, setLibelle] = useState("");
  const [emplacement, setEmplacement] = useState("");
  const [depots, setDepots] = useState<Empl[]>([]);
  const [articles, setArticles] = useState<ArticleInv[]>([]);
  const [q, setQ] = useState("");
  const [comptage, setComptage] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [load, setLoad] = useState(true);

  useEffect(() => {
    fetch("/api/mouvements-depot?vue=emplacements")
      .then((r) => r.json())
      .then((d) => setDepots([...(d.depots ?? []), ...(d.vehicules ?? [])]))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      const url = `/api/inventaire?vue=articles${q ? `&q=${encodeURIComponent(q)}` : ""}`
        + (emplacement ? `&emplacement=${encodeURIComponent(emplacement)}` : "");
      fetch(url)
        .then((r) => r.json())
        .then((d) => setArticles(d.rows ?? []))
        .catch(() => {})
        .finally(() => setLoad(false));
    }, 250);
    return () => clearTimeout(t);
  }, [q, emplacement]);

  // Seuls les articles réellement comptés partent : un champ vide n'est pas
  // un comptage à zéro, c'est un article non inventorié.
  const lignes = Object.entries(comptage)
    .filter(([, v]) => v !== "" && Number.isFinite(Number(v)))
    .map(([refArt, v]) => ({ refArt, qteComptee: Number(v) }));

  const enregistrer = async () => {
    if (lignes.length === 0) return onFlash("Saisissez au moins un comptage", false);
    setBusy(true);
    try {
      const r = await fetch("/api/inventaire", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vue: "inventaire", libelle, emplacement: emplacement || null, lignes }),
      });
      const d = await r.json();
      if (!r.ok) return onFlash(d.error ?? "Échec", false);
      onFlash([d.message, ...(d.alertes ?? [])].filter(Boolean).join("\n"), (d.alertes ?? []).length === 0);
      onClose(d.id);
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-3">
      <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl p-4 space-y-3">
        <div className="grid md:grid-cols-3 gap-3">
          <label className="block">
            <span className="block text-[10px] uppercase tracking-wide text-[var(--text-secondary)] mb-1">Libellé</span>
            <input value={libelle} onChange={(e) => setLibelle(e.target.value)}
              placeholder="Inventaire annuel…" className={inputCls} />
          </label>
          <label className="block">
            <span className="block text-[10px] uppercase tracking-wide text-[var(--text-secondary)] mb-1">
              Emplacement
            </span>
            <select value={emplacement} onChange={(e) => { setEmplacement(e.target.value); setComptage({}); }}
              className={inputCls}>
              <option value="">Global (stock article)</option>
              {depots.map((d) => <option key={d.code} value={d.code}>{d.label}</option>)}
            </select>
          </label>
          <div className="relative">
            <span className="block text-[10px] uppercase tracking-wide text-[var(--text-secondary)] mb-1">
              Rechercher
            </span>
            <Search size={13} className="absolute left-2.5 bottom-2 text-[var(--text-secondary)]" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Référence ou désignation…"
              className={`${inputCls} pl-8`} />
          </div>
        </div>
        <p className="text-xs text-[var(--text-secondary)]">
          Le stock théorique est figé à la création : l&apos;écart reste la preuve de ce
          qui manquait ce jour-là, même si le stock bouge ensuite.
          {emplacement && " Sur un emplacement, le théorique est celui de cet emplacement, pas le stock global."}
        </p>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-xs text-[var(--text-secondary)]">
          {lignes.length} article(s) compté(s) sur {articles.length} affiché(s)
        </div>
        <div className="flex gap-2">
          <button onClick={() => onClose()}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--border-primary)] text-[var(--text-secondary)]">
            Annuler
          </button>
          <button onClick={enregistrer} disabled={busy || lignes.length === 0}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 disabled:opacity-40"
            style={{ background: accent }}>
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Enregistrer le comptage
          </button>
        </div>
      </div>

      {load ? <Chargement /> : (
        <Tableau vide="Aucun article. Ajustez la recherche ou l'emplacement."
          entetes={["Référence", "Désignation", "Unité", "Théorique", "Compté", "Écart"]}>
          {articles.map((a) => {
            const saisi = comptage[a.refArt] ?? "";
            const ecart = saisi === "" ? null : Number(saisi) - a.qteTheorique;
            return (
              <tr key={a.refArt}
                className={`border-b border-[var(--border-primary)]/60 ${saisi !== "" ? "bg-[var(--accent-light)]/40" : ""}`}>
                <td className="px-3 py-1.5 font-mono text-xs">{a.refArt}</td>
                <td className="px-3 py-1.5">{a.designation ?? "—"}</td>
                <td className="px-3 py-1.5 text-xs">{a.unite ?? "—"}</td>
                <td className="px-3 py-1.5 text-right text-[var(--text-secondary)]">{fmtQ(a.qteTheorique)}</td>
                <td className="px-3 py-1.5 text-right">
                  <input type="number" step="0.001" value={saisi}
                    onChange={(e) => setComptage({ ...comptage, [a.refArt]: e.target.value })}
                    className="w-24 px-2 py-1 rounded text-xs text-right bg-[var(--bg-primary)] border border-[var(--border-primary)]" />
                </td>
                <td className="px-3 py-1.5 text-right font-semibold"
                  style={{ color: ecart == null ? undefined : ecart < 0 ? "#dc2626" : ecart > 0 ? "#16a34a" : undefined }}>
                  {ecart == null ? "—" : `${ecart > 0 ? "+" : ""}${fmtQ(ecart)}`}
                </td>
              </tr>
            );
          })}
        </Tableau>
      )}
    </div>
  );
}

/* ---------------------------------- Détail --------------------------------- */

function DetailInv({ id, accent, onFlash, onClose }: {
  id: number; accent: string; onFlash: (m: string, ok?: boolean) => void; onClose: () => void;
}) {
  const [d, setD] = useState<Detail | null>(null);
  const [load, setLoad] = useState(true);
  const [busy, setBusy] = useState(false);
  const [seulEcarts, setSeulEcarts] = useState(false);

  const charger = useCallback(() => {
    fetch(`/api/inventaire?vue=detail&id=${id}`)
      .then((r) => r.json())
      .then((x) => setD(x.error ? null : x))
      .finally(() => setLoad(false));
  }, [id]);

  useEffect(charger, [charger]);

  const valider = async () => {
    if (!(await confirmer("Valider l'inventaire ? Le stock sera aligné sur le comptage et l'inventaire deviendra non modifiable.", { danger: true }))) return;
    setBusy(true);
    try {
      const r = await fetch("/api/inventaire", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vue: "valider", id }),
      });
      const x = await r.json();
      onFlash([x.message ?? x.error, ...(x.alertes ?? [])].filter(Boolean).join("\n"), r.ok);
      if (r.ok) charger();
    } finally { setBusy(false); }
  };

  const majLigne = async (ligneId: number, qteComptee: number) => {
    const r = await fetch("/api/inventaire", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: ligneId, qteComptee }),
    });
    if (!r.ok) {
      const x = await r.json();
      return onFlash(x.error ?? "Échec", false);
    }
    charger();
  };

  const supprimerLigne = async (ligneId: number) => {
    const r = await fetch(`/api/inventaire?vue=ligne&id=${ligneId}`, { method: "DELETE" });
    if (!r.ok) return onFlash("Échec de la suppression", false);
    charger();
  };

  if (load) return <Chargement />;
  if (!d) return <div className="text-sm text-[var(--text-secondary)]">Inventaire introuvable.</div>;

  const inv = d.inventaire;
  const valide = inv.etat === "Validé";
  const affichees = seulEcarts ? d.avecEcart : d.lignes;

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <button onClick={onClose} className="text-xs text-[var(--text-secondary)] mb-1 flex items-center gap-1">
            <X size={12} /> Retour à la liste
          </button>
          <div className="font-bold text-sm text-[var(--text-primary)] font-mono">{inv.reference}</div>
          <div className="text-xs text-[var(--text-secondary)]">
            {inv.libelle ?? "Sans libellé"} · {inv.emplacement ?? "Stock global"} · {fmtDate(inv.dateInv)}
            {inv.utilisateur && ` · ${inv.utilisateur}`}
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <span className={`px-2 py-1 rounded text-xs font-semibold ${
            valide ? "bg-emerald-500/15 text-emerald-600" : "bg-amber-500/15 text-amber-600"
          }`}>{inv.etat}</span>
          <button onClick={() => csv(`inventaire-${inv.reference}`,
            ["Référence", "Désignation", "Théorique", "Compté", "Écart", "PMP", "Valeur écart"],
            d.lignes.map((l) => [l.refArt, l.designation ?? "", l.qteTheorique, l.qteComptee, l.ecart, l.pmp, l.valeurEcart]))}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--border-primary)] flex items-center gap-1.5">
            <Download size={13} /> CSV
          </button>
          {!valide && (
            <button onClick={valider} disabled={busy}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 disabled:opacity-50"
              style={{ background: accent }}>
              {busy ? <Loader2 size={13} className="animate-spin" /> : <PackageCheck size={13} />} Valider et régulariser
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Articles comptés" val={String(d.lignes.length)} accent={accent} />
        <Kpi label="Écarts" val={String(d.avecEcart.length)} accent={d.avecEcart.length > 0 ? "#dc2626" : "#16a34a"} />
        <Kpi label="Manquants" val={`${fmt(d.valeurManquants)} TND`} accent="#dc2626" />
        <Kpi label="Excédents" val={`${fmt(d.valeurExcedents)} TND`} accent="#16a34a" />
      </div>

      {valide && (
        <div className="px-3 py-2 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs flex items-start gap-2">
          <PackageCheck size={13} className="mt-0.5 shrink-0" />
          Inventaire validé : le stock a été aligné sur le comptage et les écarts
          journalisés en mouvements d&apos;ajustement. Il n&apos;est plus modifiable — il
          justifie la régularisation.
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-2">
        <label className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] cursor-pointer">
          <input type="checkbox" checked={seulEcarts} onChange={(e) => setSeulEcarts(e.target.checked)} />
          N&apos;afficher que les écarts ({d.avecEcart.length})
        </label>
        <div className="text-xs font-semibold"
          style={{ color: d.valeurNette < 0 ? "#dc2626" : d.valeurNette > 0 ? "#16a34a" : undefined }}>
          Écart net : {fmt(d.valeurNette)} TND
        </div>
      </div>

      <Tableau vide={seulEcarts ? "Aucun écart : le comptage correspond au stock théorique." : "Aucune ligne."}
        entetes={["Référence", "Désignation", "Théorique", "Compté", "Écart", "PMP", "Valeur écart", ...(valide ? [] : [""])]}>
        {affichees.map((l) => (
          <tr key={l.id}
            className={`border-b border-[var(--border-primary)]/60 ${Math.abs(l.ecart) > 0.0001 ? (l.ecart < 0 ? "bg-red-500/5" : "bg-emerald-500/5") : ""}`}>
            <td className="px-3 py-1.5 font-mono text-xs">{l.refArt}</td>
            <td className="px-3 py-1.5">{l.designation ?? "—"}</td>
            <td className="px-3 py-1.5 text-right text-[var(--text-secondary)]">{fmtQ(l.qteTheorique)}</td>
            <td className="px-3 py-1.5 text-right">
              {valide ? fmtQ(l.qteComptee) : (
                <input type="number" step="0.001" defaultValue={l.qteComptee}
                  onBlur={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isFinite(v) && v !== l.qteComptee) majLigne(l.id, v);
                  }}
                  className="w-24 px-2 py-1 rounded text-xs text-right bg-[var(--bg-primary)] border border-[var(--border-primary)]" />
              )}
            </td>
            <td className="px-3 py-1.5 text-right font-semibold"
              style={{ color: l.ecart < 0 ? "#dc2626" : l.ecart > 0 ? "#16a34a" : undefined }}>
              <span className="inline-flex items-center gap-1">
                {l.ecart < 0 && <TrendingDown size={11} />}
                {l.ecart > 0 && <TrendingUp size={11} />}
                {l.ecart > 0 ? "+" : ""}{fmtQ(l.ecart)}
              </span>
            </td>
            <td className="px-3 py-1.5 text-right text-xs">{fmt(l.pmp)}</td>
            <td className="px-3 py-1.5 text-right"
              style={{ color: l.valeurEcart < 0 ? "#dc2626" : l.valeurEcart > 0 ? "#16a34a" : undefined }}>
              {fmt(l.valeurEcart)}
            </td>
            {!valide && (
              <td className="px-3 py-1.5 text-right">
                <button onClick={() => supprimerLigne(l.id)} className="text-red-500 p-1">
                  <Trash2 size={13} />
                </button>
              </td>
            )}
          </tr>
        ))}
      </Tableau>
    </div>
  );
}

/* ------------------------------ Éléments communs --------------------------- */

function Kpi({ label, val, accent }: { label: string; val: string; accent: string }) {
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl p-3">
      <div className="text-[10px] uppercase tracking-wide text-[var(--text-secondary)]">{label}</div>
      <div className="text-lg font-bold mt-0.5" style={{ color: accent }}>{val}</div>
    </div>
  );
}

function Chargement() {
  return (
    <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)] py-8 justify-center">
      <Loader2 size={16} className="animate-spin" /> Chargement…
    </div>
  );
}

function Tableau({ vide, entetes, children }: {
  vide: string; entetes: string[]; children: React.ReactNode;
}) {
  const rows = Array.isArray(children) ? children.flat().filter(Boolean) : children;
  const estVide = Array.isArray(rows) ? rows.length === 0 : !rows;

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
