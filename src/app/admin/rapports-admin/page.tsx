"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { BarChart3, TrendingUp, Users, Package, Wallet, Truck, Download, Printer, Calendar } from "lucide-react";
import { CAAreaChart, CommercialBarChart } from "@/components/charts/CAChart";
import { MONTHLY_CA, COMMERCIAL_PERFORMANCE } from "@/lib/dummy-data";

const REPORTS = [
  { id: "ca_mensuel", title: "CA Mensuel Global", icon: TrendingUp, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200", desc: "Évolution du chiffre d'affaires sur 12 mois" },
  { id: "soldes_clients", title: "État des soldes clients", icon: Users, color: "text-red-600", bg: "bg-red-50", border: "border-red-200", desc: "Créances par client, ancienneté, risque" },
  { id: "stock_rapport", title: "Valorisation du stock", icon: Package, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200", desc: "Valeur totale par dépôt et famille" },
  { id: "tresorerie_rapport", title: "Balance de trésorerie", icon: Wallet, color: "text-purple-600", bg: "bg-purple-50", border: "border-purple-200", desc: "Entrées/sorties/soldes tous comptes" },
  { id: "perf_commerciaux", title: "Performance commerciaux", icon: TrendingUp, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200", desc: "CA, visites, recouvrement par commercial" },
  { id: "parc_km", title: "Kilométrage & charges véhicules", icon: Truck, color: "text-slate-600", bg: "bg-slate-50", border: "border-slate-200", desc: "Coûts et performance de la flotte" },
];

const CHARGES_ANNUELLES = [
  { cat: "Accompte sur salaire", vals: [0,0,0,0,820,0,0,0,0,0,0,0], total: 820 },
  { cat: "Charge de bureau", vals: [0,0,0,0,0,0,0,0,0,0,0,0], total: 0 },
  { cat: "TRANSPORT", vals: [0,0,0,0,0,0,0,0,0,0,0,0], total: 0 },
  { cat: "BON DIESEL", vals: [1200,980,1450,1100,1380,0,0,0,0,0,0,0], total: 6110 },
  { cat: "Fournisseur", vals: [33329,92414,276533,104910,5617,0,0,0,0,0,0,0], total: 512803 },
];

export default function RapportsAdminPage() {
  const [activeReport, setActiveReport] = useState("ca_mensuel");
  const [year, setYear] = useState("2026");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Rapports & Analyses</h1>
          <p className="text-slate-500 text-sm">Statistiques globales — exercice {year}</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={year} onChange={e => setYear(e.target.value)} className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none bg-white">
            {["2026","2025","2024"].map(y => <option key={y}>{y}</option>)}
          </select>
          <button className="flex items-center gap-1.5 border border-slate-200 text-slate-600 px-3 py-2 rounded-xl text-sm hover:bg-slate-50 transition"><Printer size={14} /> Imprimer</button>
          <button className="flex items-center gap-1.5 bg-emerald-600 text-white px-3 py-2 rounded-xl text-sm font-medium hover:bg-emerald-500 transition"><Download size={14} /> Excel</button>
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Report list */}
        <div className="space-y-2">
          {REPORTS.map(r => (
            <button key={r.id} onClick={() => setActiveReport(r.id)}
              className={`w-full text-left p-3 rounded-xl border-2 transition ${activeReport === r.id ? `${r.border} bg-white shadow-sm` : "border-transparent hover:border-slate-200 hover:bg-white"}`}>
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 ${r.bg} rounded-lg flex items-center justify-center flex-shrink-0`}><r.icon size={15} className={r.color} /></div>
                <div><div className="font-semibold text-slate-800 text-sm leading-tight">{r.title}</div><div className="text-slate-400 text-xs mt-0.5 leading-tight">{r.desc}</div></div>
              </div>
            </button>
          ))}
        </div>

        {/* Report content */}
        <div className="lg:col-span-3 space-y-4">
          {activeReport === "ca_mensuel" && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-800">Évolution CA mensuel — {year}</h3>
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">12 mois</span>
              </div>
              <CAAreaChart />
              <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-100">
                {[["CA Total","339 400 TND","text-blue-700"],["Encaissements","283 500 TND","text-emerald-700"],["Objectif","326 000 TND","text-slate-600"]].map(([l,v,c]) => (
                  <div key={l} className="bg-slate-50 rounded-xl p-3"><div className={`font-black ${c}`}>{v}</div><div className="text-slate-400 text-xs">{l}</div></div>
                ))}
              </div>
            </div>
          )}

          {activeReport === "perf_commerciaux" && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
              <h3 className="font-bold text-slate-800">Performance commerciaux — Mai {year}</h3>
              <CommercialBarChart />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-slate-100">{["Commercial","CA","Objectif","Taux","Clients","Visites"].map(h => <th key={h} className="text-left py-2 px-2 text-xs font-semibold text-slate-500 uppercase">{h}</th>)}</tr></thead>
                  <tbody className="divide-y divide-slate-50">
                    {COMMERCIAL_PERFORMANCE.map(c => (
                      <tr key={c.name} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-2 font-semibold text-slate-800">{c.name}</td>
                        <td className="py-3 px-2 font-bold text-blue-700">{c.ca.toLocaleString()} TND</td>
                        <td className="py-3 px-2 text-slate-500">{c.objectif.toLocaleString()}</td>
                        <td className="py-3 px-2"><span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.taux >= 100 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{c.taux}%</span></td>
                        <td className="py-3 px-2 text-slate-600">{c.clients}</td>
                        <td className="py-3 px-2 text-slate-600">{c.visites}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeReport === "stock_rapport" && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-800">Dépenses de l'année {year}</h3>
                <span className="text-xs text-slate-500">Statistiques des charges</span>
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-100">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr><th className="text-left px-3 py-2 font-semibold text-slate-500">Dépenses</th>{["Jan","Fév","Mar","Avr","Mai","Juin","Juil","Août","Sep","Oct","Nov","Déc","Total"].map(m => <th key={m} className="px-2 py-2 text-right font-semibold text-slate-500 whitespace-nowrap">{m}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {CHARGES_ANNUELLES.map(row => (
                      <tr key={row.cat} className="hover:bg-slate-50 transition">
                        <td className="px-3 py-2 font-medium text-slate-700 whitespace-nowrap">{row.cat}</td>
                        {row.vals.map((v, i) => <td key={i} className="px-2 py-2 text-right text-slate-600">{v > 0 ? v.toLocaleString() : "0"}</td>)}
                        <td className="px-2 py-2 text-right font-bold text-slate-800">{row.total.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!["ca_mensuel","perf_commerciaux","stock_rapport"].includes(activeReport) && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center text-slate-400">
              <BarChart3 size={40} className="mx-auto mb-3 opacity-20" />
              <div className="font-semibold text-slate-600">{REPORTS.find(r => r.id === activeReport)?.title}</div>
              <p className="text-sm mt-1 mb-4">Rapport disponible — cliquez pour générer</p>
              <button className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-blue-500 transition text-sm">Générer le rapport</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
