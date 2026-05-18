"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Wallet, CreditCard, AlertTriangle, CheckCircle, Clock, Search, Plus, Printer } from "lucide-react";

const SUB_TABS = ["Règlements clients","Décaissements Frs","Gestion chéquiers","Comptes bancaires","Mouvements","Extrait compte","Borderaux","Décaissements Tiers","Balance globale"];

const REGLEMENTS = [
  { n: 1, date: "15/05/2026", client: "AGIL BEJA SUD", cmd: "BL-2026-0087", mode: "Chèque", montant: 2385.50, echeance: "15/06/2026", etat: "En attente", empl: "Dépôt principal" },
  { n: 2, date: "14/05/2026", client: "AGIL MAHDIA", cmd: "BL-2026-0085", mode: "Espèce", montant: 1000.00, echeance: "14/05/2026", etat: "Encaissé", empl: "Dépôt principal" },
  { n: 3, date: "13/05/2026", client: "librairie saphir", cmd: "BL-2026-0083", mode: "Traite", montant: 640.00, echeance: "13/08/2026", etat: "En attente", empl: "Véhicule Mokhtar" },
  { n: 4, date: "10/05/2026", client: "AGIL BEJA NORD", cmd: "BL-2026-0080", mode: "Virement", montant: 4291.12, echeance: "10/05/2026", etat: "Encaissé", empl: "Banque STB" },
  { n: 5, date: "05/05/2026", client: "ola agereb", cmd: "BL-2026-0075", mode: "Chèque", montant: 2765.63, echeance: "05/07/2026", etat: "Impayé", empl: "Dépôt principal" },
];

const COMPTES = [
  { id: 1, type: "Courant", nature: "Bancaire", label: "STB Béja", rib: "25 018 0000000 12345678 90", banque: "STB", solde: 48250.00 },
  { id: 2, type: "Courant", nature: "Bancaire", label: "BIAT Tunis", rib: "08 018 0000000 98765432 10", banque: "BIAT", solde: 22100.50 },
  { id: 3, type: "Caisse", nature: "Caisse", label: "Caisse principale", rib: "—", banque: "—", solde: 3450.00 },
];

const ETAT_STYLE: Record<string, string> = {
  "En attente": "bg-amber-100 text-amber-700",
  "Encaissé": "bg-emerald-100 text-emerald-700",
  "Impayé": "bg-red-100 text-red-700",
  "Retourné": "bg-slate-100 text-slate-600",
};

const totalEncaisse = REGLEMENTS.filter(r => r.etat === "Encaissé").reduce((s, r) => s + r.montant, 0);
const totalAttente = REGLEMENTS.filter(r => r.etat === "En attente").reduce((s, r) => s + r.montant, 0);
const totalImpaye = REGLEMENTS.filter(r => r.etat === "Impayé").reduce((s, r) => s + r.montant, 0);

