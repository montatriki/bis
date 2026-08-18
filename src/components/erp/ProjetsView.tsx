"use client";
import { useState, useEffect, useCallback } from "react";
import {
  FolderKanban, Plus, Trash2, Search, X, Loader2, Check, AlertTriangle,
  Download, CalendarClock, Flag, Users,
} from "lucide-react";

// Module Projets — liste, fiche, jalonnements et état d'avancement.
// L'avancement affiché vient des jalons pondérés dès qu'il y en a.

type ProjetRow = {
  id: number; projet: string; codeCli: number | null; raisonSoc: string | null;
  respProjet: string | null; famille: string | null; etat: string;
  budget: number; periodeDu: string | null; periodeAu: string | null;
  dateLiv: string | null; dateFinReel: string | null;
  avancement: number; avancementSaisi: number; calculeDepuisJalons: boolean;
  nbJalons: number; jalonsEnRetard: number; retard: boolean;
};
type Jalon = {
  id: number; libelle: string; numOrdre: number; poids: number;
  avancement: number; datePrevue: string | null; dateReelle: string | null; retard: boolean;
};
type Detail = {
  row: ProjetRow & { description: string | null; adresse: string | null; modePay: string | null; dateAccept: string | null };
  jalons: Jalon[];
  caClient: number;
  documents: { refDoc: string; typeDoc: string | null; dateDoc: string | null; ttcNet: number }[];
  etats: string[];
};
type Client = { id: number; raisonSocial: string | null };

