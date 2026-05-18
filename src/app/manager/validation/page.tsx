"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, XCircle, Eye } from "lucide-react";

const PENDING = [
  { id: "BC-2026-0042", type: "Bon de commande", commercial: "Mokhtar", client: "AGIL BEJA SUD", amount: 5840, discount: 8, urgency: "normal", items: 12, createdAt: "17/05/2026 08:30" },
  { id: "BC-2026-0043", type: "Bon de commande", commercial: "FOUED", client: "Grossiste El Wafa", amount: 3200, discount: 6, urgency: "normal", items: 8, createdAt: "17/05/2026 09:15" },
  { id: "AV-2026-0011", type: "Avoir", commercial: "HICHEM", client: "librairie saphir", amount: 1240, discount: 0, urgency: "urgent", items: 3, createdAt: "16/05/2026 16:45" },
  { id: "REM-2026-005", type: "Remise exceptionnelle 18%", commercial: "Mokhtar", client: "AGIL MAHDIA", amount: 7100, discount: 18, urgency: "urgent", items: 20, createdAt: "17/05/2026 07:00" },
];

export default function ValidationPage() {
  const [docs, setDocs] = useState(PENDING);
  const [selected, setSelected] = useState<typeof PENDING[0] | null>(null);

  function handleAction(id: string, action: "approve" | "reject") {
    setDocs(prev => prev.filter(d => d.id !== id));
    setSelected(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Validation des documents</h1>
          <p className="text-slate-500 text-sm">{docs.length} documents en attente</p>
        </div>
        {docs.some(d => d.urgency === "urgent") && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            <span className="text-red-600 font-medium text-sm">🚨 {docs.filter(d => d.urgency === "urgent").length} urgent(s)</span>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* List */}
        <div className="space-y-3">
          {docs.map((d, i) => (
            <motion.div key={d.id} layout
              className={`bg-white rounded-2xl border shadow-sm p-4 cursor-pointer transition ${selected?.id === d.id ? "border-blue-400 ring-2 ring-blue-100" : d.urgency === "urgent" ? "border-red-200" : "border-slate-100 hover:border-slate-200"}`}
              onClick={() => setSelected(d)}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-slate-400">{d.id}</span>
                    {d.urgency === "urgent" && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">Urgent</span>}
                    {d.discount > 12 && <span className="text-xs bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full font-medium">Remise {d.discount}%</span>}
                  </div>
                  <div className="font-semibold text-slate-800 mt-1">{d.client}</div>
                  <div className="text-slate-400 text-xs">{d.commercial} • {d.type} • {d.createdAt}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-slate-800">{d.amount.toLocaleString()} TND</div>
                  <div className="text-slate-400 text-xs">{d.items} articles</div>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <motion.button onClick={(e) => { e.stopPropagation(); handleAction(d.id, "approve"); }}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 py-2 rounded-xl hover:bg-emerald-100 transition font-medium"
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <CheckCircle size={13} /> Approuver
                </motion.button>
                <motion.button onClick={(e) => { e.stopPropagation(); handleAction(d.id, "reject"); }}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs bg-red-50 text-red-600 border border-red-200 py-2 rounded-xl hover:bg-red-100 transition font-medium"
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <XCircle size={13} /> Rejeter
                </motion.button>
              </div>
            </motion.div>
          ))}
          {docs.length === 0 && (
            <div className="text-center py-16 text-slate-400">
              <div className="text-4xl mb-3">✅</div>
              <div className="font-medium">Aucun document en attente</div>
            </div>
          )}
        </div>

        {/* Detail */}
        <AnimatePresence>
          {selected && (
            <motion.div className="bg-white rounded-2xl border border-blue-200 shadow-sm p-5"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
              <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Eye size={16} className="text-blue-500" /> Aperçu — {selected.id}
              </h3>
              <div className="space-y-3">
                {[
                  { label: "Type", value: selected.type },
                  { label: "Commercial", value: selected.commercial },
                  { label: "Client", value: selected.client },
                  { label: "Montant TTC", value: `${selected.amount.toLocaleString()} TND` },
                  { label: "Remise", value: selected.discount > 0 ? `${selected.discount}%` : "Aucune" },
                  { label: "Nb articles", value: `${selected.items} lignes` },
                  { label: "Créé le", value: selected.createdAt },
                ].map(f => (
                  <div key={f.label} className="flex items-center justify-between py-2 border-b border-slate-50">
                    <span className="text-slate-500 text-sm">{f.label}</span>
                    <span className="font-medium text-slate-800 text-sm">{f.value}</span>
                  </div>
                ))}
              </div>
              {selected.discount > 12 && (
                <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <div className="font-medium text-amber-800 text-sm">⚠️ Remise hors norme</div>
                  <p className="text-amber-700 text-xs mt-1">La remise accordée ({selected.discount}%) dépasse le seuil habituel (≤12%). Vérification recommandée.</p>
                </div>
              )}
              <div className="flex gap-3 mt-5">
                <button onClick={() => handleAction(selected.id, "approve")}
                  className="flex-1 bg-emerald-500 text-white py-2.5 rounded-xl font-medium hover:bg-emerald-400 transition text-sm">
                  ✅ Approuver
                </button>
                <button onClick={() => handleAction(selected.id, "reject")}
                  className="flex-1 bg-red-500 text-white py-2.5 rounded-xl font-medium hover:bg-red-400 transition text-sm">
                  ❌ Rejeter
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
