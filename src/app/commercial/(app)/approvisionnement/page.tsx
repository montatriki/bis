"use client";
import { useState, useEffect, useCallback } from "react";
import { PackagePlus, Loader2, Check, AlertTriangle, Search, Send, Trash2, Truck } from "lucide-react";

// Bon d'approvisionnement — tuile « BON D'APPROVISIONNEMENT » de l'app
// commerciale : demande de réassort du stock camion auprès du dépôt.
// Le stock ne bouge qu'au service de la demande (bon de sortie BST).

type Bon = {
  id: number; reference: string; vehicule: string | null; depot: string | null;
  etat: string; dateDemande: string; dateService: string | null;
  refMouvement: string | null; observation: string | null;
  nbLignes: number; totalDemande: number; totalServi: number;
};
type Suggestion = {
  refArt: string; designation: string; unite: string | null;
  enStock: number; enCamion: number;
};
type Empl = { code: string; label: string };

const fmtQ = (v: unknown) => new Intl.NumberFormat("fr-TN", { maximumFractionDigits: 3 }).format(Number(v) || 0);
const fmtDate = (v: unknown) => (v ? new Date(String(v)).toLocaleDateString("fr-FR") : "—");

const ETAT_CFG: Record<string, { bg: string; text: string }> = {
  "Demandé": { bg: "bg-amber-50", text: "text-amber-700" },
  "Servi":   { bg: "bg-emerald-50", text: "text-emerald-700" },
  "Refusé":  { bg: "bg-slate-100", text: "text-slate-500" },
};

