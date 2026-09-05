"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import {
  LayoutDashboard, Users, Map, ShoppingBag, Calendar, CreditCard,
  FileText, MessageSquare, Package, BarChart3, CheckSquare, Target,
  Mic, LogOut, ChevronLeft, ChevronRight, ShieldCheck, TrendingUp,
  Truck, History, ShoppingCart, X, MapPin, Boxes, Building2,
  UserCheck, Wallet, Car, BookOpen, Receipt,
  Boxes as BoxesIcon, Factory, Wrench, ChevronDown, FolderKanban,
  PackagePlus, Lock, Banknote, LayoutGrid, Crosshair
} from "lucide-react";
import { ERP_MODULES } from "@/lib/erp-modules";

const ERP_ICONS: Record<string, React.ElementType> = {
  Boxes, ShoppingCart, Building2, TrendingUp, Truck, Receipt, Wrench, Factory, Wallet, Car,
  FolderKanban, ShieldCheck,
};

type NavItem = {
  href: string; label: string; icon: React.ElementType;
  badge?: string;
  /** Compteur relu d'une API plutôt que figé dans le menu. */
  badgeSource?: "panier";
};

// Non-module admin items. The ERP modules (Stock, Achat, CRM, Vente, Charge,
// Trésorerie, Parc Roulant, etc.) are rendered once, below, from ERP_MODULES.
const NAV_ADMIN: NavItem[] = [
  { href: "/admin/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/admin/synthese", label: "Synthèse", icon: BarChart3 },
  { href: "/admin/compta", label: "Comptabilité", icon: BookOpen },
  { href: "/admin/etat-stock", label: "État du stock", icon: Boxes },
  { href: "/admin/missions", label: "Ordres de mission", icon: Truck },
  { href: "/admin/commerciaux", label: "Commerciaux", icon: MapPin },
  { href: "/admin/visites", label: "Visites terrain", icon: Crosshair },
  { href: "/admin/grh", label: "GRH", icon: UserCheck },
  { href: "/admin/traites", label: "KEMBYELTY — Traites", icon: Banknote },
  { href: "/admin/rapports-admin", label: "Rapports", icon: BarChart3 },
  { href: "/admin/users", label: "Utilisateurs", icon: Users },
  { href: "/admin/recordings", label: "Enregistrements", icon: Mic },
];

const NAV_MANAGER: NavItem[] = [
  { href: "/manager/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/manager/supervision", label: "Supervision GPS", icon: Map },
  { href: "/manager/missions", label: "Ordres de mission", icon: Truck },
  { href: "/manager/validation", label: "Validation docs", icon: CheckSquare },
  { href: "/manager/objectifs", label: "Objectifs", icon: Target },
  { href: "/manager/rapports", label: "Rapports", icon: BarChart3 },
];

