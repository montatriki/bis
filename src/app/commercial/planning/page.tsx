"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle, Clock, MapPin, Phone, ChevronRight } from "lucide-react";
import { DUMMY_CLIENTS } from "@/lib/dummy-data";

const PLANNING = DUMMY_CLIENTS.map((c, i) => ({
  ...c,
  order: i + 1,
  time: `${8 + Math.floor(i * 0.6)}:${i % 2 === 0 ? "00" : "30"}`,
  status: i < 5 ? "done" : i === 5 ? "current" : "pending",
  duration: Math.floor(Math.random() * 20) + 10,
}));

const STATUS_CONFIG = {
  done: { label: "Visité", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500" },
  current: { label: "En cours", bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-300", dot: "bg-blue-500" },
  pending: { label: "À visiter", bg: "bg-slate-50", text: "text-slate-500", border: "border-slate-200", dot: "bg-slate-300" },
};

export default function PlanningPage() {
  const [selected, setSelected] = useState<typeof PLANNING[0] | null>(null);
  const done = PLANNING.filter(p => p.status === "done").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Planning du jour</h1>
          <p className="text-slate-500 text-sm">17/05/2026 — {done}/{PLANNING.length} visites effectuées</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-center">
            <div className="text-lg font-bold text-blue-600">{done}</div>
            <div className="text-slate-400 text-xs">Visités</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-center">
            <div className="text-lg font-bold text-amber-500">{PLANNING.length - done}</div>
            <div className="text-slate-400 text-xs">Restants</div>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-slate-500">Progression journée</span>
          <span className="font-semibold text-slate-800">{Math.round((done / PLANNING.length) * 100)}%</span>
        </div>
        <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
          <motion.div className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full"
            initial={{ width: 0 }} animate={{ width: `${(done / PLANNING.length) * 100}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }} />
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3">
          {PLANNING.map((p, i) => {
            const s = STATUS_CONFIG[p.status as keyof typeof STATUS_CONFIG];
            return (
              <motion.div key={p.name}
                className={`bg-white rounded-2xl border shadow-sm p-4 cursor-pointer transition ${selected?.name === p.name ? "border-blue-400 ring-2 ring-blue-100" : s.border}`}
                onClick={() => setSelected(p)}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm ${s.bg} ${s.text}`}>
                    {p.order}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="font-semibold text-slate-800 text-sm truncate">{p.name}</div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${s.bg} ${s.text} flex-shrink-0`}>{s.label}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                      <span className="flex items-center gap-1"><Clock size={10} />{p.time}</span>
                      <span className="flex items-center gap-1"><MapPin size={10} />{p.city}</span>
                    </div>
                  </div>
                  {p.status === "done" && <CheckCircle size={18} className="text-emerald-500 flex-shrink-0" />}
                  {p.status === "current" && (
                    <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}
                      className="w-3 h-3 bg-blue-500 rounded-full flex-shrink-0" />
                  )}
                  {p.status === "pending" && <ChevronRight size={16} className="text-slate-300 flex-shrink-0" />}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Detail panel */}
        <div className="space-y-3">
          {selected ? (
            <motion.div className="bg-white rounded-2xl border border-blue-200 shadow-sm p-5"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <h3 className="font-semibold text-slate-800 mb-4">Détails — #{selected.order}</h3>
              <div className="space-y-3">
                <div className="bg-slate-50 rounded-xl p-3">
                  <div className="text-xs text-slate-400 mb-1">Client</div>
                  <div className="font-semibold text-slate-800 text-sm">{selected.name}</div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-slate-50 rounded-xl p-3 text-center">
                    <div className="text-xs text-slate-400">Heure</div>
                    <div className="font-bold text-slate-800">{selected.time}</div>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3 text-center">
                    <div className="text-xs text-slate-400">Durée</div>
                    <div className="font-bold text-slate-800">{selected.duration} min</div>
                  </div>
                </div>
                <div className="bg-slate-50 rounded-xl p-3">
                  <div className="text-xs text-slate-400 mb-1">Adresse</div>
                  <div className="text-sm text-slate-700">{selected.city}, {selected.governorate}</div>
                </div>
                <div className="bg-slate-50 rounded-xl p-3">
                  <div className="text-xs text-slate-400 mb-1">Solde</div>
                  <div className={`font-bold text-sm ${selected.balance > 0 ? "text-red-600" : "text-emerald-600"}`}>
                    {selected.balance > 0 ? `${selected.balance.toFixed(2)} TND` : "0.000 TND"}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="flex-1 flex items-center justify-center gap-1.5 text-xs bg-blue-50 text-blue-700 border border-blue-200 py-2.5 rounded-xl hover:bg-blue-100 transition font-medium">
                    <Phone size={12} /> Appeler
                  </button>
                  <button className="flex-1 flex items-center justify-center gap-1.5 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 py-2.5 rounded-xl hover:bg-emerald-100 transition font-medium">
                    <MapPin size={12} /> Naviguer
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center">
              <MapPin size={32} className="text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">Sélectionnez un client pour voir les détails</p>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <h4 className="font-semibold text-slate-800 text-sm mb-3">Résumé journée</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Visités</span>
                <span className="font-semibold text-emerald-600">{done} clients</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">CA réalisé</span>
                <span className="font-semibold text-slate-800">3 506 TND</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Commandes</span>
                <span className="font-semibold text-slate-800">4 BL</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Km parcourus</span>
                <span className="font-semibold text-slate-800">87 km</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
