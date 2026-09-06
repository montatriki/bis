"use client";
import { Bell, Search, Menu, ChevronRight, Check, Command, X, Loader2, Users, Package, FileText, Truck, ArrowRight, UserRound } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { titreEcran, ESPACES } from "@/lib/ecrans";

type Trouvaille = {
  type: "client" | "article" | "document" | "mission" | "commercial" | "page";
  id: string; titre: string; detail?: string; info?: string; lien: string;
};

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

/** Pictogramme et teinte par nature de résultat : l'œil trie avant de lire. */
const STYLE_TROUVAILLE: Record<Trouvaille["type"], { icone: React.ReactNode; classe: string }> = {
  client: { icone: <Users size={14} />, classe: "bg-[var(--accent-light)] text-[var(--accent-primary)]" },
  article: { icone: <Package size={14} />, classe: "bg-emerald-50 text-emerald-700" },
  document: { icone: <FileText size={14} />, classe: "bg-blue-50 text-blue-700" },
  mission: { icone: <Truck size={14} />, classe: "bg-amber-50 text-amber-700" },
  commercial: { icone: <UserRound size={14} />, classe: "bg-violet-50 text-violet-700" },
  page: { icone: <ArrowRight size={14} />, classe: "bg-slate-100 text-slate-600" },
};

const ROLE_META: Record<string, { label: string; color: string; bg: string }> = {
  ADMIN: { label: "Administrateur", color: "text-slate-700", bg: "bg-slate-100" },
  MANAGER: { label: "Manager", color: "text-blue-700", bg: "bg-blue-100" },
  COMMERCIAL: { label: "Commercial", color: "text-emerald-700", bg: "bg-emerald-100" },
  CLIENT: { label: "Client", color: "text-amber-700", bg: "bg-amber-100" },
};

