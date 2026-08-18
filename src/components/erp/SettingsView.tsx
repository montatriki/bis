"use client";
import { useState, useEffect, useCallback } from "react";
import {
  Settings, Tag, Boxes, Users, FolderTree, Plus, Pencil, Trash2,
  Loader2, Check, AlertTriangle, Save, X, Landmark, Building2,
} from "lucide-react";

// Écran Paramétrages — désormais éditable.
// 3 volets : référentiels du module, comptes comptables, société & taux.

type Ref = { id: number; kind: string; code: string | null; label: string };
type Section = { kind: string; titre: string; rows: Ref[] };
type CompteParam = { cle: string; numCompte: string; libelle: string; parDefaut: boolean };
type ParamSociete = { cle: string; libelle: string; valeur: string; defaut: string };

const ICONS: Record<string, React.ElementType> = {
  "doctype-vente": Tag, "doctype-achat": Tag,
  "famille-cli": FolderTree, "sousfamille-cli": FolderTree,
  "famille-frs": FolderTree, "sousfamille-frs": FolderTree,
  depot: Boxes, vehicule: Boxes, commercial: Users,
};

const VOLETS = ["Référentiels", "Comptes comptables", "Société & taux"] as const;
type Volet = (typeof VOLETS)[number];

export default function SettingsView({ scope, accent }: { scope: string; accent: string }) {
  const [volet, setVolet] = useState<Volet>("Référentiels");
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

      <div className="flex gap-1.5 flex-wrap">
        {VOLETS.map((v) => (
          <button key={v} onClick={() => setVolet(v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
              volet === v ? "text-white border-transparent shadow-sm"
                : "bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border-primary)] hover:text-[var(--text-primary)]"
            }`}
            style={volet === v ? { background: accent } : undefined}>
            {v}
          </button>
        ))}
      </div>

      {volet === "Référentiels" && <Referentiels scope={scope} accent={accent} reload={reload} onFlash={flash} onDone={refresh} />}
      {volet === "Comptes comptables" && <Comptes accent={accent} reload={reload} onFlash={flash} onDone={refresh} />}
      {volet === "Société & taux" && <Societe accent={accent} reload={reload} onFlash={flash} onDone={refresh} />}
    </div>
  );
}

/* ------------------------------ Référentiels ------------------------------ */

function Referentiels({ scope, accent, reload, onFlash, onDone }: {
  scope: string; accent: string; reload: number;
  onFlash: (m: string, ok?: boolean) => void; onDone: () => void;
}) {
  const [sections, setSections] = useState<Section[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(true);
  const [nouveau, setNouveau] = useState("");
  const [nouveauCode, setNouveauCode] = useState("");
  const [edit, setEdit] = useState<Ref | null>(null);
  const [busy, setBusy] = useState(false);

  // Le scope du module détermine les référentiels affichés.
  const apiScope = ["vente", "crm"].includes(scope) ? "vente" : scope === "achat" ? "achat" : "stock";

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/parametres?vue=refs&scope=${apiScope}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setSections(d.sections ?? []);
        setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [apiScope, reload]);

  const sec = sections[active];

  async function ajouter() {
    if (!sec || !nouveau.trim()) return;
    setBusy(true);
    const r = await fetch("/api/parametres", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: sec.kind, label: nouveau.trim(), code: nouveauCode.trim() || null }),
    }).then((x) => x.json());
    setBusy(false);
    onFlash(r.message ?? r.error ?? "—", Boolean(r.ok));
    if (r.ok) { setNouveau(""); setNouveauCode(""); onDone(); }
  }

  async function enregistrer() {
    if (!edit) return;
    setBusy(true);
    const r = await fetch("/api/parametres", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vue: "refs", id: edit.id, label: edit.label, code: edit.code }),
    }).then((x) => x.json());
    setBusy(false);
    onFlash(r.message ?? r.error ?? "—", Boolean(r.ok));
    if (r.ok) { setEdit(null); onDone(); }
  }

  async function supprimer(r: Ref) {
    if (!confirm(`Supprimer « ${r.label} » ?`)) return;
    const res = await fetch(`/api/parametres?vue=refs&id=${r.id}`, { method: "DELETE" }).then((x) => x.json());
    onFlash(res.message ?? res.error ?? "—", Boolean(res.ok));
    if (res.ok) onDone();
  }

  if (loading) return <Spin />;
  if (sections.length === 0) return <Empty msg="Aucun référentiel pour ce module." />;

  return (
    <div className="flex flex-col md:flex-row gap-4">
      <div className="md:w-56 shrink-0 space-y-1">
        {sections.map((s, i) => {
          const Icon = ICONS[s.kind] ?? Settings;
          const on = active === i;
          return (
            <button key={s.kind} onClick={() => { setActive(i); setEdit(null); }}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition text-left ${
                on ? "text-white shadow-sm" : "bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--border-primary)]"
              }`}
              style={on ? { background: accent } : undefined}>
              <Icon size={15} className="shrink-0" />
              <span className="flex-1 truncate">{s.titre}</span>
              <span className={`text-[10px] px-1.5 rounded-full ${on ? "bg-white/20" : "bg-[var(--bg-primary)]"}`}>
                {s.rows.length}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex-1 min-w-0 space-y-3">
        {sec && (
          <>
            <div className="flex gap-2 flex-wrap">
              <input value={nouveauCode} onChange={(e) => setNouveauCode(e.target.value)}
                placeholder="Code (facultatif)"
                className="w-32 px-2.5 py-1.5 text-sm bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg focus:outline-none" />
              <input value={nouveau} onChange={(e) => setNouveau(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && ajouter()}
                placeholder={`Nouveau — ${sec.titre.toLowerCase()}`}
                className="flex-1 min-w-40 px-2.5 py-1.5 text-sm bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg focus:outline-none" />
              <button onClick={ajouter} disabled={busy || !nouveau.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-white disabled:opacity-40"
                style={{ background: accent }}>
                <Plus size={14} /> Ajouter
              </button>
            </div>

            <div className="overflow-auto rounded-xl border border-[var(--border-primary)] max-h-[50vh]">
              <table className="w-full text-sm">
                <thead className="bg-[var(--bg-primary)] border-b border-[var(--border-primary)] sticky top-0">
                  <tr className="text-[11px] uppercase tracking-wide text-[var(--text-secondary)]">
                    <th className="px-4 py-2.5 text-left font-semibold w-32">Code</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Libellé</th>
                    <th className="px-4 py-2.5 w-24" />
                  </tr>
                </thead>
                <tbody>
                  {sec.rows.length === 0 && (
                    <tr><td colSpan={3} className="py-10 text-center text-sm text-[var(--text-secondary)]">
                      Aucun élément — ajoutez-en un ci-dessus.
                    </td></tr>
                  )}
                  {sec.rows.map((r) => (
                    <tr key={r.id} className="border-b border-[var(--border-primary)]/60 hover:bg-[var(--accent-light)]">
                      <td className="px-4 py-2 font-mono text-xs text-[var(--text-secondary)]">
                        {edit?.id === r.id ? (
                          <input value={edit.code ?? ""} onChange={(e) => setEdit({ ...edit, code: e.target.value })}
                            className="w-full px-2 py-1 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded" />
                        ) : (r.code || "—")}
                      </td>
                      <td className="px-4 py-2 text-[var(--text-primary)]">
                        {edit?.id === r.id ? (
                          <input value={edit.label} onChange={(e) => setEdit({ ...edit, label: e.target.value })}
                            className="w-full px-2 py-1 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded" />
                        ) : r.label}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex gap-1 justify-end">
                          {edit?.id === r.id ? (
                            <>
                              <button onClick={enregistrer} disabled={busy}
                                className="p-1.5 rounded-lg text-white" style={{ background: accent }}><Save size={13} /></button>
                              <button onClick={() => setEdit(null)}
                                className="p-1.5 rounded-lg border border-[var(--border-primary)] text-[var(--text-secondary)]"><X size={13} /></button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => setEdit(r)}
                                className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-500/10"><Pencil size={13} /></button>
                              <button onClick={() => supprimer(r)}
                                className="p-1.5 rounded-lg text-red-600 hover:bg-red-500/10"><Trash2 size={13} /></button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* --------------------------- Comptes comptables --------------------------- */

function Comptes({ accent, reload, onFlash, onDone }: {
  accent: string; reload: number; onFlash: (m: string, ok?: boolean) => void; onDone: () => void;
}) {
  const [rows, setRows] = useState<CompteParam[]>([]);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/parametres?vue=comptes")
      .then((r) => r.json())
      .then((d) => { if (!cancelled) { setRows(d.rows ?? []); setEdits({}); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [reload]);

  async function save(c: CompteParam) {
    const val = (edits[c.cle] ?? "").trim();
    if (!val) return;
    setBusy(c.cle);
    const r = await fetch("/api/parametres", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vue: "comptes", cle: c.cle, numCompte: val, libelle: c.libelle }),
    }).then((x) => x.json());
    setBusy(null);
    onFlash(r.message ?? r.error ?? "—", Boolean(r.ok));
    if (r.ok) onDone();
  }

  if (loading) return <Spin />;

  return (
    <div className="space-y-3">
      <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
        Ces comptes pilotent l&apos;<b>intégration comptable</b> des documents : modifier un numéro
        change les écritures générées ensuite. Les écritures déjà passées ne sont pas rejouées.
      </p>
      <div className="overflow-auto rounded-xl border border-[var(--border-primary)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--bg-primary)] border-b border-[var(--border-primary)]">
            <tr className="text-[11px] uppercase tracking-wide text-[var(--text-secondary)]">
              <th className="px-4 py-2.5 text-left font-semibold">Rôle</th>
              <th className="px-4 py-2.5 text-left font-semibold">Intitulé</th>
              <th className="px-4 py-2.5 text-left font-semibold w-48">N° de compte</th>
              <th className="px-4 py-2.5 w-24" />
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const val = edits[c.cle] ?? c.numCompte;
              const modifie = edits[c.cle] !== undefined && edits[c.cle] !== c.numCompte;
              return (
                <tr key={c.cle} className="border-b border-[var(--border-primary)]/60">
                  <td className="px-4 py-2">
                    <span className="font-mono text-xs font-semibold">{c.cle}</span>
                    {c.parDefaut && (
                      <span className="ml-2 text-[9px] px-1.5 py-0.5 rounded-full bg-slate-500/12 text-[var(--text-secondary)] font-bold">
                        défaut
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-[var(--text-secondary)]">{c.libelle}</td>
                  <td className="px-4 py-2">
                    <input value={val}
                      onChange={(e) => setEdits((p) => ({ ...p, [c.cle]: e.target.value }))}
                      className="w-full px-2 py-1 font-mono text-sm bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg focus:outline-none" />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => save(c)} disabled={!modifie || busy === c.cle}
                      className="p-1.5 rounded-lg text-white disabled:opacity-30" style={{ background: accent }}>
                      {busy === c.cle ? <Loader2 className="animate-spin" size={13} /> : <Save size={13} />}
                    </button>
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

/* ------------------------------ Société & taux ---------------------------- */

function Societe({ accent, reload, onFlash, onDone }: {
  accent: string; reload: number; onFlash: (m: string, ok?: boolean) => void; onDone: () => void;
}) {
  const [rows, setRows] = useState<ParamSociete[]>([]);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/parametres?vue=societe")
      .then((r) => r.json())
      .then((d) => { if (!cancelled) { setRows(d.rows ?? []); setEdits({}); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [reload]);

  async function save(p: ParamSociete) {
    const val = edits[p.cle];
    if (val === undefined) return;
    setBusy(p.cle);
    const r = await fetch("/api/parametres", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vue: "societe", cle: p.cle, valeur: val }),
    }).then((x) => x.json());
    setBusy(null);
    onFlash(r.message ?? r.error ?? "—", Boolean(r.ok));
    if (r.ok) onDone();
  }

  if (loading) return <Spin />;

  const societe = rows.filter((r) => r.cle.startsWith("societe."));
  const taux = rows.filter((r) => r.cle.startsWith("taux."));

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Bloc titre="Identité de la société" icon={Building2} accent={accent}>
        {societe.map((p) => (
          <Champ key={p.cle} p={p} edits={edits} setEdits={setEdits} busy={busy} onSave={save} accent={accent} />
        ))}
      </Bloc>
      <Bloc titre="Taux et paramètres fiscaux" icon={Landmark} accent={accent}>
        {taux.map((p) => (
          <Champ key={p.cle} p={p} edits={edits} setEdits={setEdits} busy={busy} onSave={save} accent={accent} />
        ))}
      </Bloc>
    </div>
  );
}

function Champ({ p, edits, setEdits, busy, onSave, accent }: {
  p: ParamSociete;
  edits: Record<string, string>;
  setEdits: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  busy: string | null;
  onSave: (p: ParamSociete) => void;
  accent: string;
}) {
  const val = edits[p.cle] ?? p.valeur;
  const modifie = edits[p.cle] !== undefined && edits[p.cle] !== p.valeur;
  return (
    <div className="flex items-end gap-2 px-4 py-2 border-b border-[var(--border-primary)]/40 last:border-0">
      <label className="flex-1 flex flex-col gap-1 min-w-0">
        <span className="text-[11px] font-semibold text-[var(--text-secondary)]">{p.libelle}</span>
        <input value={val} onChange={(e) => setEdits((prev) => ({ ...prev, [p.cle]: e.target.value }))}
          className="px-2.5 py-1.5 text-sm bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg focus:outline-none" />
      </label>
      <button onClick={() => onSave(p)} disabled={!modifie || busy === p.cle}
        className="p-2 rounded-lg text-white disabled:opacity-30 shrink-0" style={{ background: accent }}>
        {busy === p.cle ? <Loader2 className="animate-spin" size={13} /> : <Save size={13} />}
      </button>
    </div>
  );
}

/* -------------------------------- Communs --------------------------------- */

function Spin() {
  return <div className="p-12 text-center text-[var(--text-secondary)]"><Loader2 className="animate-spin inline" size={20} /></div>;
}
function Empty({ msg }: { msg: string }) {
  return <div className="p-12 text-center text-sm text-[var(--text-secondary)]">{msg}</div>;
}
function Bloc({ titre, icon: Icon, accent, children }: {
  titre: string; icon: React.ElementType; accent: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[var(--border-primary)] overflow-hidden bg-[var(--bg-card)]">
      <div className="px-4 py-2.5 bg-[var(--bg-primary)] border-b border-[var(--border-primary)] font-bold text-sm flex items-center gap-2">
        <Icon size={14} style={{ color: accent }} /> {titre}
      </div>
      {children}
    </div>
  );
}
