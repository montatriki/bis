"use client";
import { useState } from "react";
import { Lock, Loader2, Check, AlertTriangle, Eye, EyeOff } from "lucide-react";

// Changer mot de passe — tuile « CHANGER MOT DE PASSE » de l'app commerciale.

export default function MotDePassePage() {
  const [actuel, setActuel] = useState("");
  const [nouveau, setNouveau] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [voir, setVoir] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const flash = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 6000);
  };

  const envoyer = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await fetch("/api/mot-de-passe", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actuel, nouveau, confirmation }),
      });
      const d = await r.json();
      if (!r.ok) return flash(d.error ?? "Échec", false);
      flash(d.message ?? "Mot de passe modifié");
      setActuel(""); setNouveau(""); setConfirmation("");
    } finally { setBusy(false); }
  };

  const cls = "w-full px-3 py-2 rounded-xl border border-slate-200 text-sm";
  // Confirmation saisie mais différente : on le signale avant l'envoi.
  const discordance = confirmation.length > 0 && nouveau !== confirmation;

  return (
    <div className="space-y-4 max-w-md">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Changer le mot de passe</h1>
        <p className="text-slate-500 text-sm">Vous devez connaître votre mot de passe actuel.</p>
      </div>

      {toast && (
        <div className={`px-4 py-2 rounded-xl text-sm font-medium flex items-start gap-2 ${
          toast.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
        }`}>
          {toast.ok ? <Check size={15} className="mt-0.5 shrink-0" /> : <AlertTriangle size={15} className="mt-0.5 shrink-0" />}
          <span>{toast.msg}</span>
        </div>
      )}

      <form onSubmit={envoyer} className="bg-white rounded-2xl border border-slate-100 p-5 space-y-3">
        <label className="block">
          <span className="block text-xs text-slate-500 mb-1">Mot de passe actuel *</span>
          <input type={voir ? "text" : "password"} value={actuel} required autoComplete="current-password"
            onChange={(e) => setActuel(e.target.value)} className={cls} />
        </label>
        <label className="block">
          <span className="block text-xs text-slate-500 mb-1">Nouveau mot de passe *</span>
          <input type={voir ? "text" : "password"} value={nouveau} required autoComplete="new-password"
            onChange={(e) => setNouveau(e.target.value)} className={cls} />
        </label>
        <label className="block">
          <span className="block text-xs text-slate-500 mb-1">Confirmer le nouveau mot de passe *</span>
          <input type={voir ? "text" : "password"} value={confirmation} required autoComplete="new-password"
            onChange={(e) => setConfirmation(e.target.value)}
            className={`${cls} ${discordance ? "border-red-300" : ""}`} />
          {discordance && (
            <span className="text-xs text-red-500 mt-1 block">La confirmation ne correspond pas.</span>
          )}
        </label>

        <button type="button" onClick={() => setVoir((v) => !v)}
          className="text-xs text-slate-500 flex items-center gap-1.5">
          {voir ? <EyeOff size={13} /> : <Eye size={13} />} {voir ? "Masquer" : "Afficher"} les mots de passe
        </button>

        <button type="submit" disabled={busy || discordance || !actuel || !nouveau}
          className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 disabled:opacity-40 flex items-center justify-center gap-2">
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Lock size={15} />} Modifier
        </button>
      </form>
    </div>
  );
}
