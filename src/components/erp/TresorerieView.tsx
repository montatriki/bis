"use client";
import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Wallet, BookOpen, FileText, Loader2, Check, AlertTriangle,
  Plus, Download, Landmark, ArrowDownCircle, ArrowUpCircle,
} from "lucide-react";

// Trésorerie : comptes, chéquiers, portefeuille de chèques, bordereaux, extraits.

type Compte = {
  id: number; type: string | null; libelle: string | null; banque: string | null;
  rib: string | null; solde: number; nbMouvements: number;
};
type Chequier = {
  id: number; banque: string; serie: string | null; numDebut: number; numFin: number;
  suivant: number; epuise: boolean; total: number; utilises: number; restants: number;
};
type Cheque = {
  id: number; numero: number; montant: number; etat: string;
  tiersNom: string | null; dateEmis: string | null; echeance: string | null;
  chequier: { banque: string; serie: string | null };
};
type Borderau = {
  id: number; dateBord: string | null; type: string | null; total: number;
  numCompte: string | null; nbLignes: number; totalLignes: number;
};
type Mouvement = {
  id: number; dateMvt: string; libelle: string; sens: string;
  montant: number; solde: number; reference: string | null;
};
type Synthese = {
  encaissements: { total: number; nb: number };
  decaissements: { total: number; nb: number };
  solde: number; nbComptes: number;
  portefeuille: { etat: string; nb: number; montant: number }[];
  parMode: { mode: string; sens: string; nb: number; montant: number }[];
};

const fmt = (v: unknown) =>
  new Intl.NumberFormat("fr-TN", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(Number(v) || 0);
const fmt0 = (v: unknown) => new Intl.NumberFormat("fr-TN", { maximumFractionDigits: 0 }).format(Number(v) || 0);
const fmtDate = (v: unknown) => (v ? new Date(String(v)).toLocaleDateString("fr-FR") : "—");

const ETAT_STYLE: Record<string, string> = {
  Emis: "bg-blue-500/12 text-blue-600",
  Remis: "bg-amber-500/12 text-amber-600",
  "Encaissé": "bg-emerald-500/12 text-emerald-600",
  "Rejeté": "bg-red-500/12 text-red-600",
  "Déchiré": "bg-slate-500/12 text-slate-500",
};

const VUES = ["Synthèse", "Comptes", "Chéquiers", "Chèques", "Bordereaux", "Extrait"] as const;
type Vue = (typeof VUES)[number];

export default function TresorerieView({ accent }: { accent: string }) {
  const [vue, setVue] = useState<Vue>("Synthèse");
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [reload, setReload] = useState(0);

  const flash = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4500);
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

      {vue === "Synthèse" && <SyntheseVue accent={accent} reload={reload} />}
      {vue === "Comptes" && <ComptesVue accent={accent} reload={reload} onFlash={flash} onDone={refresh} />}
      {vue === "Chéquiers" && <ChequiersVue accent={accent} reload={reload} onFlash={flash} onDone={refresh} />}
      {vue === "Chèques" && <ChequesVue accent={accent} reload={reload} onFlash={flash} onDone={refresh} />}
      {vue === "Bordereaux" && <BorderauxVue accent={accent} reload={reload} />}
      {vue === "Extrait" && <ExtraitVue accent={accent} reload={reload} />}
    </div>
  );
}

/* -------------------------------- Synthèse -------------------------------- */

