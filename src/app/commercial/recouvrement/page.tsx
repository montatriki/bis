"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, FileText, CreditCard, Banknote } from "lucide-react";
import { DUMMY_CLIENTS } from "@/lib/dummy-data";

const RECOUVREMENT = DUMMY_CLIENTS.filter(c => c.balance > 0).map(c => ({
  ...c,
  docs: [
    { id: `TIC-${Math.floor(Math.random() * 9000 + 1000)}`, type: "TIC", date: "10/05/2026", amount: c.balance * 0.6 },
    { id: `AV-${Math.floor(Math.random() * 9000 + 1000)}`, type: "AV", date: "12/05/2026", amount: -(c.balance * 0.1) },
  ]
}));

export default function RecouvrementPage() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<typeof RECOUVREMENT[0] | null>(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const [payAmount, setPayAmount] = useState("");

  const filtered = RECOUVREMENT.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const totalCreances = RECOUVREMENT.reduce((s, c) => s + c.balance, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Recouvrement</h1>
          <p className="text-slate-500 text-sm">{filtered.length} clients avec solde débiteur</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2 text-center">
          <div className="text-lg font-bold text-red-600">{totalCreances.toFixed(2)} TND</div>
          <div className="text-red-400 text-xs">Créances totales</div>
        </div>
      </div>

      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          className="pl-9 pr-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl w-full focus:outline-none focus:border-blue-300"
          placeholder="Rechercher un client..." />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="space-y-3">
          {filtered.map((c, i) => (
            <motion.div key={c.name}
              className={`bg-white rounded-2xl border shadow-sm p-4 cursor-pointer transition ${selected?.name === c.name ? "border-blue-400 ring-2 ring-blue-100" : "border-slate-100 hover:border-slate-200"}`}
              onClick={() => setSelected(c)}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-red-50 text-red-600 font-bold text-sm flex items-center justify-center flex-shrink-0">
                    {c.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-800 text-sm truncate">{c.name}</div>
                    <div className="text-slate-400 text-xs">{c.city} — {c.governorate}</div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-bold text-red-600 text-sm">{c.balance.toFixed(2)} TND</div>
                  <div className="text-slate-400 text-xs">Solde débiteur</div>
                </div>
              </div>
              <div className="flex gap-2">
                {["TIC", "AV", "BR"].map(type => (
                  <button key={type} onClick={e => { e.stopPropagation(); setSelected(c); }}
                    className="flex-1 text-xs py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition font-medium">
                    {type}
                  </button>
                ))}
                <button onClick={e => { e.stopPropagation(); setSelected(c); setShowPayModal(true); setPayAmount(c.balance.toFixed(2)); }}
                  className="flex-1 text-xs py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition font-medium flex items-center justify-center gap-1">
                  <CreditCard size={11} /> Encaisser
                </button>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Document detail */}
        <AnimatePresence>
          {selected && (
            <motion.div className="bg-white rounded-2xl border border-blue-200 shadow-sm overflow-hidden"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
              <div className="bg-slate-800 text-white p-4">
                <div className="font-bold">{selected.name}</div>
                <div className="text-slate-400 text-xs mt-0.5">{selected.city} — {selected.governorate}</div>
              </div>
              <div className="p-5">
                <h3 className="font-semibold text-slate-700 text-sm mb-3">Documents en cours</h3>
                <div className="space-y-2 mb-4">
                  {selected.docs.map(doc => (
                    <div key={doc.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl text-sm">
                      <div className="flex items-center gap-2">
                        <FileText size={14} className="text-slate-400" />
                        <div>
                          <div className="font-medium text-slate-800">{doc.id}</div>
                          <div className="text-slate-400 text-xs">{doc.date}</div>
                        </div>
                      </div>
                      <span className={`font-bold text-sm ${doc.amount > 0 ? "text-red-600" : "text-emerald-600"}`}>
                        {doc.amount > 0 ? "+" : ""}{doc.amount.toFixed(2)} TND
                      </span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-slate-100 pt-3 mb-4">
                  <div className="flex justify-between font-bold text-sm">
                    <span className="text-slate-700">Solde total</span>
                    <span className="text-red-600">{selected.balance.toFixed(2)} TND</span>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => { setShowPayModal(true); setPayAmount(selected.balance.toFixed(2)); }}
                    className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 text-white py-2.5 rounded-xl font-medium hover:bg-emerald-400 transition text-sm">
                    <Banknote size={15} /> Encaisser
                  </button>
                  <button onClick={() => setSelected(null)} className="px-4 border border-slate-200 text-slate-600 py-2.5 rounded-xl hover:bg-slate-50 transition text-sm">
                    Fermer
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Payment Modal */}
      <AnimatePresence>
        {showPayModal && selected && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6"
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-800">Encaissement</h3>
                <button onClick={() => setShowPayModal(false)}><X size={18} className="text-slate-400" /></button>
              </div>
              <div className="text-sm text-slate-500 mb-1">{selected.name}</div>
              <div className="text-red-600 font-bold mb-4">Solde: {selected.balance.toFixed(2)} TND</div>
              <div className="mb-4">
                <label className="text-xs text-slate-500 mb-1 block">Montant encaissé (TND)</label>
                <input value={payAmount} onChange={e => setPayAmount(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-lg font-bold focus:outline-none focus:border-emerald-400 text-center"
                  type="number" />
              </div>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {["Espèces", "Chèque", "Virement"].map(mode => (
                  <button key={mode} className="py-2 text-xs border border-slate-200 rounded-xl hover:bg-slate-50 transition text-slate-600">
                    {mode}
                  </button>
                ))}
              </div>
              <button className="w-full bg-emerald-500 text-white py-3 rounded-xl font-bold hover:bg-emerald-400 transition">
                Confirmer l'encaissement
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
