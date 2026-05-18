"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { BarChart3, Download, FileText, Calendar, TrendingUp, Users, Truck, AlertCircle } from "lucide-react";
import { CommercialBarChart } from "@/components/charts/CAChart";

const REPORTS = [
  {
    id: 1, title: "Performance commerciaux", icon: TrendingUp, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200",
    desc: "CA, visites, taux recouvrement, nouveaux clients", periods: ["Hebdomadaire", "Mensuel", "Trimestriel"],
    preview: [{ name: "Mokhtar", ca: "62 400", pct: 104, visits: 287 }, { name: "FOUED", ca: "71 300", pct: 119, visits: 312 }, { name: "HICHEM", ca: "54 200", pct: 90, visits: 241 }, { name: "Anis", ca: "48 900", pct: 89, visits: 198 }]
  },
  {
    id: 2, title: "Recouvrement & créances", icon: AlertCircle, color: "text-red-500", bg: "bg-red-50", border: "border-red-200",
    desc: "Ancienneté par tranche : <30j | 30–60j | 60–90j | >90j", periods: ["Hebdomadaire", "Mensuel"],
    preview: [{ tranche: "< 30 jours", montant: "12 450", nb: 8 }, { tranche: "30–60 jours", montant: "8 200", nb: 5 }, { tranche: "60–90 jours", montant: "6 100", nb: 3 }, { tranche: "> 90 jours", montant: "18 240", nb: 5 }]
  },
  {
    id: 3, title: "Tournées & kilométrage", icon: Truck, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200",
    desc: "Km parcourus, temps chez clients, efficacité route", periods: ["Hebdomadaire", "Mensuel"],
    preview: null
  },
  {
    id: 4, title: "Produits les plus vendus", icon: BarChart3, color: "text-purple-600", bg: "bg-purple-50", border: "border-purple-200",
    desc: "Top 10 produits par commercial et par région", periods: ["Mensuel", "Trimestriel"],
    preview: null
  },
  {
    id: 5, title: "Clients inactifs", icon: Users, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200",
    desc: "Sans achat depuis 30 / 60 / 90 jours", periods: ["Hebdomadaire", "Mensuel"],
    preview: null
  },
];

export default function RapportsPage() {
  const [selectedReport, setSelectedReport] = useState(REPORTS[0]);
  const [period, setPeriod] = useState("Mensuel");
  const [generating, setGenerating] = useState(false);

  function generate() {
    setGenerating(true);
    setTimeout(() => setGenerating(false), 1800);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Rapports & Exports</h1>
          <p className="text-slate-500 text-sm">Génération automatique — Mai 2026</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Report list */}
        <div className="space-y-3">
          {REPORTS.map((r, i) => {
            const Icon = r.icon;
            const active = selectedReport.id === r.id;
            return (
              <motion.div key={r.id} onClick={() => setSelectedReport(r)}
                className={`bg-white rounded-2xl border-2 shadow-sm p-4 cursor-pointer transition-all ${active ? `${r.border} ring-2 ring-offset-1 ring-blue-100` : "border-slate-100 hover:border-slate-200"}`}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                whileHover={{ y: -1 }}>
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 ${r.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                    <Icon size={17} className={r.color} />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-800 text-sm">{r.title}</div>
                    <div className="text-slate-400 text-xs mt-0.5 leading-snug">{r.desc}</div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Report preview */}
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 ${selectedReport.bg} rounded-xl flex items-center justify-center`}>
                  <selectedReport.icon size={17} className={selectedReport.color} />
                </div>
                <div>
                  <h2 className="font-bold text-slate-800">{selectedReport.title}</h2>
                  <p className="text-slate-400 text-xs">{selectedReport.desc}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <select value={period} onChange={e => setPeriod(e.target.value)}
                  className="px-3 py-1.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-300 bg-white">
                  {selectedReport.periods.map(p => <option key={p}>{p}</option>)}
                </select>
                <motion.button onClick={generate} disabled={generating}
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-1.5 rounded-xl text-sm font-medium hover:bg-blue-500 transition disabled:opacity-60"
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  {generating ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Download size={14} />
                  )}
                  {generating ? "Génération..." : "Exporter PDF"}
                </motion.button>
              </div>
            </div>

            <div className="p-6">
              {selectedReport.id === 1 && (
                <div className="space-y-4">
                  <CommercialBarChart />
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100">
                          {["Commercial", "CA Réalisé", "Objectif", "Taux", "Visites"].map(h => (
                            <th key={h} className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(selectedReport.preview as any[]).map((row: any) => (
                          <tr key={row.name} className="border-b border-slate-50 hover:bg-slate-50 transition">
                            <td className="py-3 px-3 font-medium text-slate-800">{row.name}</td>
                            <td className="py-3 px-3 text-slate-700">{row.ca} TND</td>
                            <td className="py-3 px-3 text-slate-500">60 000 TND</td>
                            <td className="py-3 px-3">
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${row.pct >= 100 ? "bg-emerald-100 text-emerald-700" : row.pct >= 80 ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
                                {row.pct}%
                              </span>
                            </td>
                            <td className="py-3 px-3 text-slate-700">{row.visits}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {selectedReport.id === 2 && (
                <div className="space-y-3">
                  {(selectedReport.preview as any[]).map((row: any) => (
                    <div key={row.tranche} className="flex items-center gap-4 bg-slate-50 rounded-xl p-4">
                      <div className="flex-1">
                        <div className="font-semibold text-slate-800 text-sm">{row.tranche}</div>
                        <div className="text-slate-400 text-xs">{row.nb} clients concernés</div>
                      </div>
                      <div className="text-right">
                        <div className={`font-bold text-lg ${row.tranche.includes("90") ? "text-red-600" : row.tranche.includes("60") ? "text-amber-600" : "text-slate-700"}`}>
                          {row.montant} TND
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between">
                    <span className="font-bold text-red-800">Total créances</span>
                    <span className="font-black text-red-700 text-xl">44 990 TND</span>
                  </div>
                </div>
              )}

              {!selectedReport.preview && (
                <div className="text-center py-16">
                  <selectedReport.icon size={40} className={`mx-auto mb-4 opacity-20 ${selectedReport.color}`} />
                  <div className="font-semibold text-slate-700 mb-2">Rapport {selectedReport.title}</div>
                  <p className="text-slate-400 text-sm mb-6">{selectedReport.desc}</p>
                  <button onClick={generate} className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-blue-500 transition text-sm">
                    Générer le rapport
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Scheduled reports */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Calendar size={16} className="text-blue-500" />
              Rapports planifiés
            </h3>
            <div className="space-y-3">
              {[
                { report: "Performance commerciaux", schedule: "Lundi 08h00", recipients: "manager@bis.tn, admin@bis.tn", format: "PDF + Excel" },
                { report: "Recouvrement mensuel", schedule: "1er du mois 07h00", recipients: "manager@bis.tn", format: "PDF" },
              ].map((s, i) => (
                <div key={i} className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl text-sm">
                  <div>
                    <div className="font-semibold text-slate-800">{s.report}</div>
                    <div className="text-slate-400 text-xs mt-0.5">{s.schedule} · {s.recipients}</div>
                  </div>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2.5 py-1 rounded-lg font-medium">{s.format}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
