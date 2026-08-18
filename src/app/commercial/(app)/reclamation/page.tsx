"use client";
import { useState, useEffect, useCallback } from "react";
import {
  MessageSquareWarning, Plus, Loader2, Check, AlertTriangle, X, Search, Send,
} from "lucide-react";

// Réclamations client — sur la base (`Reclamation`, table `reclamation_client` de A).
// Remplace 4 réclamations inventées ; la saisie est rattachée automatiquement à
// la tournée du jour, ce qui la fait remonter dans le bilan de journée.

type Reclam = {
  id: number; codeCli: number | null; clientNom: string | null;
  type: string; reclamation: string; etat: string; reponse: string | null;
  utilisateur: string | null; dateReclam: string; dateReponse: string | null;
  mission: { id: number; dateOrdre: string | null } | null;
};
type ClientRef = { id: number; raisonSocial: string | null; ville: string | null };

const fmtDate = (v: unknown) =>
  v ? new Date(String(v)).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

const ETAT_CFG: Record<string, { bg: string; text: string }> = {
  "Ouverte":  { bg: "bg-amber-50",   text: "text-amber-700" },
  "En cours": { bg: "bg-blue-50",    text: "text-blue-700" },
  "Résolue":  { bg: "bg-emerald-50", text: "text-emerald-700" },
  "Rejetée":  { bg: "bg-slate-100",  text: "text-slate-500" },
};

