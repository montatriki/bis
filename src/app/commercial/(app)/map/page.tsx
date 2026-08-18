"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { Navigation, CheckCircle, X, Loader2, MapPin, Phone, Check, AlertTriangle } from "lucide-react";

// Carte des clients — sur la base.
// 2 283 des 2 399 tiers portent des coordonnées GPS réelles : la carte les
// affiche, et met en évidence ceux de la tournée du jour. Les clients sans
// coordonnées sont exclus plutôt que placés arbitrairement.

const ClientsMap = dynamic(() => import("@/components/map/ClientsMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-slate-100 rounded-2xl animate-pulse flex items-center justify-center text-slate-400">
      Chargement de la carte...
    </div>
  ),
});

export type ClientGeo = {
  id: number; raisonSocial: string | null; ville: string | null; gouvernorat: string | null;
  tel: string | null; latitude: number; longitude: number; soldeFin: number;
  dansTournee: boolean; etatVisite: string | null; numOrdre: number | null;
};

const fmt = (v: unknown) =>
  new Intl.NumberFormat("fr-TN", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(Number(v) || 0);

export default function CommercialMapPage() {
  const [rows, setRows] = useState<ClientGeo[]>([]);
  const [gouvernorats, setGouvernorats] = useState<string[]>([]);
  const [filtre, setFiltre] = useState("Tous");
  const [seulTournee, setSeulTournee] = useState(false);
  const [load, setLoad] = useState(true);
  const [sel, setSel] = useState<ClientGeo | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const flash = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 5000);
  }, []);

  const charger = useCallback(() => {
    fetch(`/api/missions?vue=geo&gouvernorat=${encodeURIComponent(filtre)}`)
      .then((r) => r.json())
      .then((d) => {
        setRows(d.rows ?? []);
        setGouvernorats(d.gouvernorats ?? []);
      })
      .catch(() => flash("Chargement impossible", false))
      .finally(() => setLoad(false));
  }, [filtre, flash]);

  useEffect(charger, [charger]);

  const affiches = useMemo(
    () => (seulTournee ? rows.filter((r) => r.dansTournee) : rows),
    [rows, seulTournee]
  );
  const enTournee = rows.filter((r) => r.dansTournee).length;
  const debiteurs = affiches.filter((r) => r.soldeFin > 0).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Carte clients</h1>
          <p className="text-slate-500 text-sm">
            {affiches.length} client(s) géolocalisé(s)
            {enTournee > 0 && ` · ${enTournee} dans la tournée du jour`}
          </p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <select value={filtre} onChange={(e) => setFiltre(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm">
            <option value="Tous">Tous les gouvernorats</option>
            {gouvernorats.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
          {enTournee > 0 && (
            <label className="flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer">
              <input type="checkbox" checked={seulTournee} onChange={(e) => setSeulTournee(e.target.checked)} />
              Tournée du jour
            </label>
          )}
        </div>
      </div>

      {toast && (
        <div className={`px-4 py-2 rounded-xl text-sm font-medium flex items-start gap-2 ${
          toast.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
        }`}>
          {toast.ok ? <Check size={15} className="mt-0.5 shrink-0" /> : <AlertTriangle size={15} className="mt-0.5 shrink-0" />}
          <span>{toast.msg}</span>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <Kpi label="Clients affichés" value={String(affiches.length)} color="text-blue-600" bg="bg-blue-50" border="border-blue-200" />
        <Kpi label="Dans la tournée" value={String(enTournee)} color="text-emerald-600" bg="bg-emerald-50" border="border-emerald-200" />
        <Kpi label="Avec solde débiteur" value={String(debiteurs)} color="text-red-500" bg="bg-red-50" border="border-red-200" />
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden" style={{ height: 520 }}>
        {load ? (
          <div className="w-full h-full flex items-center justify-center text-slate-400">
            <Loader2 className="animate-spin" size={22} />
          </div>
        ) : affiches.length === 0 ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-2">
            <MapPin size={30} className="text-slate-200" />
            <span className="text-sm">Aucun client géolocalisé pour ce filtre.</span>
          </div>
        ) : (
          <ClientsMap clients={affiches} onSelect={setSel} />
        )}
      </div>

      <AnimatePresence>
        {sel && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-50 p-4"
            onClick={() => setSel(null)}>
            <motion.div initial={{ y: 30 }} animate={{ y: 0 }} exit={{ y: 30 }}
              className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4"
              onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-bold text-slate-800">{sel.raisonSocial ?? `Client ${sel.id}`}</div>
                  <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                    <MapPin size={11} /> {[sel.ville, sel.gouvernorat].filter(Boolean).join(", ") || "—"}
                  </div>
                </div>
                <button onClick={() => setSel(null)} className="text-slate-400"><X size={18} /></button>
              </div>

              {sel.dansTournee && (
                <div className="px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 text-xs flex items-center gap-2">
                  <CheckCircle size={13} />
                  Visite n° {sel.numOrdre} de la tournée du jour — {sel.etatVisite}
                </div>
              )}
              {sel.soldeFin > 0 && (
                <div className="px-3 py-2 rounded-xl bg-red-50 text-red-600 text-xs">
                  Solde débiteur : {fmt(sel.soldeFin)} TND
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                {sel.tel && (
                  <a href={`tel:${sel.tel}`}
                    className="px-3 py-2 rounded-xl text-sm font-semibold bg-slate-100 text-slate-700 text-center flex items-center justify-center gap-1.5">
                    <Phone size={14} /> Appeler
                  </a>
                )}
                <a href={`https://www.google.com/maps/dir/?api=1&destination=${sel.latitude},${sel.longitude}`}
                  target="_blank" rel="noopener noreferrer"
                  className="px-3 py-2 rounded-xl text-sm font-semibold bg-blue-600 text-white text-center flex items-center justify-center gap-1.5">
                  <Navigation size={14} /> Itinéraire
                </a>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Kpi({ label, value, color, bg, border }: {
  label: string; value: string; color: string; bg: string; border: string;
}) {
  return (
    <div className={`${bg} border ${border} rounded-2xl p-4`}>
      <div className={`text-xl font-bold ${color}`}>{value}</div>
      <div className="text-slate-500 text-xs mt-1">{label}</div>
    </div>
  );
}