export default function TopBar({ user }: { user: { name: string; role: string } }) {
  const router = useRouter();
  const chemin = usePathname();
  const [showNotifs, setShowNotifs] = useState(false);
  const [focusRecherche, setFocusRecherche] = useState(false);
  const champRecherche = useRef<HTMLInputElement>(null);
  // Recherche globale : clients, articles, pièces, tournées et écrans, dans le
  // périmètre du rôle (`/api/recherche`).
  const [requete, setRequete] = useState("");
  const [resultats, setResultats] = useState<Trouvaille[]>([]);
  const [chercheEnCours, setChercheEnCours] = useState(false);
  const [surligne, setSurligne] = useState(0);
  /** Recherche déployée sur mobile (masquée par défaut, faute de place). */
  const [rechercheMobile, setRechercheMobile] = useState(false);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const meta = ROLE_META[user.role] || ROLE_META.ADMIN;
  const espace = ESPACES[user.role] ?? "Espace";
  const ecran = titreEcran(chemin);

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

  // Une requête par frappe saturerait la base : on attend une pause de saisie.
  useEffect(() => {
    const q = requete.trim();
    let annule = false;
    if (q.length < 2) {
      // Vider hors du corps de l'effet : un setState synchrone y provoque des
      // rendus en cascade.
      const vider = setTimeout(() => { if (!annule) setResultats([]); }, 0);
      return () => { annule = true; clearTimeout(vider); };
    }
    const t = setTimeout(() => {
      // L'indicateur d'attente vit dans le délai, pas dans le corps de
      // l'effet : un setState synchrone y déclencherait des rendus en cascade.
      setChercheEnCours(true);
      fetch(`/api/recherche?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((d) => { if (!annule) { setResultats(d.resultats ?? []); setSurligne(0); } })
        .catch(() => { if (!annule) setResultats([]); })
        .finally(() => { if (!annule) setChercheEnCours(false); });
    }, 220);
    return () => { annule = true; clearTimeout(t); };
  }, [requete]);

  /** Ouvre un résultat et referme la recherche. */
  const ouvrirResultat = useCallback((r: Trouvaille) => {
    setRequete("");
    setResultats([]);
    setFocusRecherche(false);
    setRechercheMobile(false);
    champRecherche.current?.blur();
    router.push(r.lien);
  }, [router]);

  /** Flèches pour parcourir, Entrée pour ouvrir, Échap pour fermer. */
  function surToucheRecherche(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!resultats.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setSurligne((i) => (i + 1) % resultats.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSurligne((i) => (i - 1 + resultats.length) % resultats.length); }
    else if (e.key === "Enter") { e.preventDefault(); ouvrirResultat(resultats[surligne] ?? resultats[0]); }
  }

  // Le repère « ⌘K » affiché dans le champ doit agir : un raccourci décoratif
  // est pire que pas de raccourci.
  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        champRecherche.current?.focus();
      }
      if (e.key === "Escape" && document.activeElement === champRecherche.current) {
        setRequete("");
        setResultats([]);
        champRecherche.current?.blur();
      }
    };
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, []);

  const toggleMobileSidebar = () => {
    window.dispatchEvent(new Event("toggle-mobile-sidebar"));
  };

  return (
    // `z-10` créait un contexte d'empilement propre à l'en-tête : le panneau de
    // notifications, même en `z-[100]`, ne montait qu'au sein de cet en-tête et
    // passait donc *sous* les cartes du tableau de bord. Il faut élever
    // l'en-tête lui-même pour que ses menus déroulants couvrent la page.
    // La barre s'étirait sur toute la largeur alors que le contenu est bridé à
    // 1600 px et centré : sur grand écran, la recherche et le profil se
    // retrouvaient loin des colonnes de la page. On aligne la barre sur la
    // même largeur utile que `<main>`.
    <header className="relative z-[60] h-16 flex-shrink-0 bg-[var(--bg-card)]/85 backdrop-blur-xl border-b border-[var(--border-primary)]"
      style={{ boxShadow: "0 1px 0 var(--border-primary), 0 6px 24px -12px var(--shadow-primary)" }}>
      {/* Filet d'accent : rattache l'en-tête à l'identité chaude de l'app
          plutôt que de le laisser en bandeau blanc neutre. */}
      <div className="absolute inset-x-0 top-0 h-px opacity-70"
        style={{ background: "linear-gradient(90deg, transparent, var(--accent-primary), transparent)" }} />

      <div className="h-full max-w-[1600px] w-full mx-auto flex items-center gap-3 px-4 md:px-6">
        {/* Menu (mobile) */}
        <button 
          onClick={toggleMobileSidebar}
          className="w-10 h-10 -ml-1.5 rounded-2xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-light)] md:hidden transition-all flex items-center justify-center flex-shrink-0 active:scale-95"
        >
          <Menu size={19} />
        </button>

        {/* Situation : l'utilisateur sait toujours où il se trouve. Sous
            « lg », la barre n'a plus la place du fil complet — le titre de
            l'écran seul vaut mieux qu'une barre vide. */}
        <div className="flex items-baseline gap-2 min-w-0 flex-shrink">
          <span className="hidden lg:inline text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-secondary)] opacity-55 whitespace-nowrap">
            {espace}
          </span>
          {ecran && (
            <>
              <span className="hidden lg:inline text-[var(--text-secondary)] opacity-25 text-xs">/</span>
              <span className="text-sm lg:text-[13px] font-bold text-[var(--text-primary)] truncate max-w-[11rem] sm:max-w-[15rem]">{ecran}</span>
            </>
          )}
        </div>

        {/* Recherche : discrète au repos, elle s'élargit et s'éclaire au
            focus — l'action la plus fréquente mérite d'être invitante. */}
        <div className={`min-w-0 ml-auto transition-[max-width,flex-grow] duration-300 ease-out
                         ${rechercheMobile ? "absolute inset-x-3 z-20 max-w-none" : "hidden sm:block"}
                         ${focusRecherche ? "flex-grow sm:max-w-lg" : "flex-grow sm:max-w-[19rem]"}`}>
          <div className="relative group">
            <Search size={15}
              className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors pointer-events-none ${focusRecherche ? "text-[var(--accent-primary)]" : "text-[var(--text-secondary)] opacity-55"}`} />
            <input ref={champRecherche} placeholder="Client, produit, pièce, écran…"
              value={requete}
              onChange={(e) => setRequete(e.target.value)}
              onKeyDown={surToucheRecherche}
              onFocus={() => setFocusRecherche(true)}
              // Différé : sans cela, le clic sur un résultat démonterait la
              // liste avant que l'événement ne l'atteigne.
              onBlur={() => setTimeout(() => { setFocusRecherche(false); setRechercheMobile(false); }, 180)}
              className="w-full pl-11 pr-16 h-10 text-[13px] rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-primary)] text-[var(--text-primary)]
                         placeholder:text-[var(--text-secondary)]/55 transition-all duration-200
                         hover:border-[var(--accent-primary)]/25
                         focus:outline-none focus:bg-[var(--bg-card)] focus:border-[var(--accent-primary)]/45 focus:shadow-[0_6px_24px_-10px_var(--shadow-hover)]" />

            {chercheEnCours ? (
              <Loader2 size={14} className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-[var(--accent-primary)]" />
            ) : requete ? (
              <button onClick={() => { setRequete(""); champRecherche.current?.focus(); }}
                aria-label="Effacer la recherche"
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--accent-light)] transition">
                <X size={14} />
              </button>
            ) : (
              /* Repère clavier, estompé dès la saisie. */
              <kbd className={`absolute right-3 top-1/2 -translate-y-1/2 hidden md:flex items-center gap-0.5 h-6 px-1.5 rounded-lg
                               text-[10px] font-semibold text-[var(--text-secondary)] bg-[var(--bg-card)] border border-[var(--border-primary)]
                               transition-opacity pointer-events-none ${focusRecherche ? "opacity-0" : "opacity-70"}`}>
                <Command size={10} /> K
              </kbd>
            )}

            {/* Résultats : regroupés par nature, parcourus aux flèches. */}
            {focusRecherche && requete.trim().length >= 2 && (
              <div className="absolute left-0 right-0 top-full mt-2 max-h-[26rem] overflow-y-auto rounded-2xl
                              bg-[var(--bg-card)] border border-[var(--border-primary)] shadow-2xl py-1.5 z-[70]">
                {resultats.length === 0 ? (
                  <div className="px-4 py-6 text-center text-xs text-[var(--text-secondary)]">
                    {chercheEnCours ? "Recherche…" : `Aucun résultat pour « ${requete.trim()} »`}
                  </div>
                ) : resultats.map((r, i) => (
                  <button key={r.id}
                    onMouseDown={(e) => { e.preventDefault(); ouvrirResultat(r); }}
                    onMouseEnter={() => setSurligne(i)}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-left transition
                                ${i === surligne ? "bg-[var(--accent-light)]" : "hover:bg-[var(--accent-light)]/60"}`}>
                    <span className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${STYLE_TROUVAILLE[r.type].classe}`}>
                      {STYLE_TROUVAILLE[r.type].icone}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-bold text-[var(--text-primary)] truncate">{r.titre}</span>
                      {r.detail && <span className="block text-[11px] text-[var(--text-secondary)] opacity-80 truncate">{r.detail}</span>}
                    </span>
                    {r.info && (
                      <span className="text-[11px] font-bold text-[var(--accent-primary)] shrink-0 tabular-nums">{r.info}</span>
                    )}
                  </button>
                ))}
                {resultats.length > 0 && (
                  <div className="px-3 pt-2 mt-1 border-t border-[var(--border-primary)] text-[10px] text-[var(--text-secondary)] opacity-70 flex items-center gap-2">
                    <kbd className="px-1 rounded border border-[var(--border-primary)]">↑↓</kbd> parcourir
                    <kbd className="px-1 rounded border border-[var(--border-primary)]">↵</kbd> ouvrir
                    <kbd className="px-1 rounded border border-[var(--border-primary)]">esc</kbd> fermer
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 ml-auto sm:ml-3">
          {/* Loupe (mobile) : la recherche y était purement absente. */}
          <button onClick={() => { setRechercheMobile(true); setTimeout(() => champRecherche.current?.focus(), 60); }}
            aria-label="Rechercher"
            className="sm:hidden w-10 h-10 rounded-2xl flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--accent-light)] transition">
            <Search size={18} />
          </button>
        {/* Notifications */}
        <div className="relative">
          <button onClick={() => setShowNotifs(!showNotifs)}
            className={`relative w-10 h-10 rounded-2xl flex items-center justify-center transition-all active:scale-95
                        ${showNotifs
                          ? "bg-[var(--accent-light)] text-[var(--accent-primary)]"
                          : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-light)]"}`}>
            <Bell size={18} />
            {unread > 0 && (
              <>
                {/* Halo pulsé : une alerte non lue doit accrocher l'œil. */}
                <span className="absolute top-1 right-1 w-[18px] h-[18px] rounded-full bg-red-500/30 animate-ping" />
                <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-[var(--bg-card)]">
                  {unread > 99 ? "99+" : unread}
                </span>
              </>
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

        {/* Profil : une pastille posée, cohérente avec la carte utilisateur de
            la barre latérale — pas un texte flottant au bord de l'écran. */}
        <div className="flex items-center gap-2.5 ml-1 md:pl-2 md:pr-3.5 md:py-1.5 md:rounded-2xl md:border md:border-[var(--accent-primary)]/15 md:bg-[var(--accent-light)] min-w-0 transition-all md:hover:border-[var(--accent-primary)]/30 md:hover:shadow-[0_6px_20px_-12px_var(--shadow-hover)] cursor-default">
          <div className="relative flex-shrink-0">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-black shadow-sm"
              style={{ background: "linear-gradient(135deg, var(--accent-primary), color-mix(in srgb, var(--accent-primary) 72%, #000))" }}>
              {user.name.charAt(0).toUpperCase()}
            </div>
            {/* Pastille de présence : l'utilisateur est connecté. */}
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-[var(--bg-card)]" />
          </div>
          <div className="hidden md:block min-w-0 leading-tight">
            <div className="text-[13px] font-bold text-[var(--text-primary)] truncate max-w-[10rem]">{user.name}</div>
            <div className="text-[10px] font-bold uppercase tracking-[0.1em] opacity-75" style={{ color: "var(--accent-primary)" }}>{meta.label}</div>
          </div>
        </div>
        </div>
      </div>
    </header>
  );
}
