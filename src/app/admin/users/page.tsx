"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Edit, Trash2, Shield, TrendingUp, MapPin, ShoppingBag, Search, X } from "lucide-react";

const USERS = [
  { id: 1, name: "Admin Système", login: "admin", email: "admin@bis.tn", role: "ADMIN", status: "active", lastLogin: "2026-05-17 09:12" },
  { id: 2, name: "Rachid Mansouri", login: "manager", email: "manager@bis.tn", role: "MANAGER", status: "active", lastLogin: "2026-05-17 08:45" },
  { id: 3, name: "Mokhtar Trabelsi", login: "mokhtar", email: "mokhtar@bis.tn", role: "COMMERCIAL", status: "active", lastLogin: "2026-05-17 07:30", vehicle: "206TU7140", zone: "Nord", clients: 111 },
  { id: 4, name: "HICHEM", login: "hichem", email: "hichem@bis.tn", role: "COMMERCIAL", status: "active", lastLogin: "2026-05-16 18:22", vehicle: "238TU1019", zone: "Centre", clients: 87 },
  { id: 5, name: "FOUED", login: "foued", email: "foued@bis.tn", role: "COMMERCIAL", status: "active", lastLogin: "2026-05-17 07:15", vehicle: "243TU3251", zone: "Côte", clients: 98 },
  { id: 6, name: "AGIL BEJA SUD", login: "client", email: "agil@beja.tn", role: "CLIENT", status: "active", lastLogin: "2026-05-15 14:00" },
];

const ROLE_CONFIG = {
  ADMIN: { color: "bg-slate-700", icon: Shield, label: "Admin" },
  MANAGER: { color: "bg-blue-600", icon: TrendingUp, label: "Manager" },
  COMMERCIAL: { color: "bg-emerald-600", icon: MapPin, label: "Commercial" },
  CLIENT: { color: "bg-amber-600", icon: ShoppingBag, label: "Client" },
};

const MODULES = ["Stock", "Achat", "Vente", "CRM", "GRH", "Trésorerie", "GPAO", "Parc Roulant", "Enregistrements"];

export default function UsersPage() {
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<typeof USERS[0] | null>(null);
  const [activeTab, setActiveTab] = useState("Identité");

  const filtered = USERS.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.role.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Gestion des utilisateurs</h1>
          <p className="text-slate-500 text-sm">{USERS.length} utilisateurs enregistrés</p>
        </div>
        <motion.button onClick={() => { setSelectedUser(null); setShowModal(true); }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl font-medium transition"
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Plus size={16} /> Nouvel utilisateur
        </motion.button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {/* Search */}
        <div className="p-4 border-b border-slate-100">
          <div className="relative max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un utilisateur..."
              className="pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl w-full focus:outline-none focus:border-blue-300" />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {["Utilisateur", "Login", "Rôle", "Statut", "Dernière connexion", "Actions"].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((u, i) => {
                const rc = ROLE_CONFIG[u.role as keyof typeof ROLE_CONFIG];
                const Icon = rc.icon;
                return (
                  <motion.tr key={u.id} className="hover:bg-slate-50 transition"
                    initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg ${rc.color} flex items-center justify-center text-white text-xs font-bold`}>
                          {u.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-medium text-slate-800 text-sm">{u.name}</div>
                          <div className="text-slate-400 text-xs">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-sm font-mono">{u.login}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg text-white ${rc.color}`}>
                        <Icon size={11} /> {rc.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> Actif
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{u.lastLogin}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => { setSelectedUser(u); setShowModal(true); }}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition">
                          <Edit size={14} />
                        </button>
                        <button className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden"
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
              <div className="flex items-center justify-between p-6 border-b border-slate-100">
                <h2 className="text-lg font-bold text-slate-800">
                  {selectedUser ? "Modifier l'utilisateur" : "Nouvel utilisateur"}
                </h2>
                <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 rounded-xl transition">
                  <X size={18} />
                </button>
              </div>
              {/* Tabs */}
              <div className="flex border-b border-slate-100">
                {["Identité", "Rôle & Accès", "Modules"].map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className={`px-5 py-3 text-sm font-medium transition ${activeTab === tab ? "text-blue-600 border-b-2 border-blue-600" : "text-slate-500 hover:text-slate-700"}`}>
                    {tab}
                  </button>
                ))}
              </div>
              <div className="p-6">
                {activeTab === "Identité" && (
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: "Nom complet", placeholder: "Mokhtar Trabelsi", defaultValue: selectedUser?.name },
                      { label: "Email", placeholder: "email@bis.tn", defaultValue: selectedUser?.email },
                      { label: "Login", placeholder: "mokhtar", defaultValue: selectedUser?.login },
                      { label: "Téléphone", placeholder: "+216 XX XXX XXX" },
                    ].map(f => (
                      <div key={f.label}>
                        <label className="text-sm font-medium text-slate-700 mb-1 block">{f.label}</label>
                        <input defaultValue={f.defaultValue}
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                          placeholder={f.placeholder} />
                      </div>
                    ))}
                  </div>
                )}
                {activeTab === "Rôle & Accès" && (
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(ROLE_CONFIG).map(([role, rc]) => {
                      const Icon = rc.icon;
                      return (
                        <div key={role}
                          className={`border-2 rounded-xl p-4 cursor-pointer transition ${selectedUser?.role === role ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-slate-300"}`}>
                          <div className={`w-8 h-8 rounded-lg ${rc.color} flex items-center justify-center text-white mb-2`}>
                            <Icon size={16} />
                          </div>
                          <div className="font-medium text-slate-800 text-sm">{rc.label}</div>
                          <div className="text-slate-400 text-xs mt-0.5">{role}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {activeTab === "Modules" && (
                  <div className="grid grid-cols-3 gap-3">
                    {MODULES.map(m => (
                      <label key={m} className="flex items-center gap-2 p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition">
                        <input type="checkbox" defaultChecked={m !== "Enregistrements"} className="accent-blue-600" />
                        <span className="text-sm text-slate-700">{m}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-3 p-6 border-t border-slate-100">
                <button onClick={() => setShowModal(false)}
                  className="flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-xl font-medium hover:bg-slate-50 transition">
                  Annuler
                </button>
                <button className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl font-medium hover:bg-blue-500 transition">
                  {selectedUser ? "Sauvegarder" : "Créer"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
