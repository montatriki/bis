"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { DUMMY_CLIENTS } from "@/lib/dummy-data";

const RECLAMATIONS = [
  { id: "REC-001", client: "AGIL BEJA SUD", type: "Produit endommagé", date: "15/05/2026", status: "open", description: "Carton abîmé lors de la livraison, 3 articles cassés" },
  { id: "REC-002", client: "Papeterie Centrale", type: "Erreur de quantité", date: "14/05/2026", status: "processing", description: "Livré 10 unités au lieu de 15 commandées" },
  { id: "REC-003", client: "Librairie Saphir", type: "Produit non conforme", date: "12/05/2026", status: "resolved", description: "Mauvaise référence livrée, échange effectué" },
  { id: "REC-004", client: "Grossiste El Amal", type: "Retard de livraison", date: "11/05/2026", status: "resolved", description: "Livraison avec 2 jours de retard" },
];

const STATUS = {
  open: { label: "Ouvert", icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50", border: "border-red-200" },
  processing: { label: "En traitement", icon: Clock, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
  resolved: { label: "Résolu", icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200" },
};

const TYPES = ["Produit endommagé", "Erreur de quantité", "Produit non conforme", "Retard de livraison", "Autre"];

export default function ReclamationPage() {
  const [claims, setClaims] = useState(RECLAMATIONS);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ client: "", type: TYPES[0], description: "" });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const newClaim = {
      id: `REC-${String(claims.length + 1).padStart(3, "0")}`,
      client: form.client,
      type: form.type,
      date: "17/05/2026",
      status: "open" as const,
      description: form.description,
    };
    setClaims(prev => [newClaim, ...prev]);
    setShowForm(false);
    setForm({ client: "", type: TYPES[0], description: "" });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Réclamations</h1>
          <p className="text-slate-500 text-sm">{claims.filter(c => c.status === "open").length} ouverte(s) • {claims.length} total</p>
        </div>
        <motion.button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl font-medium hover:bg-blue-500 transition text-sm"
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Plus size={16} /> AJOUTER
        </motion.button>
      </div>

      <div className="space-y-3">
        {claims.map((c, i) => {
          const s = STATUS[c.status as keyof typeof STATUS];
          return (
            <motion.div key={c.id} className={`bg-white rounded-2xl border shadow-sm p-4 ${s.border}`}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs text-slate-400">{c.id}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${s.bg} ${s.color} flex items-center gap-1`}>
                      <s.icon size={10} />{s.label}
                    </span>
                  </div>
                  <div className="font-semibold text-slate-800">{c.client}</div>
                  <div className="text-slate-500 text-xs">{c.type} — {c.date}</div>
                </div>
              </div>
              <p className="text-slate-600 text-sm bg-slate-50 rounded-xl px-3 py-2">{c.description}</p>
            </motion.div>
          );
        })}
      </div>

      {/* Add Modal */}
      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div className="bg-white rounded-2xl shadow-2xl w-full max-w-md"
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
              <div className="flex items-center justify-between p-5 border-b border-slate-100">
                <h3 className="font-bold text-slate-800">Nouvelle réclamation</h3>
                <button onClick={() => setShowForm(false)}><X size={18} className="text-slate-400" /></button>
              </div>
              <form onSubmit={handleSubmit} className="p-5 space-y-4">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Client *</label>
                  <select required value={form.client} onChange={e => setForm(f => ({ ...f, client: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-300">
                    <option value="">Sélectionner un client</option>
                    {DUMMY_CLIENTS.map(c => <option key={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Type de réclamation *</label>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-300">
                    {TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Description *</label>
                  <textarea required value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    rows={3} placeholder="Décrivez la réclamation..."
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-300 resize-none" />
                </div>
                <div className="flex gap-3 pt-1">
                  <button type="submit" className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl font-medium hover:bg-blue-500 transition text-sm">
                    Soumettre
                  </button>
                  <button type="button" onClick={() => setShowForm(false)} className="flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-xl hover:bg-slate-50 transition text-sm">
                    Annuler
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