const NAV_COMMERCIAL: NavItem[] = [
  { href: "/commercial/dashboard", label: "Menu principal", icon: LayoutGrid },
  { href: "/commercial/statistiques", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/commercial/clients", label: "Mes clients", icon: Users },
  { href: "/commercial/map", label: "Carte GPS", icon: MapPin },
  { href: "/commercial/planning", label: "Planning du jour", icon: Calendar },
  { href: "/commercial/catalogue", label: "Catalogue", icon: ShoppingBag },
  // `badgeSource` : le compteur est relu de l'API, pas figé dans le menu.
  { href: "/commercial/panier", label: "Panier de commande", icon: ShoppingCart, badgeSource: "panier" },
  { href: "/commercial/recouvrement", label: "Recouvrement", icon: CreditCard },
  { href: "/commercial/retour-stock", label: "Stock véhicule", icon: Package },
  { href: "/commercial/approvisionnement", label: "Bon d'approvisionnement", icon: PackagePlus },
  { href: "/commercial/journal", label: "Journal de caisse", icon: FileText },
  { href: "/commercial/dernier-ticket", label: "Dernier ticket", icon: Receipt },
  { href: "/commercial/reclamation", label: "Réclamations", icon: MessageSquare },
  { href: "/commercial/mot-de-passe", label: "Changer mot de passe", icon: Lock },
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
  const [expandedErp, setExpandedErp] = useState<string | null>(null);
  const [panier, setPanier] = useState(0);
  const config = ROLE_CONFIG[user.role as keyof typeof ROLE_CONFIG];

  useEffect(() => {
    const handleToggle = () => setMobileOpen(prev => !prev);
    window.addEventListener("toggle-mobile-sidebar", handleToggle);
    return () => window.removeEventListener("toggle-mobile-sidebar", handleToggle);
  }, []);

  // Compteur du panier : relu à chaque navigation, comme le badge de l'app
  // commerciale d'origine. Seul le rôle COMMERCIAL en a besoin.
  useEffect(() => {
    if (user.role !== "COMMERCIAL") return;
    let annule = false;
    fetch("/api/panier?vue=badge")
      .then((r) => r.json())
      .then((d) => { if (!annule) setPanier(d.articles ?? 0); })
      .catch(() => {});
    return () => { annule = true; };
  }, [user.role, pathname]);

  if (!config) return null;

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
  }

  const sidebarContent = (
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
              <div className="text-[var(--text-primary)] font-black text-sm whitespace-nowrap leading-tight tracking-tight">S.K.Y Demo</div>
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
          // Compteur dynamique (panier) prioritaire sur le badge statique ;
          // un panier vide n'affiche rien plutôt qu'un « 0 ».
          const compteur =
            item.badgeSource === "panier" ? (panier > 0 ? String(panier) : null) : item.badge;
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
                {compteur && !collapsed && (
                  <span className={`ml-auto text-[8px] font-black rounded-full px-2 py-0.5 flex-shrink-0 shadow-sm border ${active ? "bg-white text-slate-800 border-white/20" : "bg-red-50 text-red-650 border-red-150 animate-pulse-dot"}`}>
                    {compteur}
                  </span>
                )}
                {compteur && collapsed && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white text-[8px] rounded-full flex items-center justify-center font-bold border border-[var(--bg-card)]">
                    !
                  </span>
                )}
              </div>
            </Link>
          );
        })}

        {/* ERP MODULES (S.K.Y) — admin only, all modules + submenus */}
        {user.role === "ADMIN" && !collapsed && (
          <div className="mt-3 pt-3 border-t border-[var(--border-primary)]">
            <div className="px-3 mb-1.5 text-[9px] font-black uppercase tracking-wider text-[var(--text-secondary)] opacity-70">Modules S.K.Y</div>
            {ERP_MODULES.map((m) => {
              const Icon = ERP_ICONS[m.icon] ?? BoxesIcon;
              const base = `/admin/modules/${m.slug}`;
              const open = expandedErp === m.slug || pathname.startsWith(base);
              return (
                <div key={m.slug}>
                  <button onClick={() => setExpandedErp(open && expandedErp === m.slug ? null : m.slug)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-light)]">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: m.color }} />
                    <Icon size={14} className="flex-shrink-0" />
                    <span className="text-[11px] font-bold truncate flex-1 text-left">{m.label}</span>
                    <ChevronDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
                  </button>
                  {open && (
                    <div className="ml-4 pl-2 border-l border-[var(--border-primary)] space-y-0.5 mt-0.5 mb-1">
                      {m.subs.map((s) => {
                        const href = `${base}/${s.slug}`;
                        const active = pathname === href;
                        return (
                          <Link key={s.slug} href={href} onClick={() => setMobileOpen(false)}
                            className={`block px-3 py-1.5 rounded-lg text-[11px] font-medium truncate transition ${active ? "text-white" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-light)]"}`}
                            style={active ? { background: m.color } : undefined}>
                            {s.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </nav>

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
            {sidebarContent}
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Desktop sticky sidebar */}
      <motion.aside className="hidden md:flex flex-col h-screen sticky top-0 bg-[var(--bg-card)] border-r border-[var(--border-primary)] z-20 flex-shrink-0 transition-all duration-300"
        animate={{ width: collapsed ? 68 : 240 }}
        transition={{ duration: 0.22, ease: "easeInOut" }}>
        {sidebarContent}
      </motion.aside>
    </>
  );
}
