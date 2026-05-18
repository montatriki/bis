"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Car, AlertTriangle, Wrench, BarChart3, Plus, MapPin, Fuel } from "lucide-react";
import { DEMO_VEHICLES } from "@/lib/dummy-data";

const VEHICLES_FULL = [
  { ...DEMO_VEHICLES[0], assurance: "2027-01-15", visite: "2026-12-20", taxe: "2026-05-06", km: 124580, repairs: 3 },
  { ...DEMO_VEHICLES[1], assurance: "2026-08-10", visite: "2026-07-15", taxe: "2026-06-01", km: 98340, repairs: 1 },
  { ...DEMO_VEHICLES[2], assurance: "2026-12-27", visite: "2026-12-46", taxe: "2026-05-06", km: 156230, repairs: 5 },
  { ...DEMO_VEHICLES[3], assurance: "2026-05-09", visite: "2027-05-38", taxe: "2026-02-06", km: 210400, repairs: 7 },
  { ...DEMO_VEHICLES[4], assurance: "2026-05-43", visite: "2027-05-36", taxe: null, km: 87600, repairs: 2 },
];

const STATUS_STYLE: Record<string, { label: string; dot: string; badge: string }> = {
  active: { label: "En mission", dot: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-700" },
  moving: { label: "En déplacement", dot: "bg-blue-500", badge: "bg-blue-100 text-blue-700" },
  stopped: { label: "Arrêté", dot: "bg-amber-500", badge: "bg-amber-100 text-amber-700" },
  offline: { label: "Hors ligne", dot: "bg-red-400", badge: "bg-red-100 text-red-600" },
};

export default function ParcRoulantPage() {
  const [selected, setSelected] = useState<typeof VEHICLES_FULL[0] | null>(null);

  const alertCount = VEHICLES_FULL.filter(v => {
    const today = new Date("2026-05-17");
    const assur = v.assurance ? new Date(v.assurance) : null;
    return assur && (assur.getTime() - today.getTime()) < 30 * 24 * 60 * 60 * 1000;
  }).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Parc Roulant</h1>
          <p className="text-slate-500 text-sm">{VEHICLES_FULL.length} véhicules · {alertCount} alertes administratives</p>
        </div>
        <div className="flex gap-3">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2 text-center">
            <div className="text-lg font-bold text-emerald-700">{VEHICLES_FULL.filter(v => v.status !== "offline").length}</div>
            <div className="text-xs text-emerald-500">Actifs</div>
          </div>
          {alertCount > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2 text-center flex items-center gap-2">
              <AlertTriangle size={14} className="text-red-500" />
              <div><div className="text-lg font-bold text-red-700">{alertCount}</div><div className="text-xs text-red-500">Alertes</div></div>
            </div>
          )}
          <button className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-500 transition"><Plus size={14} /> Ajouter</button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>{["Matricule","Marque / Modèle","Année","Chauffeur","Statut","Fin Assurance","Fin Visite","Taxe","Km","CA","Actions"].map(h => (
                <th key={h} className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {VEHICLES_FULL.map((v, i) => {
                const s = STATUS_STYLE[v.status as keyof typeof STATUS_STYLE];
                const assurAlert = v.assurance && new Date(v.assurance) < new Date("2026-07-17");
                return (
                  <motion.tr key={v.plate} className="hover:bg-slate-50 transition cursor-pointer" onClick={() => setSelected(v === selected ? null : v)}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}>
                    <td className="px-3 py-3 font-mono text-xs font-bold text-slate-800">{v.plate}</td>
                    <td className="px-3 py-3 font-medium text-slate-700">{v.brand} {v.model}</td>
                    <td className="px-3 py-3 text-slate-500">{v.year}</td>
                    <td className="px-3 py-3 text-slate-700">{v.driver}</td>
                    <td className="px-3 py-3"><span className={`text-xs px-2.5 py-1 rounded-full font-semibold flex items-center gap-1.5 w-fit ${s.badge}`}><span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />{s.label}</span></td>
                    <td className="px-3 py-3"><span className={`text-xs font-medium ${assurAlert ? "text-red-600 font-bold" : "text-slate-600"}`}>{v.assurance || "—"}{assurAlert && " ⚠"}</span></td>
                    <td className="px-3 py-3 text-slate-500 text-xs">{v.visite || "—"}</td>
                    <td className="px-3 py-3 text-slate-500 text-xs">{v.taxe || "—"}</td>
                    <td className="px-3 py-3 text-slate-700 font-medium">{v.km.toLocaleString()}</td>
                    <td className="px-3 py-3 font-bold text-blue-700">{(v.ca / 1000).toFixed(1)}k</td>
                    <td className="px-3 py-3">
                      <div className="flex gap-1">
                        {[Wrench, BarChart3, MapPin, Fuel].map((Icon, j) => (
                          <button key={j} className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"><Icon size={12} /></button>
                        ))}
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <motion.div className="bg-white rounded-2xl border border-blue-200 shadow-sm p-5"
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Car size={16} className="text-blue-600" /> Détail — {selected.plate}</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Véhicule", value: `${selected.brand} ${selected.model} (${selected.year})` },
              { label: "Chauffeur", value: selected.driver },
              { label: "Kilométrage", value: `${selected.km.toLocaleString()} km` },
              { label: "CA généré", value: `${selected.ca.toLocaleString()} TND` },
              { label: "Visites", value: `${selected.visited}/${selected.total}` },
              { label: "Interventions", value: `${selected.repairs} réparations` },
              { label: "Fin assurance", value: selected.assurance || "—" },
              { label: "Fin visite tech.", value: selected.visite || "—" },
            ].map(({ label, value }) => (
              <div key={label} className="bg-slate-50 rounded-xl p-3">
                <div className="text-xs text-slate-400 mb-1">{label}</div>
                <div className="font-semibold text-slate-800 text-sm">{value}</div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
