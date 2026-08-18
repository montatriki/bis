"use client";
import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Users, Plus, Pencil, Trash2, Printer, Download, Search, Loader2,
  CalendarDays, Calculator, FileSpreadsheet, Settings, X, Save, CheckCircle2,
} from "lucide-react";
import PersonnelForm from "@/components/grh/PersonnelForm";
import PointageGrid from "@/components/grh/PointageGrid";

const SUB_TABS = ["Employés", "Contrats", "Gestion pointage", "Congés", "Crédits", "Traitements", "Paramètres paie", "Rapports", "Paramètres"] as const;
type Tab = (typeof SUB_TABS)[number];

type Row = Record<string, unknown>;
const sv = (v: unknown) => (v == null ? "" : String(v));
const n = (v: unknown) => (v == null || v === "" ? 0 : Number(v)) || 0;
const fmtMoney = (v: number) =>
  new Intl.NumberFormat("fr-TN", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(n(v));
const fmtDate = (v: unknown) => (v ? new Date(String(v)).toLocaleDateString("fr-FR") : "—");

const ACCENT = "#2563eb";

export default function GRHPage() {
  const [tab, setTab] = useState<Tab>("Employés");
  const [stats, setStats] = useState<Row | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  const refresh = useCallback(() => setReload((k) => k + 1), []);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3000); };

  useEffect(() => {
    let cancelled = false;
    fetch("/api/grh?resource=stats")
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setStats(d); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [reload]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">GRH — Ressources Humaines</h1>
          <p className="text-[var(--text-secondary)] text-sm">
            {stats ? `${n(stats.actifs)} actifs sur ${n(stats.effectif)} employés` : "Chargement…"}
          </p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <Stat label="Effectif total" value={String(n(stats?.effectif))} color="#2563eb" />
          <Stat label="Actifs" value={String(n(stats?.actifs))} color="#16a34a" />
          <Stat label="Congés en attente" value={String(n(stats?.congesEnAttente))} color="#f59e0b" />
          <Stat label="Masse salariale" value={`${fmtMoney(n(stats?.masseSalariale))} TND`} color="#7c3aed" />
        </div>
      </div>

      {toast && (
        <div className="px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-sm font-medium">
          {toast}
        </div>
      )}

      <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-primary)] shadow-sm overflow-hidden">
        <div className="flex border-b border-[var(--border-primary)] overflow-x-auto scrollbar-none">
          {SUB_TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition border-b-2 ${
                tab === t
                  ? "border-blue-600 text-blue-600 bg-blue-50/50 dark:bg-blue-500/10"
                  : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}>{t}</button>
          ))}
        </div>

        <div className="p-4">
          {tab === "Employés" && <EmployesTab onChanged={() => { refresh(); flash("Enregistré"); }} />}
          {tab === "Contrats" && <ContratsTab onFlash={flash} />}
          {tab === "Gestion pointage" && <PointageGrid accent={ACCENT} onFlash={flash} />}
          {tab === "Congés" && <CongesTab onFlash={flash} />}
          {tab === "Crédits" && <CreditsTab onFlash={flash} />}
          {tab === "Traitements" && <TraitementsTab onFlash={(m) => { flash(m); refresh(); }} />}
          {tab === "Paramètres paie" && <ParamsPaieTab onFlash={flash} />}
          {tab === "Rapports" && <RapportsTab />}
          {tab === "Paramètres" && <ParametresTab onFlash={flash} />}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl px-4 py-2 text-center border" style={{ background: color + "12", borderColor: color + "33" }}>
      <div className="text-lg font-bold" style={{ color }}>{value}</div>
      <div className="text-xs" style={{ color }}>{label}</div>
    </div>
  );
}

/* ---------------------------------- Employés --------------------------------- */

