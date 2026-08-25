"use client";
import { useState, useEffect, useCallback } from "react";
import { confirmer } from "@/lib/alertes";
import {
  ShieldCheck, Loader2, Check, AlertTriangle, X, RotateCcw,
  Save, ChevronRight, Search,
} from "lucide-react";

// Droits d'accès par utilisateur / composant.
// Remplace `droit-access` de l'ERP source (droits par composant et par utilisateur).

type UserRow = {
  login: string; name: string; role: string; isActive: boolean;
  droitsAccordes: number; toutPermisParRole: boolean;
};
type Fonction = {
  id: number; funcName: string; funcLib: string; typeFn: string;
  valeur: boolean; explicite: boolean;
};
type Groupe = { component: string; label: string; module: string; fonctions: Fonction[] };
type DetailDroits = {
  user: { login: string; name: string; role: string; isActive: boolean };
  toutPermisParRole: boolean;
  groupes: Groupe[];
  total: number;
};

export default function DroitsView({ accent }: { accent: string }) {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [totalFonctions, setTotalFonctions] = useState(0);
  const [load, setLoad] = useState(true);
  const [sel, setSel] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [refuse, setRefuse] = useState(false);

  const flash = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 6000);
  }, []);

  const charger = useCallback(() => {
    // Simple lecture : c'est le serveur qui complète le catalogue en répondant
    // à cette requête, l'écran n'a rien à initialiser lui-même.
    fetch("/api/droits?vue=matrice")
      .then(async (r) => {
        if (r.status === 403) { setRefuse(true); return; }
        const d = await r.json();
        setRows(d.rows ?? []);
        setTotalFonctions(d.totalFonctions ?? 0);
      })
      .catch(() => flash("Chargement impossible", false))
      .finally(() => setLoad(false));
  }, [flash]);

  useEffect(charger, [charger]);

  if (refuse) {
    return (
      <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl p-8 text-center">
        <ShieldCheck size={32} className="mx-auto mb-3 opacity-20" />
        <div className="font-semibold text-[var(--text-primary)] text-sm">Accès réservé aux administrateurs</div>
        <p className="text-xs text-[var(--text-secondary)] mt-1">
          La matrice des droits révèle la surface d&apos;accès de chaque compte.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ background: accent + "18", color: accent }}>
          <ShieldCheck size={17} />
        </div>
        <div>
          <div className="font-bold text-[var(--text-primary)] text-sm">Droits d&apos;accès</div>
          <div className="text-xs text-[var(--text-secondary)]">
            {totalFonctions} fonction(s) protégeable(s) sur {rows.length} compte(s)
          </div>
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

      {sel ? (
        <Matrice login={sel} accent={accent} onFlash={flash}
          onClose={() => { setSel(null); charger(); }} />
      ) : load ? (
        <Chargement />
      ) : (
        <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--bg-primary)]/60 border-b border-[var(--border-primary)]">
                {["Compte", "Login", "Rôle", "Droits accordés", ""].map((h, i) => (
                  <th key={i} className="px-3 py-2 text-left text-[10px] uppercase tracking-wide text-[var(--text-secondary)] font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="text-[var(--text-primary)]">
              {rows.map((u) => (
                <tr key={u.login} onClick={() => setSel(u.login)}
                  className="border-b border-[var(--border-primary)]/60 hover:bg-[var(--accent-light)] cursor-pointer">
                  <td className="px-3 py-2 font-medium">
                    {u.name}
                    {!u.isActive && <span className="ml-1.5 text-xs text-[var(--text-secondary)]">(désactivé)</span>}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{u.login}</td>
                  <td className="px-3 py-2 text-xs">{u.role}</td>
                  <td className="px-3 py-2 text-xs">
                    {u.toutPermisParRole ? (
                      <span className="text-emerald-600 font-semibold">Tous (par son rôle)</span>
                    ) : (
                      `${u.droitsAccordes} / ${totalFonctions}`
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <ChevronRight size={14} className="inline text-[var(--text-secondary)]" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Matrice({ login, accent, onFlash, onClose }: {
  login: string; accent: string; onFlash: (m: string, ok?: boolean) => void; onClose: () => void;
}) {
  const [d, setD] = useState<DetailDroits | null>(null);
  const [load, setLoad] = useState(true);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  // Modifications en attente : `component.funcName` → valeur.
  const [modifs, setModifs] = useState<Record<string, boolean>>({});

  const charger = useCallback(() => {
    fetch(`/api/droits?vue=utilisateur&login=${encodeURIComponent(login)}`)
      .then((r) => r.json())
      .then((x) => {
        setD(x.error ? null : x);
        // Les modifications en attente sont abandonnées : elles portaient sur
        // l'état relu, qui vient d'être remplacé.
        setModifs({});
      })
      .finally(() => setLoad(false));
  }, [login]);

  useEffect(charger, [charger]);

  const valeur = (g: Groupe, f: Fonction) => {
    const cle = `${g.component}.${f.funcName}`;
    return Object.prototype.hasOwnProperty.call(modifs, cle) ? modifs[cle] : f.valeur;
  };

  const basculer = (g: Groupe, f: Fonction) => {
    const cle = `${g.component}.${f.funcName}`;
    setModifs((m) => ({ ...m, [cle]: !valeur(g, f) }));
  };

  /** Coche ou décoche toutes les fonctions d'un écran d'un coup. */
  const toutLigne = (g: Groupe, val: boolean) => {
    setModifs((m) => {
      const suite = { ...m };
      for (const f of g.fonctions) suite[`${g.component}.${f.funcName}`] = val;
      return suite;
    });
  };

  const enregistrer = async () => {
    if (Object.keys(modifs).length === 0) return onFlash("Aucune modification", false);
    setBusy(true);
    try {
      const r = await fetch("/api/droits", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, droits: modifs }),
      });
      const x = await r.json();
      if (!r.ok) return onFlash(x.error ?? "Échec", false);
      onFlash(x.message ?? "Enregistré");
      charger();
    } finally { setBusy(false); }
  };

  const reinitialiser = async () => {
    if (!(await confirmer(`Supprimer tous les droits enregistrés de ${login} ?`, { danger: true }))) return;
    const r = await fetch(`/api/droits?login=${encodeURIComponent(login)}`, { method: "DELETE" });
    const x = await r.json();
    if (!r.ok) return onFlash(x.error ?? "Échec", false);
    onFlash(x.message ?? "Réinitialisé");
    charger();
  };

  if (load) return <Chargement />;
  if (!d) return <div className="text-sm text-[var(--text-secondary)]">Utilisateur introuvable.</div>;

  const groupes = q
    ? d.groupes.filter(
        (g) =>
          g.label.toLowerCase().includes(q.toLowerCase()) ||
          g.module.toLowerCase().includes(q.toLowerCase())
      )
    : d.groupes;

  const nbModifs = Object.keys(modifs).length;

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <button onClick={onClose} className="text-xs text-[var(--text-secondary)] mb-1 flex items-center gap-1">
            <X size={12} /> Retour aux comptes
          </button>
          <div className="font-bold text-sm text-[var(--text-primary)]">{d.user.name}</div>
          <div className="text-xs text-[var(--text-secondary)]">
            {d.user.login} · {d.user.role} · {d.total} fonction(s)
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={reinitialiser}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--border-primary)] flex items-center gap-1.5">
            <RotateCcw size={13} /> Réinitialiser
          </button>
          <button onClick={enregistrer} disabled={busy || nbModifs === 0}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 disabled:opacity-40"
            style={{ background: accent }}>
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            Enregistrer{nbModifs > 0 ? ` (${nbModifs})` : ""}
          </button>
        </div>
      </div>

      {d.toutPermisParRole && (
        <div className="px-3 py-2 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs flex items-start gap-2">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          Ce compte est <strong>ADMIN</strong> : il conserve tous les droits par son rôle, quels que soient
          les réglages enregistrés ici. Changez son rôle dans la gestion des utilisateurs pour que
          cette matrice s&apos;applique.
        </div>
      )}

      <div className="relative">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrer par écran ou module…"
          className="pl-8 pr-3 py-1.5 rounded-lg text-xs bg-[var(--bg-card)] border border-[var(--border-primary)] w-64" />
      </div>

      <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--bg-primary)]/60 border-b border-[var(--border-primary)]">
                <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wide text-[var(--text-secondary)] font-semibold">
                  Module / Écran
                </th>
                {(d.groupes[0]?.fonctions ?? []).map((f) => (
                  <th key={f.funcName}
                    className="px-2 py-2 text-center text-[10px] uppercase tracking-wide text-[var(--text-secondary)] font-semibold whitespace-nowrap">
                    {f.funcLib}
                  </th>
                ))}
                <th className="px-2 py-2 text-center text-[10px] uppercase tracking-wide text-[var(--text-secondary)] font-semibold">
                  Tout
                </th>
              </tr>
            </thead>
            <tbody className="text-[var(--text-primary)]">
              {groupes.map((g) => (
                <tr key={g.component} className="border-b border-[var(--border-primary)]/60 hover:bg-[var(--accent-light)]">
                  <td className="px-3 py-1.5">
                    <div className="text-xs font-medium">{g.label}</div>
                    <div className="text-[10px] text-[var(--text-secondary)]">{g.module}</div>
                  </td>
                  {g.fonctions.map((f) => {
                    const v = valeur(g, f);
                    const cle = `${g.component}.${f.funcName}`;
                    const modifie = Object.prototype.hasOwnProperty.call(modifs, cle);
                    return (
                      <td key={f.funcName} className={`px-2 py-1.5 text-center ${modifie ? "bg-amber-500/10" : ""}`}>
                        <input type="checkbox" checked={v} onChange={() => basculer(g, f)}
                          disabled={d.toutPermisParRole} className="cursor-pointer" />
                      </td>
                    );
                  })}
                  <td className="px-2 py-1.5 text-center whitespace-nowrap">
                    <button onClick={() => toutLigne(g, true)} disabled={d.toutPermisParRole}
                      className="text-[10px] px-1 text-emerald-600 disabled:opacity-40">tout</button>
                    <button onClick={() => toutLigne(g, false)} disabled={d.toutPermisParRole}
                      className="text-[10px] px-1 text-red-500 disabled:opacity-40">rien</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {groupes.length === 0 && (
          <div className="px-4 py-6 text-center text-xs text-[var(--text-secondary)]">
            Aucun écran ne correspond au filtre.
          </div>
        )}
      </div>

      <p className="text-xs text-[var(--text-secondary)]">
        Sans droit enregistré, seul l&apos;accès à l&apos;écran est accordé par défaut :
        les actions sensibles (créer, modifier, supprimer, voir les valeurs) doivent être
        cochées explicitement. Les cases en jaune sont modifiées et pas encore enregistrées.
      </p>
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
