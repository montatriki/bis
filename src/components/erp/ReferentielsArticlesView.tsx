"use client";
import { useState, useEffect, useCallback } from "react";
import { confirmer } from "@/lib/alertes";
import {
  Tags, Plus, Trash2, Loader2, Check, AlertTriangle, Wand2, Pencil,
} from "lucide-react";

// Référentiels articles — familles, sous-familles, unités, catalogue.
// Comble le constat du §10 : les articles portent des codes numériques
// (famille = 2, 3, 11…) sans aucune table de libellés.

type Famille = { code: number; libelle: string; charge: boolean; lettreCompta: string | null; nbArticles?: number };
type SousFamille = Famille & { codeFamille: number | null };
type Unite = { unite: string; libelle: string | null };
type Catalogue = { code: number; libelle: string };
type Orphelins = {
  familles: { code: number; nbArticles: number }[];
  sousFamilles: { code: number; nbArticles: number }[];
  unites: { unite: string; nbArticles: number }[];
};

const ONGLETS = [
  { k: "familles", l: "Familles" },
  { k: "sous-familles", l: "Sous-familles" },
  { k: "unites", l: "Unités" },
  { k: "catalogue", l: "Catalogue" },
] as const;

export default function ReferentielsArticlesView({ accent }: { accent: string }) {
  const [onglet, setOnglet] = useState<string>("familles");
  const [rows, setRows] = useState<(Famille | SousFamille | Unite | Catalogue)[]>([]);
  const [familles, setFamilles] = useState<Famille[]>([]);
  const [orphelins, setOrphelins] = useState<Orphelins | null>(null);
  const [load, setLoad] = useState(true);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<Record<string, string> | null>(null);
  const [edit, setEdit] = useState<string | number | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const flash = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 7000);
  }, []);

  const charger = useCallback(() => {
    Promise.all([
      fetch(`/api/referentiels-articles?vue=${onglet}`).then((r) => r.json()),
      fetch("/api/referentiels-articles?vue=orphelins").then((r) => r.json()),
      fetch("/api/referentiels-articles?vue=familles").then((r) => r.json()),
    ])
      .then(([d, o, f]) => {
        setRows(d.rows ?? []);
        setOrphelins(o);
        setFamilles(f.rows ?? []);
      })
      .catch(() => flash("Chargement impossible", false))
      .finally(() => setLoad(false));
  }, [onglet, flash]);

  useEffect(charger, [charger]);

  const singulier: Record<string, string> = {
    "familles": "famille", "sous-familles": "sous-famille",
    "unites": "unite", "catalogue": "catalogue",
  };

  const initialiser = async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/referentiels-articles", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vue: "init" }),
      });
      const d = await r.json();
      flash(d.message ?? d.error, r.ok);
      if (r.ok) charger();
    } finally { setBusy(false); }
  };

  const enregistrer = async () => {
    if (!form) return;
    setBusy(true);
    try {
      const vue = singulier[onglet];
      const r = await fetch("/api/referentiels-articles", {
        method: edit != null ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vue, ...form }),
      });
      const d = await r.json();
      if (!r.ok) return flash(d.error ?? "Échec", false);
      flash(d.message ?? "Enregistré");
      setForm(null); setEdit(null);
      charger();
    } finally { setBusy(false); }
  };

  const supprimer = async (cle: string | number) => {
    if (!(await confirmer("Supprimer cette entrée ?", { danger: true }))) return;
    const vue = singulier[onglet];
    const param = onglet === "unites" ? `unite=${encodeURIComponent(String(cle))}` : `code=${cle}`;
    const r = await fetch(`/api/referentiels-articles?vue=${vue}&${param}`, { method: "DELETE" });
    const d = await r.json();
    flash(d.message ?? d.error, r.ok);
    if (r.ok) charger();
  };

  const nbOrphelins =
    (orphelins?.familles.length ?? 0) + (orphelins?.sousFamilles.length ?? 0) + (orphelins?.unites.length ?? 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: accent + "18", color: accent }}>
            <Tags size={17} />
          </div>
          <div>
            <div className="font-bold text-[var(--text-primary)] text-sm">Référentiels articles</div>
            <div className="text-xs text-[var(--text-secondary)]">
              Familles, sous-familles, unités et catalogue
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {nbOrphelins > 0 && (
            <button onClick={initialiser} disabled={busy}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-amber-300 text-amber-700 flex items-center gap-1.5 disabled:opacity-50">
              {busy ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}
              Créer les {nbOrphelins} entrée(s) manquante(s)
            </button>
          )}
          <button onClick={() => { setForm({}); setEdit(null); }}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5"
            style={{ background: accent }}>
            <Plus size={13} /> Ajouter
          </button>
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

      {nbOrphelins > 0 && (
        <div className="px-3 py-2 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs space-y-1">
          <div className="flex items-start gap-2">
            <AlertTriangle size={13} className="mt-0.5 shrink-0" />
            <span>
              <b>{nbOrphelins} code(s) sans libellé</b> — des articles portent ces codes,
              mais aucun libellé ne leur correspond : les écrans affichent le code brut.
            </span>
          </div>
          {orphelins!.familles.length > 0 && (
            <div className="pl-5">Familles : {orphelins!.familles.map((f) => `${f.code} (${f.nbArticles} art.)`).join(", ")}</div>
          )}
          {orphelins!.unites.length > 0 && (
            <div className="pl-5">Unités : {orphelins!.unites.map((u) => `${u.unite} (${u.nbArticles} art.)`).join(", ")}</div>
          )}
        </div>
      )}

      <div className="flex gap-1.5 flex-wrap">
        {ONGLETS.map((o) => (
          <button key={o.k} onClick={() => { setOnglet(o.k); setForm(null); setEdit(null); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
              onglet === o.k ? "text-white border-transparent shadow-sm"
                : "bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border-primary)]"
            }`}
            style={onglet === o.k ? { background: accent } : undefined}>
            {o.l}
          </button>
        ))}
      </div>

      {form && (
        <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl p-4 space-y-3">
          <div className="grid sm:grid-cols-4 gap-3">
            {onglet === "unites" ? (
              <Champ label="Unité *">
                <input value={form.unite ?? ""} disabled={edit != null}
                  onChange={(e) => setForm({ ...form, unite: e.target.value })} className={inputCls} />
              </Champ>
            ) : (
              <Champ label="Code *">
                <input type="number" value={form.code ?? ""} disabled={edit != null}
                  onChange={(e) => setForm({ ...form, code: e.target.value })} className={inputCls} />
              </Champ>
            )}
            <div className="sm:col-span-2">
              <Champ label="Libellé *">
                <input value={form.libelle ?? ""}
                  onChange={(e) => setForm({ ...form, libelle: e.target.value })} className={inputCls} />
              </Champ>
            </div>
            {onglet === "sous-familles" && (
              <Champ label="Famille de rattachement">
                <select value={form.codeFamille ?? ""}
                  onChange={(e) => setForm({ ...form, codeFamille: e.target.value })} className={inputCls}>
                  <option value="">— Aucune —</option>
                  {familles.map((f) => <option key={f.code} value={f.code}>{f.code} — {f.libelle}</option>)}
                </select>
              </Champ>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={enregistrer} disabled={busy}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 disabled:opacity-50"
              style={{ background: accent }}>
              {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Enregistrer
            </button>
            <button onClick={() => { setForm(null); setEdit(null); }}
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
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--bg-primary)]/60 border-b border-[var(--border-primary)]">
                {[onglet === "unites" ? "Unité" : "Code", "Libellé",
                  ...(onglet === "sous-familles" ? ["Famille"] : []),
                  ...(onglet === "familles" || onglet === "sous-familles" ? ["Articles"] : []), ""]
                  .map((h, i) => (
                    <th key={i} className="px-3 py-2 text-left text-[10px] uppercase tracking-wide text-[var(--text-secondary)] font-semibold">
                      {h}
                    </th>
                  ))}
              </tr>
            </thead>
            <tbody className="text-[var(--text-primary)]">
              {rows.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-xs text-[var(--text-secondary)]">
                  Aucune entrée. Utilisez « Créer les entrées manquantes » pour partir des codes réellement utilisés.
                </td></tr>
              )}
              {rows.map((r) => {
                const cle = "unite" in r ? r.unite : r.code;
                const sf = r as SousFamille;
                const fam = familles.find((f) => f.code === sf.codeFamille);
                return (
                  <tr key={String(cle)} className="border-b border-[var(--border-primary)]/60 hover:bg-[var(--accent-light)]">
                    <td className="px-3 py-2 font-mono text-xs">{String(cle)}</td>
                    <td className="px-3 py-2">{"libelle" in r ? (r.libelle ?? "—") : "—"}</td>
                    {onglet === "sous-familles" && (
                      <td className="px-3 py-2 text-xs">{fam ? `${fam.code} — ${fam.libelle}` : "—"}</td>
                    )}
                    {(onglet === "familles" || onglet === "sous-familles") && (
                      <td className="px-3 py-2 text-right text-xs">{(r as Famille).nbArticles ?? 0}</td>
                    )}
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <button onClick={() => {
                        setEdit(cle);
                        setForm(onglet === "unites"
                          ? { unite: String(cle), libelle: (r as Unite).libelle ?? "" }
                          : { code: String(cle), libelle: (r as Famille).libelle,
                              ...(onglet === "sous-familles" ? { codeFamille: String(sf.codeFamille ?? "") } : {}) });
                      }} className="p-1 text-[var(--text-secondary)] mr-1"><Pencil size={13} /></button>
                      <button onClick={() => supprimer(cle)} className="text-red-500 p-1"><Trash2 size={13} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
