"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import {
  LayoutDashboard, Users, Map, ShoppingBag, Calendar, CreditCard,
  FileText, MessageSquare, Package, BarChart3, CheckSquare, Target,
  Mic, LogOut, ChevronLeft, ChevronRight, ShieldCheck, TrendingUp,
  Truck, History, ShoppingCart, X, Menu, MapPin, Boxes, Building2,
  UserCheck, Wallet, Car, Cpu
} from "lucide-react";

type NavItem = { href: string; label: string; icon: React.ElementType; badge?: string };

const NAV_ADMIN: NavItem[] = [
  { href: "/admin/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/admin/stock", label: "Stock", icon: Boxes, badge: "9+" },
  { href: "/admin/achat", label: "Achat", icon: ShoppingCart },
  { href: "/admin/crm", label: "CRM", icon: Building2 },
  { href: "/admin/vente", label: "Vente", icon: TrendingUp },
  { href: "/admin/tresorerie", label: "Trésorerie", icon: Wallet },
  { href: "/admin/grh", label: "GRH", icon: UserCheck },
  { href: "/admin/parc-roulant", label: "Parc Roulant", icon: Car, badge: "GPS" },
  { href: "/admin/rapports-admin", label: "Rapports", icon: BarChart3 },
  { href: "/admin/users", label: "Utilisateurs", icon: Users },
  { href: "/admin/recordings", label: "Enregistrements", icon: Mic },
];

const NAV_MANAGER: NavItem[] = [
  { href: "/manager/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/manager/supervision", label: "Supervision GPS", icon: Map },
  { href: "/manager/validation", label: "Validation docs", icon: CheckSquare, badge: "4" },
  { href: "/manager/objectifs", label: "Objectifs", icon: Target },
  { href: "/manager/rapports", label: "Rapports", icon: BarChart3 },
];

const NAV_COMMERCIAL: NavItem[] = [
  { href: "/commercial/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/commercial/clients", label: "Mes clients", icon: Users },
  { href: "/commercial/map", label: "Carte GPS", icon: MapPin },
  { href: "/commercial/planning", label: "Planning du jour", icon: Calendar },
  { href: "/commercial/catalogue", label: "Catalogue", icon: ShoppingBag },
  { href: "/commercial/recouvrement", label: "Recouvrement", icon: CreditCard },
  { href: "/commercial/retour-stock", label: "Stock véhicule", icon: Package },
  { href: "/commercial/journal", label: "Journal de caisse", icon: FileText },
  { href: "/commercial/reclamation", label: "Réclamations", icon: MessageSquare },
];

const NAV_CLIENT: NavItem[] = [
  { href: "/client/dashboard", label: "Accueil", icon: LayoutDashboard },
  { href: "/client/commander", label: "Commander", icon: ShoppingCart },
  { href: "/client/historique", label: "Historique", icon: History },
  { href: "/client/suivi", label: "Suivi livraison", icon: Truck },
];

const ROLE_CONFIG = {
  ADMIN: { nav: NAV_ADMIN, accent: "#b56e2d", label: "Administration", icon: ShieldCheck },
  MANAGER: { nav: NAV_MANAGER, accent: "#4e3621", label: "Management", icon: TrendingUp },
  COMMERCIAL: { nav: NAV_COMMERCIAL, accent: "#6e8b3d", label: "Commercial", icon: MapPin },
  CLIENT: { nav: NAV_CLIENT, accent: "#d4a373", label: "Espace Client", icon: ShoppingBag },
};

