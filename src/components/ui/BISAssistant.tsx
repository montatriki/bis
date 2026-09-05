"use client";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, Bot, User, Sparkles, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";

type Message = { role: "user" | "assistant"; content: string; time: string; lien?: string };


function now() { return new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }); }

/** Libellé du bouton de navigation proposé par l'assistant. */
function libelleLien(chemin: string): string {
  if (/^\/(?:commercial\/clients|admin\/modules\/vente\/clients)\/\d+/.test(chemin)) return "Ouvrir la fiche client";
  const noms: Record<string, string> = {
    "/commercial/planning": "Ouvrir la tournée du jour",
    "/commercial/clients": "Ouvrir mes clients",
    "/commercial/catalogue": "Ouvrir le catalogue",
    "/commercial/panier": "Ouvrir le panier",
    "/commercial/recouvrement": "Ouvrir le recouvrement",
    "/commercial/journal": "Ouvrir le journal de caisse",
    "/commercial/dernier-ticket": "Ouvrir le dernier ticket",
    "/commercial/retour-stock": "Ouvrir le stock du camion",
    "/commercial/approvisionnement": "Ouvrir l'approvisionnement",
    "/commercial/reclamation": "Ouvrir les réclamations",
    "/commercial/statistiques": "Ouvrir les statistiques",
    "/commercial/map": "Ouvrir la carte",
    "/admin/dashboard": "Ouvrir le tableau de bord",
    "/admin/missions": "Ouvrir les ordres de mission",
    "/admin/commerciaux": "Ouvrir les commerciaux",
    "/admin/visites": "Ouvrir les visites terrain",
    "/admin/etat-stock": "Ouvrir l'état du stock",
    "/admin/synthese": "Ouvrir la synthèse",
    "/admin/compta": "Ouvrir la comptabilité",
    "/admin/rapports-admin": "Ouvrir les rapports",
    "/admin/modules/vente/clients": "Ouvrir les clients",
  };
  return noms[chemin] ?? "Ouvrir l'écran";
}


