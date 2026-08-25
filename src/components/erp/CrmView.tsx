"use client";
import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { confirmer } from "@/lib/alertes";
import {
  Target, Headphones, Plus, Loader2, Check, AlertTriangle, X,
  TrendingUp, Archive, MessageSquare, ChevronRight,
} from "lucide-react";

// CRM — pipeline d'opportunités et tickets SAV, sur les tiers réels.

type Opp = {
  id: number; libelle: string; codeCli: number | null; clientNom: string | null;
  etape: string; montant: number; probabilite: number; source: string | null;
  suiviPar: string | null; description: string | null; nbEvenements: number;
};
type EtapeStat = { etape: string; nb: number; montant: number; pondere: number };
type Ticket = {
  id: number; reference: string; codeCli: number | null; clientNom: string | null;
  typePanne: string | null; description: string; etat: string; priorite: string;
  intervenant: string | null; solution: string | null;
  dateReclamation: string; dateReparation: string | null;
};
type Evenement = { id: number; type: string; libelle: string; dateEvent: string; auteur: string | null };
type ClientRef = { id: number; raisonSocial: string };

const fmt = (v: unknown) =>
  new Intl.NumberFormat("fr-TN", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(Number(v) || 0);
const fmt0 = (v: unknown) => new Intl.NumberFormat("fr-TN", { maximumFractionDigits: 0 }).format(Number(v) || 0);
const fmtDate = (v: unknown) => (v ? new Date(String(v)).toLocaleDateString("fr-FR") : "—");

const ETAPE_COULEUR: Record<string, string> = {
  Prospection: "#64748b", Qualification: "#3b82f6", Proposition: "#8b5cf6",
  "Négociation": "#f59e0b", "Gagnée": "#16a34a", Perdue: "#dc2626",
};
const ETAT_STYLE: Record<string, string> = {
  Ouvert: "bg-blue-500/12 text-blue-600",
  "En cours": "bg-amber-500/12 text-amber-600",
  "Résolu": "bg-emerald-500/12 text-emerald-600",
  "Clôturé": "bg-slate-500/12 text-slate-500",
  "Rejeté": "bg-red-500/12 text-red-600",
};
const PRIO_STYLE: Record<string, string> = {
  Basse: "text-slate-500", Normale: "text-blue-600",
  Haute: "text-amber-600", Urgente: "text-red-600",
};

export default function CrmView({ accent, mode }: { accent: string; mode: "pipeline" | "tickets" }) {
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [reload, setReload] = useState(0);

  const flash = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }, []);
  const refresh = useCallback(() => setReload((k) => k + 1), []);

  return (
    <div className="space-y-4">
      {toast && (
        <div className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 ${
          toast.ok ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-red-500/10 text-red-600"
        }`}>
          {toast.ok ? <Check size={15} /> : <AlertTriangle size={15} />} {toast.msg}
        </div>
      )}
      {mode === "pipeline"
        ? <Pipeline accent={accent} reload={reload} onFlash={flash} onDone={refresh} />
        : <Tickets accent={accent} reload={reload} onFlash={flash} onDone={refresh} />}
    </div>
  );
}

/* -------------------------------- Pipeline -------------------------------- */

function Pipeline({ accent, reload, onFlash, onDone }: {
  accent: string; reload: number; onFlash: (m: string, ok?: boolean) => void; onDone: () => void;
}) {
  const [rows, setRows] = useState<Opp[]>([]);
  const [parEtape, setParEtape] = useState<EtapeStat[]>([]);
  const [etapes, setEtapes] = useState<string[]>([]);
  const [totaux, setTotaux] = useState({ montant: 0, pondere: 0 });
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [clients, setClients] = useState<ClientRef[]>([]);
  const [detail, setDetail] = useState<Opp | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/crm?vue=pipeline").then((r) => r.json()),
      fetch("/api/clients?limit=300").then((r) => r.json()),
    ]).then(([p, c]) => {
      if (cancelled) return;
      setRows(p.rows ?? []); setParEtape(p.parEtape ?? []); setEtapes(p.etapes ?? []);
      setTotaux({ montant: p.totalMontant ?? 0, pondere: p.totalPondere ?? 0 });
      setClients(c.rows ?? []);
      setLoading(false);
    }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [reload]);

  async function creer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    const r = await fetch("/api/crm", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vue: "opportunite", libelle: fd.get("libelle"), codeCli: fd.get("codeCli") || null,
        montant: fd.get("montant"), probabilite: fd.get("probabilite"),
        etape: fd.get("etape"), source: fd.get("source"),
      }),
    }).then((x) => x.json());
    setBusy(false);
    onFlash(r.message ?? r.error ?? "—", Boolean(r.ok));
    if (r.ok) { setOpen(false); onDone(); }
  }

  async function deplacer(o: Opp, etape: string) {
    const r = await fetch("/api/crm", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vue: "opportunite", id: o.id, etape }),
    }).then((x) => x.json());
    onFlash(r.message ?? r.error ?? "—", Boolean(r.ok));
    if (r.ok) onDone();
  }

  async function archiver(o: Opp) {
    if (!(await confirmer(`Archiver « ${o.libelle} » ?`, { danger: true }))) return;
    const r = await fetch(`/api/crm?vue=opportunite&id=${o.id}`, { method: "DELETE" }).then((x) => x.json());
    onFlash(r.message ?? r.error ?? "—", Boolean(r.ok));
    if (r.ok) onDone();
  }

  if (loading) return <Spin />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3 text-sm">
          <span className="text-[var(--text-secondary)]">{rows.length} opportunité(s)</span>
          <span className="font-bold" style={{ color: accent }}>{fmt0(totaux.montant)} TND</span>
          <span className="text-[var(--text-secondary)]">pondéré {fmt0(totaux.pondere)} TND</span>
        </div>
        <button onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: accent }}>
          <Plus size={14} /> Nouvelle opportunité
        </button>
      </div>

      {open && (
        <form onSubmit={creer} className="grid sm:grid-cols-6 gap-2 p-3 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)]">
          <input name="libelle" required placeholder="Libellé *"
            className="sm:col-span-2 px-2 py-1.5 text-sm bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg" />
          <select name="codeCli" className="px-2 py-1.5 text-sm bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg">
            <option value="">Client…</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.raisonSocial}</option>)}
          </select>
          <input name="montant" type="number" step="any" placeholder="Montant"
            className="px-2 py-1.5 text-sm bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg" />
          <input name="probabilite" type="number" min={0} max={100} defaultValue={50} placeholder="Proba %"
            className="px-2 py-1.5 text-sm bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg" />
          <select name="etape" className="px-2 py-1.5 text-sm bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg">
            {etapes.map((e) => <option key={e}>{e}</option>)}
          </select>
          <input name="source" placeholder="Source"
            className="sm:col-span-2 px-2 py-1.5 text-sm bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg" />
          <div className="sm:col-span-4 flex gap-2">
            <button type="submit" disabled={busy}
              className="px-4 py-1.5 text-sm font-semibold text-white rounded-lg disabled:opacity-50" style={{ background: accent }}>
              {busy ? "…" : "Créer"}
            </button>
            <button type="button" onClick={() => setOpen(false)}
              className="px-3 rounded-lg border border-[var(--border-primary)] text-[var(--text-secondary)]">Annuler</button>
          </div>
        </form>
      )}

      {/* Pipeline en colonnes */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {parEtape.map((e) => (
          <div key={e.etape} className="rounded-xl border border-[var(--border-primary)] overflow-hidden bg-[var(--bg-card)]">
            <div className="px-3 py-2 text-white" style={{ background: ETAPE_COULEUR[e.etape] ?? "#64748b" }}>
              <div className="font-bold text-xs truncate">{e.etape}</div>
              <div className="text-[10px] opacity-90">{e.nb} · {fmt0(e.montant)} TND</div>
            </div>
            <div className="p-2 space-y-2 max-h-[45vh] overflow-auto">
              {rows.filter((r) => r.etape === e.etape).length === 0 && (
                <div className="py-4 text-center text-[10px] text-[var(--text-secondary)]">—</div>
              )}
              {rows.filter((r) => r.etape === e.etape).map((o) => (
                <motion.div key={o.id} layout onClick={() => setDetail(o)}
                  className="p-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-primary)] cursor-pointer hover:shadow-sm"
                  initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
                  <div className="font-semibold text-[11px] text-[var(--text-primary)] truncate" title={o.libelle}>{o.libelle}</div>
                  <div className="text-[10px] text-[var(--text-secondary)] truncate">{o.clientNom || "—"}</div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[11px] font-bold tabular-nums">{fmt0(o.montant)}</span>
                    <span className="text-[9px] px-1.5 rounded-full bg-[var(--accent-light)] text-[var(--accent-primary)]">
                      {o.probabilite}%
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {detail && (
        <DetailOpp opp={detail} etapes={etapes} accent={accent}
          onClose={() => setDetail(null)}
          onDeplacer={(e) => { deplacer(detail, e); setDetail(null); }}
          onArchiver={() => { archiver(detail); setDetail(null); }}
          onFlash={onFlash} />
      )}
    </div>
  );
}

function DetailOpp({ opp, etapes, accent, onClose, onDeplacer, onArchiver, onFlash }: {
  opp: Opp; etapes: string[]; accent: string;
  onClose: () => void; onDeplacer: (e: string) => void; onArchiver: () => void;
  onFlash: (m: string, ok?: boolean) => void;
}) {
  const [evts, setEvts] = useState<Evenement[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/crm?vue=evenements&opportuniteId=${opp.id}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setEvts(d.rows ?? []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [opp.id]);

  async function ajouterNote() {
    if (!note.trim()) return;
    setBusy(true);
    const r = await fetch("/api/crm", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vue: "evenement", opportuniteId: opp.id, type: "Note", libelle: note.trim() }),
    }).then((x) => x.json());
    setBusy(false);
    if (r.ok) {
      setNote("");
      const d = await fetch(`/api/crm?vue=evenements&opportuniteId=${opp.id}`).then((x) => x.json());
      setEvts(d.rows ?? []);
      onFlash("Événement ajouté");
    } else onFlash(r.error ?? "Échec", false);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div onClick={(e) => e.stopPropagation()}
        className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden"
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
        <div className="px-5 py-3.5 border-b border-[var(--border-primary)] flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-bold text-[var(--text-primary)] truncate">{opp.libelle}</div>
            <div className="text-xs text-[var(--text-secondary)] truncate">
              {opp.clientNom || "—"} · {fmt(opp.montant)} TND · {opp.probabilite}%
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[var(--bg-primary)] text-[var(--text-secondary)] shrink-0"><X size={18} /></button>
        </div>

        <div className="px-5 py-4 space-y-4 overflow-auto flex-1">
          <div>
            <div className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2">
              Déplacer vers
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {etapes.filter((e) => e !== opp.etape).map((e) => (
                <button key={e} onClick={() => onDeplacer(e)}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold text-white"
                  style={{ background: ETAPE_COULEUR[e] ?? "#64748b" }}>
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2">
              Historique ({evts.length})
            </div>
            <div className="flex gap-2 mb-2">
              <input value={note} onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && ajouterNote()}
                placeholder="Ajouter une note, un appel, une visite…"
                className="flex-1 px-2.5 py-1.5 text-sm bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg focus:outline-none" />
              <button onClick={ajouterNote} disabled={busy || !note.trim()}
                className="px-3 rounded-lg text-white disabled:opacity-40" style={{ background: accent }}>
                <Plus size={14} />
              </button>
            </div>
            <div className="space-y-1.5 max-h-52 overflow-auto">
              {evts.length === 0 && (
                <div className="py-4 text-center text-xs text-[var(--text-secondary)]">Aucun événement.</div>
              )}
              {evts.map((e) => (
                <div key={e.id} className="flex items-start gap-2 p-2 rounded-lg bg-[var(--bg-primary)]">
                  <MessageSquare size={12} className="mt-0.5 shrink-0 text-[var(--text-secondary)]" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-[var(--text-primary)]">{e.libelle}</div>
                    <div className="text-[10px] text-[var(--text-secondary)]">
                      {e.type} · {fmtDate(e.dateEvent)}{e.auteur ? ` · ${e.auteur}` : ""}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-[var(--border-primary)] flex justify-between">
          <button onClick={onArchiver}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border border-[var(--border-primary)] text-amber-600">
            <Archive size={14} /> Archiver
          </button>
          <button onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-semibold border border-[var(--border-primary)] text-[var(--text-secondary)]">
            Fermer
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* --------------------------------- Tickets -------------------------------- */

function Tickets({ accent, reload, onFlash, onDone }: {
  accent: string; reload: number; onFlash: (m: string, ok?: boolean) => void; onDone: () => void;
}) {
  const [rows, setRows] = useState<Ticket[]>([]);
  const [etats, setEtats] = useState<string[]>([]);
  const [priorites, setPriorites] = useState<string[]>([]);
  const [parEtat, setParEtat] = useState<{ etat: string; nb: number }[]>([]);
  const [filtre, setFiltre] = useState("Tous");
  const [clients, setClients] = useState<ClientRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(`/api/crm?vue=tickets&etat=${encodeURIComponent(filtre)}`).then((r) => r.json()),
      fetch("/api/clients?limit=300").then((r) => r.json()),
    ]).then(([t, c]) => {
      if (cancelled) return;
      setRows(t.rows ?? []); setEtats(t.etats ?? []); setPriorites(t.priorites ?? []);
      setParEtat(t.parEtat ?? []); setClients(c.rows ?? []); setLoading(false);
    }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [filtre, reload]);

  async function creer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    const r = await fetch("/api/crm", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vue: "ticket", description: fd.get("description"), codeCli: fd.get("codeCli") || null,
        typePanne: fd.get("typePanne"), priorite: fd.get("priorite"), intervenant: fd.get("intervenant"),
      }),
    }).then((x) => x.json());
    setBusy(false);
    onFlash(r.message ?? r.error ?? "—", Boolean(r.ok));
    if (r.ok) { setOpen(false); onDone(); }
  }

  async function changer(t: Ticket, etat: string) {
    const r = await fetch("/api/crm", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vue: "ticket", id: t.id, etat }),
    }).then((x) => x.json());
    onFlash(r.message ?? r.error ?? "—", Boolean(r.ok));
    if (r.ok) onDone();
  }

  if (loading) return <Spin />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <select value={filtre} onChange={(e) => { setLoading(true); setFiltre(e.target.value); }}
            className="px-3 py-2 text-sm bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl">
            <option>Tous</option>
            {etats.map((e) => <option key={e}>{e}</option>)}
          </select>
          {parEtat.map((p) => (
            <span key={p.etat} className={`text-[10px] px-2 py-1 rounded-full font-bold ${ETAT_STYLE[p.etat] ?? ""}`}>
              {p.etat} {p.nb}
            </span>
          ))}
        </div>
        <button onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: accent }}>
          <Plus size={14} /> Nouveau ticket
        </button>
      </div>

      {open && (
        <form onSubmit={creer} className="grid sm:grid-cols-5 gap-2 p-3 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)]">
          <select name="codeCli" className="px-2 py-1.5 text-sm bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg">
            <option value="">Client…</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.raisonSocial}</option>)}
          </select>
          <input name="typePanne" placeholder="Type de panne"
            className="px-2 py-1.5 text-sm bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg" />
          <select name="priorite" className="px-2 py-1.5 text-sm bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg">
            {priorites.map((p) => <option key={p}>{p}</option>)}
          </select>
          <input name="intervenant" placeholder="Intervenant"
            className="px-2 py-1.5 text-sm bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg" />
          <div className="flex gap-1">
            <button type="submit" disabled={busy}
              className="flex-1 px-3 py-1.5 text-sm font-semibold text-white rounded-lg disabled:opacity-50" style={{ background: accent }}>
              {busy ? "…" : "Créer"}
            </button>
            <button type="button" onClick={() => setOpen(false)}
              className="px-2 rounded-lg border border-[var(--border-primary)] text-[var(--text-secondary)]">✕</button>
          </div>
          <textarea name="description" required rows={2} placeholder="Description du problème *"
            className="sm:col-span-5 px-2 py-1.5 text-sm bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg resize-none" />
        </form>
      )}

      <div className="overflow-auto rounded-xl border border-[var(--border-primary)] max-h-[55vh]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--bg-primary)] border-b border-[var(--border-primary)] sticky top-0 z-10">
            <tr className="text-[11px] uppercase tracking-wide text-[var(--text-secondary)]">
              <th className="px-4 py-2.5 text-left font-semibold">Référence</th>
              <th className="px-4 py-2.5 text-left font-semibold">Client</th>
              <th className="px-4 py-2.5 text-left font-semibold">Problème</th>
              <th className="px-4 py-2.5 text-left font-semibold">Priorité</th>
              <th className="px-4 py-2.5 text-left font-semibold">Intervenant</th>
              <th className="px-4 py-2.5 text-left font-semibold">Date</th>
              <th className="px-4 py-2.5 text-center font-semibold">État</th>
              <th className="px-4 py-2.5 w-32" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={8} className="py-12 text-center text-sm text-[var(--text-secondary)]">
                Aucun ticket{filtre !== "Tous" ? ` à l'état « ${filtre} »` : ""}.
              </td></tr>
            )}
            {rows.map((t) => (
              <tr key={t.id} className="border-b border-[var(--border-primary)]/60 hover:bg-[var(--accent-light)]">
                <td className="px-4 py-2 font-mono text-xs font-bold">{t.reference}</td>
                <td className="px-4 py-2 text-[var(--text-primary)] truncate max-w-[14rem]">{t.clientNom || "—"}</td>
                <td className="px-4 py-2 text-[var(--text-secondary)] truncate max-w-xs" title={t.description}>
                  {t.typePanne ? <b className="text-[var(--text-primary)]">{t.typePanne} — </b> : null}{t.description}
                </td>
                <td className={`px-4 py-2 font-semibold text-xs ${PRIO_STYLE[t.priorite] ?? ""}`}>{t.priorite}</td>
                <td className="px-4 py-2 text-[var(--text-secondary)]">{t.intervenant || "—"}</td>
                <td className="px-4 py-2 text-[var(--text-secondary)] text-xs">{fmtDate(t.dateReclamation)}</td>
                <td className="px-4 py-2 text-center">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${ETAT_STYLE[t.etat] ?? ""}`}>{t.etat}</span>
                </td>
                <td className="px-4 py-2">
                  <select value="" onChange={(e) => e.target.value && changer(t, e.target.value)}
                    className="text-xs px-2 py-1 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg">
                    <option value="">Changer…</option>
                    {etats.filter((x) => x !== t.etat).map((x) => <option key={x} value={x}>{x}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Spin() {
  return <div className="p-12 text-center text-[var(--text-secondary)]"><Loader2 className="animate-spin inline" size={20} /></div>;
}