function EmployesTab({ onChanged }: { onChanged: () => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Row | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      fetch(`/api/grh?resource=personnel${search ? `&search=${encodeURIComponent(search)}` : ""}`)
        .then((r) => r.json())
        .then((d) => { if (!cancelled) { setRows(d.rows ?? []); setTotal(d.total ?? 0); setLoading(false); } })
        .catch(() => { if (!cancelled) setLoading(false); });
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [search, reload]);

  async function remove(id: number) {
    if (!confirm("Supprimer cet employé ?")) return;
    const r = await fetch(`/api/grh?resource=personnel&id=${id}`, { method: "DELETE" }).then((x) => x.json());
    if (r.ok) { setReload((k) => k + 1); onChanged(); }
    else alert(r.error ?? "Échec");
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setLoading(true); }}
            placeholder="Rechercher un employé (nom, matricule, CIN)…"
            className="pl-9 pr-4 py-2 text-sm bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl w-full focus:outline-none" />
        </div>
        <button onClick={() => setEditing({})}
          className="flex items-center gap-1.5 text-white px-3 py-2 rounded-xl text-sm font-medium" style={{ background: ACCENT }}>
          <Plus size={15} /> Nouvel employé
        </button>
        <button onClick={() => window.print()} className="p-2 rounded-xl border border-[var(--border-primary)] text-[var(--text-secondary)]"><Printer size={15} /></button>
      </div>

      <div className="overflow-auto rounded-xl border border-[var(--border-primary)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--bg-primary)] border-b border-[var(--border-primary)]">
            <tr className="text-[11px] uppercase tracking-wide text-[var(--text-secondary)]">
              <th className="px-3 py-2.5 text-left font-semibold">Matricule</th>
              <th className="px-3 py-2.5 text-left font-semibold">Nom &amp; prénom</th>
              <th className="px-3 py-2.5 text-left font-semibold">Fonction</th>
              <th className="px-3 py-2.5 text-left font-semibold">Service</th>
              <th className="px-3 py-2.5 text-left font-semibold">Embauche</th>
              <th className="px-3 py-2.5 text-center font-semibold">Régime</th>
              <th className="px-3 py-2.5 text-right font-semibold">Salaire base</th>
              <th className="px-3 py-2.5 text-center font-semibold">État</th>
              <th className="w-20" />
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={9} className="py-10 text-center text-[var(--text-secondary)]"><Loader2 className="animate-spin inline" size={18} /> Chargement…</td></tr>}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={9} className="py-10 text-center text-[var(--text-secondary)] text-sm">
                Aucun employé. Cliquez sur « Nouvel employé » pour commencer.
              </td></tr>
            )}
            {!loading && rows.map((e, i) => (
              <motion.tr key={sv(e.id)} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ delay: Math.min(i * 0.02, 0.3) }}
                className="border-b border-[var(--border-primary)]/60 hover:bg-[var(--accent-light)]">
                <td className="px-3 py-2.5 font-mono text-xs">{sv(e.codeEmploye)}</td>
                <td className="px-3 py-2.5 font-medium text-[var(--text-primary)]">{sv(e.nom)} {sv(e.prenom)}</td>
                <td className="px-3 py-2.5 text-[var(--text-secondary)]">{sv((e.fonction as Row)?.libelle) || "—"}</td>
                <td className="px-3 py-2.5 text-[var(--text-secondary)]">{sv((e.service as Row)?.libelle) || "—"}</td>
                <td className="px-3 py-2.5 text-[var(--text-secondary)] text-xs">{fmtDate(e.dateEmbauche)}</td>
                <td className="px-3 py-2.5 text-center">
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-[var(--accent-light)] text-[var(--accent-primary)]">
                    {sv(e.traitement) === "H" ? "Horaire" : "Mensuel"}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums font-medium">{fmtMoney(n(e.salaireBase))}</td>
                <td className="px-3 py-2.5 text-center">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${e.actif ? "bg-emerald-500/12 text-emerald-600" : "bg-slate-500/12 text-slate-500"}`}>
                    {e.actif ? "Actif" : "Inactif"}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex gap-1 justify-end">
                    <button onClick={() => setEditing(e)} className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-500/10"><Pencil size={14} /></button>
                    <button onClick={() => remove(Number(e.id))} className="p-1.5 rounded-lg text-red-600 hover:bg-red-500/10"><Trash2 size={14} /></button>
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="text-xs text-[var(--text-secondary)]">{total} employé(s)</div>

      {editing && (
        <PersonnelForm
          initial={editing}
          accent={ACCENT}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); setReload((k) => k + 1); onChanged(); }}
        />
      )}
    </div>
  );
}

/* ---------------------------------- Contrats --------------------------------- */

// Contrats de travail (table `grh_contrats` de A). Le CDI est le seul type sans
// échéance ; pour les autres, la date de fin est obligatoire côté API.
const TYPES_CONTRAT = ["CDI", "CDD", "CIVP", "SIVP", "Stage"] as const;
const ETATS_CONTRAT = ["En cours", "Expiré", "Rompu", "Renouvelé"] as const;

function ContratsTab({ onFlash }: { onFlash: (m: string) => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [personnel, setPersonnel] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [filtre, setFiltre] = useState("Tous");
  const [type, setType] = useState<string>("CDI");
  const [meta, setMeta] = useState({ aRenouveler: 0, expires: 0 });
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(`/api/grh?resource=contrats&etat=${filtre}`).then((r) => r.json()),
      fetch("/api/grh?resource=personnel&actif=1").then((r) => r.json()),
    ]).then(([c, p]) => {
      if (cancelled) return;
      setRows(c.rows ?? []);
      setMeta({ aRenouveler: c.aRenouveler ?? 0, expires: c.expires ?? 0 });
      setPersonnel(p.rows ?? []);
      setLoading(false);
    }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [reload, filtre]);

  async function setEtat(id: number, etat: string) {
    const r = await fetch("/api/grh?resource=contrats", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, etat }),
    }).then((x) => x.json());
    if (r.ok) { setReload((k) => k + 1); onFlash(`Contrat marqué « ${etat} »`); }
    else alert(r.error ?? "Échec");
  }

  async function supprimer(id: number) {
    if (!confirm("Supprimer ce contrat ?")) return;
    const r = await fetch(`/api/grh?resource=contrats&id=${id}`, { method: "DELETE" }).then((x) => x.json());
    if (r.ok) { setReload((k) => k + 1); onFlash("Contrat supprimé"); }
    else alert(r.error ?? "Échec");
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const r = await fetch("/api/grh?resource=contrats", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        personnelId: Number(fd.get("personnelId")),
        typeContrat: fd.get("typeContrat"),
        reference: fd.get("reference"),
        dateDebut: fd.get("dateDebut"),
        dateFin: fd.get("dateFin") || null,
        essaiMois: fd.get("essaiMois"),
        salaireBrut: fd.get("salaireBrut") || null,
        poste: fd.get("poste"),
        lieuTravail: fd.get("lieuTravail"),
      }),
    }).then((x) => x.json());
    if (r.ok) { setAdding(false); setReload((k) => k + 1); onFlash("Contrat enregistré"); }
    else alert(r.error ?? "Échec");
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h3 className="font-bold text-sm flex items-center gap-2">
          <FileSpreadsheet size={15} style={{ color: ACCENT }} /> Contrats de travail
        </h3>
        <div className="flex gap-2 items-center">
          <select value={filtre} onChange={(e) => setFiltre(e.target.value)}
            className="px-2 py-1.5 text-sm bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg">
            <option value="Tous">Tous les états</option>
            {ETATS_CONTRAT.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
          <button onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 text-white px-3 py-2 rounded-xl text-sm font-medium" style={{ background: ACCENT }}>
            <Plus size={15} /> Nouveau contrat
          </button>
        </div>
      </div>

      {(meta.aRenouveler > 0 || meta.expires > 0) && (
        <div className="px-3 py-2 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-400 text-sm">
          {meta.aRenouveler > 0 && <div>{meta.aRenouveler} contrat(s) arrivent à échéance sous 30 jours.</div>}
          {meta.expires > 0 && (
            <div>
              {meta.expires} contrat(s) encore « En cours » alors que leur date de fin est passée —
              à passer en Expiré ou Renouvelé.
            </div>
          )}
        </div>
      )}

      {adding && (
        <form onSubmit={submit} className="grid sm:grid-cols-4 gap-2 p-3 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)]">
          <select name="personnelId" required
            className="px-2 py-1.5 text-sm bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg">
            <option value="">Employé…</option>
            {personnel.map((p) => (
              <option key={sv(p.id)} value={sv(p.id)}>{sv(p.nom)} {sv(p.prenom)}</option>
            ))}
          </select>
          <select name="typeContrat" value={type} onChange={(e) => setType(e.target.value)}
            className="px-2 py-1.5 text-sm bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg">
            {TYPES_CONTRAT.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input name="reference" placeholder="Référence"
            className="px-2 py-1.5 text-sm bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg" />
          <input name="poste" placeholder="Poste"
            className="px-2 py-1.5 text-sm bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg" />
          <label className="text-xs text-[var(--text-secondary)]">
            Début *
            <input type="date" name="dateDebut" required
              className="w-full px-2 py-1.5 text-sm bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg" />
          </label>
          <label className="text-xs text-[var(--text-secondary)]">
            Fin {type !== "CDI" ? "*" : "(CDI : aucune)"}
            <input type="date" name="dateFin" required={type !== "CDI"} disabled={type === "CDI"}
              className="w-full px-2 py-1.5 text-sm bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg disabled:opacity-40" />
          </label>
          <label className="text-xs text-[var(--text-secondary)]">
            Essai (mois)
            <input type="number" step="0.5" min="0" name="essaiMois" defaultValue={0}
              className="w-full px-2 py-1.5 text-sm bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg" />
          </label>
          <label className="text-xs text-[var(--text-secondary)]">
            Salaire brut (vide = fiche employé)
            <input type="number" step="0.001" name="salaireBrut"
              className="w-full px-2 py-1.5 text-sm bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg" />
          </label>
          <input name="lieuTravail" placeholder="Lieu de travail"
            className="sm:col-span-2 px-2 py-1.5 text-sm bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg" />
          <div className="sm:col-span-2 flex gap-1">
            <button type="submit" className="flex-1 px-3 py-1.5 text-sm font-semibold text-white rounded-lg" style={{ background: ACCENT }}>
              Enregistrer
            </button>
            <button type="button" onClick={() => setAdding(false)} className="px-2 rounded-lg border border-[var(--border-primary)]">
              <X size={14} />
            </button>
          </div>
        </form>
      )}

      <div className="overflow-auto rounded-xl border border-[var(--border-primary)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--bg-primary)] border-b border-[var(--border-primary)]">
            <tr className="text-[11px] uppercase tracking-wide text-[var(--text-secondary)]">
              <th className="px-3 py-2.5 text-left font-semibold">Employé</th>
              <th className="px-3 py-2.5 text-left font-semibold">Type</th>
              <th className="px-3 py-2.5 text-left font-semibold">Référence</th>
              <th className="px-3 py-2.5 text-left font-semibold">Du</th>
              <th className="px-3 py-2.5 text-left font-semibold">Au</th>
              <th className="px-3 py-2.5 text-right font-semibold">Salaire brut</th>
              <th className="px-3 py-2.5 text-left font-semibold">Poste</th>
              <th className="px-3 py-2.5 text-center font-semibold">État</th>
              <th className="w-32" />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={9} className="py-10 text-center text-[var(--text-secondary)]">
                <Loader2 className="animate-spin inline" size={18} />
              </td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={9} className="py-10 text-center text-[var(--text-secondary)] text-sm">
                Aucun contrat enregistré.
              </td></tr>
            )}
            {rows.map((c) => {
              const p = c.personnel as Row | undefined;
              const jours = c.joursRestants == null ? null : Number(c.joursRestants);
              return (
                <tr key={sv(c.id)}
                  className={`border-b border-[var(--border-primary)]/60 hover:bg-[var(--accent-light)] ${c.expire && c.etat === "En cours" ? "bg-red-500/5" : ""}`}>
                  <td className="px-3 py-2.5 font-medium">{sv(p?.nom)} {sv(p?.prenom)}</td>
                  <td className="px-3 py-2.5">{sv(c.typeContrat)}</td>
                  <td className="px-3 py-2.5 text-[var(--text-secondary)]">{sv(c.reference) || "—"}</td>
                  <td className="px-3 py-2.5 text-[var(--text-secondary)]">{fmtDate(c.dateDebut)}</td>
                  <td className="px-3 py-2.5 text-[var(--text-secondary)]">
                    {c.dateFin ? fmtDate(c.dateFin) : "indéterminée"}
                    {Boolean(c.aRenouveler) && jours != null && (
                      <span className="ml-1.5 text-[10px] text-amber-600 font-bold">J-{jours}</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{fmtMoney(n(c.salaireBrut))}</td>
                  <td className="px-3 py-2.5 text-[var(--text-secondary)]">{sv(c.poste) || "—"}</td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      c.etatEffectif === "En cours" ? "bg-emerald-500/12 text-emerald-600"
                      : c.etatEffectif === "Renouvelé" ? "bg-blue-500/12 text-blue-600"
                      : c.etatEffectif === "Rompu" ? "bg-red-500/12 text-red-600"
                      : "bg-slate-500/12 text-slate-500"}`}>
                      {sv(c.etatEffectif)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex gap-1 justify-end items-center">
                      {c.etat === "En cours" && (
                        <select defaultValue="" onChange={(e) => e.target.value && setEtat(Number(c.id), e.target.value)}
                          className="text-[11px] px-1.5 py-1 rounded-lg bg-[var(--bg-card)] border border-[var(--border-primary)]">
                          <option value="">Clôturer…</option>
                          <option value="Expiré">Expiré</option>
                          <option value="Renouvelé">Renouvelé</option>
                          <option value="Rompu">Rompu</option>
                        </select>
                      )}
                      <button onClick={() => supprimer(Number(c.id))}
                        className="p-1.5 rounded-lg text-red-600 hover:bg-red-500/10" title="Supprimer">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ----------------------------------- Congés ---------------------------------- */

function CongesTab({ onFlash }: { onFlash: (m: string) => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [personnel, setPersonnel] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/grh?resource=conges").then((r) => r.json()),
      fetch("/api/grh?resource=personnel&actif=1").then((r) => r.json()),
    ]).then(([c, p]) => {
      if (cancelled) return;
      setRows(c.rows ?? []); setPersonnel(p.rows ?? []); setLoading(false);
    }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [reload]);

  async function setStatut(id: number, statut: string) {
    const r = await fetch("/api/grh?resource=conges", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, statut }),
    }).then((x) => x.json());
    if (r.ok) { setReload((k) => k + 1); onFlash(`Congé ${statut.toLowerCase()}`); }
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const r = await fetch("/api/grh?resource=conges", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        codeEmploye: fd.get("codeEmploye"), dateDebut: fd.get("dateDebut"),
        dateFin: fd.get("dateFin"), motif: fd.get("motif"),
      }),
    }).then((x) => x.json());
    if (r.ok) { setAdding(false); setReload((k) => k + 1); onFlash("Congé enregistré"); }
    else alert(r.error ?? "Échec");
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-sm flex items-center gap-2"><CalendarDays size={15} style={{ color: ACCENT }} /> Demandes de congé</h3>
        <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 text-white px-3 py-2 rounded-xl text-sm font-medium" style={{ background: ACCENT }}>
          <Plus size={15} /> Nouveau congé
        </button>
      </div>

      {adding && (
        <form onSubmit={submit} className="grid sm:grid-cols-5 gap-2 p-3 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)]">
          <select name="codeEmploye" required className="px-2 py-1.5 text-sm bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg">
            <option value="">Employé…</option>
            {personnel.map((p) => <option key={sv(p.codeEmploye)} value={sv(p.codeEmploye)}>{sv(p.nom)} {sv(p.prenom)}</option>)}
          </select>
          <input type="date" name="dateDebut" required className="px-2 py-1.5 text-sm bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg" />
          <input type="date" name="dateFin" required className="px-2 py-1.5 text-sm bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg" />
          <input name="motif" placeholder="Motif" className="px-2 py-1.5 text-sm bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg" />
          <div className="flex gap-1">
            <button type="submit" className="flex-1 px-3 py-1.5 text-sm font-semibold text-white rounded-lg" style={{ background: ACCENT }}>Ajouter</button>
            <button type="button" onClick={() => setAdding(false)} className="px-2 rounded-lg border border-[var(--border-primary)]"><X size={14} /></button>
          </div>
        </form>
      )}

      <div className="overflow-auto rounded-xl border border-[var(--border-primary)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--bg-primary)] border-b border-[var(--border-primary)]">
            <tr className="text-[11px] uppercase tracking-wide text-[var(--text-secondary)]">
              <th className="px-3 py-2.5 text-left font-semibold">Employé</th>
              <th className="px-3 py-2.5 text-left font-semibold">Du</th>
              <th className="px-3 py-2.5 text-left font-semibold">Au</th>
              <th className="px-3 py-2.5 text-right font-semibold">Jours</th>
              <th className="px-3 py-2.5 text-left font-semibold">Motif</th>
              <th className="px-3 py-2.5 text-center font-semibold">Statut</th>
              <th className="w-28" />
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="py-10 text-center text-[var(--text-secondary)]"><Loader2 className="animate-spin inline" size={18} /></td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={7} className="py-10 text-center text-[var(--text-secondary)] text-sm">Aucune demande de congé.</td></tr>}
            {rows.map((c) => (
              <tr key={sv(c.id)} className="border-b border-[var(--border-primary)]/60 hover:bg-[var(--accent-light)]">
                <td className="px-3 py-2.5 font-medium">{sv((c.personnel as Row)?.nom)} {sv((c.personnel as Row)?.prenom)}</td>
                <td className="px-3 py-2.5 text-[var(--text-secondary)]">{fmtDate(c.dateDebut)}</td>
                <td className="px-3 py-2.5 text-[var(--text-secondary)]">{fmtDate(c.dateFin)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{n(c.nbrJours)}</td>
                <td className="px-3 py-2.5 text-[var(--text-secondary)]">{sv(c.motif) || "—"}</td>
                <td className="px-3 py-2.5 text-center">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    c.statut === "Approuvé" ? "bg-emerald-500/12 text-emerald-600"
                    : c.statut === "Refusé" ? "bg-red-500/12 text-red-600"
                    : "bg-amber-500/12 text-amber-600"}`}>{sv(c.statut)}</span>
                </td>
                <td className="px-3 py-2.5">
                  {c.statut === "En attente" && (
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => setStatut(Number(c.id), "Approuvé")} className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-500/10" title="Approuver"><CheckCircle2 size={14} /></button>
                      <button onClick={() => setStatut(Number(c.id), "Refusé")} className="p-1.5 rounded-lg text-red-600 hover:bg-red-500/10" title="Refuser"><X size={14} /></button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* -------------------------------- Traitements -------------------------------- */

function TraitementsTab({ onFlash }: { onFlash: (m: string) => void }) {
  const [sessions, setSessions] = useState<Row[]>([]);
  const [sessionId, setSessionId] = useState<string>("");
  const [bulletins, setBulletins] = useState<Row[]>([]);
  const [sum, setSum] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/grh?resource=sessions").then((r) => r.json()).then((d) => {
      if (cancelled) return;
      setSessions(d.rows ?? []);
      if (!sessionId && d.rows?.[0]) setSessionId(String(d.rows[0].id));
      setLoading(false);
    }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    fetch(`/api/grh?resource=bulletins&sessionId=${sessionId}`).then((r) => r.json()).then((d) => {
      if (cancelled) return;
      setBulletins(d.rows ?? []); setSum(d.sum ?? null);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [sessionId, reload]);

  async function traiter() {
    if (!sessionId) return;
    setBusy(true);
    const r = await fetch("/api/grh/traitement", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: Number(sessionId) }),
    }).then((x) => x.json()).catch(() => ({ error: "réseau" }));
    setBusy(false);
    if (r.ok) { onFlash(r.message); setReload((k) => k + 1); }
    else alert(r.error ?? "Échec du traitement");
  }

  function exportCsv() {
    const head = ["Matricule", "Nom", "Brut", "CNSS", "IRPP", "CSS", "Net à payer"].join(";");
    const lines = bulletins.map((b) => [
      sv(b.codeEmploye), `${sv((b.personnel as Row)?.nom)} ${sv((b.personnel as Row)?.prenom)}`,
      n(b.brutImposable), n(b.cnss), n(b.irpp), n(b.css), n(b.netAPayer),
    ].join(";"));
    const csv = "﻿" + [head, ...lines].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "bulletins.csv"; a.click(); URL.revokeObjectURL(url);
  }

  if (loading) return <div className="py-10 text-center text-[var(--text-secondary)]"><Loader2 className="animate-spin inline" size={18} /></div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <select value={sessionId} onChange={(e) => setSessionId(e.target.value)}
          className="px-3 py-2 text-sm bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl">
          <option value="">Session…</option>
          {sessions.map((s) => <option key={sv(s.id)} value={sv(s.id)}>{sv(s.libelle)}{s.cloturee ? " (clôturée)" : ""}</option>)}
        </select>
        <button onClick={traiter} disabled={busy || !sessionId}
          className="flex items-center gap-1.5 text-white px-3 py-2 rounded-xl text-sm font-medium disabled:opacity-50" style={{ background: ACCENT }}>
          {busy ? <Loader2 className="animate-spin" size={15} /> : <Calculator size={15} />} Lancer le traitement
        </button>
        {bulletins.length > 0 && (
          <button onClick={exportCsv} className="flex items-center gap-1.5 border border-[var(--border-primary)] text-emerald-600 px-3 py-2 rounded-xl text-sm"><Download size={15} /> Excel</button>
        )}
      </div>

      {sessions.length === 0 && (
        <div className="p-6 rounded-xl border border-dashed border-[var(--border-primary)] text-center text-sm text-[var(--text-secondary)]">
          Aucune session de paie. Créez-en une dans l&apos;onglet <b>Paramètres</b>.
        </div>
      )}

      {sum && bulletins.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <Mini label="Brut" value={fmtMoney(n(sum.brutImposable))} />
          <Mini label="CNSS" value={fmtMoney(n(sum.cnss))} />
          <Mini label="IRPP" value={fmtMoney(n(sum.irpp))} />
          <Mini label="CSS" value={fmtMoney(n(sum.css))} />
          <Mini label="Net à payer" value={fmtMoney(n(sum.netAPayer))} strong />
        </div>
      )}

      <div className="overflow-auto rounded-xl border border-[var(--border-primary)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--bg-primary)] border-b border-[var(--border-primary)]">
            <tr className="text-[11px] uppercase tracking-wide text-[var(--text-secondary)]">
              <th className="px-3 py-2.5 text-left font-semibold">Matricule</th>
              <th className="px-3 py-2.5 text-left font-semibold">Employé</th>
              <th className="px-3 py-2.5 text-right font-semibold">Jours</th>
              <th className="px-3 py-2.5 text-right font-semibold">Salaire base</th>
              <th className="px-3 py-2.5 text-right font-semibold">Brut</th>
              <th className="px-3 py-2.5 text-right font-semibold">CNSS</th>
              <th className="px-3 py-2.5 text-right font-semibold">IRPP</th>
              <th className="px-3 py-2.5 text-right font-semibold">CSS</th>
              <th className="px-3 py-2.5 text-right font-semibold">Net à payer</th>
            </tr>
          </thead>
          <tbody>
            {bulletins.length === 0 && (
              <tr><td colSpan={9} className="py-10 text-center text-[var(--text-secondary)] text-sm">
                Aucun bulletin. Saisissez le pointage puis lancez le traitement.
              </td></tr>
            )}
            {bulletins.map((b) => (
              <tr key={sv(b.id)} className="border-b border-[var(--border-primary)]/60 hover:bg-[var(--accent-light)]">
                <td className="px-3 py-2.5 font-mono text-xs">{sv(b.codeEmploye)}</td>
                <td className="px-3 py-2.5 font-medium">{sv((b.personnel as Row)?.nom)} {sv((b.personnel as Row)?.prenom)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{n(b.jourTravailles)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{fmtMoney(n(b.salaireBase))}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{fmtMoney(n(b.brutImposable))}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-red-600">{fmtMoney(n(b.cnss))}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-red-600">{fmtMoney(n(b.irpp))}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-red-600">{fmtMoney(n(b.css))}</td>
                <td className="px-3 py-2.5 text-right tabular-nums font-bold" style={{ color: ACCENT }}>{fmtMoney(n(b.netAPayer))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Mini({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--border-primary)] px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-[var(--text-secondary)] font-semibold">{label}</div>
      <div className={`tabular-nums ${strong ? "font-bold text-base" : "font-semibold text-sm"}`} style={strong ? { color: ACCENT } : undefined}>{value}</div>
    </div>
  );
}

/* --------------------------------- Rapports ---------------------------------- */

function RapportsTab() {
  const [data, setData] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/grh?resource=personnel&actif=1").then((r) => r.json()).then((d) => {
      if (!cancelled) { setData(d.rows ?? []); setLoading(false); }
    }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Répartition de l'effectif par service, calculée depuis la base.
  const parService = new Map<string, number>();
  for (const e of data) {
    const k = sv((e.service as Row)?.libelle) || "Non affecté";
    parService.set(k, (parService.get(k) ?? 0) + 1);
  }
  const max = Math.max(1, ...parService.values());

  if (loading) return <div className="py-10 text-center text-[var(--text-secondary)]"><Loader2 className="animate-spin inline" size={18} /></div>;

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="rounded-xl border border-[var(--border-primary)] p-4">
        <h3 className="font-bold text-sm mb-3 flex items-center gap-2"><FileSpreadsheet size={15} style={{ color: ACCENT }} /> Effectif par service</h3>
        {parService.size === 0 && <div className="text-sm text-[var(--text-secondary)]">Aucune donnée.</div>}
        <div className="space-y-2">
          {[...parService.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => (
            <div key={k} className="flex items-center gap-2">
              <span className="text-xs w-32 truncate text-[var(--text-secondary)]">{k}</span>
              <div className="flex-1 h-2 rounded-full bg-[var(--bg-primary)] overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${(v / max) * 100}%`, background: ACCENT }} />
              </div>
              <span className="text-xs font-bold w-8 text-right">{v}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border-primary)] p-4">
        <h3 className="font-bold text-sm mb-3 flex items-center gap-2"><Users size={15} style={{ color: ACCENT }} /> Répartition par régime</h3>
        {(() => {
          const m = data.filter((e) => sv(e.traitement) !== "H").length;
          const h = data.filter((e) => sv(e.traitement) === "H").length;
          return (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-[var(--text-secondary)]">Mensuel</span><b>{m}</b></div>
              <div className="flex justify-between"><span className="text-[var(--text-secondary)]">Horaire</span><b>{h}</b></div>
              <div className="flex justify-between border-t border-[var(--border-primary)] pt-2">
                <span className="text-[var(--text-secondary)]">Masse salariale de base</span>
                <b>{fmtMoney(data.reduce((s, e) => s + n(e.salaireBase), 0))} TND</b>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

/* -------------------------------- Paramètres --------------------------------- */

const REF_TABS = [
  { key: "fonctions", label: "Fonctions" },
  { key: "grades", label: "Grades" },
  { key: "services", label: "Services" },
  { key: "categories", label: "Catégories" },
  { key: "echelons", label: "Échelons" },
] as const;

function ParametresTab({ onFlash }: { onFlash: (m: string) => void }) {
  const [ref, setRef] = useState<string>("fonctions");
  const [rows, setRows] = useState<Row[]>([]);
  const [sessions, setSessions] = useState<Row[]>([]);
  const [libelle, setLibelle] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(`/api/grh?resource=${ref}`).then((r) => r.json()),
      fetch(`/api/grh?resource=sessions`).then((r) => r.json()),
    ]).then(([d, s]) => { if (!cancelled) { setRows(d.rows ?? []); setSessions(s.rows ?? []); } })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [ref, reload]);

  async function add() {
    if (!libelle.trim()) return;
    const r = await fetch(`/api/grh?resource=${ref}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ libelle: libelle.trim() }),
    }).then((x) => x.json());
    if (r.ok) { setLibelle(""); setReload((k) => k + 1); onFlash("Ajouté"); }
    else alert(r.error ?? "Échec");
  }

  async function remove(id: number) {
    const r = await fetch(`/api/grh?resource=${ref}&id=${id}`, { method: "DELETE" }).then((x) => x.json());
    if (r.ok) { setReload((k) => k + 1); onFlash("Supprimé"); }
    else alert(r.error ?? "Suppression impossible (élément utilisé)");
  }

  async function addSession(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const mois = Number(fd.get("mois")), annee = Number(fd.get("annee"));
    const r = await fetch("/api/grh?resource=sessions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        libelle: `${String(mois).padStart(2, "0")}/${annee}`, mois, annee,
        nJours: Number(fd.get("nJours")) || 26, nHeures: Number(fd.get("nHeures")) || 0,
      }),
    }).then((x) => x.json());
    if (r.ok) { setReload((k) => k + 1); onFlash("Session créée"); (e.target as HTMLFormElement).reset(); }
    else alert(r.error ?? "Échec");
  }

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="rounded-xl border border-[var(--border-primary)] p-4 space-y-3">
        <h3 className="font-bold text-sm flex items-center gap-2"><Settings size={15} style={{ color: ACCENT }} /> Référentiels</h3>
        <div className="flex gap-1 flex-wrap">
          {REF_TABS.map((t) => (
            <button key={t.key} onClick={() => setRef(t.key)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${ref === t.key ? "text-white border-transparent" : "border-[var(--border-primary)] text-[var(--text-secondary)]"}`}
              style={ref === t.key ? { background: ACCENT } : undefined}>{t.label}</button>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={libelle} onChange={(e) => setLibelle(e.target.value)} placeholder="Nouveau libellé…"
            onKeyDown={(e) => e.key === "Enter" && add()}
            className="flex-1 px-2.5 py-1.5 text-sm bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg focus:outline-none" />
          <button onClick={add} className="px-3 py-1.5 text-sm font-semibold text-white rounded-lg" style={{ background: ACCENT }}><Plus size={15} /></button>
        </div>
        <div className="max-h-64 overflow-auto divide-y divide-[var(--border-primary)]">
          {rows.length === 0 && <div className="py-6 text-center text-sm text-[var(--text-secondary)]">Aucun élément.</div>}
          {rows.map((r) => (
            <div key={sv(r.id)} className="flex items-center justify-between py-2">
              <span className="text-sm">{sv(r.libelle)}</span>
              <button onClick={() => remove(Number(r.id))} className="p-1 rounded text-red-600 hover:bg-red-500/10"><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border-primary)] p-4 space-y-3">
        <h3 className="font-bold text-sm flex items-center gap-2"><CalendarDays size={15} style={{ color: ACCENT }} /> Sessions de paie</h3>
        <form onSubmit={addSession} className="grid grid-cols-2 gap-2">
          <input name="mois" type="number" min={1} max={12} placeholder="Mois" required className="px-2 py-1.5 text-sm bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg" />
          <input name="annee" type="number" defaultValue={new Date().getFullYear()} placeholder="Année" required className="px-2 py-1.5 text-sm bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg" />
          <input name="nJours" type="number" step="any" defaultValue={26} placeholder="Jours" className="px-2 py-1.5 text-sm bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg" />
          <input name="nHeures" type="number" step="any" defaultValue={208} placeholder="Heures" className="px-2 py-1.5 text-sm bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg" />
          <button type="submit" className="col-span-2 px-3 py-1.5 text-sm font-semibold text-white rounded-lg flex items-center justify-center gap-1.5" style={{ background: ACCENT }}>
            <Save size={14} /> Créer la session
          </button>
        </form>
        <div className="max-h-52 overflow-auto divide-y divide-[var(--border-primary)]">
          {sessions.length === 0 && <div className="py-6 text-center text-sm text-[var(--text-secondary)]">Aucune session.</div>}
          {sessions.map((s) => (
            <div key={sv(s.id)} className="flex items-center justify-between py-2 text-sm">
              <span>{sv(s.libelle)}</span>
              <span className="text-xs text-[var(--text-secondary)]">{n(s.nJours)} j · {n(s.nHeures)} h</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ Paramètres paie ----------------------------- */

// Rubriques de paie, grilles de salaire, types CNSS et barème IRPP.
// Ce sont les 4 paramétrages dont dépendait le moteur de paie sans avoir
// d'interface — ils étaient codés en dur jusqu'ici.
const PAIE_TABS = [
  { key: "rubriques", label: "Rubriques" },
  { key: "grilles", label: "Grilles de salaire" },
  { key: "types-cnss", label: "Types CNSS" },
  { key: "bareme-irpp", label: "Barème IRPP" },
] as const;

function ParamsPaieTab({ onFlash }: { onFlash: (m: string) => void }) {
  const [sous, setSous] = useState<string>("rubriques");
  const [rows, setRows] = useState<Row[]>([]);
  const [meta, setMeta] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/grh?resource=${sous}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setRows(d.rows ?? []);
        setMeta(d);
        setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [sous, reload]);

  async function envoyer(method: string, body: Record<string, unknown>) {
    const r = await fetch(`/api/grh?resource=${sous}`, {
      method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }).then((x) => x.json());
    if (r.ok) { setReload((k) => k + 1); onFlash(r.message ?? "Enregistré"); }
    else alert(r.error ?? "Échec");
    return r.ok;
  }

  async function supprimer(id: number) {
    const r = await fetch(`/api/grh?resource=${sous}&id=${id}`, { method: "DELETE" }).then((x) => x.json());
    if (r.ok) { setReload((k) => k + 1); onFlash("Supprimé"); }
    else alert(r.error ?? "Échec");
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div className="flex gap-1.5 flex-wrap">
          {/* Changer d'onglet referme le formulaire : ses champs ne
              correspondraient plus au référentiel affiché. */}
          {PAIE_TABS.map((t) => (
            <button key={t.key} onClick={() => { setSous(t.key); setAdding(false); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                sous === t.key ? "text-white border-transparent" : "bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border-primary)]"
              }`}
              style={sous === t.key ? { background: ACCENT } : undefined}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {(sous === "types-cnss" || sous === "bareme-irpp") && (
            <button onClick={() => envoyer("POST", { init: true })}
              className="px-3 py-2 rounded-xl text-sm font-medium border border-[var(--border-primary)]">
              Charger les valeurs usuelles
            </button>
          )}
          <button onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 text-white px-3 py-2 rounded-xl text-sm font-medium" style={{ background: ACCENT }}>
            <Plus size={15} /> Ajouter
          </button>
        </div>
      </div>

      {sous === "bareme-irpp" && meta?.alerte != null && (
        <div className="px-3 py-2 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-400 text-sm">
          {sv(meta.alerte)}
        </div>
      )}
      {sous === "bareme-irpp" && (
        <p className="text-xs text-[var(--text-secondary)]">
          Barème annuel appliqué au revenu imposable puis divisé par 12. La dernière tranche
          doit rester non bornée (champ « Au » vide), sinon les hauts revenus ne seraient
          pas imposés au-delà.
        </p>
      )}
      {sous === "rubriques" && (
        <p className="text-xs text-[var(--text-secondary)]">
          Les cases décident sur quelles assiettes la rubrique agit : une prime soumise
          à CNSS/IRPP augmente les cotisations, une indemnité exonérée s&apos;ajoute
          directement au net.
        </p>
      )}

      {adding && <FormPaie sous={sous} onCancel={() => setAdding(false)}
        onSubmit={(b) => envoyer("POST", b).then((ok) => { if (ok) setAdding(false); })} />}

      <div className="overflow-auto rounded-xl border border-[var(--border-primary)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--bg-primary)] border-b border-[var(--border-primary)]">
            <tr className="text-[11px] uppercase tracking-wide text-[var(--text-secondary)]">
              {sous === "rubriques" && (
                <>
                  <th className="px-3 py-2.5 text-left font-semibold">Code</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Libellé</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Sens</th>
                  <th className="px-3 py-2.5 text-center font-semibold">CNSS</th>
                  <th className="px-3 py-2.5 text-center font-semibold">IRPP</th>
                  <th className="px-3 py-2.5 text-center font-semibold">× Qté</th>
                  <th className="px-3 py-2.5 text-center font-semibold">Prorata</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Affectations</th>
                </>
              )}
              {sous === "grilles" && (
                <>
                  <th className="px-3 py-2.5 text-left font-semibold">Régime</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Catégorie</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Échelon</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Salaire base</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Durée (mois)</th>
                </>
              )}
              {sous === "types-cnss" && (
                <>
                  <th className="px-3 py-2.5 text-left font-semibold">Code</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Libellé</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Ret. CNSS %</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Ch. patronale %</th>
                  <th className="px-3 py-2.5 text-center font-semibold">IRPP</th>
                  <th className="px-3 py-2.5 text-center font-semibold">Défaut</th>
                </>
              )}
              {sous === "bareme-irpp" && (
                <>
                  <th className="px-3 py-2.5 text-right font-semibold">Du (annuel)</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Au</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Taux %</th>
                </>
              )}
              <th className="w-16" />
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={9} className="py-10 text-center text-[var(--text-secondary)]"><Loader2 className="animate-spin inline" size={18} /></td></tr>}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={9} className="py-10 text-center text-[var(--text-secondary)] text-sm">
                Aucune donnée. {sous === "rubriques" ? "Créez vos primes et retenues." : "Ajoutez une ligne."}
              </td></tr>
            )}
            {rows.map((r) => (
              <tr key={sv(r.id)} className="border-b border-[var(--border-primary)]/60 hover:bg-[var(--accent-light)]">
                {sous === "rubriques" && (
                  <>
                    <td className="px-3 py-2.5 font-mono text-xs">{sv(r.code)}</td>
                    <td className="px-3 py-2.5">{sv(r.libelle)}</td>
                    <td className="px-3 py-2.5">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        r.sens === "Retenue" ? "bg-red-500/12 text-red-600" : "bg-emerald-500/12 text-emerald-600"}`}>
                        {sv(r.sens)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center">{r.soumisCnss ? "✓" : "—"}</td>
                    <td className="px-3 py-2.5 text-center">{r.soumisIrpp ? "✓" : "—"}</td>
                    <td className="px-3 py-2.5 text-center">{r.parQuantite ? "✓" : "—"}</td>
                    <td className="px-3 py-2.5 text-center">{r.prorataAbsence ? "✓" : "—"}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{n(r.nbAffectations)}</td>
                  </>
                )}
                {sous === "grilles" && (
                  <>
                    <td className="px-3 py-2.5">{sv(r.regime)}</td>
                    <td className="px-3 py-2.5">{sv(r.categorie)}</td>
                    <td className="px-3 py-2.5">{sv(r.echelon)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{fmtMoney(n(r.salaireBase))}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{n(r.dureeEchelon)}</td>
                  </>
                )}
                {sous === "types-cnss" && (
                  <>
                    <td className="px-3 py-2.5 font-mono text-xs">{sv(r.code)}</td>
                    <td className="px-3 py-2.5">{sv(r.libelle)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{n(r.retCnss)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{n(r.chCnss)}</td>
                    <td className="px-3 py-2.5 text-center">{r.retenuIrpp ? "✓" : "—"}</td>
                    <td className="px-3 py-2.5 text-center">{r.parDefaut ? "★" : "—"}</td>
                  </>
                )}
                {sous === "bareme-irpp" && (
                  <>
                    <td className="px-3 py-2.5 text-right tabular-nums">{fmtMoney(n(r.du))}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {r.au == null ? <span className="text-[var(--text-secondary)]">et au-delà</span> : fmtMoney(n(r.au))}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{n(r.taux)}</td>
                  </>
                )}
                <td className="px-3 py-2.5 text-right">
                  <button onClick={() => supprimer(Number(r.id))}
                    className="p-1.5 rounded-lg text-red-600 hover:bg-red-500/10"><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FormPaie({ sous, onCancel, onSubmit }: {
  sous: string; onCancel: () => void; onSubmit: (b: Record<string, unknown>) => void;
}) {
  const cls = "px-2 py-1.5 text-sm bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg";

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const o: Record<string, unknown> = {};
    fd.forEach((v, k) => { o[k] = v; });
    // Les cases non cochées n'apparaissent pas dans FormData : on les force à false
    // pour que l'API distingue « décoché » de « non fourni ».
    if (sous === "rubriques") {
      for (const k of ["soumisCnss", "soumisIrpp", "parQuantite", "prorataAbsence"]) {
        o[k] = fd.get(k) === "on";
      }
    }
    if (sous === "types-cnss") {
      o.retenuIrpp = fd.get("retenuIrpp") === "on";
      o.parDefaut = fd.get("parDefaut") === "on";
    }
    // Dernière tranche : « Au » vide = non bornée.
    if (sous === "bareme-irpp" && o.au === "") o.au = null;
    onSubmit(o);
  }

  return (
    <form onSubmit={submit} className="grid sm:grid-cols-4 gap-2 p-3 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)]">
      {sous === "rubriques" && (
        <>
          <input name="code" placeholder="Code *" required className={cls} />
          <input name="libelle" placeholder="Libellé *" required className={cls} />
          <select name="sens" className={cls}>
            <option value="Gain">Gain</option>
            <option value="Retenue">Retenue</option>
          </select>
          <div className="sm:col-span-4 flex flex-wrap gap-4 text-xs text-[var(--text-secondary)]">
            <label className="flex items-center gap-1.5"><input type="checkbox" name="soumisCnss" defaultChecked /> Soumis CNSS</label>
            <label className="flex items-center gap-1.5"><input type="checkbox" name="soumisIrpp" defaultChecked /> Soumis IRPP</label>
            <label className="flex items-center gap-1.5"><input type="checkbox" name="parQuantite" /> Montant × quantité</label>
            <label className="flex items-center gap-1.5"><input type="checkbox" name="prorataAbsence" /> Réduit au prorata des absences</label>
          </div>
        </>
      )}
      {sous === "grilles" && (
        <>
          <select name="regime" className={cls}>
            <option value="M">Mensuel (M)</option>
            <option value="H">Horaire (H)</option>
          </select>
          <input name="categorie" placeholder="Catégorie *" required className={cls} />
          <input name="echelon" placeholder="Échelon *" required className={cls} />
          <input type="number" step="0.001" name="salaireBase" placeholder="Salaire base" className={cls} />
          <input type="number" step="1" name="dureeEchelon" placeholder="Durée échelon (mois)" className={cls} />
        </>
      )}
      {sous === "types-cnss" && (
        <>
          <input name="code" placeholder="Code *" required className={cls} />
          <input name="libelle" placeholder="Libellé *" required className={cls} />
          <input type="number" step="0.01" name="retCnss" placeholder="Retenue CNSS %" defaultValue={9.18} className={cls} />
          <input type="number" step="0.01" name="chCnss" placeholder="Charge patronale %" defaultValue={16.57} className={cls} />
          <div className="sm:col-span-4 flex gap-4 text-xs text-[var(--text-secondary)]">
            <label className="flex items-center gap-1.5"><input type="checkbox" name="retenuIrpp" defaultChecked /> Soumis à l&apos;IRPP</label>
            <label className="flex items-center gap-1.5"><input type="checkbox" name="parDefaut" /> Type par défaut</label>
          </div>
        </>
      )}
      {sous === "bareme-irpp" && (
        <>
          <input type="number" step="0.001" name="du" placeholder="Du (annuel) *" required className={cls} />
          <input type="number" step="0.001" name="au" placeholder="Au (vide = illimité)" className={cls} />
          <input type="number" step="0.01" name="taux" placeholder="Taux %" required className={cls} />
        </>
      )}
      <div className="sm:col-span-4 flex gap-1">
        <button type="submit" className="px-4 py-1.5 text-sm font-semibold text-white rounded-lg" style={{ background: ACCENT }}>
          Enregistrer
        </button>
        <button type="button" onClick={onCancel} className="px-2 rounded-lg border border-[var(--border-primary)]"><X size={14} /></button>
      </div>
    </form>
  );
}

/* ─────────────────────────────────────────────────────────────
   Crédits employés
   Avance versée à un salarié, remboursée par retenues mensuelles.
   Chaque échéance est un règlement `modePay = "Crédit"` — même modèle que
   l'écran « Gestion Crédit » de l'ERP d'origine, sans table dédiée.
   ───────────────────────────────────────────────────────────── */

type CreditEmploye = {
  tiersCode: number | null; tiersNom: string | null;
  total: number; regle: number; reste: number;
  nbEcheances: number; nbReglees: number;
  echeances: { id: number; montant: number; echeance: string | null; etat: string | null; commentaire: string | null }[];
};

function CreditsTab({ onFlash }: { onFlash: (m: string) => void }) {
  const [rows, setRows] = useState<CreditEmploye[]>([]);
  const [totaux, setTotaux] = useState({ montantTotal: 0, resteTotal: 0 });
  const [load, setLoad] = useState(true);
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [form, setForm] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let annule = false;
    fetch("/api/grh?resource=credits")
      .then((r) => r.json())
      .then((d) => {
        if (annule) return;
        setRows(d.rows ?? []);
        setTotaux({ montantTotal: d.montantTotal ?? 0, resteTotal: d.resteTotal ?? 0 });
        setLoad(false);
      })
      .catch(() => { if (!annule) setLoad(false); });
    return () => { annule = true; };
  }, [reload]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-4">
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Crédits accordés</div>
            <div className="text-lg font-extrabold tabular-nums">{fmtMoney(totaux.montantTotal)} TND</div>
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Reste à retenir</div>
            <div className="text-lg font-extrabold tabular-nums text-amber-600">{fmtMoney(totaux.resteTotal)} TND</div>
          </div>
        </div>
        <button onClick={() => setForm(true)}
          className="px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition">
          + Accorder un crédit
        </button>
      </div>

      {load ? (
        <div className="py-10 text-center text-slate-400 text-sm">Chargement…</div>
      ) : rows.length === 0 ? (
        <div className="py-10 text-center text-slate-500 text-sm">
          Aucun crédit accordé. Un crédit est une avance remboursée par retenues mensuelles.
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((c) => {
            const cle = String(c.tiersCode ?? c.tiersNom);
            const pct = c.total > 0 ? Math.round((c.regle / c.total) * 100) : 0;
            return (
              <div key={cle} className="bg-white rounded-2xl border border-slate-100 p-4">
                <button onClick={() => setOuvert(ouvert === cle ? null : cle)}
                  className="w-full flex items-center justify-between gap-3 text-left">
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-800 truncate">
                      {c.tiersNom || `Employé ${c.tiersCode}`}
                    </div>
                    <div className="text-xs text-slate-500">
                      {c.nbReglees}/{c.nbEcheances} échéance(s) retenue(s)
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold tabular-nums">{fmtMoney(c.total)} TND</div>
                    <div className="text-xs font-semibold text-amber-600 tabular-nums">
                      reste {fmtMoney(c.reste)}
                    </div>
                  </div>
                </button>

                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mt-2">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                </div>

                {ouvert === cle && (
                  <div className="mt-3 pt-3 border-t border-slate-100 space-y-1">
                    {c.echeances.map((e) => (
                      <div key={e.id} className="flex items-center justify-between text-xs gap-3">
                        <span className="text-slate-500 truncate">{e.commentaire ?? "—"}</span>
                        <span className="shrink-0 flex items-center gap-3">
                          <span className="text-slate-400">{e.echeance ?? "—"}</span>
                          <span className={`font-bold tabular-nums ${
                            (e.etat ?? "").toLowerCase().startsWith("encaiss") ? "text-emerald-600" : "text-slate-700"
                          }`}>
                            {fmtMoney(e.montant)}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {form && (
        <FormCredit
          onClose={() => setForm(false)}
          onCree={(m) => { setForm(false); onFlash(m); setReload((k) => k + 1); }}
        />
      )}
    </div>
  );
}

function FormCredit({ onClose, onCree }: { onClose: () => void; onCree: (m: string) => void }) {
  const [employes, setEmployes] = useState<{ id: number; nom: string; soldeFin: number }[]>([]);
  const [codeEmploye, setCodeEmploye] = useState("");
  const [montant, setMontant] = useState("");
  const [nbEcheances, setNbEcheances] = useState("3");
  const [premiere, setPremiere] = useState(new Date().toISOString().slice(0, 10));
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/grh?resource=employes-liste")
      .then((r) => r.json())
      .then((d) => setEmployes(d.rows ?? []))
      .catch(() => {});
  }, []);

  // Montant de chaque retenue : affiché avant validation pour éviter la
  // mauvaise surprise sur la fiche de paie.
  const tranche = (() => {
    const m = Number(montant), n = Number(nbEcheances);
    return Number.isFinite(m) && Number.isFinite(n) && n > 0 ? m / n : 0;
  })();

  async function valider() {
    setErreur(null);
    if (!codeEmploye) { setErreur("Choisissez l'employé"); return; }
    setEnvoi(true);
    const nom = employes.find((e) => String(e.id) === codeEmploye)?.nom ?? "";
    const r = await fetch("/api/grh?resource=credits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codeEmploye, nom, montant, nbEcheances, premiereEcheance: premiere }),
    }).then((x) => x.json()).catch(() => ({ error: "réseau" }));
    setEnvoi(false);
    if (r.ok) onCree(r.message ?? "Crédit accordé"); else setErreur(r.error ?? "Échec");
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-5 py-4 border-b border-slate-100 font-bold text-sm">Accorder un crédit</div>
        <div className="p-5 space-y-3">
          <label className="block">
            <span className="block text-xs font-semibold text-slate-500 mb-1">Employé</span>
            <select value={codeEmploye} onChange={(e) => setCodeEmploye(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm">
              <option value="">— Choisir —</option>
              {employes.map((e) => <option key={e.id} value={e.id}>{e.nom}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs font-semibold text-slate-500 mb-1">Montant (TND)</span>
              <input value={montant} onChange={(e) => setMontant(e.target.value)} inputMode="decimal"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" placeholder="1200.000" />
            </label>
            <label className="block">
              <span className="block text-xs font-semibold text-slate-500 mb-1">Nombre d&apos;échéances</span>
              <input value={nbEcheances} onChange={(e) => setNbEcheances(e.target.value)} type="number" min={1} max={60}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" />
            </label>
          </div>
          <label className="block">
            <span className="block text-xs font-semibold text-slate-500 mb-1">Première retenue</span>
            <input type="date" value={premiere} onChange={(e) => setPremiere(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" />
          </label>

          {tranche > 0 && (
            <div className="px-3 py-2 rounded-xl bg-slate-50 text-xs text-slate-600">
              Retenue par tranche : <b>{fmtMoney(tranche)} TND</b> — les échéances
              sont espacées de 30 jours à partir de la première.
            </div>
          )}

          {erreur && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{erreur}</div>
          )}
        </div>
        <div className="flex gap-3 px-5 py-4 border-t border-slate-100">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-slate-200 text-slate-600">
            Annuler
          </button>
          <button onClick={valider} disabled={envoi}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-emerald-600 disabled:opacity-50">
            {envoi ? "…" : "Accorder"}
          </button>
        </div>
      </div>
    </div>
  );
}
