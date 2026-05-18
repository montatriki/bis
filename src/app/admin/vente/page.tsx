"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Search, Plus, Edit, Trash2, Printer, Download, AlertTriangle, TrendingUp, FileText, Users } from "lucide-react";
import { DUMMY_CLIENTS } from "@/lib/dummy-data";

const SUB_TABS = ["Clients","Documents client","Suivi commandes","Clôture caisse","Dem. devis","Devis","B.Commande","B.Livraison","Facture","Avoir","Rapports","Paramètres"];

const DOCS_VENTE = [
  { type: "BL", ref: "BL-2026-0087", date: "15/05/2026", client: "AGIL BEJA SUD", ht: 2004.62, ttc: 2385.50, regle: 2385.50, solde: 0 },
  { type: "BL", ref: "BL-2026-0086", date: "15/05/2026", client: "librairie saphir", ht: 1554.62, ttc: 1849.99, regle: 0, solde: 1849.99 },
  { type: "FAC", ref: "FAC-2026-042", date: "15/05/2026", client: "AGIL BEJA SUD", ht: 2004.62, ttc: 2385.50, regle: 2385.50, solde: 0 },
  { type: "BL", ref: "BL-2026-0085", date: "14/05/2026", client: "AGIL MAHDIA", ht: 2857.31, ttc: 3400.20, regle: 1000, solde: 2400.20 },
  { type: "BC", ref: "BC-2026-0089", date: "17/05/2026", client: "ola agereb", ht: 362.18, ttc: 430.99, regle: 0, solde: 430.99 },
  { type: "AV", ref: "AV-2026-008", date: "02/05/2026", client: "librairie saphir", ht: -201.68, ttc: -240.00, regle: 0, solde: -240.00 },
];

const TYPE_STYLE: Record<string, string> = {
  BL: "bg-blue-100 text-blue-700", FAC: "bg-purple-100 text-purple-700",
  BC: "bg-amber-100 text-amber-700", AV: "bg-red-100 text-red-600",
};

