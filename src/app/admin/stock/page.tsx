"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Search, Plus, Edit, Trash2, Printer, Download, AlertTriangle, Package, BarChart3, ArrowLeftRight, Truck } from "lucide-react";
import { DUMMY_PRODUCTS } from "@/lib/dummy-data";

const SUB_TABS = ["Produits", "Matières", "P.Semi Fini", "Inventaires", "Mouvements", "Transferts", "Dépôts", "Rapports", "Paramètres"];

const DEPOTS = [
  { id: 1, label: "Dépôt principal", matricule: "DEPOT-001", type: "fixe", stock: DUMMY_PRODUCTS.reduce((s,p) => s + p.stock, 0) },
  { id: 2, label: "mokhtar 206TU7140", matricule: "206TU7140", type: "mobile", stock: 45 },
  { id: 3, label: "HICHEM 238TU1019", matricule: "238TU1019", type: "mobile", stock: 32 },
  { id: 4, label: "FOUED 243TU3251", matricule: "243TU3251", type: "mobile", stock: 58 },
];

export default function StockPage() {
  const [tab, setTab] = useState("Produits");
  const [search, setSearch] = useState("");

  const filtered = DUMMY_PRODUCTS.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.reference.toLowerCase().includes(search.toLowerCase())
  );

  const lowStock = DUMMY_PRODUCTS.filter(p => p.stock < 10).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Module Stock</h1>
          <p className="text-slate-500 text-sm">{DUMMY_PRODUCTS.length} produits · {lowStock} sous seuil minimum</p>
        </div>
        {lowStock > 0 && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2">
            <AlertTriangle size={16} className="text-red-500" />
            <span className="text-red-700 text-sm font-semibold">{lowStock} articles en stock minimum</span>
          </div>
        )}
      </div>

      {/* Sub-navigation */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-100 overflow-x-auto scrollbar-none">
          {SUB_TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition border-b-2 ${tab === t ? "border-blue-600 text-blue-600 bg-blue-50/50" : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"}`}>
              {t}
            </button>
          ))}
        </div>

        {tab === "Produits" && (
          <div className="p-4 space-y-4">
            {/* Toolbar */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 min-w-48">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Désignation, Référence, Famille..."
                  className="pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl w-full focus:outline-none focus:border-blue-300" />
              </div>
              <button className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-2 rounded-xl text-sm font-medium hover:bg-blue-500 transition"><Plus size={14} /> Ajouter</button>
              <button className="flex items-center gap-1.5 border border-slate-200 text-slate-600 px-3 py-2 rounded-xl text-sm hover:bg-slate-50 transition"><Edit size={14} /> Modifier</button>
              <button className="flex items-center gap-1.5 border border-slate-200 text-red-500 px-3 py-2 rounded-xl text-sm hover:bg-red-50 transition"><Trash2 size={14} /> Supprimer</button>
              <button className="flex items-center gap-1.5 border border-slate-200 text-slate-600 px-3 py-2 rounded-xl text-sm hover:bg-slate-50 transition"><Printer size={14} /> Imprimer</button>
              <button className="flex items-center gap-1.5 border border-slate-200 text-emerald-600 px-3 py-2 rounded-xl text-sm hover:bg-emerald-50 transition"><Download size={14} /> Excel</button>
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    {["Référence","Code Barre","Désignation","Famille","S.Famille","En stock","PU achat HT","T1 HT","T1 TTC","Min"].map(h => (
                      <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map((p, i) => (
                    <motion.tr key={p.reference} className="hover:bg-slate-50 transition"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}>
                      <td className="px-3 py-3 font-mono text-xs text-slate-700 font-medium">{p.reference}</td>
                      <td className="px-3 py-3 font-mono text-xs text-slate-500">{p.barcode}</td>
                      <td className="px-3 py-3 font-medium text-slate-800">{p.name}</td>
                      <td className="px-3 py-3 text-slate-600">{p.family}</td>
                      <td className="px-3 py-3 text-slate-500 text-xs">{p.subFamily}</td>
                      <td className="px-3 py-3">
                        <span className={`font-bold ${p.stock < 10 ? "text-red-600" : p.stock < 15 ? "text-amber-600" : "text-emerald-600"}`}>{p.stock}</span>
                        {p.stock < 10 && <AlertTriangle size={12} className="text-red-500 inline ml-1" />}
                      </td>
                      <td className="px-3 py-3 text-slate-700">{p.price.toFixed(3)}</td>
                      <td className="px-3 py-3 text-slate-700">{p.price.toFixed(3)}</td>
                      <td className="px-3 py-3 font-semibold text-slate-800">{p.priceTTC.toFixed(3)}</td>
                      <td className="px-3 py-3 text-xs text-slate-500">10</td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Depots section */}
            <div className="border-t border-slate-100 pt-4">
              <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2"><Truck size={14} className="text-blue-500" /> Distribution par dépôt</h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {DEPOTS.map(d => (
                  <div key={d.id} className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                    <div className="font-semibold text-slate-800 text-sm">{d.label}</div>
                    <div className="text-slate-400 text-xs">{d.matricule}</div>
                    <div className="flex items-center justify-between mt-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${d.type === "fixe" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"}`}>{d.type}</span>
                      <span className="font-bold text-slate-700">{d.stock} art.</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "Rapports" && (
          <div className="p-6 space-y-6">
            <h3 className="font-bold text-slate-800">Rapports Stock</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { title: "État du stock", desc: "Inventaire par dépôt, famille, sous-famille", icon: Package },
                { title: "Rotation de stock", desc: "Articles les plus/moins vendus", icon: ArrowLeftRight },
                { title: "Stock minimum", desc: "Articles sous seuil d'alerte", icon: AlertTriangle },
                { title: "Valorisation stock", desc: "Valeur totale (DPA/PMP/Prix vente)", icon: BarChart3 },
              ].map(r => (
                <div key={r.title} className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex items-start gap-3 hover:bg-blue-50 hover:border-blue-200 cursor-pointer transition">
                  <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <r.icon size={16} className="text-blue-600" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-800 text-sm">{r.title}</div>
                    <div className="text-slate-400 text-xs mt-0.5">{r.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "Dépôts" && (
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-700">Gestion des dépôts</h3>
              <button className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-2 rounded-xl text-sm font-medium hover:bg-blue-500 transition"><Plus size={14} /> Ajouter</button>
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>{["#","Libellé","Matricule","Type","Stock total","Actions"].map(h => <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {DEPOTS.map(d => (
                    <tr key={d.id} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-3 text-slate-500 text-xs">{d.id}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">{d.label}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{d.matricule}</td>
                      <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${d.type === "fixe" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"}`}>{d.type}</span></td>
                      <td className="px-4 py-3 font-bold text-slate-700">{d.stock}</td>
                      <td className="px-4 py-3"><div className="flex gap-1"><button className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"><Edit size={13} /></button><button className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"><Trash2 size={13} /></button></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!["Produits","Rapports","Dépôts"].includes(tab) && (
          <div className="p-8 text-center text-slate-400">
            <Package size={40} className="mx-auto mb-3 opacity-20" />
            <div className="font-semibold text-slate-600">{tab}</div>
            <p className="text-sm mt-1">Module disponible — données chargées depuis la base</p>
          </div>
        )}
      </div>
    </div>
  );
}
