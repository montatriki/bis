"use client";
import { useState, useEffect, useCallback } from "react";
import { Package, RotateCcw, ArrowLeftRight, Loader2, Check, AlertTriangle, Truck } from "lucide-react";

// Stock camion et retours — sur la base (`StockDepot` + `/api/mouvements-depot`).
// Remplace un stock véhicule inventé (`Math.random()` sur 8 produits fictifs)
// par la vraie ventilation du stock à l'emplacement du véhicule.

type LigneStock = {
  refArt: string; designation: string | null; unite: string | null;
  quantite: number; pmp: number; valeur: number; horsReferentiel: boolean;
};
type Empl = { code: string; label: string };
type Mission = { id: number; vehicule: string | null; etat: string | null };

const fmt = (v: unknown) =>
  new Intl.NumberFormat("fr-TN", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(Number(v) || 0);
const fmtQ = (v: unknown) => new Intl.NumberFormat("fr-TN", { maximumFractionDigits: 3 }).format(Number(v) || 0);

const TABS = [
  { id: "inventaire", label: "Stock camion", icon: Package },
  { id: "retour", label: "Retour au dépôt", icon: RotateCcw },
  { id: "transfert", label: "Transfert", icon: ArrowLeftRight },
] as const;

export default function RetourStockPage() {
  const [tab, setTab] = useState<string>("inventaire");
  const [vehicules, setVehicules] = useState<Empl[]>([]);
  const [depots, setDepots] = useState<Empl[]>([]);
  const [vehicule, setVehicule] = useState("");
  const [lignes, setLignes] = useState<LigneStock[]>([]);
  const [valeur, setValeur] = useState(0);
  const [load, setLoad] = useState(true);
  const [qtes, setQtes] = useState<Record<string, string>>({});
  const [destination, setDestination] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const flash = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 6000);
  }, []);

  // Emplacements + véhicule de la tournée du jour, pour pré-sélectionner.
  useEffect(() => {
    Promise.all([
      fetch("/api/mouvements-depot?vue=emplacements").then((r) => r.json()),
      fetch(`/api/missions?vue=jour&date=${new Date().toISOString().slice(0, 10)}`).then((r) => r.json()),
    ])
      .then(([e, j]) => {
        setVehicules(e.vehicules ?? []);
        setDepots(e.depots ?? []);
        const m: Mission | null = j.mission ?? null;
        // Priorité au véhicule de la tournée du jour, puis à celui attribué au
        // commercial. Retomber sur le premier de la liste montrerait à chacun
        // le camion d'un collègue.
        const auto = m?.vehicule || e.vehiculeAttribue || "";
        setVehicule(auto);
        setDestination((e.depots ?? [])[0]?.code ?? "");
      })
      .catch(() => flash("Chargement des emplacements impossible", false));
  }, [flash]);

  const charger = useCallback(() => {
    // Sans véhicule sélectionné il n'y a rien à charger, mais on passe quand
    // même par la chaîne asynchrone : un setState synchrone dans l'effet
    // déclencherait un rendu en cascade.
    Promise.resolve()
      .then(async () => {
        if (!vehicule) return { lignes: [], valeurTotale: 0 };
        const r = await fetch(`/api/missions?vue=stock-vehicule&vehicule=${encodeURIComponent(vehicule)}`);
        return r.json();
      })
      .then((d) => {
        setLignes(d.lignes ?? []);
        setValeur(d.valeurTotale ?? 0);
        setQtes({});
      })
      .catch(() => flash("Chargement du stock impossible", false))
      .finally(() => setLoad(false));
  }, [vehicule, flash]);

  useEffect(charger, [charger]);

  // Lignes réellement saisies : un champ vide n'est pas un retour de zéro.
  const saisies = Object.entries(qtes)
    .filter(([, v]) => v !== "" && Number(v) > 0)
    .map(([refArt, v]) => {
      const l = lignes.find((x) => x.refArt === refArt);
      return { refArt, designation: l?.designation ?? null, quantite: Number(v) };
    });

  const envoyer = async (typeDoc: "BRT" | "BTV") => {
    if (!vehicule) return flash("Sélectionnez un véhicule", false);
    if (!destination) return flash("Sélectionnez une destination", false);
    if (saisies.length === 0) return flash("Saisissez au moins une quantité", false);

    setBusy(true);
    try {
      const r = await fetch("/api/mouvements-depot", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ typeDoc, source: vehicule, destination, lignes: saisies }),
      });
      const d = await r.json();
      if (!r.ok) return flash(d.error ?? "Échec", false);
      flash([d.message, ...(d.alertes ?? [])].filter(Boolean).join("\n"), (d.alertes ?? []).length === 0);
      charger();
    } finally { setBusy(false); }
  };

  const listeDest = tab === "transfert" ? vehicules.filter((v) => v.code !== vehicule) : depots;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Stock camion</h1>
          <p className="text-slate-500 text-sm">
            {lignes.length} article(s) embarqué(s) · valeur {fmt(valeur)} TND
          </p>
        </div>
        <label className="flex items-center gap-2">
          <Truck size={16} className="text-slate-400" />
          <select value={vehicule} onChange={(e) => setVehicule(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm">
            <option value="">— Véhicule —</option>
            {vehicules.map((v) => <option key={v.code} value={v.code}>{v.label}</option>)}
          </select>
        </label>
      </div>

      {toast && (
        <div className={`px-4 py-2 rounded-xl text-sm font-medium flex items-start gap-2 ${
          toast.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
        }`}>
          {toast.ok ? <Check size={15} className="mt-0.5 shrink-0" /> : <AlertTriangle size={15} className="mt-0.5 shrink-0" />}
          <span className="whitespace-pre-line">{toast.msg}</span>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => { setTab(t.id); setQtes({}); }}
            className={`px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition ${
              tab === t.id ? "bg-blue-600 text-white" : "bg-white border border-slate-200 text-slate-600"
            }`}>
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {tab !== "inventaire" && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap gap-3 items-end">
          <label className="block">
            <span className="block text-xs text-slate-500 mb-1">
              {tab === "retour" ? "Dépôt de destination" : "Véhicule de destination"}
            </span>
            <select value={destination} onChange={(e) => setDestination(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-sm min-w-48">
              <option value="">— Sélectionner —</option>
              {listeDest.map((d) => <option key={d.code} value={d.code}>{d.label}</option>)}
            </select>
          </label>
          <button onClick={() => envoyer(tab === "retour" ? "BRT" : "BTV")}
            disabled={busy || saisies.length === 0 || !destination}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-blue-600 disabled:opacity-40 flex items-center gap-2">
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            {tab === "retour" ? "Valider le retour" : "Valider le transfert"}
          </button>
          <div className="text-xs text-slate-500 flex-1 min-w-40">
            {saisies.length} ligne(s) saisie(s).{" "}
            {tab === "retour"
              ? "Le retour remet la marchandise en stock global."
              : "Un transfert entre véhicules ne change pas le stock global."}
          </div>
        </div>
      )}

      {load ? (
        <div className="py-16 text-center text-slate-400"><Loader2 className="animate-spin inline" size={22} /></div>
      ) : lignes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center">
          <Package size={32} className="mx-auto mb-3 text-slate-200" />
          <div className="text-sm text-slate-500">
            {vehicule ? "Aucun article dans ce véhicule." : "Sélectionnez un véhicule."}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Le chargement se fait par un bon de sortie depuis le module Gestion Tourner.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr className="text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 text-left font-semibold">Référence</th>
                  <th className="px-4 py-3 text-left font-semibold">Désignation</th>
                  <th className="px-4 py-3 text-right font-semibold">En camion</th>
                  <th className="px-4 py-3 text-right font-semibold">Valeur</th>
                  {tab !== "inventaire" && (
                    <th className="px-4 py-3 text-right font-semibold">
                      {tab === "retour" ? "À retourner" : "À transférer"}
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {lignes.map((l) => (
                  <tr key={l.refArt} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-mono text-xs">
                      {l.refArt}
                      {l.horsReferentiel && (
                        <span className="ml-1 text-amber-600" title="Absent du référentiel articles">⚠</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">{l.designation ?? "—"}</td>
                    <td className="px-4 py-2.5 text-right font-semibold">
                      {fmtQ(l.quantite)} <span className="text-xs text-slate-400">{l.unite ?? ""}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-500">{fmt(l.valeur)}</td>
                    {tab !== "inventaire" && (
                      <td className="px-4 py-2.5 text-right">
                        <input type="number" step="0.001" min={0} max={l.quantite}
                          value={qtes[l.refArt] ?? ""}
                          onChange={(e) => setQtes({ ...qtes, [l.refArt]: e.target.value })}
                          placeholder="0"
                          className="w-24 px-2 py-1 rounded-lg border border-slate-200 text-sm text-right" />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 border-t border-slate-100">
                  <td colSpan={3} className="px-4 py-3 font-semibold text-slate-700">Valeur totale embarquée</td>
                  <td className="px-4 py-3 text-right font-bold text-blue-600">{fmt(valeur)} TND</td>
                  {tab !== "inventaire" && <td />}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
