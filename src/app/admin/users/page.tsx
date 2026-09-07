"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Pencil, Trash2, Shield, TrendingUp, MapPin, ShoppingBag, Search, X, Loader2, Save, Copy, Check, KeyRound } from "lucide-react";
import { confirmer } from "@/lib/alertes";

type User = {
  id: string; name: string; login: string; email: string; role: string;
  isActive: boolean; phone: string | null; codeTiers: number | null;
  createdAt: string; nbDocuments: number; tiersNom: string | null;
};

const ROLE_CONFIG: Record<string, { color: string; icon: React.ElementType; label: string }> = {
  ADMIN: { color: "bg-slate-700", icon: Shield, label: "Admin" },
  MANAGER: { color: "bg-[color-mix(in_srgb,var(--accent-primary)_75%,#000)]", icon: TrendingUp, label: "Manager" },
  COMMERCIAL: { color: "bg-emerald-600", icon: MapPin, label: "Commercial" },
  CLIENT: { color: "bg-amber-600", icon: ShoppingBag, label: "Client" },
};

const fmtDate = (v: unknown) => (v ? new Date(String(v)).toLocaleDateString("fr-FR") : "—");

export default function UsersPage() {
  const [rows, setRows] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<User> | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/utilisateurs")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (!d.error) setRows(d.rows ?? []);
        setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [reload]);

  const flash = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3500); };

  async function remove(u: User) {
    if (!(await confirmer(`Supprimer le compte « ${u.name} » ?`, { danger: true }))) return;
    const r = await fetch(`/api/utilisateurs?id=${u.id}`, { method: "DELETE" }).then((x) => x.json());
    if (r.ok) { flash("Compte supprimé"); setReload((k) => k + 1); }
    else flash(r.error ?? "Échec", false);
  }

  const filtered = rows.filter((u) =>
    [u.name, u.login, u.email, u.role].some((v) => (v ?? "").toLowerCase().includes(search.toLowerCase()))
  );

  /**
   * Mot de passe fraîchement réinitialisé, par utilisateur. Les mots de passe
   * sont hachés (bcrypt) : celui-ci n'existe que le temps de l'afficher, il ne
   * sera plus jamais récupérable ensuite.
   */
  const [nouveauMdp, setNouveauMdp] = useState<Record<string, string>>({});
  /** Dernier élément copié, pour la confirmation visuelle. */
  const [copie, setCopie] = useState<string | null>(null);

  async function copier(texte: string, cle: string) {
    try {
      await navigator.clipboard.writeText(texte);
      setCopie(cle);
      setTimeout(() => setCopie((c) => (c === cle ? null : c)), 1800);
    } catch {
      setToast({ ok: false, msg: "Copie impossible sur ce navigateur" });
    }
  }

  /** Génère un nouveau mot de passe côté serveur et l'affiche une fois. */
  async function reinitialiser(u: User) {
    if (!(await confirmer(
      `Générer un nouveau mot de passe pour « ${u.name} » ? L'ancien cessera aussitôt de fonctionner.`,
    ))) return;
    try {
      const r = await fetch("/api/utilisateurs", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: u.id, reinitialiser: true }),
      });
      const d = await r.json();
      if (!r.ok) { setToast({ ok: false, msg: d.error ?? "Échec de la réinitialisation" }); return; }
      setNouveauMdp((m) => ({ ...m, [u.id]: d.motDePasse }));
      setToast({ ok: true, msg: `Nouveau mot de passe généré pour ${u.name} — transmettez-le maintenant` });
    } catch {
      setToast({ ok: false, msg: "Réseau indisponible" });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)]">Gestion des utilisateurs</h1>
          <p className="text-[var(--text-secondary)] text-sm">
            {loading ? "Chargement…" : `${rows.length} compte(s) · ${rows.filter((u) => u.isActive).length} actif(s)`}
          </p>
        </div>
        {/* Pleine largeur sur mobile : le bouton flottait à gauche, seul sur
            sa ligne, ce qui déséquilibrait l'écran. */}
        <motion.button onClick={() => setEditing({ role: "COMMERCIAL", isActive: true })}
          className="flex items-center justify-center gap-2 text-white h-11 px-4 rounded-xl font-bold transition shrink-0
                     shadow-[0_10px_24px_-14px_var(--shadow-hover)]"
          style={{ background: "linear-gradient(135deg, var(--accent-primary), color-mix(in srgb, var(--accent-primary) 78%, #000))" }}
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Plus size={16} /> Nouvel utilisateur
        </motion.button>
      </div>

      {toast && (
        <div className={`px-4 py-2 rounded-xl text-sm font-medium ${
          toast.ok ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-red-500/10 text-red-600"
        }`}>{toast.msg}</div>
      )}

      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          className="pl-9 pr-4 h-11 text-sm bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl w-full
                     transition focus:outline-none focus:border-[var(--accent-primary)]/50 focus:ring-2 focus:ring-[var(--accent-primary)]/12"
          placeholder="Rechercher un utilisateur…" />
      </div>

      {loading && <div className="py-16 text-center text-[var(--text-secondary)]"><Loader2 className="animate-spin inline" size={22} /></div>}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {!loading && filtered.map((u, i) => {
          const cfg = ROLE_CONFIG[u.role] ?? ROLE_CONFIG.CLIENT;
          const Icon = cfg.icon;
          return (
            <motion.div key={u.id} className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-primary)] shadow-sm p-4"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.04, 0.3) }}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-xl ${cfg.color} text-white flex items-center justify-center flex-shrink-0`}>
                    <Icon size={17} />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-[var(--text-primary)] text-sm truncate">{u.name}</div>
                    <div className="text-[var(--text-secondary)] text-xs truncate">@{u.login}</div>
                  </div>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                  u.isActive ? "bg-emerald-500/12 text-emerald-600" : "bg-slate-500/12 text-slate-500"
                }`}>{u.isActive ? "Actif" : "Inactif"}</span>
              </div>

              <div className="space-y-1.5 text-xs mb-3">
                <Row label="Rôle" value={cfg.label} />
                <Row label="Email" value={u.email} />
                {u.tiersNom && <Row label="Tiers rattaché" value={u.tiersNom} />}
                <Row label="Documents saisis" value={String(u.nbDocuments)} />
                <Row label="Créé le" value={fmtDate(u.createdAt)} />
              </div>

              {/* Identifiants : le login se copie tel quel. Le mot de passe est
                  haché en base — il n'existe en clair nulle part, donc rien à
                  afficher tant qu'on n'en a pas généré un nouveau. */}
              <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)] p-2.5 mb-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[9px] font-bold uppercase tracking-wide text-[var(--text-secondary)] opacity-70">Login</div>
                    <div className="font-mono text-[13px] font-bold text-[var(--text-primary)] truncate">{u.login}</div>
                  </div>
                  <button onClick={() => copier(u.login, `login-${u.id}`)}
                    title="Copier le login"
                    className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center border border-[var(--border-primary)]
                               text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition">
                    {copie === `login-${u.id}` ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                  </button>
                </div>

                {nouveauMdp[u.id] ? (
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--border-primary)]">
                    <div className="min-w-0">
                      <div className="text-[9px] font-bold uppercase tracking-wide text-amber-600">
                        Nouveau mot de passe — affiché une seule fois
                      </div>
                      <div className="font-mono text-[13px] font-bold text-[var(--text-primary)] truncate">
                        {nouveauMdp[u.id]}
                      </div>
                    </div>
                    <button onClick={() => copier(`Login : ${u.login}\nMot de passe : ${nouveauMdp[u.id]}`, `duo-${u.id}`)}
                      title="Copier le login et le mot de passe"
                      className="shrink-0 h-8 px-2.5 rounded-lg flex items-center gap-1.5 text-[11px] font-bold text-white
                                 bg-emerald-600 hover:bg-emerald-500 transition">
                      {copie === `duo-${u.id}` ? <Check size={12} /> : <Copy size={12} />}
                      <span className="hidden sm:inline">Copier</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--border-primary)]">
                    <div className="min-w-0">
                      <div className="text-[9px] font-bold uppercase tracking-wide text-[var(--text-secondary)] opacity-70">Mot de passe</div>
                      <div className="font-mono text-[13px] text-[var(--text-secondary)] tracking-widest">••••••••</div>
                    </div>
                    <button onClick={() => reinitialiser(u)}
                      title="Générer un nouveau mot de passe"
                      className="shrink-0 h-8 px-2.5 rounded-lg flex items-center gap-1.5 text-[11px] font-bold
                                 border border-[var(--border-primary)] text-[var(--text-secondary)]
                                 hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition">
                      <KeyRound size={12} /> <span className="hidden sm:inline">Réinitialiser</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button onClick={() => setEditing(u)}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs h-10 rounded-xl transition font-bold
                             bg-[var(--accent-light)] text-[var(--accent-primary)] border border-[var(--accent-primary)]/25 hover:brightness-97">
                  <Pencil size={13} /> Modifier
                </button>
                <button onClick={() => remove(u)} aria-label="Supprimer"
                  className="w-10 h-10 flex items-center justify-center text-xs bg-red-50 dark:bg-red-500/10 text-red-600 border border-red-200 dark:border-red-500/25 rounded-xl hover:bg-red-100 transition">
                  <Trash2 size={13} />
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {!loading && filtered.length === 0 && (
        <div className="py-16 text-center text-sm text-[var(--text-secondary)]">Aucun utilisateur trouvé.</div>
      )}

      <AnimatePresence>
        {editing && (
          <UserForm initial={editing} onClose={() => setEditing(null)}
            onSaved={(m) => { setEditing(null); flash(m); setReload((k) => k + 1); }} />
        )}
      </AnimatePresence>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-[var(--text-secondary)]">{label}</span>
      <span className="font-medium text-[var(--text-primary)] truncate" title={value}>{value}</span>
    </div>
  );
}

function UserForm({ initial, onClose, onSaved }: {
  initial: Partial<User>; onClose: () => void; onSaved: (msg: string) => void;
}) {
  const isNew = !initial.id;
  const [f, setF] = useState({
    name: initial.name ?? "", login: initial.login ?? "", email: initial.email ?? "",
    role: initial.role ?? "COMMERCIAL", phone: initial.phone ?? "",
    codeTiers: initial.codeTiers != null ? String(initial.codeTiers) : "",
    isActive: initial.isActive ?? true, password: "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const set = (k: string, v: unknown) => setF((p) => ({ ...p, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const r = await fetch("/api/utilisateurs", {
      method: isNew ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isNew ? f : { ...f, id: initial.id }),
    }).then((x) => x.json()).catch(() => ({ error: "réseau" }));
    setBusy(false);
    if (r.ok) onSaved(isNew ? "Compte créé" : "Compte modifié");
    else setErr(r.error ?? "Échec");
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.form onSubmit={submit} onClick={(e) => e.stopPropagation()}
        className="bg-[var(--bg-card)] border border-[var(--border-primary)] w-full sm:max-w-md
                   max-h-[92dvh] sm:max-h-[90vh] rounded-t-3xl sm:rounded-2xl flex flex-col overflow-hidden"
        initial={{ opacity: 0, y: 32, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 32, scale: 0.98 }}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border-primary)]">
          <div className="font-bold text-[var(--text-primary)]">{isNew ? "Nouvel utilisateur" : `Modifier ${initial.name}`}</div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-[var(--bg-primary)] text-[var(--text-secondary)]"><X size={18} /></button>
        </div>

        {err && <div className="mx-5 mt-3 px-3 py-2 rounded-lg bg-red-500/10 text-red-500 text-sm">{err}</div>}

        <div className="px-4 sm:px-5 py-4 space-y-3 overflow-y-auto flex-1 min-h-0">
          <Field label="Nom complet" req value={f.name} onChange={(v) => set("name", v)} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
            <Field label="Login" req value={f.login} onChange={(v) => set("login", v)} />
            <Field label="Téléphone" value={f.phone} onChange={(v) => set("phone", v)} />
          </div>
          <Field label="Email" req type="email" value={f.email} onChange={(v) => set("email", v)} />
          <Field label={isNew ? "Mot de passe" : "Nouveau mot de passe (vide = inchangé)"}
            req={isNew} type="password" value={f.password} onChange={(v) => set("password", v)} />

          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-[var(--text-secondary)]">Rôle</span>
            <select value={f.role} onChange={(e) => set("role", e.target.value)}
              className="px-2.5 py-1.5 text-sm bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg focus:outline-none">
              {Object.entries(ROLE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </label>

          {f.role === "CLIENT" && (
            <Field label="Code tiers ERP (rattachement client)" value={f.codeTiers} onChange={(v) => set("codeTiers", v)} />
          )}

          <label className="flex items-center gap-2 text-sm cursor-pointer pt-1">
            <input type="checkbox" checked={f.isActive} onChange={(e) => set("isActive", e.target.checked)}
              className="w-4 h-4" style={{ accentColor: "#2563eb" }} />
            <span className="text-[var(--text-primary)]">Compte actif</span>
          </label>
        </div>

        <div className="border-t border-[var(--border-primary)] shrink-0 bg-[var(--bg-card)]
                        px-4 sm:px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-3 flex gap-2 sm:justify-end">
          <button type="button" onClick={onClose}
            className="flex-1 sm:flex-none px-4 h-11 text-sm font-bold rounded-xl border border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition">Annuler</button>
          <button type="submit" disabled={busy}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 h-11 text-sm font-bold rounded-xl text-white disabled:opacity-60"
            style={{ background: "linear-gradient(135deg, var(--accent-primary), color-mix(in srgb, var(--accent-primary) 78%, #000))" }}>
            {busy ? <Loader2 className="animate-spin" size={15} /> : <Save size={15} />} Enregistrer
          </button>
        </div>
      </motion.form>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", req }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; req?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold text-[var(--text-secondary)]">
        {label}{req && <span className="text-red-500"> *</span>}
      </span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        className="px-2.5 py-1.5 text-sm bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg focus:outline-none" />
    </label>
  );
}
