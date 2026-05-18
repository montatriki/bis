"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Search, Plus, Edit, Trash2, Printer, Download, FileText, Building } from "lucide-react";

const SUB_TABS = ["Fournisseurs","Documents Frs","Dem. devis","Devis","B.Commande","Importation","B.Réception","B.Retour","Facture","Avoir","Rapports","Paramètres"];

const FOURNISSEURS = [
  { code: "FRS001", nom: "SAMIR MULTIPRINT SARL", matricule: "1234567A/P/M000", ville: "Tunis", tel: "+216 71 XXX XXX", solde: 33329.316 },
  { code: "FRS002", nom: "JOUETS MÉDITERRANÉE", matricule: "2345678B/A/M000", ville: "Sfax", tel: "+216 74 XXX XXX", solde: 92414.273 },
  { code: "FRS003", nom: "ÉDITIONS NORD-AFRICAINES", matricule: "3456789C/P/M000", ville: "Béja", tel: "+216 78 XXX XXX", solde: 12800.000 },
  { code: "FRS004", nom: "GLOBAL TOYS IMPORT", matricule: "4567890D/P/M000", ville: "Sousse", tel: "+216 73 XXX XXX", solde: 0 },
];

const DOCS_ACHAT = [
  { type: "BR", ref: "BR-2026-0045", date: "10/05/2026", frs: "JOUETS MÉDITERRANÉE", ht: 15420.00, ttc: 18349.80, regle: 0, solde: 18349.80 },
  { type: "FAC", ref: "FAC-FRS-031", date: "05/05/2026", frs: "SAMIR MULTIPRINT SARL", ht: 28000.00, ttc: 33320.00, regle: 33329.32, solde: 0 },
  { type: "BC", ref: "BC-2026-0089", date: "15/05/2026", frs: "GLOBAL TOYS IMPORT", ht: 8000.00, ttc: 9520.00, regle: 0, solde: 9520.00 },
];

export default function AchatPage() {
  const [tab, setTab] = useState("Fournisseurs");
  const [search, setSearch] = useState("");

  const filtered = FOURNISSEURS.filter(f => f.nom.toLowerCase().includes(search.toLowerCase()));
  const totalSolde = FOURNISSEURS.reduce((s, f) => s + f.solde, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Module Achat</h1>
          <p className="text-slate-500 text-sm">{FOURNISSEURS.length} fournisseurs · Total dû : {totalSolde.toFixed(3)} TND</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 text-center">
          <div className="text-lg font-bold text-amber-700">{totalSolde.toFixed(0)} TND</div>
          <div className="text-xs text-amber-500">Dettes fournisseurs</div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-100 overflow-x-auto scrollbar-none">
          {SUB_TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition border-b-2 ${tab === t ? "border-blue-600 text-blue-600 bg-blue-50/50" : "border-transparent text-slate-500 hover:text-slate-700"}`}>{t}</button>
          ))}
        </div>

        {tab === "Fournisseurs" && (
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 min-w-48"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Raison sociale, Code..." className="pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl w-full focus:outline-none focus:border-blue-300" /></div>
              <button className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-2 rounded-xl text-sm font-medium hover:bg-blue-500 transition"><Plus size={14} /> Ajouter</button>
              <button className="flex items-center gap-1.5 border border-slate-200 text-emerald-600 px-3 py-2 rounded-xl text-sm hover:bg-emerald-50 transition"><Download size={14} /> Excel</button>
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>{["Code","Raison sociale","Matricule fiscale","Ville","Téléphone","Solde","Actions"].map(h => <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map((f, i) => (
                    <motion.tr key={f.code} className="hover:bg-slate-50 transition" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}>
                      <td className="px-3 py-3 font-mono text-xs text-slate-500">{f.code}</td>
                      <td className="px-3 py-3 font-medium text-slate-800">{f.nom}</td>
                      <td className="px-3 py-3 font-mono text-xs text-slate-500">{f.matricule}</td>
                      <td className="px-3 py-3 text-slate-600">{f.ville}</td>
                      <td className="px-3 py-3 text-slate-500 text-xs">{f.tel}</td>
                      <td className="px-3 py-3 font-bold"><span className={f.solde > 0 ? "text-amber-600" : "text-emerald-600"}>{f.solde.toFixed(3)}</span></td>
                      <td className="px-3 py-3"><div className="flex gap-1"><button className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"><Edit size={12} /></button><button className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"><Trash2 size={12} /></button></div></td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "Documents Frs" && (
          <div className="p-4 space-y-4">
            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>{["Type","Référence","Date","Fournisseur","Total HT","Total TTC","Réglé","Solde"].map(h => <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {DOCS_ACHAT.map((d, i) => (
                    <motion.tr key={d.ref} className="hover:bg-slate-50 transition" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}>
                      <td className="px-3 py-3"><span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">{d.type}</span></td>
                      <td className="px-3 py-3 font-mono text-xs font-medium text-slate-800">{d.ref}</td>
                      <td className="px-3 py-3 text-slate-500 text-xs">{d.date}</td>
                      <td className="px-3 py-3 font-medium text-slate-700">{d.frs}</td>
                      <td className="px-3 py-3 text-slate-700">{d.ht.toFixed(3)}</td>
                      <td className="px-3 py-3 font-bold text-slate-800">{d.ttc.toFixed(3)}</td>
                      <td className="px-3 py-3 text-emerald-600">{d.regle.toFixed(3)}</td>
                      <td className="px-3 py-3 font-bold"><span className={d.solde > 0 ? "text-amber-600" : "text-emerald-600"}>{d.solde.toFixed(3)}</span></td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!["Fournisseurs","Documents Frs"].includes(tab) && (
          <div className="p-8 text-center text-slate-400">
            <Building size={36} className="mx-auto mb-3 opacity-20" />
            <div className="font-semibold text-slate-600">{tab}</div>
            <p className="text-sm mt-1">Module disponible</p>
          </div>
        )}
      </div>
    </div>
  );
}
