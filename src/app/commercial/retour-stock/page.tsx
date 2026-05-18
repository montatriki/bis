"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Package, RotateCcw, ArrowLeftRight, ClipboardList } from "lucide-react";
import { DUMMY_PRODUCTS } from "@/lib/dummy-data";

const TABS = [
  { id: "inventaire", label: "Inventaire", icon: ClipboardList },
  { id: "retour", label: "Retour", icon: RotateCcw },
  { id: "transfert", label: "Transfert", icon: ArrowLeftRight },
];

const VEHICLE_STOCK = DUMMY_PRODUCTS.slice(0, 8).map(p => ({
  ...p,
  vehicleStock: Math.floor(Math.random() * 20) + 2,
  returned: 0,
}));

export default function RetourStockPage() {
  const [activeTab, setActiveTab] = useState("inventaire");
  const [quantities, setQuantities] = useState<Record<string, number>>(
    Object.fromEntries(VEHICLE_STOCK.map(p => [p.reference, p.vehicleStock]))
  );
  const [returnQtys, setReturnQtys] = useState<Record<string, number>>(
    Object.fromEntries(VEHICLE_STOCK.map(p => [p.reference, 0]))
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Stock véhicule</h1>
        <p className="text-slate-500 text-sm">Plaque: 206TU7140 — 17/05/2026</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 bg-slate-100 p-1 rounded-2xl w-fit">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition ${activeTab === tab.id ? "bg-white shadow text-slate-800" : "text-slate-500 hover:text-slate-700"}`}>
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "inventaire" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">Inventaire véhicule</h2>
            <span className="text-xs text-slate-400">{VEHICLE_STOCK.length} produits chargés</span>
          </div>
          <div className="divide-y divide-slate-50">
            {VEHICLE_STOCK.map((p, i) => (
              <motion.div key={p.reference} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition"
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
                <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Package size={14} className="text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-800 text-sm truncate">{p.name}</div>
                  <div className="text-slate-400 text-xs">Réf: {p.reference}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setQuantities(q => ({ ...q, [p.reference]: Math.max(0, q[p.reference] - 1) }))}
                    className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center text-slate-600 hover:bg-red-100 hover:text-red-600 transition text-base font-bold">−</button>
                  <span className="w-8 text-center font-bold text-slate-800">{quantities[p.reference]}</span>
                  <button onClick={() => setQuantities(q => ({ ...q, [p.reference]: q[p.reference] + 1 }))}
                    className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center text-slate-600 hover:bg-emerald-100 hover:text-emerald-600 transition text-base font-bold">+</button>
                </div>
                <div className="text-right flex-shrink-0 w-20">
                  <div className="font-semibold text-slate-800 text-sm">{(p.price * quantities[p.reference]).toFixed(2)}</div>
                  <div className="text-slate-400 text-xs">TND</div>
                </div>
              </motion.div>
            ))}
          </div>
          <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
            <span className="font-semibold text-slate-700">Valeur totale stock</span>
            <span className="font-bold text-slate-800 text-lg">
              {VEHICLE_STOCK.reduce((s, p) => s + p.price * quantities[p.reference], 0).toFixed(2)} TND
            </span>
          </div>
        </motion.div>
      )}

      {activeTab === "retour" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800">Retour au dépôt</h2>
            <p className="text-slate-500 text-xs mt-1">Sélectionnez les quantités à retourner</p>
          </div>
          <div className="divide-y divide-slate-50">
            {VEHICLE_STOCK.map((p, i) => (
              <div key={p.reference} className="flex items-center gap-4 px-5 py-3.5">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-800 text-sm truncate">{p.name}</div>
                  <div className="text-slate-400 text-xs">Stock véhicule: {quantities[p.reference]}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setReturnQtys(q => ({ ...q, [p.reference]: Math.max(0, q[p.reference] - 1) }))}
                    className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center text-slate-600 hover:bg-red-100 transition text-base font-bold">−</button>
                  <span className={`w-8 text-center font-bold ${returnQtys[p.reference] > 0 ? "text-amber-600" : "text-slate-300"}`}>{returnQtys[p.reference]}</span>
                  <button onClick={() => setReturnQtys(q => ({ ...q, [p.reference]: Math.min(quantities[p.reference], q[p.reference] + 1) }))}
                    className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center text-slate-600 hover:bg-emerald-100 transition text-base font-bold">+</button>
                </div>
              </div>
            ))}
          </div>
          <div className="p-4 border-t border-slate-100">
            <button className="w-full bg-amber-500 text-white py-3 rounded-xl font-medium hover:bg-amber-400 transition">
              Valider le retour ({Object.values(returnQtys).reduce((a, b) => a + b, 0)} articles)
            </button>
          </div>
        </motion.div>
      )}

      {activeTab === "transfert" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center">
          <ArrowLeftRight size={40} className="text-slate-200 mx-auto mb-4" />
          <h3 className="font-semibold text-slate-700 mb-2">Transfert inter-véhicules</h3>
          <p className="text-slate-400 text-sm mb-6">Transférez du stock d'un véhicule à un autre en temps réel</p>
          <div className="grid grid-cols-2 gap-4 text-left max-w-xs mx-auto mb-6">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Véhicule source</label>
              <select className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-300">
                <option>206TU7140 (Mokhtar)</option>
                <option>243TU3251 (FOUED)</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Véhicule cible</label>
              <select className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-300">
                <option>243TU3251 (FOUED)</option>
                <option>238TU1019 (HICHEM)</option>
              </select>
            </div>
          </div>
          <button className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-blue-500 transition text-sm">
            Sélectionner les produits
          </button>
        </motion.div>
      )}
    </div>
  );
}