export default function VentePage() {
  const [tab, setTab] = useState("Clients");
  const [search, setSearch] = useState("");

  const totalSolde = DUMMY_CLIENTS.reduce((s, c) => s + c.balance, 0);
  const filteredClients = DUMMY_CLIENTS.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Module Vente</h1>
          <p className="text-slate-500 text-sm">{DUMMY_CLIENTS.length} clients · Total solde : {totalSolde.toFixed(3)} TND</p>
        </div>
        <div className="flex gap-3">
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2 text-center">
            <div className="text-lg font-bold text-blue-700">23 100 TND</div>
            <div className="text-blue-500 text-xs">CA Mai 2026</div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2 text-center">
            <div className="text-lg font-bold text-red-700">{totalSolde.toFixed(0)} TND</div>
            <div className="text-red-500 text-xs">Créances totales</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-100 overflow-x-auto scrollbar-none">
          {SUB_TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition border-b-2 ${tab === t ? "border-blue-600 text-blue-600 bg-blue-50/50" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
              {t}
            </button>
          ))}
        </div>

        {tab === "Clients" && (
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 min-w-48">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Raison sociale, Code, Ville..."
                  className="pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl w-full focus:outline-none focus:border-blue-300" />
              </div>
              <select className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none bg-white text-slate-600">
                <option>Solde : tous</option><option>Solde &gt; 0</option><option>Solde = 0</option>
              </select>
              <button className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-2 rounded-xl text-sm font-medium hover:bg-blue-500 transition"><Plus size={14} /> Ajouter</button>
              <button className="flex items-center gap-1.5 border border-slate-200 text-slate-600 px-3 py-2 rounded-xl text-sm hover:bg-slate-50 transition"><Edit size={14} /></button>
              <button className="flex items-center gap-1.5 border border-slate-200 text-red-500 px-3 py-2 rounded-xl text-sm hover:bg-red-50 transition"><Trash2 size={14} /></button>
              <button className="flex items-center gap-1.5 border border-slate-200 text-slate-600 px-3 py-2 rounded-xl text-sm hover:bg-slate-50 transition"><Printer size={14} /></button>
              <button className="flex items-center gap-1.5 border border-slate-200 text-emerald-600 px-3 py-2 rounded-xl text-sm hover:bg-emerald-50 transition"><Download size={14} /> Excel</button>
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>{["Code","Raison sociale","Solde","Commercial","Ville","Gouvernorat","Téléphone","Catégorie","Actions"].map(h => (
                    <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredClients.map((c, i) => (
                    <motion.tr key={c.name} className="hover:bg-slate-50 transition"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}>
                      <td className="px-3 py-3 font-mono text-xs text-slate-500">CLI{String(i+1).padStart(3,"0")}</td>
                      <td className="px-3 py-3 font-medium text-slate-800">{c.name}</td>
                      <td className="px-3 py-3 font-bold">
                        <span className={c.balance > 0 ? "text-red-600" : "text-emerald-600"}>{c.balance.toFixed(3)}</span>
                      </td>
                      <td className="px-3 py-3 text-slate-600 text-xs">Mokhtar</td>
                      <td className="px-3 py-3 text-slate-600">{c.city}</td>
                      <td className="px-3 py-3 text-slate-500 text-xs">{c.governorate}</td>
                      <td className="px-3 py-3 text-slate-500 text-xs">+216 XX XXX XXX</td>
                      <td className="px-3 py-3"><span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{c.category}</span></td>
                      <td className="px-3 py-3"><div className="flex gap-1"><button className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"><Edit size={12} /></button><button className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"><Trash2 size={12} /></button></div></td>
                    </motion.tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 border-t border-slate-200">
                  <tr><td colSpan={2} className="px-3 py-2 font-bold text-slate-700 text-sm">Total Solde Clients</td><td className="px-3 py-2 font-black text-red-700">{totalSolde.toFixed(3)} TND</td><td colSpan={6} /></tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {tab === "Documents client" && (
          <div className="p-4 space-y-4">
            <div className="flex gap-2 flex-wrap">
              <div className="relative flex-1 min-w-48"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input placeholder="Client, N° Document..." className="pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl w-full focus:outline-none focus:border-blue-300" /></div>
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>{["Type","Référence","Date","Client","Total HT","Total TTC","Réglé","Solde"].map(h => <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {DOCS_VENTE.map((d, i) => (
                    <motion.tr key={d.ref} className="hover:bg-slate-50 transition" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}>
                      <td className="px-3 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_STYLE[d.type] || "bg-slate-100 text-slate-600"}`}>{d.type}</span></td>
                      <td className="px-3 py-3 font-mono text-xs font-medium text-slate-800">{d.ref}</td>
                      <td className="px-3 py-3 text-slate-500 text-xs">{d.date}</td>
                      <td className="px-3 py-3 text-slate-700 font-medium">{d.client}</td>
                      <td className="px-3 py-3 text-slate-700">{d.ht.toFixed(3)}</td>
                      <td className="px-3 py-3 font-bold text-slate-800">{d.ttc.toFixed(3)}</td>
                      <td className="px-3 py-3 text-emerald-600 font-medium">{d.regle.toFixed(3)}</td>
                      <td className="px-3 py-3 font-bold"><span className={d.solde > 0 ? "text-red-600" : d.solde < 0 ? "text-blue-600" : "text-emerald-600"}>{d.solde.toFixed(3)}</span></td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "Rapports" && (
          <div className="p-6 space-y-4">
            <h3 className="font-bold text-slate-800">Rapports Vente</h3>
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { title: "État des soldes clients", desc: "Créances par client, ancienneté", icon: Users },
                { title: "Statistique de vente", desc: "Performance par produit, client, commercial", icon: TrendingUp },
                { title: "Statistique par magasin", desc: "Analyse par dépôt/point de vente", icon: FileText },
              ].map(r => (
                <div key={r.title} className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex items-start gap-3 hover:bg-blue-50 hover:border-blue-200 cursor-pointer transition">
                  <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0"><r.icon size={16} className="text-blue-600" /></div>
                  <div><div className="font-semibold text-slate-800 text-sm">{r.title}</div><div className="text-slate-400 text-xs mt-0.5">{r.desc}</div></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!["Clients","Documents client","Rapports"].includes(tab) && (
          <div className="p-8 text-center text-slate-400">
            <FileText size={36} className="mx-auto mb-3 opacity-20" />
            <div className="font-semibold text-slate-600">{tab}</div>
            <p className="text-sm mt-1">Module disponible — données chargées depuis la base</p>
          </div>
        )}
      </div>
    </div>
  );
}