function SyntheseVue({ accent, reload }: { accent: string; reload: number }) {
  const [d, setD] = useState<Synthese | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/tresorerie?vue=synthese")
      .then((r) => r.json())
      .then((x) => { if (!cancelled) { setD(x); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [reload]);

  if (loading) return <Spin />;
  if (!d) return null;

  const maxMode = Math.max(1, ...d.parMode.map((m) => m.montant));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tile label="Encaissements" value={`${fmt0(d.encaissements.total)} TND`}
          sub={`${d.encaissements.nb} règlements`} color="#16a34a" icon={ArrowDownCircle} />
        <Tile label="Décaissements" value={`${fmt0(d.decaissements.total)} TND`}
          sub={`${d.decaissements.nb} règlements`} color="#dc2626" icon={ArrowUpCircle} />
        <Tile label="Solde net" value={`${fmt0(d.solde)} TND`}
          sub={d.solde >= 0 ? "Excédent" : "Déficit"} color={d.solde >= 0 ? "#2563eb" : "#dc2626"} icon={Wallet} />
        <Tile label="Comptes" value={String(d.nbComptes)} sub="Trésorerie" color="#7c3aed" icon={Landmark} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Panel titre="Portefeuille de chèques" accent={accent}>
          {d.portefeuille.length === 0 ? (
            <Empty msg="Aucun chèque enregistré." />
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {d.portefeuille.map((p) => (
                  <tr key={p.etat} className="border-b border-[var(--border-primary)]/40 last:border-0">
                    <td className="px-4 py-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${ETAT_STYLE[p.etat] ?? ""}`}>
                        {p.etat}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right text-[var(--text-secondary)]">{p.nb}</td>
                    <td className="px-4 py-2 text-right tabular-nums font-semibold">{fmt(p.montant)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel titre="Règlements par mode" accent={accent}>
          <div className="p-4 space-y-2">
            {d.parMode.sort((a, b) => b.montant - a.montant).slice(0, 8).map((m, i) => (
              <div key={`${m.mode}-${m.sens}-${i}`} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--text-primary)] font-medium">
                    {m.mode} <span className="opacity-60">({m.sens === "C" ? "client" : "fournisseur"})</span>
                  </span>
                  <span className="tabular-nums font-bold">{fmt0(m.montant)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--bg-primary)] overflow-hidden">
                  <div className="h-full rounded-full"
                    style={{ width: `${(m.montant / maxMode) * 100}%`, background: m.sens === "C" ? "#16a34a" : "#dc2626" }} />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* --------------------------------- Comptes -------------------------------- */

function ComptesVue({ accent, reload, onFlash, onDone }: {
  accent: string; reload: number; onFlash: (m: string, ok?: boolean) => void; onDone: () => void;
}) {
  const [rows, setRows] = useState<Compte[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<{ compteId: string; sens: string; montant: string; libelle: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/tresorerie?vue=comptes")
      .then((r) => r.json())
      .then((d) => { if (!cancelled) { setRows(d.rows ?? []); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [reload]);

  async function saveMvt(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    const r = await fetch("/api/tresorerie", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mouvement", ...form, compteId: Number(form.compteId) }),
    }).then((x) => x.json());
    setBusy(false);
    onFlash(r.message ?? r.error ?? "—", Boolean(r.ok));
    if (r.ok) { setForm(null); onDone(); }
  }

  if (loading) return <Spin />;

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={() => setForm({ compteId: String(rows[0]?.id ?? ""), sens: "E", montant: "", libelle: "" })}
          disabled={rows.length === 0}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
          style={{ background: accent }}>
          <Plus size={14} /> Saisir un mouvement
        </button>
      </div>

      {form && (
        <form onSubmit={saveMvt} className="grid sm:grid-cols-5 gap-2 p-3 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)]">
          <select value={form.compteId} onChange={(e) => setForm({ ...form, compteId: e.target.value })}
            className="px-2 py-1.5 text-sm bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg">
            {rows.map((c) => <option key={c.id} value={c.id}>{c.libelle || `Compte ${c.id}`}</option>)}
          </select>
          <select value={form.sens} onChange={(e) => setForm({ ...form, sens: e.target.value })}
            className="px-2 py-1.5 text-sm bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg">
            <option value="E">Entrée</option>
            <option value="S">Sortie</option>
          </select>
          <input type="number" step="any" required placeholder="Montant" value={form.montant}
            onChange={(e) => setForm({ ...form, montant: e.target.value })}
            className="px-2 py-1.5 text-sm bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg" />
          <input placeholder="Libellé" value={form.libelle}
            onChange={(e) => setForm({ ...form, libelle: e.target.value })}
            className="px-2 py-1.5 text-sm bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg" />
          <div className="flex gap-1">
            <button type="submit" disabled={busy}
              className="flex-1 px-3 py-1.5 text-sm font-semibold text-white rounded-lg disabled:opacity-50" style={{ background: accent }}>
              {busy ? "…" : "Ajouter"}
            </button>
            <button type="button" onClick={() => setForm(null)}
              className="px-2 rounded-lg border border-[var(--border-primary)] text-[var(--text-secondary)]">✕</button>
          </div>
        </form>
      )}

      <Table head={["Compte", "Type", "Banque", "RIB", "Mouvements", "Solde"]}>
        {rows.length === 0 && <EmptyRow cols={6} msg="Aucun compte de trésorerie." />}
        {rows.map((c) => (
          <tr key={c.id} className="border-b border-[var(--border-primary)]/60 hover:bg-[var(--accent-light)]">
            <td className="px-4 py-2 font-medium text-[var(--text-primary)]">{c.libelle || `Compte ${c.id}`}</td>
            <td className="px-4 py-2 text-[var(--text-secondary)]">{c.type || "—"}</td>
            <td className="px-4 py-2 text-[var(--text-secondary)]">{c.banque || "—"}</td>
            <td className="px-4 py-2 text-[var(--text-secondary)] text-xs font-mono truncate max-w-xs">{c.rib || "—"}</td>
            <td className="px-4 py-2 text-right text-[var(--text-secondary)]">{c.nbMouvements}</td>
            <td className={`px-4 py-2 text-right tabular-nums font-bold ${c.solde < 0 ? "text-red-600" : ""}`}>{fmt(c.solde)}</td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

/* -------------------------------- Chéquiers ------------------------------- */

function ChequiersVue({ accent, reload, onFlash, onDone }: {
  accent: string; reload: number; onFlash: (m: string, ok?: boolean) => void; onDone: () => void;
}) {
  const [rows, setRows] = useState<Chequier[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/tresorerie?vue=chequiers")
      .then((r) => r.json())
      .then((d) => { if (!cancelled) { setRows(d.rows ?? []); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [reload]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    const r = await fetch("/api/tresorerie", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "chequier", banque: fd.get("banque"), serie: fd.get("serie"),
        numDebut: fd.get("numDebut"), numFin: fd.get("numFin"),
      }),
    }).then((x) => x.json());
    setBusy(false);
    onFlash(r.message ?? r.error ?? "—", Boolean(r.ok));
    if (r.ok) { setOpen(false); onDone(); }
  }

  if (loading) return <Spin />;

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: accent }}>
          <Plus size={14} /> Nouveau chéquier
        </button>
      </div>

      {open && (
        <form onSubmit={submit} className="grid sm:grid-cols-5 gap-2 p-3 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)]">
          <input name="banque" required placeholder="Banque *"
            className="px-2 py-1.5 text-sm bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg" />
          <input name="serie" placeholder="Série"
            className="px-2 py-1.5 text-sm bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg" />
          <input name="numDebut" type="number" required placeholder="N° début *"
            className="px-2 py-1.5 text-sm bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg" />
          <input name="numFin" type="number" required placeholder="N° fin *"
            className="px-2 py-1.5 text-sm bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg" />
          <div className="flex gap-1">
            <button type="submit" disabled={busy}
              className="flex-1 px-3 py-1.5 text-sm font-semibold text-white rounded-lg disabled:opacity-50" style={{ background: accent }}>
              {busy ? "…" : "Créer"}
            </button>
            <button type="button" onClick={() => setOpen(false)}
              className="px-2 rounded-lg border border-[var(--border-primary)] text-[var(--text-secondary)]">✕</button>
          </div>
        </form>
      )}

      <Table head={["Banque", "Série", "Plage", "Suivant", "Utilisés", "Restants", "État"]}>
        {rows.length === 0 && <EmptyRow cols={7} msg="Aucun chéquier. Créez-en un pour émettre des chèques." />}
        {rows.map((c) => (
          <tr key={c.id} className="border-b border-[var(--border-primary)]/60 hover:bg-[var(--accent-light)]">
            <td className="px-4 py-2 font-medium text-[var(--text-primary)]">{c.banque}</td>
            <td className="px-4 py-2 text-[var(--text-secondary)]">{c.serie || "—"}</td>
            <td className="px-4 py-2 font-mono text-xs">{c.numDebut} → {c.numFin}</td>
            <td className="px-4 py-2 font-mono text-xs font-bold" style={{ color: accent }}>{c.suivant}</td>
            <td className="px-4 py-2 text-right">{c.utilises}</td>
            <td className="px-4 py-2 text-right font-semibold">{c.restants}</td>
            <td className="px-4 py-2">
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                c.epuise ? "bg-red-500/12 text-red-600" : "bg-emerald-500/12 text-emerald-600"
              }`}>{c.epuise ? "Épuisé" : "Actif"}</span>
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

/* --------------------------------- Chèques -------------------------------- */

function ChequesVue({ accent, reload, onFlash, onDone }: {
  accent: string; reload: number; onFlash: (m: string, ok?: boolean) => void; onDone: () => void;
}) {
  const [rows, setRows] = useState<Cheque[]>([]);
  const [chequiers, setChequiers] = useState<Chequier[]>([]);
  const [etat, setEtat] = useState("Tous");
  const [total, setTotal] = useState(0);
  const [totalMontant, setTotalMontant] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(`/api/tresorerie?vue=cheques&etat=${encodeURIComponent(etat)}`).then((r) => r.json()),
      fetch("/api/tresorerie?vue=chequiers").then((r) => r.json()),
    ]).then(([c, q]) => {
      if (cancelled) return;
      setRows(c.rows ?? []); setTotal(c.total ?? 0); setTotalMontant(c.totalMontant ?? 0);
      setChequiers(q.rows ?? []); setSel(new Set()); setLoading(false);
    }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [etat, reload]);

  async function changerEtat(id: number, nouvelEtat: string) {
    const r = await fetch("/api/tresorerie", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cheque-etat", id, etat: nouvelEtat }),
    }).then((x) => x.json());
    onFlash(r.message ?? r.error ?? "—", Boolean(r.ok));
    if (r.ok) onDone();
  }

  async function remettre() {
    if (sel.size === 0) return;
    setBusy(true);
    const r = await fetch("/api/tresorerie", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "borderau", chequeIds: [...sel] }),
    }).then((x) => x.json());
    setBusy(false);
    onFlash(r.message ?? r.error ?? "—", Boolean(r.ok));
    if (r.ok) onDone();
  }

  async function emettre(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    const r = await fetch("/api/tresorerie", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "emettre-cheque", chequierId: Number(fd.get("chequierId")),
        montant: fd.get("montant"), tiersNom: fd.get("tiersNom"), echeance: fd.get("echeance") || null,
      }),
    }).then((x) => x.json());
    setBusy(false);
    onFlash(r.message ?? r.error ?? "—", Boolean(r.ok));
    if (r.ok) { setOpen(false); onDone(); }
  }

  const toggle = (id: number) =>
    setSel((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  if (loading) return <Spin />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <select value={etat} onChange={(e) => { setLoading(true); setEtat(e.target.value); }}
            className="px-3 py-2 text-sm bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl">
            {["Tous", "Emis", "Remis", "Encaissé", "Rejeté", "Déchiré"].map((x) => <option key={x}>{x}</option>)}
          </select>
          <span className="text-sm text-[var(--text-secondary)]">{total} chèque(s) · {fmt(totalMontant)} TND</span>
        </div>
        <div className="flex gap-2">
          <button onClick={remettre} disabled={busy || sel.size === 0}
            className="px-3 py-2 rounded-xl text-sm font-semibold border border-[var(--border-primary)] text-[var(--text-secondary)] disabled:opacity-40">
            Remettre en banque ({sel.size})
          </button>
          <button onClick={() => setOpen(true)} disabled={chequiers.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-40" style={{ background: accent }}>
            <Plus size={14} /> Émettre
          </button>
        </div>
      </div>

      {open && (
        <form onSubmit={emettre} className="grid sm:grid-cols-5 gap-2 p-3 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)]">
          <select name="chequierId" required className="px-2 py-1.5 text-sm bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg">
            {chequiers.filter((c) => !c.epuise).map((c) => (
              <option key={c.id} value={c.id}>{c.banque} — n°{c.suivant}</option>
            ))}
          </select>
          <input name="montant" type="number" step="any" required placeholder="Montant *"
            className="px-2 py-1.5 text-sm bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg" />
          <input name="tiersNom" placeholder="Bénéficiaire"
            className="px-2 py-1.5 text-sm bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg" />
          <input name="echeance" type="date"
            className="px-2 py-1.5 text-sm bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg" />
          <div className="flex gap-1">
            <button type="submit" disabled={busy}
              className="flex-1 px-3 py-1.5 text-sm font-semibold text-white rounded-lg disabled:opacity-50" style={{ background: accent }}>
              {busy ? "…" : "Émettre"}
            </button>
            <button type="button" onClick={() => setOpen(false)}
              className="px-2 rounded-lg border border-[var(--border-primary)] text-[var(--text-secondary)]">✕</button>
          </div>
        </form>
      )}

      <Table head={["", "N°", "Banque", "Bénéficiaire", "Émission", "Échéance", "Montant", "État", "Actions"]}>
        {rows.length === 0 && <EmptyRow cols={9} msg="Aucun chèque." />}
        {rows.map((c) => (
          <tr key={c.id} className="border-b border-[var(--border-primary)]/60 hover:bg-[var(--accent-light)]">
            <td className="px-3 py-2 text-center">
              {c.etat === "Emis" && (
                <input type="checkbox" checked={sel.has(c.id)} onChange={() => toggle(c.id)} style={{ accentColor: accent }} />
              )}
            </td>
            <td className="px-3 py-2 font-mono text-xs font-bold">{c.numero}</td>
            <td className="px-3 py-2 text-[var(--text-secondary)]">{c.chequier.banque}</td>
            <td className="px-3 py-2 text-[var(--text-primary)] truncate max-w-xs">{c.tiersNom || "—"}</td>
            <td className="px-3 py-2 text-[var(--text-secondary)] text-xs">{fmtDate(c.dateEmis)}</td>
            <td className="px-3 py-2 text-[var(--text-secondary)] text-xs">{fmtDate(c.echeance)}</td>
            <td className="px-3 py-2 text-right tabular-nums font-semibold">{fmt(c.montant)}</td>
            <td className="px-3 py-2">
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${ETAT_STYLE[c.etat] ?? ""}`}>{c.etat}</span>
            </td>
            <td className="px-3 py-2">
              <select value="" onChange={(e) => e.target.value && changerEtat(c.id, e.target.value)}
                className="text-xs px-2 py-1 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg">
                <option value="">Changer…</option>
                {["Emis", "Remis", "Encaissé", "Rejeté", "Déchiré"].filter((x) => x !== c.etat).map((x) => (
                  <option key={x} value={x}>{x}</option>
                ))}
              </select>
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

/* ------------------------------- Bordereaux ------------------------------- */

function BorderauxVue({ accent, reload }: { accent: string; reload: number }) {
  const [rows, setRows] = useState<Borderau[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/tresorerie?vue=borderaux")
      .then((r) => r.json())
      .then((d) => { if (!cancelled) { setRows(d.rows ?? []); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [reload]);

  if (loading) return <Spin />;

  const total = rows.reduce((s, b) => s + b.total, 0);

  return (
    <div className="space-y-3">
      <div className="text-sm text-[var(--text-secondary)]">
        {rows.length} bordereau(x) · {fmt(total)} TND
      </div>
      <Table head={["N°", "Date", "Type", "Compte", "Lignes", "Total"]}>
        {rows.length === 0 && <EmptyRow cols={6} msg="Aucun bordereau. Remettez des chèques depuis l'onglet « Chèques »." />}
        {rows.map((b) => (
          <tr key={b.id} className="border-b border-[var(--border-primary)]/60 hover:bg-[var(--accent-light)]">
            <td className="px-4 py-2 font-mono text-xs font-bold" style={{ color: accent }}>{b.id}</td>
            <td className="px-4 py-2 text-[var(--text-secondary)]">{fmtDate(b.dateBord)}</td>
            <td className="px-4 py-2">
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-[var(--accent-light)] text-[var(--accent-primary)]">
                {b.type || "—"}
              </span>
            </td>
            <td className="px-4 py-2 text-[var(--text-secondary)]">{b.numCompte || "—"}</td>
            <td className="px-4 py-2 text-right text-[var(--text-secondary)]">{b.nbLignes}</td>
            <td className="px-4 py-2 text-right tabular-nums font-semibold">{fmt(b.total)}</td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

/* --------------------------------- Extrait -------------------------------- */

function ExtraitVue({ accent, reload }: { accent: string; reload: number }) {
  const [comptes, setComptes] = useState<Compte[]>([]);
  const [compteId, setCompteId] = useState("");
  const [rows, setRows] = useState<Mouvement[]>([]);
  const [meta, setMeta] = useState<{ totalEntrees: number; totalSorties: number; soldeFinal: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/tresorerie?vue=comptes")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const cs: Compte[] = d.rows ?? [];
        setComptes(cs);
        if (!compteId && cs[0]) setCompteId(String(cs[0].id));
        setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload]);

  useEffect(() => {
    if (!compteId) return;
    let cancelled = false;
    fetch(`/api/tresorerie?vue=extrait&compteId=${compteId}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setRows(d.rows ?? []);
        setMeta({ totalEntrees: d.totalEntrees ?? 0, totalSorties: d.totalSorties ?? 0, soldeFinal: d.soldeFinal ?? 0 });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [compteId, reload]);

  function exportCsv() {
    const head = ["Date", "Libellé", "Référence", "Entrée", "Sortie", "Solde"].join(";");
    const lines = rows.map((m) => [
      fmtDate(m.dateMvt), m.libelle.replace(/;/g, ","), m.reference ?? "",
      m.sens === "E" ? m.montant : "", m.sens === "S" ? m.montant : "", m.solde,
    ].join(";"));
    const csv = "﻿" + [head, ...lines].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "extrait-compte.csv"; a.click(); URL.revokeObjectURL(url);
  }

  if (loading) return <Spin />;
  if (comptes.length === 0) return <Empty msg="Aucun compte de trésorerie." />;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <BookOpen size={16} style={{ color: accent }} />
        <select value={compteId} onChange={(e) => setCompteId(e.target.value)}
          className="px-3 py-2 text-sm bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl">
          {comptes.map((c) => <option key={c.id} value={c.id}>{c.libelle || `Compte ${c.id}`}</option>)}
        </select>
        {meta && (
          <div className="flex items-center gap-3 ml-auto text-sm">
            <span className="text-emerald-600">+{fmt(meta.totalEntrees)}</span>
            <span className="text-red-600">−{fmt(meta.totalSorties)}</span>
            <span className="font-bold" style={{ color: accent }}>Solde {fmt(meta.soldeFinal)}</span>
            <button onClick={exportCsv} disabled={rows.length === 0}
              className="flex items-center gap-1.5 border border-[var(--border-primary)] text-emerald-600 px-2.5 py-1.5 rounded-lg text-xs disabled:opacity-40">
              <Download size={13} /> Excel
            </button>
          </div>
        )}
      </div>

      <Table head={["Date", "Libellé", "Référence", "Entrée", "Sortie", "Solde"]}>
        {rows.length === 0 && <EmptyRow cols={6} msg="Aucun mouvement sur ce compte." />}
        {rows.map((m) => (
          <tr key={m.id} className="border-b border-[var(--border-primary)]/60 hover:bg-[var(--accent-light)]">
            <td className="px-4 py-2 text-[var(--text-secondary)]">{fmtDate(m.dateMvt)}</td>
            <td className="px-4 py-2 text-[var(--text-primary)]">{m.libelle}</td>
            <td className="px-4 py-2 text-[var(--text-secondary)] text-xs font-mono">{m.reference || "—"}</td>
            <td className="px-4 py-2 text-right tabular-nums text-emerald-600">{m.sens === "E" ? fmt(m.montant) : ""}</td>
            <td className="px-4 py-2 text-right tabular-nums text-red-600">{m.sens === "S" ? fmt(m.montant) : ""}</td>
            <td className="px-4 py-2 text-right tabular-nums font-bold">{fmt(m.solde)}</td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

/* -------------------------------- Communs --------------------------------- */

function Spin() {
  return <div className="py-12 text-center text-[var(--text-secondary)]"><Loader2 className="animate-spin inline" size={20} /></div>;
}
function Empty({ msg }: { msg: string }) {
  return <div className="py-12 text-center text-sm text-[var(--text-secondary)]">{msg}</div>;
}
function EmptyRow({ cols, msg }: { cols: number; msg: string }) {
  return <tr><td colSpan={cols} className="py-12 text-center text-sm text-[var(--text-secondary)]">{msg}</td></tr>;
}
function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-auto rounded-xl border border-[var(--border-primary)] max-h-[55vh]">
      <table className="w-full text-sm">
        <thead className="bg-[var(--bg-primary)] border-b border-[var(--border-primary)] sticky top-0 z-10">
          <tr className="text-[11px] uppercase tracking-wide text-[var(--text-secondary)]">
            {head.map((h, i) => (
              <th key={i} className={`px-4 py-2.5 font-semibold ${["Montant", "Total", "Solde", "Entrée", "Sortie", "Utilisés", "Restants", "Lignes", "Mouvements"].includes(h) ? "text-right" : "text-left"}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
function Panel({ titre, accent, children }: { titre: string; accent: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--border-primary)] overflow-hidden bg-[var(--bg-card)]">
      <div className="px-4 py-2.5 bg-[var(--bg-primary)] border-b border-[var(--border-primary)] font-bold text-sm flex items-center gap-2">
        <FileText size={14} style={{ color: accent }} /> {titre}
      </div>
      {children}
    </div>
  );
}
function Tile({ label, value, sub, color, icon: Icon }: {
  label: string; value: string; sub: string; color: string; icon: React.ElementType;
}) {
  return (
    <motion.div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-primary)] shadow-sm p-4"
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-2" style={{ background: color + "18", color }}>
        <Icon size={16} />
      </div>
      <div className="text-lg font-bold" style={{ color }}>{value}</div>
      <div className="text-[var(--text-secondary)] text-xs mt-0.5">{label}</div>
      <div className="text-[var(--text-secondary)] opacity-70 text-[10px]">{sub}</div>
    </motion.div>
  );
}