export default function BISAssistant() {
  const [open, setOpen] = useState(false);
  // Rôle de l'utilisateur : décide des suggestions et, côté serveur, du
  // périmètre des données auxquelles l'assistant a accès.
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const router = useRouter();
  // Sujet de la dernière réponse : permet au serveur de comprendre les
  // questions de suivi (« donne-moi la liste » après une réponse sur le stock).
  const dernierSujet = useRef<string | null>(null);
  // Le message d'accueil appartient à l'état initial : le poser depuis un effet
  // déclenchait un rendu supplémentaire à chaque montage, et `now()` lit
  // l'horloge — un appel impur interdit pendant le rendu.
  const [messages, setMessages] = useState<Message[]>(() => [
    {
      role: "assistant",
      content:
        "Bonjour ! Je suis **BIS Assistant** 🤖\n\nJe peux vous aider avec les données de vente, stock, clients et performances. Que souhaitez-vous savoir ?",
      time: now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  // Accueil et suggestions viennent du serveur : ils dépendent du rôle, que
  // seul le serveur connaît de façon fiable.
  useEffect(() => {
    if (!open || suggestions.length) return;
    let annule = false;
    fetch("/api/assistant")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (annule || !d) return;
        setSuggestions(d.suggestions ?? []);
        if (d.accueil) {
          setMessages((prev) => (prev.length <= 1 ? [{ role: "assistant" as const, content: d.accueil, time: now() }] : prev));
        }
      })
      .catch(() => {});
    return () => { annule = true; };
  }, [open, suggestions.length]);

  async function send(text?: string) {
    const msg = text || input.trim();
    if (!msg) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: msg, time: now() }]);
    setTyping(true);
    try {
      // Les données viennent du serveur, dans le périmètre du rôle : un
      // commercial ne peut pas obtenir le CA d'un collègue.
      const r = await fetch("/api/assistant", {
        method: "POST", headers: { "Content-Type": "application/json" },
        // L'historique permet au modèle de suivre le fil (« et en dinars ? »).
        body: JSON.stringify({
          question: msg,
          suivi: { sujet: dernierSujet.current },
          historique: messages.slice(-6).map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const d = await r.json();
      if (d.sujet && d.sujet !== "aide") dernierSujet.current = d.sujet;
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: d.reponse ?? d.error ?? "Je n'ai pas pu répondre.",
        time: now(),
        // L'assistant peut proposer d'ouvrir un écran : on laisse le geste à
        // l'utilisateur plutôt que de le déplacer sans prévenir.
        lien: typeof d.navigation === "string" ? d.navigation : undefined,
      }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Connexion indisponible — réessayez.", time: now() }]);
    } finally {
      setTyping(false);
    }
  }

  return (
    <>
      {/* Toggle button */}
      <motion.button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-[0_18px_40px_-16px_var(--shadow-hover)]"
        style={{ background: "linear-gradient(135deg, var(--accent-primary), color-mix(in srgb, var(--accent-primary) 76%, #000))" }}
        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
        animate={open ? { rotate: 0 } : { rotate: 0 }}>
        {open ? <X size={22} /> : (
          <>
            <MessageCircle size={22} />
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full text-[10px] font-bold flex items-center justify-center">IA</span>
          </>
        )}
      </motion.button>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed bottom-24 right-6 z-50 w-[360px] bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col"
            style={{ maxHeight: "70vh", height: 520 }}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", damping: 22, stiffness: 280 }}>

            {/* Header */}
            <div className="px-4 py-3.5 flex items-center gap-3" style={{ background: "linear-gradient(135deg, var(--accent-primary), color-mix(in srgb, var(--accent-primary) 76%, #000))" }}>
              <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
                <Sparkles size={18} className="text-white" />
              </div>
              <div>
                <div className="text-white font-bold text-sm">BIS Assistant</div>
                <div className="text-white/75 text-xs flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                  Propulsé par IA
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="ml-auto text-white/70 hover:text-white transition">
                <X size={18} />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
              {messages.map((msg, i) => (
                <motion.div key={i} className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${msg.role === "assistant" ? "bg-[var(--accent-light)] text-[var(--accent-primary)]" : "bg-slate-200 text-slate-600"}`}>
                    {msg.role === "assistant" ? <Bot size={14} /> : <User size={14} />}
                  </div>
                  <div className={`max-w-[78%] ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col gap-1`}>
                    <div className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-line ${msg.role === "assistant" ? "bg-white border border-slate-100 text-slate-700 shadow-sm" : "text-white"}`}
                      style={msg.role === "assistant" ? undefined : { background: "var(--accent-primary)" }}>
                      {msg.content.replace(/\*\*(.*?)\*\*/g, "$1")}
                    </div>
                    {msg.lien && (
                      <button onClick={() => { router.push(msg.lien!); setOpen(false); }}
                        className="flex items-center gap-1.5 text-xs font-bold text-[var(--accent-primary)] bg-[var(--accent-light)] border border-[var(--accent-primary)]/20 rounded-xl px-3 py-2 hover:brightness-97 transition">
                        {libelleLien(msg.lien)} <ArrowRight size={13} />
                      </button>
                    )}
                    <span className="text-[10px] text-slate-400 px-1">{msg.time}</span>
                  </div>
                </motion.div>
              ))}

              {typing && (
                <motion.div className="flex gap-2.5" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div className="w-8 h-8 rounded-xl bg-[var(--accent-light)] flex items-center justify-center flex-shrink-0">
                    <Bot size={14} className="text-[var(--accent-primary)]" />
                  </div>
                  <div className="bg-white border border-slate-100 rounded-2xl px-4 py-3 shadow-sm">
                    <div className="flex gap-1">
                      {[0,1,2].map(i => (
                        <motion.div key={i} className="w-2 h-2 rounded-full bg-[var(--accent-primary)] opacity-55"
                          animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.15 }} />
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Suggestions */}
            {messages.length <= 2 && (
              <div className="px-3 py-2 border-t border-slate-100 bg-white flex gap-1.5 overflow-x-auto scrollbar-none">
                {suggestions.slice(0, 4).map(s => (
                  <button key={s} onClick={() => send(s)}
                    className="flex-shrink-0 text-xs bg-[var(--accent-light)] text-[var(--accent-primary)] border border-[var(--accent-primary)]/20 px-3 py-1.5 rounded-xl hover:brightness-97 transition font-semibold whitespace-nowrap">
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <div className="p-3 border-t border-slate-100 bg-white flex gap-2">
              <input value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && send()}
                placeholder="Poser une question..."
                className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[var(--accent-primary)]/45 text-slate-800 placeholder:text-slate-400" />
              <motion.button onClick={() => send()} disabled={!input.trim()}
                className="w-10 h-10 text-white rounded-xl flex items-center justify-center transition hover:brightness-110 disabled:opacity-40"
                style={{ background: "linear-gradient(135deg, var(--accent-primary), color-mix(in srgb, var(--accent-primary) 76%, #000))" }}
                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Send size={15} />
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