export default function ReclamationPage() {
  const [rows, setRows] = useState<Reclam[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [etats, setEtats] = useState<string[]>([]);
  const [filtre, setFiltre] = useState("Tous");
  const [load, setLoad] = useState(true);
  const [ajout, setAjout] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const flash = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 5000);
  }, []);

  const charger = useCallback(() => {
    fetch(`/api/reclamations?vue=liste&etat=${filtre}`)
      .then((r) => r.json())
      .then((d) => {
        setRows(d.rows ?? []);
        setTypes(d.types ?? []);
        setEtats(d.etats ?? []);
      })
      .catch(() => flash("Chargement impossible", false))
      .finally(() => setLoad(false));
  }, [filtre, flash]);

  useEffect(charger, [charger]);

  const majEtat = async (r: Reclam, etat: string) => {
    const res = await fetch("/api/reclamations", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: r.id, etat }),
    });
    const d = await res.json();
    if (!res.ok) return flash(d.error ?? "Échec", false);
    flash(d.message ?? "Mis à jour");
    charger();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Réclamations</h1>
          <p className="text-slate-500 text-sm">{rows.length} réclamation(s)</p>
        </div>
        <div className="flex gap-2 items-center">
          <select value={filtre} onChange={(e) => setFiltre(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm">
            <option value="Tous">Tous les états</option>
            {etats.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
          <button onClick={() => setAjout(true)}
            className="px-3 py-2 rounded-xl text-sm font-semibold text-white bg-blue-600 flex items-center gap-1.5">
            <Plus size={15} /> Nouvelle
          </button>
        </div>
      </div>

      {toast && (
        <div className={`px-4 py-2 rounded-xl text-sm font-medium flex items-start gap-2 ${
          toast.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
        }`}>
          {toast.ok ? <Check size={15} className="mt-0.5 shrink-0" /> : <AlertTriangle size={15} className="mt-0.5 shrink-0" />}
          <span className="whitespace-pre-line">{toast.msg}</span>
        </div>
      )}

      {ajout && (
        <Formulaire types={types} onFlash={flash}
          onClose={(fait) => { setAjout(false); if (fait) charger(); }} />
      )}

      {load ? (
        <div className="py-16 text-center text-slate-400"><Loader2 className="animate-spin inline" size={22} /></div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center">
          <MessageSquareWarning size={32} className="mx-auto mb-3 text-slate-200" />
          <div className="text-sm text-slate-500">Aucune réclamation enregistrée.</div>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const cfg = ETAT_CFG[r.etat] ?? ETAT_CFG["Ouverte"];
            return (
              <div key={r.id} className="bg-white rounded-2xl border border-slate-100 p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-800">
                        {r.clientNom ?? `Client ${r.codeCli ?? "?"}`}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{r.type}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.bg} ${cfg.text}`}>
                        {r.etat}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 mt-1.5">{r.reclamation}</p>
                    <div className="text-xs text-slate-400 mt-1.5 flex gap-3 flex-wrap">
                      <span>{fmtDate(r.dateReclam)}</span>
                      {r.utilisateur && <span>par {r.utilisateur}</span>}
                      {r.mission && <span>tournée n° {r.mission.id}</span>}
                      {r.dateReponse && <span>traitée le {fmtDate(r.dateReponse)}</span>}
                    </div>
                    {r.reponse && (
                      <div className="mt-2 px-3 py-2 rounded-xl bg-slate-50 text-xs text-slate-600">
                        <b>Réponse :</b> {r.reponse}
                      </div>
                    )}
                  </div>
                  {(r.etat === "Ouverte" || r.etat === "En cours") && (
                    <div className="flex gap-1.5 shrink-0">
                      {r.etat === "Ouverte" && (
                        <button onClick={() => majEtat(r, "En cours")}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 text-slate-600">
                          Prendre en charge
                        </button>
                      )}
                      <button onClick={() => majEtat(r, "Résolue")}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white">
                        Résoudre
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Formulaire({ types, onFlash, onClose }: {
  types: string[]; onFlash: (m: string, ok?: boolean) => void; onClose: (fait: boolean) => void;
}) {
  const [q, setQ] = useState("");
  const [clients, setClients] = useState<ClientRef[]>([]);
  const [codeCli, setCodeCli] = useState<number | null>(null);
  const [type, setType] = useState(types[0] ?? "Autre");
  const [texte, setTexte] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      fetch(`/api/missions?vue=clients${q ? `&q=${encodeURIComponent(q)}` : ""}`)
        .then((r) => r.json())
        .then((d) => setClients(d.rows ?? []))
        .catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const envoyer = async () => {
    if (!texte.trim()) return onFlash("Décrivez la réclamation", false);
    setBusy(true);
    try {
      const r = await fetch("/api/reclamations", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codeCli, type, reclamation: texte }),
      });
      const d = await r.json();
      if (!r.ok) return onFlash(d.error ?? "Échec", false);
      onFlash(d.message ?? "Enregistrée");
      onClose(true);
    } finally { setBusy(false); }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="relative">
          <span className="block text-xs text-slate-500 mb-1">Client</span>
          <Search size={13} className="absolute left-3 top-7 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher…"
            className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-sm mb-2" />
          <select value={codeCli ?? ""} onChange={(e) => setCodeCli(e.target.value ? Number(e.target.value) : null)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm">
            <option value="">— Sélectionner —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.raisonSocial ?? `Client ${c.id}`}{c.ville ? ` — ${c.ville}` : ""}
              </option>
            ))}
          </select>
        </div>
        <label className="block">
          <span className="block text-xs text-slate-500 mb-1">Type</span>
          <select value={type} onChange={(e) => setType(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm">
            {types.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
      </div>
      <label className="block">
        <span className="block text-xs text-slate-500 mb-1">Détail de la réclamation *</span>
        <textarea value={texte} onChange={(e) => setTexte(e.target.value)} rows={3}
          placeholder="Décrivez le problème constaté…"
          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm resize-y" />
      </label>
      <p className="text-xs text-slate-400">
        La réclamation est rattachée automatiquement à votre tournée du jour, si elle existe.
      </p>
      <div className="flex gap-2">
        <button onClick={envoyer} disabled={busy || !texte.trim()}
          className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-blue-600 disabled:opacity-40 flex items-center gap-2">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Enregistrer
        </button>
        <button onClick={() => onClose(false)}
          className="px-4 py-2 rounded-xl text-sm font-semibold border border-slate-200 text-slate-600 flex items-center gap-1.5">
          <X size={14} /> Annuler
        </button>
      </div>
    </div>
  );
}
