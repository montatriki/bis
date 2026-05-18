"use client";
import { Bell, Search, Menu } from "lucide-react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const NOTIFS = [
  { id: 1, title: "Stock minimum atteint", msg: "coffret echec 2025 — stock: 2", type: "STOCK", time: "5 min", icon: "📦", color: "bg-amber-50 text-amber-600 border border-amber-100" },
  { id: 2, title: "Chèque échu", msg: "1 chèque de 2 500 TND arrivé à échéance", type: "FINANCE", time: "1h", icon: "💰", color: "bg-red-50 text-red-650 border border-red-100" },
  { id: 3, title: "Véhicule hors ligne", msg: "238TU1019 — HICHEM hors ligne 2h", type: "GPS", time: "2h", icon: "🚗", color: "bg-blue-50 text-blue-600 border border-blue-100" },
  { id: 4, title: "Objectif atteint", msg: "FOUED a dépassé son objectif mensuel", type: "PERF", time: "3h", icon: "🏆", color: "bg-emerald-50 text-emerald-700 border border-emerald-100" },
];

const ROLE_META: Record<string, { label: string; color: string; bg: string }> = {
  ADMIN: { label: "Administrateur", color: "text-slate-700", bg: "bg-slate-100" },
  MANAGER: { label: "Manager", color: "text-blue-700", bg: "bg-blue-100" },
  COMMERCIAL: { label: "Commercial", color: "text-emerald-700", bg: "bg-emerald-100" },
  CLIENT: { label: "Client", color: "text-amber-700", bg: "bg-amber-100" },
};

export default function TopBar({ user }: { user: { name: string; role: string } }) {
  const [showNotifs, setShowNotifs] = useState(false);
  const [unread, setUnread] = useState(NOTIFS.length);
  const meta = ROLE_META[user.role] || ROLE_META.ADMIN;

  const toggleMobileSidebar = () => {
    window.dispatchEvent(new Event("toggle-mobile-sidebar"));
  };

  return (
    <header className="h-14 flex items-center px-4 md:px-6 gap-4 flex-shrink-0 shadow-sm transition-all duration-300 bg-[var(--bg-card)] border-b border-[var(--border-primary)] z-10">
      {/* Mobile Menu Hamburger button */}
      <button 
        onClick={toggleMobileSidebar}
        className="p-2.5 -ml-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-light)] md:hidden transition-all flex items-center justify-center flex-shrink-0 border border-transparent hover:border-[var(--border-primary)]"
      >
        <Menu size={18} />
      </button>

      {/* Search */}
      <div className="flex-1 max-w-md hidden sm:block">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] opacity-70" />
          <input placeholder="Rechercher client, produit, document..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-[var(--bg-primary)] rounded-xl border border-[var(--border-primary)] focus:border-[var(--accent-primary)] focus:outline-none focus:bg-[var(--bg-card)] transition placeholder:text-[var(--text-secondary)]/50 text-[var(--text-primary)]" />
        </div>
      </div>

      <div className="flex items-center gap-2 ml-auto">
        {/* Notifications */}
        <div className="relative">
          <button onClick={() => { setShowNotifs(!showNotifs); setUnread(0); }}
            className="relative p-2.5 rounded-xl hover:bg-[var(--accent-light)] transition text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent hover:border-[var(--border-primary)]">
            <Bell size={18} />
            {unread > 0 && (
              <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center shadow-sm">
                {unread}
              </span>
            )}
          </button>
          <AnimatePresence>
            {showNotifs && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setShowNotifs(false)} />
                <motion.div className="absolute right-0 top-full mt-2 w-80 bg-[var(--bg-card)] rounded-2xl shadow-2xl border border-[var(--border-primary)] z-40 overflow-hidden text-[var(--text-primary)]"
                  initial={{ opacity: 0, y: -8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.95 }}
                  transition={{ duration: 0.15 }}>
                  <div className="px-4 py-3 border-b border-[var(--border-primary)] flex items-center justify-between">
                    <div>
                      <div className="font-extrabold text-[var(--text-primary)] text-xs uppercase tracking-wider">Notifications</div>
                      <div className="text-[10px] text-[var(--text-secondary)] opacity-80 mt-0.5">{NOTIFS.length} alertes système</div>
                    </div>
                    <button className="text-[10px] font-black text-[var(--accent-primary)] hover:underline uppercase">Tout lire</button>
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-[var(--border-primary)] bg-[var(--bg-card)]">
                    {NOTIFS.map(n => (
                      <div key={n.id} className="flex gap-3 px-4 py-3 hover:bg-[var(--accent-light)] transition cursor-pointer">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm flex-shrink-0 shadow-sm ${n.color}`}>
                          {n.icon}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-black text-[var(--text-primary)] leading-tight">{n.title}</div>
                          <div className="text-[10px] text-[var(--text-secondary)] opacity-85 mt-0.5 leading-snug">{n.msg}</div>
                          <div className="text-[8px] text-[var(--text-secondary)] opacity-60 mt-1 uppercase font-mono">Il y a {n.time}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="px-4 py-2.5 border-t border-[var(--border-primary)] text-center bg-[var(--bg-primary)]/40">
                    <button className="text-[10px] font-black text-[var(--accent-primary)] hover:underline uppercase">Voir toutes les notifications</button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* User profile dropdown button */}
        <div className="flex items-center gap-2.5 pl-2.5 border-l border-[var(--border-primary)]">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-black flex-shrink-0 shadow-sm"
            style={{ background: "var(--accent-primary)" }}>
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="hidden sm:block">
            <div className="text-xs font-black text-[var(--text-primary)] leading-tight">{user.name}</div>
            <div className="text-[9px] font-bold uppercase tracking-wider opacity-75 mt-0.5" style={{ color: "var(--accent-primary)" }}>{meta.label}</div>
          </div>
        </div>
      </div>
    </header>
  );
}
