"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Download, Eye, Search, RefreshCw, Package, CreditCard, ArrowLeftRight } from "lucide-react";

const ALL_DOCS = [
  { id: "BL-2026-0087", type: "BL", date: "15/05/2026", amount: 2340.50, items: 8, status: "Livré", commercial: "Mokhtar" },
  { id: "FAC-2026-042", type: "FAC", date: "15/05/2026", amount: 2340.50, items: 8, status: "Émise", commercial: "Mokhtar" },
  { id: "BL-2026-0074", type: "BL", date: "10/05/2026", amount: 1850.00, items: 5, status: "Livré", commercial: "Mokhtar" },
  { id: "BL-2026-0061", type: "BL", date: "05/05/2026", amount: 3100.75, items: 12, status: "Livré", commercial: "FOUED" },
  { id: "FAC-2026-038", type: "FAC", date: "05/05/2026", amount: 3100.75, items: 12, status: "Payée", commercial: "FOUED" },
  { id: "AV-2026-008", type: "AV", date: "02/05/2026", amount: -240.00, items: 2, status: "Validé", commercial: "Mokhtar" },
  { id: "BL-2026-0053", type: "BL", date: "28/04/2026", amount: 4200.00, items: 18, status: "Livré", commercial: "Mokhtar" },
  { id: "FAC-2026-031", type: "FAC", date: "28/04/2026", amount: 4200.00, items: 18, status: "Payée", commercial: "Mokhtar" },
  { id: "REG-2026-019", type: "REG", date: "20/04/2026", amount: 4200.00, items: 0, status: "Encaissé", commercial: "Mokhtar" },
  { id: "REG-2026-011", type: "REG", date: "05/04/2026", amount: 3100.75, items: 0, status: "Encaissé", commercial: "FOUED" },
];

const TABS = [
  { id: "ALL", label: "Tous", icon: FileText, filter: () => true },
  { id: "BL", label: "Tickets / BL", icon: Package, filter: (d: typeof ALL_DOCS[0]) => d.type === "BL" },
  { id: "FAC", label: "Factures", icon: FileText, filter: (d: typeof ALL_DOCS[0]) => d.type === "FAC" },
  { id: "AV", label: "Avoirs", icon: ArrowLeftRight, filter: (d: typeof ALL_DOCS[0]) => d.type === "AV" },
  { id: "REG", label: "Règlements", icon: CreditCard, filter: (d: typeof ALL_DOCS[0]) => d.type === "REG" },
];

const TYPE_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  BL: { bg: "bg-blue-50", text: "text-blue-700", label: "Bon de livraison" },
  FAC: { bg: "bg-purple-50", text: "text-purple-700", label: "Facture" },
  AV: { bg: "bg-red-50", text: "text-red-600", label: "Avoir" },
  REG: { bg: "bg-emerald-50", text: "text-emerald-700", label: "Règlement" },
};

const STATUS_STYLE: Record<string, string> = {
  "Livré": "text-emerald-600",
  "Émise": "text-amber-600",
  "Payée": "text-emerald-600",
  "Validé": "text-blue-600",
  "Encaissé": "text-emerald-600",
  "En attente": "text-amber-600",
};

export default function HistoriquePage() {
  const [activeTab, setActiveTab] = useState("ALL");
  const [search, setSearch] = useState("");

  const tab = TABS.find(t => t.id === activeTab)!;
  const filtered = ALL_DOCS.filter(d =>
    tab.filter(d) &&
    (d.id.toLowerCase().includes(search.toLowerCase()) || d.commercial.toLowerCase().includes(search.toLowerCase()))
  );

  const totalBL = ALL_DOCS.filter(d => d.type === "BL").length;
  const totalFAC = ALL_DOCS.filter(d => d.type === "FAC").length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Historique</h1>
          <p className="text-slate-500 text-sm">{totalBL} BL · {totalFAC} factures — Mai 2026</p>
        </div>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl w-64 focus:outline-none focus:border-blue-300"
            placeholder="Rechercher..." />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map(t => {
          const Icon = t.icon;
          const count = ALL_DOCS.filter(t.filter).length;
          return (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition ${activeTab === t.id ? "bg-slate-800 text-white shadow-sm" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
              <Icon size={14} />
              {t.label}
              {count > 0 && <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${activeTab === t.id ? "bg-white/20" : "bg-slate-100"}`}>{count}</span>}
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {["N° Document", "Type", "Date", "Articles", "Montant TTC", "Commercial", "Statut", "Actions"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {filtered.map((doc, i) => {
                  const typeStyle = TYPE_STYLE[doc.type] || { bg: "bg-slate-50", text: "text-slate-600", label: doc.type };
                  return (
                    <motion.tr key={doc.id} className="border-b border-slate-50 hover:bg-slate-50 transition"
                      initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: i * 0.03 }}>
                      <td className="px-4 py-3.5 font-semibold text-slate-800 text-sm">{doc.id}</td>
                      <td className="px-4 py-3.5">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${typeStyle.bg} ${typeStyle.text}`}>{typeStyle.label}</span>
                      </td>
                      <td className="px-4 py-3.5 text-slate-500 text-sm whitespace-nowrap">{doc.date}</td>
                      <td className="px-4 py-3.5 text-slate-500 text-sm">{doc.items > 0 ? `${doc.items} art.` : "—"}</td>
                      <td className="px-4 py-3.5 font-bold text-sm whitespace-nowrap">
                        <span className={doc.amount < 0 ? "text-red-600" : "text-slate-800"}>
                          {doc.amount < 0 ? "−" : ""}{Math.abs(doc.amount).toFixed(2)} TND
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-slate-500 text-sm">{doc.commercial}</td>
                      <td className="px-4 py-3.5">
                        <span className={`text-xs font-medium ${STATUS_STYLE[doc.status] || "text-slate-500"}`}>{doc.status}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex gap-1">
                          <button title="Voir détail" className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition">
                            <Eye size={14} />
                          </button>
                          <button title="Télécharger PDF" className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition">
                            <Download size={14} />
                          </button>
                          {doc.type === "BL" && (
                            <button title="Recommander" className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition">
                              <RefreshCw size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <FileText size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Aucun document trouvé</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