export default function ApprovisionnementPage() {
  const [rows, setRows] = useState<Bon[]>([]);
  const [load, setLoad] = useState(true);
  const [nouveau, setNouveau] = useState(false);
  const [filtre, setFiltre] = useState("Tous");
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const flash = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 7000);
  }, []);

  const charger = useCallback(() => {
    fetch(`/api/approvisionnement?vue=liste&etat=${filtre}`)
      .then((r) => r.json())
      .then((d) => setRows(d.rows ?? []))
      .catch(() => flash("Chargement impossible", false))
      .finally(() => setLoad(false));
  }, [filtre, flash]);

  useEffect(charger, [charger]);

  const supprimer = async (b: Bon) => {
    if (!confirm(`Supprimer le bon ${b.reference} ?`)) return;
    const r = await fetch(`/api/approvisionnement?id=${b.id}`, { method: "DELETE" });
    const d = await r.json();
    flash(d.message ?? d.error, r.ok);
    if (r.ok) charger();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Bons d&apos;approvisionnement</h1>
          <p className="text-slate-500 text-sm">Demandes de réassort du stock camion</p>
        </div>
        <div className="flex gap-2 items-center">
          <select value={filtre} onChange={(e) => setFiltre(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm">
            <option value="Tous">Tous les états</option>
            <option value="Demandé">Demandé</option>
            <option value="Servi">Servi</option>
            <option value="Refusé">Refusé</option>
          </select>
          <button onClick={() => setNouveau(true)}
            className="px-3 py-2 rounded-xl text-sm font-semibold text-white bg-blue-600 flex items-center gap-1.5">
            <PackagePlus size={15} /> Nouvelle demande
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

      {nouveau && (
        <Formulaire onFlash={flash} onClose={(fait) => { setNouveau(false); if (fait) charger(); }} />
      )}

      {load ? (
        <div className="py-16 text-center text-slate-400"><Loader2 className="animate-spin inline" size={22} /></div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center">
          <PackagePlus size={32} className="mx-auto mb-3 text-slate-200" />
          <div className="text-sm text-slate-500">Aucune demande de réassort.</div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr className="text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 text-left font-semibold">Référence</th>
                  <th className="px-4 py-3 text-left font-semibold">Véhicule</th>
                  <th className="px-4 py-3 text-left font-semibold">Dépôt</th>
                  <th className="px-4 py-3 text-left font-semibold">Demandé le</th>
                  <th className="px-4 py-3 text-right font-semibold">Lignes</th>
                  <th className="px-4 py-3 text-right font-semibold">Qté demandée</th>
                  <th className="px-4 py-3 text-right font-semibold">Qté servie</th>
                  <th className="px-4 py-3 text-center font-semibold">État</th>
                  <th className="w-12" />
                </tr>
              </thead>
              <tbody>
                {rows.map((b) => {
                  const cfg = ETAT_CFG[b.etat] ?? ETAT_CFG["Demandé"];
                  return (
                    <tr key={b.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-mono text-xs">
                        {b.reference}
                        {b.refMouvement && (
                          <div className="text-[10px] text-emerald-600">→ {b.refMouvement}</div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs">{b.vehicule ?? "—"}</td>
                      <td className="px-4 py-2.5 text-xs">{b.depot ?? "—"}</td>
                      <td className="px-4 py-2.5 text-xs">{fmtDate(b.dateDemande)}</td>
                      <td className="px-4 py-2.5 text-right text-xs">{b.nbLignes}</td>
                      <td className="px-4 py-2.5 text-right">{fmtQ(b.totalDemande)}</td>
                      <td className="px-4 py-2.5 text-right font-semibold"
                        style={{ color: b.totalServi > 0 ? "#16a34a" : undefined }}>
                        {fmtQ(b.totalServi)}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.bg} ${cfg.text}`}>
                          {b.etat}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {b.etat !== "Servi" && (
                          <button onClick={() => supprimer(b)} className="text-red-500 p-1">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Formulaire({ onFlash, onClose }: {
  onFlash: (m: string, ok?: boolean) => void; onClose: (fait: boolean) => void;
}) {
  const [depots, setDepots] = useState<Empl[]>([]);
  const [vehicules, setVehicules] = useState<Empl[]>([]);
  const [depot, setDepot] = useState("");
  const [vehicule, setVehicule] = useState("");
  const [q, setQ] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [qtes, setQtes] = useState<Record<string, string>>({});
  const [observation, setObservation] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/mouvements-depot?vue=emplacements").then((r) => r.json()),
      fetch(`/api/missions?vue=jour&date=${new Date().toISOString().slice(0, 10)}`).then((r) => r.json()),
    ])
      .then(([e, j]) => {
        setDepots(e.depots ?? []);
        setVehicules(e.vehicules ?? []);
        setDepot((e.depots ?? [])[0]?.code ?? "");
        setVehicule(j.mission?.vehicule || (e.vehicules ?? [])[0]?.code || "");
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      const url = `/api/approvisionnement?vue=suggestions${q ? `&q=${encodeURIComponent(q)}` : ""}`
        + (vehicule ? `&vehicule=${encodeURIComponent(vehicule)}` : "");
      fetch(url).then((r) => r.json()).then((d) => setSuggestions(d.rows ?? [])).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [q, vehicule]);

  const lignes = Object.entries(qtes)
    .filter(([, v]) => v !== "" && Number(v) > 0)
    .map(([refArt, v]) => ({ refArt, qteDemandee: Number(v) }));

  const envoyer = async () => {
    if (lignes.length === 0) return onFlash("Saisissez au moins une quantité", false);
    setBusy(true);
    try {
      const r = await fetch("/api/approvisionnement", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vue: "bon", depot, vehicule, observation, lignes }),
      });
      const d = await r.json();
      if (!r.ok) return onFlash(d.error ?? "Échec", false);
      onFlash([d.message, ...(d.alertes ?? [])].filter(Boolean).join("\n"), (d.alertes ?? []).length === 0);
      onClose(true);
    } finally { setBusy(false); }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
      <div className="grid sm:grid-cols-3 gap-3">
        <label className="block">
          <span className="block text-xs text-slate-500 mb-1">Dépôt sollicité</span>
          <select value={depot} onChange={(e) => setDepot(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm">
            <option value="">— Sélectionner —</option>
            {depots.map((d) => <option key={d.code} value={d.code}>{d.label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="block text-xs text-slate-500 mb-1">Véhicule à recharger</span>
          <select value={vehicule} onChange={(e) => setVehicule(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm">
            <option value="">— Sélectionner —</option>
            {vehicules.map((v) => <option key={v.code} value={v.code}>{v.label}</option>)}
          </select>
        </label>
        <div className="relative">
          <span className="block text-xs text-slate-500 mb-1">Rechercher un article</span>
          <Search size={13} className="absolute left-3 top-8 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Référence ou désignation…"
            className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-sm" />
        </div>
      </div>

      <div className="border border-slate-200 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 sticky top-0">
            <tr className="text-[11px] uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2 text-left font-semibold">Article</th>
              <th className="px-3 py-2 text-right font-semibold">Dépôt</th>
              <th className="px-3 py-2 text-right font-semibold">En camion</th>
              <th className="px-3 py-2 text-right font-semibold">À charger</th>
            </tr>
          </thead>
          <tbody>
            {suggestions.length === 0 && (
              <tr><td colSpan={4} className="px-3 py-6 text-center text-xs text-slate-400">
                Aucun article. Affinez la recherche.
              </td></tr>
            )}
            {suggestions.map((a) => (
              <tr key={a.refArt}
                className={`border-b border-slate-50 ${qtes[a.refArt] ? "bg-blue-50/40" : ""}`}>
                <td className="px-3 py-1.5">
                  <div className="text-slate-700">{a.designation}</div>
                  <div className="text-[10px] text-slate-400 font-mono">{a.refArt}{a.unite ? ` · ${a.unite}` : ""}</div>
                </td>
                <td className="px-3 py-1.5 text-right text-xs"
                  style={{ color: a.enStock <= 0 ? "#dc2626" : undefined }}>
                  {fmtQ(a.enStock)}
                </td>
                <td className="px-3 py-1.5 text-right text-xs text-slate-500">{fmtQ(a.enCamion)}</td>
                <td className="px-3 py-1.5 text-right">
                  <input type="number" step="0.001" min={0} value={qtes[a.refArt] ?? ""}
                    onChange={(e) => setQtes({ ...qtes, [a.refArt]: e.target.value })}
                    placeholder="0"
                    className="w-24 px-2 py-1 rounded-lg border border-slate-200 text-sm text-right" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <input value={observation} onChange={(e) => setObservation(e.target.value)}
        placeholder="Observation (facultatif)"
        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" />

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-xs text-slate-500 flex items-center gap-1.5">
          <Truck size={13} /> {lignes.length} article(s) demandé(s).
          Le stock ne bougera qu&apos;au service de la demande par le dépôt.
        </div>
        <div className="flex gap-2">
          <button onClick={envoyer} disabled={busy || lignes.length === 0}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-blue-600 disabled:opacity-40 flex items-center gap-2">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Envoyer la demande
          </button>
          <button onClick={() => onClose(false)}
            className="px-4 py-2 rounded-xl text-sm font-semibold border border-slate-200 text-slate-600">
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