export default function TresoreriePage() {
  const [tab, setTab] = useState("Règlements clients");
  const [modeFilter, setModeFilter] = useState("Tous");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Trésorerie</h1>
          <p className="text-slate-500 text-sm">Gestion financière — Mai 2026</p>
        </div>
        <div className="flex gap-3">
          {[[`${totalEncaisse.toFixed(0)} TND`,"Encaissé","text-emerald-700 bg-emerald-50 border-emerald-200"],[`${totalAttente.toFixed(0)} TND`,"En attente","text-amber-700 bg-amber-50 border-amber-200"],[`${totalImpaye.toFixed(0)} TND`,"Impayés","text-red-700 bg-red-50 border-red-200"]].map(([v,l,cls]) => (
            <div key={l} className={`border rounded-xl px-4 py-2 text-center ${cls}`}>
              <div className="text-base font-bold">{v}</div>
              <div className="text-xs">{l}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-100 overflow-x-auto scrollbar-none">
          {SUB_TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition border-b-2 ${tab === t ? "border-blue-600 text-blue-600 bg-blue-50/50" : "border-transparent text-slate-500 hover:text-slate-700"}`}>{t}</button>
          ))}
        </div>

        {tab === "Règlements clients" && (
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 min-w-48"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input placeholder="Client, N°CHQ, N°Vente..." className="pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl w-full focus:outline-none focus:border-blue-300" /></div>
              <select className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none bg-white text-slate-600" value={modeFilter} onChange={e => setModeFilter(e.target.value)}>
                {["Tous","Espèce","Chèque","Traite","Virement"].map(m => <option key={m}>{m}</option>)}
              </select>
              <select className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none bg-white text-slate-600">
                {["État : tous","En attente","Encaissé","Impayé","Retourné"].map(e => <option key={e}>{e}</option>)}
              </select>
              <button className="flex items-center gap-1.5 border border-slate-200 text-slate-600 px-3 py-2 rounded-xl text-sm hover:bg-slate-50 transition"><Printer size={14} /> Imprimer</button>
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>{["N°","Date","Client","N°CMD","Mode paiement","Montant","Échéance","État","Emplacement"].map(h => <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {REGLEMENTS.map((r, i) => (
                    <motion.tr key={r.n} className="hover:bg-slate-50 transition" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}>
                      <td className="px-3 py-3 text-slate-500 text-xs">{r.n}</td>
                      <td className="px-3 py-3 text-slate-600 text-xs">{r.date}</td>
                      <td className="px-3 py-3 font-medium text-slate-800">{r.client}</td>
                      <td className="px-3 py-3 font-mono text-xs text-slate-500">{r.cmd}</td>
                      <td className="px-3 py-3"><span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-medium">{r.mode}</span></td>
                      <td className="px-3 py-3 font-bold text-slate-800">{r.montant.toFixed(3)}</td>
                      <td className="px-3 py-3 text-slate-500 text-xs">{r.echeance}</td>
                      <td className="px-3 py-3"><span className={`text-xs px-2.5 py-1 rounded-full font-medium ${ETAT_STYLE[r.etat] || ""}`}>{r.etat}</span></td>
                      <td className="px-3 py-3 text-slate-500 text-xs">{r.empl}</td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "Comptes bancaires" && (
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-700">Comptes bancaires</h3>
              <button className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-2 rounded-xl text-sm font-medium hover:bg-blue-500 transition"><Plus size={14} /> Ajouter</button>
            </div>
            <div className="grid sm:grid-cols-3 gap-4">
              {COMPTES.map((c, i) => (
                <motion.div key={c.id} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm"
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center"><Wallet size={18} className="text-blue-600" /></div>
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{c.type}</span>
                  </div>
                  <div className="font-bold text-slate-800">{c.label}</div>
                  <div className="text-slate-400 text-xs mt-0.5">{c.banque} · {c.rib}</div>
                  <div className="mt-3 pt-3 border-t border-slate-50">
                    <div className="text-2xl font-black text-emerald-600">{c.solde.toLocaleString("fr-TN")} TND</div>
                    <div className="text-slate-400 text-xs mt-0.5">Solde disponible</div>
                  </div>
                </motion.div>
              ))}
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between">
              <span className="font-bold text-blue-800">Trésorerie totale</span>
              <span className="font-black text-blue-700 text-xl">{COMPTES.reduce((s,c) => s + c.solde, 0).toLocaleString("fr-TN")} TND</span>
            </div>
          </div>
        )}

        {tab === "Balance globale" && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800">Balance globale de trésorerie</h3>
              <div className="flex gap-2">
                <button className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-500 transition">RÉSULTAT</button>
                <button className="border border-slate-200 text-slate-600 px-4 py-2 rounded-xl text-sm hover:bg-slate-50 transition"><Printer size={14} /></button>
              </div>
            </div>
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { label: "Total encaissements", value: `${totalEncaisse.toFixed(3)} TND`, icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50" },
                { label: "Total décaissements", value: "8 450.000 TND", icon: TrendingDown, color: "text-red-600", bg: "bg-red-50" },
                { label: "Solde net", value: `${(totalEncaisse - 8450).toFixed(3)} TND`, icon: Wallet, color: "text-blue-600", bg: "bg-blue-50" },
              ].map(s => (
                <div key={s.label} className={`${s.bg} rounded-2xl p-5 border border-slate-100`}>
                  <s.icon size={20} className={`${s.color} mb-2`} />
                  <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
                  <div className="text-slate-500 text-sm mt-1">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!["Règlements clients","Comptes bancaires","Balance globale"].includes(tab) && (
          <div className="p-8 text-center text-slate-400">
            <CreditCard size={36} className="mx-auto mb-3 opacity-20" />
            <div className="font-semibold text-slate-600">{tab}</div>
            <p className="text-sm mt-1">Module disponible</p>
          </div>
        )}
      </div>
    </div>
  );
}