export default function Sidebar({ user }: { user: { name: string; role: string; login: string } }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const config = ROLE_CONFIG[user.role as keyof typeof ROLE_CONFIG];

  useEffect(() => {
    const handleToggle = () => setMobileOpen(prev => !prev);
    window.addEventListener("toggle-mobile-sidebar", handleToggle);
    return () => window.removeEventListener("toggle-mobile-sidebar", handleToggle);
  }, []);

  if (!config) return null;

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-[var(--bg-card)] transition-colors duration-300">
      {/* Brand Header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-[var(--border-primary)] bg-[var(--bg-primary)]/30">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-base flex-shrink-0 shadow-sm"
          style={{ background: `linear-gradient(135deg, var(--accent-primary), var(--accent-primary)dd)` }}>
          B
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div className="overflow-hidden" initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: "auto" }} exit={{ opacity: 0, width: 0 }} transition={{ duration: 0.2 }}>
              <div className="text-[var(--text-primary)] font-black text-sm whitespace-nowrap leading-tight tracking-tight">B.I.S Demo</div>
              <div className="text-[var(--text-secondary)] text-[10px] uppercase font-bold tracking-wider opacity-85">{config.label}</div>
            </motion.div>
          )}
        </AnimatePresence>
        <button onClick={() => setCollapsed(!collapsed)}
          className="ml-auto text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-light)] transition p-1.5 rounded-lg flex-shrink-0 hidden md:flex border border-transparent hover:border-[var(--border-primary)] shadow-sm">
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
        <button onClick={() => setMobileOpen(false)}
          className="ml-auto text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-light)] transition p-1.5 rounded-lg flex-shrink-0 md:hidden border border-transparent">
          <X size={16} />
        </button>
      </div>

      {/* User card chip */}
      <div className="mx-3 my-3 rounded-2xl p-3 flex items-center gap-2.5 border border-[var(--border-primary)] shadow-sm transition-all"
        style={{ background: `linear-gradient(135deg, var(--accent-light), transparent)` }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-sm"
          style={{ background: "var(--accent-primary)" }}>
          {user.name.charAt(0).toUpperCase()}
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div className="overflow-hidden min-w-0 flex-1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
              <div className="text-[var(--text-primary)] text-xs font-black truncate leading-tight">{user.name}</div>
              <div className="text-[9px] font-bold uppercase tracking-wider mt-0.5" style={{ color: "var(--accent-primary)" }}>{user.role}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation Link list */}
      <nav className="flex-1 px-2.5 overflow-y-auto space-y-0.5 pb-4">
        {config.nav.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link key={item.href} href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all relative group ${active ? "text-white shadow-sm" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-light)]"}`}>
              {active && (
                <motion.div layoutId="activeNav" className="absolute inset-0 rounded-xl"
                  style={{ background: "var(--accent-primary)", boxShadow: `0 4px 15px var(--accent-light)` }}
                  transition={{ type: "spring", bounce: 0.15, duration: 0.35 }} />
              )}
              <div className="relative z-10 flex items-center gap-3 min-w-0 flex-1">
                <Icon size={16} className={`flex-shrink-0 ${active ? "text-white" : "text-[var(--text-secondary)]"}`} />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span className="text-xs font-bold truncate whitespace-nowrap flex-1"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
                {item.badge && !collapsed && (
                  <span className={`ml-auto text-[8px] font-black rounded-full px-2 py-0.5 flex-shrink-0 shadow-sm border ${active ? "bg-white text-slate-800 border-white/20" : "bg-red-50 text-red-650 border-red-150 animate-pulse-dot"}`}>
                    {item.badge}
                  </span>
                )}
                {item.badge && collapsed && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white text-[8px] rounded-full flex items-center justify-center font-bold border border-[var(--bg-card)]">
                    !
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Engine Telemetry Logs & Performance Widget */}
      {!collapsed && (
        <div className="mx-3 my-2.5 p-3 rounded-2xl bg-[var(--bg-primary)]/60 border border-[var(--border-primary)] font-mono text-[9px] text-[var(--text-secondary)] space-y-1.5 transition-all">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 font-bold text-[var(--text-primary)]"><Cpu size={10} className="text-[var(--accent-primary)]" /> TELEMETRIE</span>
            <span className="text-emerald-700 font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse-dot" /> ACTIVE
            </span>
          </div>
          <div className="w-full bg-[var(--border-primary)] h-1 rounded-full overflow-hidden">
            <div className="bg-emerald-600 h-full rounded-full" style={{ width: "42%" }} />
          </div>
          <div className="flex items-center justify-between text-[8px] text-[var(--text-secondary)] opacity-85">
            <span>MEM: 42%</span>
            <span>PING: 24ms</span>
          </div>
        </div>
      )}

      {/* Footer Logout */}
      <div className="px-2 py-2 border-t border-[var(--border-primary)] bg-[var(--bg-primary)]/20">
        <button onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-[var(--text-secondary)] hover:text-[#b84a39] hover:bg-[#b84a39]/05 rounded-xl transition font-bold text-xs">
          <LogOut size={16} className="flex-shrink-0" />
          <AnimatePresence>
            {!collapsed && (
              <motion.span className="text-xs font-bold" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                Déconnexion
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile overlay backdrop */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setMobileOpen(false)} />
        )}
      </AnimatePresence>

      {/* Mobile sidebar sliding drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.aside className="fixed left-0 top-0 h-full w-64 bg-[var(--bg-card)] z-50 md:hidden flex flex-col border-r border-[var(--border-primary)] shadow-2xl"
            initial={{ x: -264 }} animate={{ x: 0 }} exit={{ x: -264 }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}>
            <SidebarContent />
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Desktop sticky sidebar */}
      <motion.aside className="hidden md:flex flex-col h-screen sticky top-0 bg-[var(--bg-card)] border-r border-[var(--border-primary)] z-20 flex-shrink-0 transition-all duration-300"
        animate={{ width: collapsed ? 68 : 240 }}
        transition={{ duration: 0.22, ease: "easeInOut" }}>
        <SidebarContent />
      </motion.aside>
    </>
  );
}
