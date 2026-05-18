"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { MapPin, Phone, DollarSign, Star, Plus, Search, AlertCircle, CheckCircle, Clock } from "lucide-react";
import { DUMMY_CLIENTS } from "@/lib/dummy-data";

const SUB_TABS = ["Contacts","Opportunités","Mailing","Tickets SAV","Paramètres"];

const TICKETS = [
  { id: "SAV-001", client: "AGIL BEJA SUD", date: "15/05/2026", reclamation: "Livraison en retard — 3 jours de délai dépassé", etat: "En cours", intervenant: "Mokhtar", machine: "" },
  { id: "SAV-002", client: "librairie saphir", date: "13/05/2026", reclamation: "2 articles défectueux — coffret echec cassé", etat: "Ouvert", intervenant: "", machine: "" },
  { id: "SAV-003", client: "AGIL MAHDIA", date: "10/05/2026", reclamation: "Erreur facturation — montant incorrect", etat: "Réparé", intervenant: "Admin", machine: "" },
];

const ETAT_STYLE: Record<string, string> = {
  "Ouvert": "bg-red-100 text-red-700",
  "En cours": "bg-amber-100 text-amber-700",
  "Réparé": "bg-blue-100 text-blue-700",
  "Livré": "bg-emerald-100 text-emerald-700",
};

const PIPELINE = [
  { stage: "Lead", count: 8, value: "24 000", color: "bg-slate-200" },
  { stage: "Prospect", count: 5, value: "62 500", color: "bg-blue-200" },
  { stage: "Proposition", count: 3, value: "48 000", color: "bg-amber-200" },
  { stage: "Négociation", count: 2, value: "31 000", color: "bg-orange-200" },
  { stage: "Gagné", count: 4, value: "87 500", color: "bg-emerald-200" },
];

export default function CRMPage() {
  const [tab, setTab] = useState("Contacts");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("Tous");

  const filtered = DUMMY_CLIENTS.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">CRM — Gestion Relation Client</h1>
          <p className="text-slate-500 text-sm">{DUMMY_CLIENTS.length} contacts · {TICKETS.filter(t => t.etat !== "Livré").length} tickets ouverts</p>
        </div>
        <div className="flex gap-3">
          {[["8", "Leads actifs", "text-blue-700 bg-blue-50 border-blue-200"],["3", "Tickets urgents", "text-red-700 bg-red-50 border-red-200"]].map(([v,l,cls]) => (
            <div key={l} className={`border rounded-xl px-4 py-2 text-center ${cls}`}>
              <div className="text-lg font-bold">{v}</div>
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

        {tab === "Contacts" && (
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 min-w-48">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un contact..." className="pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl w-full focus:outline-none focus:border-blue-300" />
              </div>
              {["Tous","Leads","Prospects","Clients"].map(f => (
                <button key={f} onClick={() => setFilter(f)} className={`px-3 py-2 rounded-xl text-sm font-medium transition ${filter === f ? "bg-slate-800 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>{f}</button>
              ))}
              <button className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-2 rounded-xl text-sm font-medium hover:bg-blue-500 transition ml-auto"><Plus size={14} /> Ajouter</button>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((c, i) => (
                <motion.div key={c.name} className="border border-slate-100 rounded-2xl p-4 hover:shadow-md hover:border-blue-200 transition cursor-pointer"
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {c.name.charAt(0)}
                    </div>
                    <button className="text-slate-300 hover:text-amber-400 transition"><Star size={14} /></button>
                  </div>
                  <div className="font-semibold text-slate-800 text-sm mb-1 leading-tight">{c.name}</div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500"><MapPin size={10} /> {c.city}, {c.governorate}</div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500"><Phone size={10} /> +216 XX XXX XXX</div>
                    <div className="flex items-center gap-1.5 text-xs">
                      <DollarSign size={10} className={c.balance > 0 ? "text-red-500" : "text-emerald-500"} />
                      <span className={`font-semibold ${c.balance > 0 ? "text-red-600" : "text-emerald-600"}`}>{c.balance.toFixed(3)} TND</span>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-50 flex items-center justify-between">
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{c.category}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.riskScore > 60 ? "bg-red-100 text-red-700" : c.riskScore > 30 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                      Score: {c.riskScore}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {tab === "Opportunités" && (
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-700">Pipeline commercial</h3>
              <button className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-2 rounded-xl text-sm font-medium hover:bg-blue-500 transition"><Plus size={14} /> Opportunité</button>
            </div>
            <div className="grid sm:grid-cols-5 gap-3">
              {PIPELINE.map((p, i) => (
                <motion.div key={p.stage} className="bg-white border border-slate-100 rounded-2xl p-4 text-center"
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                  <div className={`w-full h-2 rounded-full mb-3 ${p.color}`} />
                  <div className="font-bold text-slate-800 text-lg">{p.count}</div>
                  <div className="font-semibold text-slate-600 text-sm">{p.stage}</div>
                  <div className="text-blue-700 font-bold text-sm mt-1">{p.value} TND</div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {tab === "Tickets SAV" && (
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-700">Gestion des tickets SAV</h3>
              <button className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-2 rounded-xl text-sm font-medium hover:bg-blue-500 transition"><Plus size={14} /> Ticket SAV</button>
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>{["#","Client","Date réclamation","Réclamation","État","Intervenant"].map(h => <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {TICKETS.map((t, i) => (
                    <motion.tr key={t.id} className="hover:bg-slate-50 transition" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.06 }}>
                      <td className="px-3 py-3 font-mono text-xs text-slate-500">{t.id}</td>
                      <td className="px-3 py-3 font-medium text-slate-800">{t.client}</td>
                      <td className="px-3 py-3 text-slate-500 text-xs">{t.date}</td>
                      <td className="px-3 py-3 text-slate-700 max-w-xs">{t.reclamation}</td>
                      <td className="px-3 py-3"><span className={`text-xs px-2.5 py-1 rounded-full font-medium ${ETAT_STYLE[t.etat] || "bg-slate-100 text-slate-600"}`}>{t.etat}</span></td>
                      <td className="px-3 py-3 text-slate-600">{t.intervenant || <span className="text-slate-300">—</span>}</td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!["Contacts","Opportunités","Tickets SAV"].includes(tab) && (
          <div className="p-8 text-center text-slate-400">
            <AlertCircle size={36} className="mx-auto mb-3 opacity-20" />
            <div className="font-semibold text-slate-600">{tab}</div>
            <p className="text-sm mt-1">Module disponible</p>
          </div>
        )}
      </div>
    </div>
  );
}
