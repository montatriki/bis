"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Users, Plus, Edit, Trash2, Printer, Download, CreditCard } from "lucide-react";

const SUB_TABS = ["Employés","Gestion pointage","Gestion crédit","Traitements","Rapports","Paramètres"];

const EMPLOYES = [
  { code: "4150001", nom: "Serine Chaari", famille: "Administration", debit: 820.00, credit: 0, solde: -820.00 },
  { code: "4150002", nom: "Samar Machaoui", famille: "Commercial", debit: 0, credit: 0, solde: 0 },
  { code: "4150003", nom: "Sonia Amich", famille: "Administration", debit: 0, credit: 0, solde: 0 },
  { code: "4150005", nom: "Hana Rfifa", famille: "Commercial", debit: 0, credit: 0, solde: 0 },
  { code: "4150006", nom: "Zaineb Baati", famille: "Logistique", debit: 0, credit: 0, solde: 0 },
  { code: "4150007", nom: "Wassim Triki", famille: "Commercial", debit: 50.00, credit: 0, solde: -50.00 },
  { code: "4150008", nom: "BRINI OLFA", famille: "Administration", debit: 9.50, credit: 0, solde: -9.50 },
];

export default function GRHPage() {
  const [tab, setTab] = useState("Employés");
  const [search, setSearch] = useState("");

  const filtered = EMPLOYES.filter(e => e.nom.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">GRH — Ressources Humaines</h1>
          <p className="text-slate-500 text-sm">{EMPLOYES.length} employés</p>
        </div>
        <div className="flex gap-3">
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2 text-center">
            <div className="text-lg font-bold text-blue-700">{EMPLOYES.length}</div>
            <div className="text-xs text-blue-500">Effectif total</div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2 text-center">
            <div className="text-lg font-bold text-red-700">{Math.abs(EMPLOYES.reduce((s,e) => s + e.solde, 0)).toFixed(0)} TND</div>
            <div className="text-xs text-red-500">Avances en cours</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-100 overflow-x-auto scrollbar-none">
          {SUB_TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition border-b-2 ${tab === t ? "border-blue-600 text-blue-600 bg-blue-50/50" : "border-transparent text-slate-500 hover:text-slate-700"}`}>{t}</button>
          ))}
        </div>

        {tab === "Employés" && (
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 min-w-48">
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un employé..."
                  className="px-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl w-full focus:outline-none focus:border-blue-300" />
              </div>
              <button className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-2 rounded-xl text-sm font-medium hover:bg-blue-500 transition"><Plus size={14} /> Ajouter</button>
              <button className="flex items-center gap-1.5 border border-slate-200 text-slate-600 px-3 py-2 rounded-xl text-sm hover:bg-slate-50 transition"><Edit size={14} /></button>
              <button className="flex items-center gap-1.5 border border-slate-200 text-red-500 px-3 py-2 rounded-xl text-sm hover:bg-red-50 transition"><Trash2 size={14} /></button>
              <button className="flex items-center gap-1.5 border border-slate-200 text-slate-600 px-3 py-2 rounded-xl text-sm hover:bg-slate-50 transition"><Printer size={14} /></button>
              <button className="flex items-center gap-1.5 border border-slate-200 text-emerald-600 px-3 py-2 rounded-xl text-sm hover:bg-emerald-50 transition"><Download size={14} /> Excel</button>
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>{["N°","Code","Raison sociale","Solde initial","Débit","Crédit","Solde","Famille"].map(h => (
                    <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map((e, i) => (
                    <motion.tr key={e.code} className="hover:bg-slate-50 transition" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}>
                      <td className="px-3 py-3 text-slate-400 text-xs">{i+1}</td>
                      <td className="px-3 py-3 font-mono text-xs text-slate-600">{e.code}</td>
                      <td className="px-3 py-3 font-medium text-slate-800">{e.nom}</td>
                      <td className="px-3 py-3 text-slate-500">0.000</td>
                      <td className="px-3 py-3 text-red-600 font-medium">{e.debit > 0 ? e.debit.toFixed(3) : "0.000"}</td>
                      <td className="px-3 py-3 text-emerald-600">{e.credit > 0 ? e.credit.toFixed(3) : "0.000"}</td>
                      <td className="px-3 py-3 font-bold"><span className={e.solde < 0 ? "text-red-600" : "text-emerald-600"}>{e.solde.toFixed(3)}</span></td>
                      <td className="px-3 py-3"><span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{e.famille}</span></td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
              <div className="px-4 py-2 text-xs text-slate-400 bg-slate-50 border-t border-slate-100">Rows per page: 20 | 1–{filtered.length} of {filtered.length}</div>
            </div>
          </div>
        )}

        {tab === "Gestion crédit" && (
          <div className="p-6 max-w-md space-y-5">
            <h3 className="font-bold text-slate-800">Créer un crédit / avance sur salaire</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Sélectionner un employé</label>
                <select className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 bg-white">
                  {EMPLOYES.map(e => <option key={e.code}>{e.nom}</option>)}
                </select>
              </div>
              {[["Valeur Crédit (TND)","montant"],["Nbre de tranches","nombre"],["Valeur tranche (calculée)","montant"]].map(([label, type]) => (
                <div key={label}>
                  <label className="text-sm font-medium text-slate-700 block mb-1">{label}</label>
                  <input type={type === "montant" ? "number" : "text"} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400" />
                </div>
              ))}
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">1ère échéance</label>
                <input type="date" className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <button className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-500 transition flex items-center justify-center gap-2">
                <CreditCard size={16} /> CRÉER
              </button>
            </div>
          </div>
        )}

        {!["Employés","Gestion crédit"].includes(tab) && (
          <div className="p-8 text-center text-slate-400">
            <Users size={36} className="mx-auto mb-3 opacity-20" />
            <div className="font-semibold text-slate-600">{tab}</div>
            <p className="text-sm mt-1">Module disponible</p>
          </div>
        )}
      </div>
    </div>
  );
}