const fmt = (v: unknown) =>
  new Intl.NumberFormat("fr-TN", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(Number(v) || 0);
const fmtDate = (v: unknown) => (v ? new Date(String(v)).toLocaleDateString("fr-FR") : "—");

const inputCls =
  "w-full px-2.5 py-1.5 rounded-lg text-xs bg-[var(--bg-primary)] border border-[var(--border-primary)] text-[var(--text-primary)]";

const COULEUR_ETAT: Record<string, string> = {
  "En attente": "#94a3b8", "En cours": "#0891b2", "Terminé": "#16a34a",
  "Livré": "#2563eb", "Annulé": "#dc2626",
};

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

export default function ProjetsView({ accent }: { accent: string }) {
  const [rows, setRows] = useState<ProjetRow[]>([]);
  const [etats, setEtats] = useState<string[]>([]);
  const [load, setLoad] = useState(true);
  const [q, setQ] = useState("");
  const [filtreEtat, setFiltreEtat] = useState("Tous");
  const [sel, setSel] = useState<number | null>(null);
  const [creer, setCreer] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [stats, setStats] = useState<{ total: number; budgetTotal: number; avancementMoyen: number; enRetard: number } | null>(null);

  const flash = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 6000);
  }, []);

  const charger = useCallback(() => {
    Promise.all([
      fetch(`/api/projets?vue=liste&etat=${filtreEtat}${q ? `&q=${encodeURIComponent(q)}` : ""}`).then((r) => r.json()),
      fetch("/api/projets?vue=stats").then((r) => r.json()),
    ])
      .then(([l, s]) => {
        setRows(l.rows ?? []);
        setEtats(l.etats ?? []);
        setStats(s);
      })
      .catch(() => flash("Chargement impossible", false))
      .finally(() => setLoad(false));
  }, [q, filtreEtat, flash]);

  useEffect(() => {
    const t = setTimeout(charger, 250);
    return () => clearTimeout(t);
  }, [charger]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: accent + "18", color: accent }}>
            <FolderKanban size={17} />
          </div>
          <div>
            <div className="font-bold text-[var(--text-primary)] text-sm">Projets</div>
            <div className="text-xs text-[var(--text-secondary)]">Jalonnements et état d&apos;avancement</div>
          </div>
        </div>
        <button onClick={() => setCreer(true)}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5"
          style={{ background: accent }}>
          <Plus size={13} /> Nouveau projet
        </button>
      </div>

      {toast && (
        <div className={`px-4 py-2 rounded-xl text-sm font-medium flex items-start gap-2 ${
          toast.ok ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-red-500/10 text-red-600"
        }`}>
          {toast.ok ? <Check size={15} className="mt-0.5 shrink-0" /> : <AlertTriangle size={15} className="mt-0.5 shrink-0" />}
          <span className="whitespace-pre-line">{toast.msg}</span>
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Projets" val={String(stats.total)} accent={accent} />
          <Kpi label="Budget total" val={`${fmt(stats.budgetTotal)} TND`} accent={accent} />
          <Kpi label="Avancement moyen" val={`${fmt(stats.avancementMoyen)} %`} accent={accent} />
          <Kpi label="En retard" val={String(stats.enRetard)} accent={stats.enRetard > 0 ? "#dc2626" : "#16a34a"} />
        </div>
      )}

      {creer && <CreerProjet accent={accent} onFlash={flash}
        onClose={(id) => { setCreer(false); charger(); if (id) setSel(id); }} />}

      {sel != null ? (
        <ProjetDetail id={sel} accent={accent} onFlash={flash}
          onClose={() => { setSel(null); charger(); }} />
      ) : (
        <>
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <div className="flex gap-2 items-center">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Projet, client, responsable…"
                  className="pl-8 pr-3 py-1.5 rounded-lg text-xs bg-[var(--bg-card)] border border-[var(--border-primary)] w-60" />
              </div>
              <select value={filtreEtat} onChange={(e) => setFiltreEtat(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg text-xs bg-[var(--bg-card)] border border-[var(--border-primary)]">
                <option value="Tous">Tous les états</option>
                {etats.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <button onClick={() => csv("projets",
              ["Projet", "Client", "Responsable", "État", "Budget", "Du", "Au", "Avancement %", "Jalons"],
              rows.map((p) => [p.projet, p.raisonSoc ?? "", p.respProjet ?? "", p.etat, p.budget,
                fmtDate(p.periodeDu), fmtDate(p.periodeAu), p.avancement, p.nbJalons]))}
              disabled={rows.length === 0}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--border-primary)] flex items-center gap-1.5 disabled:opacity-40">
              <Download size={13} /> Export CSV
            </button>
          </div>

          <Tableau load={load}
            vide="Aucun projet. Créez-en un pour suivre son avancement par jalons."
            entetes={["Projet", "Client", "Responsable", "Période", "Budget", "Avancement", "Jalons", "État"]}>
            {rows.map((p) => (
              <tr key={p.id} onClick={() => setSel(p.id)}
                className={`border-b border-[var(--border-primary)]/60 hover:bg-[var(--accent-light)] cursor-pointer ${p.retard ? "bg-red-500/5" : ""}`}>
                <td className="px-3 py-2 font-medium">
                  {p.projet}
                  {p.retard && <span className="ml-1.5 text-red-500 text-xs" title="Échéance dépassée">retard</span>}
                </td>
                <td className="px-3 py-2 text-xs">{p.raisonSoc ?? "—"}</td>
                <td className="px-3 py-2 text-xs">{p.respProjet ?? "—"}</td>
                <td className="px-3 py-2 text-xs whitespace-nowrap">
                  {fmtDate(p.periodeDu)} → {fmtDate(p.periodeAu)}
                </td>
                <td className="px-3 py-2 text-right">{fmt(p.budget)}</td>
                <td className="px-3 py-2 min-w-32">
                  <Jauge valeur={p.avancement} accent={accent} />
                  {!p.calculeDepuisJalons && p.nbJalons === 0 && (
                    <span className="text-[10px] text-[var(--text-secondary)]">saisi</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right text-xs">
                  {p.nbJalons}
                  {p.jalonsEnRetard > 0 && (
                    <span className="text-red-500 ml-1" title={`${p.jalonsEnRetard} jalon(s) en retard`}>
                      ({p.jalonsEnRetard})
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <span className="px-1.5 py-0.5 rounded text-xs font-semibold"
                    style={{ background: (COULEUR_ETAT[p.etat] ?? "#94a3b8") + "22", color: COULEUR_ETAT[p.etat] ?? "#94a3b8" }}>
                    {p.etat}
                  </span>
                </td>
              </tr>
            ))}
          </Tableau>
        </>
      )}
    </div>
  );
}

function CreerProjet({ accent, onFlash, onClose }: {
  accent: string; onFlash: (m: string, ok?: boolean) => void; onClose: (id?: number) => void;
}) {
  const [form, setForm] = useState({
    projet: "", codeCli: "", respProjet: "", famille: "", budget: 0,
    periodeDu: "", periodeAu: "", description: "",
  });
  const [clients, setClients] = useState<Client[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      fetch(`/api/clients?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((d) => setClients((d.rows ?? d.clients ?? []).slice(0, 100)))
        .catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const creer = async () => {
    if (!form.projet.trim()) return onFlash("Nom du projet requis", false);
    setBusy(true);
    try {
      const r = await fetch("/api/projets", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vue: "projet", ...form,
          codeCli: form.codeCli ? Number(form.codeCli) : null,
        }),
      });
      const d = await r.json();
      if (!r.ok) return onFlash(d.error ?? "Échec", false);
      onFlash(d.message ?? "Créé");
      onClose(d.row?.id);
    } finally { setBusy(false); }
  };

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl p-4 space-y-3">
      <div className="grid md:grid-cols-3 gap-3">
        <Champ label="Nom du projet *"><input value={form.projet}
          onChange={(e) => setForm({ ...form, projet: e.target.value })} className={inputCls} /></Champ>
        <Champ label="Client">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher…" className={`${inputCls} mb-1`} />
          <select value={form.codeCli} onChange={(e) => setForm({ ...form, codeCli: e.target.value })} className={inputCls}>
            <option value="">— Aucun —</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.raisonSocial ?? `Client ${c.id}`}</option>)}
          </select>
        </Champ>
        <Champ label="Responsable"><input value={form.respProjet}
          onChange={(e) => setForm({ ...form, respProjet: e.target.value })} className={inputCls} /></Champ>
        <Champ label="Famille"><input value={form.famille}
          onChange={(e) => setForm({ ...form, famille: e.target.value })} className={inputCls} /></Champ>
        <Champ label="Budget"><input type="number" step="0.001" value={form.budget}
          onChange={(e) => setForm({ ...form, budget: Number(e.target.value) })} className={inputCls} /></Champ>
        <div className="grid grid-cols-2 gap-2">
          <Champ label="Du"><input type="date" value={form.periodeDu}
            onChange={(e) => setForm({ ...form, periodeDu: e.target.value })} className={inputCls} /></Champ>
          <Champ label="Au"><input type="date" value={form.periodeAu}
            onChange={(e) => setForm({ ...form, periodeAu: e.target.value })} className={inputCls} /></Champ>
        </div>
      </div>
      <Champ label="Description"><textarea value={form.description} rows={2}
        onChange={(e) => setForm({ ...form, description: e.target.value })} className={`${inputCls} resize-y`} /></Champ>
      <div className="flex gap-2">
        <button onClick={creer} disabled={busy}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 disabled:opacity-50"
          style={{ background: accent }}>
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Créer
        </button>
        <button onClick={() => onClose()}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--border-primary)] text-[var(--text-secondary)]">
          Annuler
        </button>
      </div>
    </div>
  );
}

function ProjetDetail({ id, accent, onFlash, onClose }: {
  id: number; accent: string; onFlash: (m: string, ok?: boolean) => void; onClose: () => void;
}) {
  const [d, setD] = useState<Detail | null>(null);
  const [load, setLoad] = useState(true);
  const [jalon, setJalon] = useState<{ libelle: string; poids: number; datePrevue: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const charger = useCallback(() => {
    fetch(`/api/projets?vue=detail&id=${id}`)
      .then((r) => r.json())
      .then((x) => setD(x.error ? null : x))
      .finally(() => setLoad(false));
  }, [id]);

  useEffect(charger, [charger]);

  const majEtat = async (etat: string) => {
    const r = await fetch("/api/projets", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vue: "projet", id, etat }),
    });
    const x = await r.json();
    if (!r.ok) return onFlash(x.error ?? "Échec", false);
    onFlash(`Projet passé en « ${etat} »`);
    charger();
  };

  const ajouterJalon = async () => {
    if (!jalon?.libelle.trim()) return onFlash("Libellé du jalon requis", false);
    setBusy(true);
    try {
      const r = await fetch("/api/projets", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vue: "jalon", projetId: id, ...jalon }),
      });
      const x = await r.json();
      if (!r.ok) return onFlash(x.error ?? "Échec", false);
      onFlash(x.message ?? "Ajouté");
      setJalon(null);
      charger();
    } finally { setBusy(false); }
  };

  const majJalon = async (jid: number, avancement: number) => {
    const r = await fetch("/api/projets", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vue: "jalon", id: jid, avancement }),
    });
    if (!r.ok) return onFlash("Échec de la mise à jour", false);
    charger();
  };

  const supprimerJalon = async (jid: number) => {
    const r = await fetch(`/api/projets?vue=jalon&id=${jid}`, { method: "DELETE" });
    if (!r.ok) return onFlash("Échec de la suppression", false);
    charger();
  };

  if (load) return <Chargement />;
  if (!d) return <div className="text-sm text-[var(--text-secondary)]">Projet introuvable.</div>;

  const p = d.row;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <button onClick={onClose} className="text-xs text-[var(--text-secondary)] mb-1 flex items-center gap-1">
            <X size={12} /> Retour à la liste
          </button>
          <div className="font-bold text-sm text-[var(--text-primary)]">{p.projet}</div>
          <div className="text-xs text-[var(--text-secondary)] flex items-center gap-3 flex-wrap mt-0.5">
            {p.raisonSoc && <span className="flex items-center gap-1"><Users size={11} /> {p.raisonSoc}</span>}
            {p.respProjet && <span>Resp. {p.respProjet}</span>}
            <span className="flex items-center gap-1">
              <CalendarClock size={11} /> {fmtDate(p.periodeDu)} → {fmtDate(p.periodeAu)}
            </span>
          </div>
        </div>
        <select value={p.etat} onChange={(e) => majEtat(e.target.value)}
          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[var(--bg-card)] border border-[var(--border-primary)]">
          {d.etats.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Budget" val={`${fmt(p.budget)} TND`} accent={accent} />
        <Kpi label="Avancement" val={`${fmt(p.avancement)} %`} accent={accent} />
        <Kpi label="Jalons" val={String(d.jalons.length)} accent={accent} />
        <Kpi label="CA du client" val={`${fmt(d.caClient)} TND`} accent={accent} />
      </div>

      {p.calculeDepuisJalons && (
        <div className="px-3 py-2 rounded-lg bg-blue-500/10 text-blue-700 dark:text-blue-400 text-xs flex items-start gap-2">
          <Flag size={13} className="mt-0.5 shrink-0" />
          Avancement calculé depuis les {d.jalons.length} jalons pondérés
          {p.avancementSaisi !== p.avancement && ` — la valeur saisie (${fmt(p.avancementSaisi)} %) est ignorée`}.
        </div>
      )}

      {p.description && (
        <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl p-3 text-xs text-[var(--text-secondary)]">
          {p.description}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-[var(--text-primary)]">Jalonnements</div>
        <button onClick={() => setJalon({ libelle: "", poids: 1, datePrevue: "" })}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--border-primary)] flex items-center gap-1.5">
          <Plus size={13} /> Jalon
        </button>
      </div>

      {jalon && (
        <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl p-3 flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-48">
            <Champ label="Libellé *"><input value={jalon.libelle}
              onChange={(e) => setJalon({ ...jalon, libelle: e.target.value })} className={inputCls} /></Champ>
          </div>
          <Champ label="Poids"><input type="number" step="0.1" min={0.1} value={jalon.poids}
            onChange={(e) => setJalon({ ...jalon, poids: Number(e.target.value) })} className={`${inputCls} w-24`} /></Champ>
          <Champ label="Date prévue"><input type="date" value={jalon.datePrevue}
            onChange={(e) => setJalon({ ...jalon, datePrevue: e.target.value })} className={inputCls} /></Champ>
          <button onClick={ajouterJalon} disabled={busy}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 disabled:opacity-50"
            style={{ background: accent }}>
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Ajouter
          </button>
          <button onClick={() => setJalon(null)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--border-primary)] text-[var(--text-secondary)]">
            Annuler
          </button>
        </div>
      )}

      <Tableau load={false}
        vide="Aucun jalon. Sans jalon, l'avancement du projet reste une valeur saisie à la main."
        entetes={["#", "Jalon", "Poids", "Avancement", "Prévu", "Réalisé", ""]}>
        {d.jalons.map((j) => (
          <tr key={j.id} className={`border-b border-[var(--border-primary)]/60 ${j.retard ? "bg-red-500/5" : ""}`}>
            <td className="px-3 py-2 text-xs">{j.numOrdre}</td>
            <td className="px-3 py-2">
              {j.libelle}
              {j.retard && <span className="ml-1.5 text-red-500 text-xs">retard</span>}
            </td>
            <td className="px-3 py-2 text-right text-xs">{j.poids}</td>
            <td className="px-3 py-2 min-w-40">
              <div className="flex items-center gap-2">
                <input type="range" min={0} max={100} step={5} value={j.avancement}
                  onChange={(e) => majJalon(j.id, Number(e.target.value))} className="flex-1" />
                <span className="text-xs font-semibold w-10 text-right">{j.avancement} %</span>
              </div>
            </td>
            <td className="px-3 py-2 text-xs">{fmtDate(j.datePrevue)}</td>
            <td className="px-3 py-2 text-xs">{fmtDate(j.dateReelle)}</td>
            <td className="px-3 py-2 text-right">
              <button onClick={() => supprimerJalon(j.id)} className="text-red-500 p-1"><Trash2 size={13} /></button>
            </td>
          </tr>
        ))}
      </Tableau>

      {d.documents.length > 0 && (
        <>
          <div className="text-xs font-semibold text-[var(--text-primary)]">
            Derniers documents du client
          </div>
          <Tableau load={false} vide="Aucun document." entetes={["Référence", "Type", "Date", "TTC"]}>
            {d.documents.map((doc) => (
              <tr key={doc.refDoc} className="border-b border-[var(--border-primary)]/60">
                <td className="px-3 py-2 font-mono text-xs">{doc.refDoc}</td>
                <td className="px-3 py-2 text-xs">{doc.typeDoc ?? "—"}</td>
                <td className="px-3 py-2 text-xs">{fmtDate(doc.dateDoc)}</td>
                <td className="px-3 py-2 text-right">{fmt(doc.ttcNet)}</td>
              </tr>
            ))}
          </Tableau>
        </>
      )}
    </div>
  );
}

/* ------------------------------ Éléments communs --------------------------- */

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

function Jauge({ valeur, accent }: { valeur: number; accent: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-[var(--border-primary)] overflow-hidden min-w-14">
        <div className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(100, Math.max(0, valeur))}%`, background: valeur >= 100 ? "#16a34a" : accent }} />
      </div>
      <span className="text-xs font-semibold w-11 text-right">{fmt(valeur)} %</span>
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

function Tableau({ load, vide, entetes, children }: {
  load: boolean; vide: string; entetes: string[]; children: React.ReactNode;
}) {
  const rows = Array.isArray(children) ? children.flat().filter(Boolean) : children;
  const estVide = Array.isArray(rows) ? rows.length === 0 : !rows;

  if (load) return <Chargement />;

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
