"use client";
import { Bell, Search, Menu, ChevronRight, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Notif = {
  id: string; title: string; message: string; type: string;
  isRead: boolean; createdAt: string; source: "db" | "systeme";
  icon: string; color: string;
  /** Écran où traiter l'alerte ; `null` si elle n'est qu'informative. */
  lien: string | null;
  /** Empreinte du contenu, renvoyée au serveur à l'acquittement. */
  empreinte: string | null;
};

/** Ancienneté abrégée ("5 min", "2 h", "3 j") pour l'affichage. */
function depuis(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  return `${Math.floor(h / 24)} j`;
}

const ROLE_META: Record<string, { label: string; color: string; bg: string }> = {
  ADMIN: { label: "Administrateur", color: "text-slate-700", bg: "bg-slate-100" },
  MANAGER: { label: "Manager", color: "text-blue-700", bg: "bg-blue-100" },
  COMMERCIAL: { label: "Commercial", color: "text-emerald-700", bg: "bg-emerald-100" },
  CLIENT: { label: "Client", color: "text-amber-700", bg: "bg-amber-100" },
};

export default function TopBar({ user }: { user: { name: string; role: string } }) {
  const router = useRouter();
  const [showNotifs, setShowNotifs] = useState(false);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const meta = ROLE_META[user.role] || ROLE_META.ADMIN;

  const charger = useCallback(() => {
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((d) => { setNotifs(d.rows ?? []); setUnread(d.nonLues ?? 0); })
      .catch(() => {});
  }, []);

  // Les alertes se recalculent en base (stock, impayés, échéances) : sans
  // rafraîchissement, la cloche restait figée sur l'état du chargement initial.
  useEffect(() => {
    const t = setTimeout(charger, 0);
    const i = setInterval(charger, 120_000);
    return () => { clearTimeout(t); clearInterval(i); };
  }, [charger]);

  /**
   * Acquitte tout : les notifications persistées passent en « lu », et les
   * alertes système sont mémorisées comme acquittées pour cet utilisateur —
   * sinon elles réapparaissaient au recalcul suivant et le compteur ne
   * redescendait jamais.
   */
  async function toutLire() {
    const systeme = notifs
      .filter((n) => n.source === "systeme")
      .map((n) => ({ id: n.id, empreinte: n.empreinte }));
    setUnread(0);
    setNotifs([]);
    await fetch("/api/notifications", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ systeme }),
    }).catch(() => {});
    charger();
  }

  /** Acquitte une seule alerte, sans quitter l'écran. */
  async function acquitter(n: Notif) {
    setNotifs((prev) => prev.filter((x) => x.id !== n.id));
    setUnread((u) => Math.max(0, u - (n.isRead ? 0 : 1)));
    await fetch("/api/notifications", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        n.source === "systeme"
          ? { systeme: [{ id: n.id, empreinte: n.empreinte }] }
          : { ids: [n.id] },
      ),
    }).catch(() => {});
  }

  /** Ouvre l'écran qui permet de traiter l'alerte. */
  function ouvrir(n: Notif) {
    if (!n.lien) return;
    setShowNotifs(false);
    router.push(n.lien);
  }

  const toggleMobileSidebar = () => {
    window.dispatchEvent(new Event("toggle-mobile-sidebar"));
  };

  return (
    // `z-10` créait un contexte d'empilement propre à l'en-tête : le panneau de
    // notifications, même en `z-[100]`, ne montait qu'au sein de cet en-tête et
    // passait donc *sous* les cartes du tableau de bord. Il faut élever
    // l'en-tête lui-même pour que ses menus déroulants couvrent la page.
    <header className="relative z-[60] h-14 flex items-center px-4 md:px-6 gap-4 flex-shrink-0 shadow-sm transition-all duration-300 bg-[var(--bg-card)] border-b border-[var(--border-primary)]">
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
          <button onClick={() => setShowNotifs(!showNotifs)}
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
                <div className="fixed inset-0 z-[90]" onClick={() => setShowNotifs(false)} />
                <motion.div className="absolute right-0 top-full mt-2 w-[22rem] max-w-[calc(100vw-2rem)] bg-[var(--bg-card)] rounded-2xl shadow-2xl border border-[var(--border-primary)] z-[100] overflow-hidden text-[var(--text-primary)]"
                  initial={{ opacity: 0, y: -8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.95 }}
                  transition={{ duration: 0.15 }}>
                  <div className="px-4 py-3 border-b border-[var(--border-primary)] flex items-center justify-between">
                    <div>
                      <div className="font-extrabold text-[var(--text-primary)] text-xs uppercase tracking-wider">Notifications</div>
                      <div className="text-[10px] text-[var(--text-secondary)] opacity-80 mt-0.5">
                        {notifs.length} alerte(s) · {unread} non lue(s)
                      </div>
                    </div>
                    {notifs.length > 0 && (
                      <button onClick={toutLire} className="text-[10px] font-black text-[var(--accent-primary)] hover:underline uppercase">
                        Tout traiter
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-[var(--border-primary)] bg-[var(--bg-card)]">
                    {notifs.length === 0 && (
                      <div className="px-4 py-8 text-center text-[10px] text-[var(--text-secondary)] opacity-70">
                        Aucune notification.
                      </div>
                    )}
                    {notifs.map(n => (
                      <div key={n.id}
                        className={`group flex gap-3 px-4 py-3 transition ${n.isRead ? "opacity-60" : ""} ${n.lien ? "hover:bg-[var(--accent-light)] cursor-pointer" : ""}`}
                        onClick={() => ouvrir(n)}>
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm flex-shrink-0 shadow-sm ${n.color}`}>
                          {n.icon}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-black text-[var(--text-primary)] leading-tight flex items-center gap-1.5">
                            {n.title}
                            {!n.isRead && <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />}
                          </div>
                          <div className="text-[10px] text-[var(--text-secondary)] opacity-85 mt-0.5 leading-snug">{n.message}</div>
                          <div className="text-[8px] text-[var(--text-secondary)] opacity-60 mt-1 uppercase font-mono">
                            Il y a {depuis(n.createdAt)}
                          </div>
                        </div>
                        <div className="flex flex-col items-center gap-1 flex-shrink-0 self-center">
                          {/* Acquitter sans ouvrir : le clic ne doit pas naviguer. */}
                          <button title="Marquer comme traitée"
                            onClick={(e) => { e.stopPropagation(); acquitter(n); }}
                            className="w-6 h-6 rounded-lg flex items-center justify-center text-[var(--text-secondary)]
                                       opacity-0 group-hover:opacity-100 hover:bg-[var(--bg-primary)] transition">
                            <Check size={13} />
                          </button>
                          {n.lien && <ChevronRight size={13} className="text-[var(--text-secondary)] opacity-40" />}
                        </div>
                      </div>
                    ))}
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
