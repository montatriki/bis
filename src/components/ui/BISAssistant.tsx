"use client";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, Bot, User, Sparkles } from "lucide-react";

type Message = { role: "user" | "assistant"; content: string; time: string };

const SUGGESTIONS = [
  "Quel est le CA du mois?",
  "Clients avec solde > 3000 TND?",
  "Produits sous stock minimum?",
  "Performance de Mokhtar ce mois?",
];

const DEMO_RESPONSES: Record<string, string> = {
  default: "Je suis BIS Assistant, votre IA de gestion commerciale. Je peux vous aider avec les données de vente, stock, clients et performances.",
  ca: "📊 CA de mai 2026 : **23 100 TND** (objectif: 25 000 TND, taux: 92.4%). Meilleur commercial: FOUED avec 71 300 TND sur l'année.",
  clients: "🔴 5 clients dépassent 3 000 TND de solde :\n• AGIL BEJA SUD — 4 428 TND\n• AGIL BEJA NORD — 4 291 TND\n• AGIL SIDI KHLIFA — 3 659 TND\n• AGIL MAHDIA — 3 408 TND\n• librairie saphir — 2 738 TND",
  stock: "⚠️ 2 articles sous seuil minimum :\n• coffret echec 2025 — stock: 2 (min: 5)\n• jeux ludo bois — stock: 9 (min: 10)\n\nJe peux générer un bon de commande automatique.",
  performance: "📈 Mokhtar Trabelsi — Mai 2026 :\n• CA réalisé: 3 506 TND / 5 000 objectif (70%)\n• Visites: 14/17 clients\n• Taux recouvrement: 68%\n• Km parcourus: 287 km",
};

function getResponse(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("ca") || m.includes("chiffre") || m.includes("mois")) return DEMO_RESPONSES.ca;
  if (m.includes("client") || m.includes("solde") || m.includes("créance")) return DEMO_RESPONSES.clients;
  if (m.includes("stock") || m.includes("rupture") || m.includes("minimum")) return DEMO_RESPONSES.stock;
  if (m.includes("mokhtar") || m.includes("performance") || m.includes("commercial")) return DEMO_RESPONSES.performance;
  return DEMO_RESPONSES.default;
}

function now() { return new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }); }

export default function BISAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([
      { role: "assistant", content: "Bonjour ! Je suis **BIS Assistant** 🤖\n\nJe peux vous aider avec les données de vente, stock, clients et performances. Que souhaitez-vous savoir ?", time: now() }
    ]);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  function send(text?: string) {
    const msg = text || input.trim();
    if (!msg) return;
    setInput("");
    const userMsg: Message = { role: "user", content: msg, time: now() };
    setMessages(prev => [...prev, userMsg]);
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setMessages(prev => [...prev, { role: "assistant", content: getResponse(msg), time: now() }]);
    }, 900 + Math.random() * 600);
  }

  return (
    <>
      {/* Toggle button */}
      <motion.button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-500/30 text-white"
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
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3.5 flex items-center gap-3">
              <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
                <Sparkles size={18} className="text-white" />
              </div>
              <div>
                <div className="text-white font-bold text-sm">BIS Assistant</div>
                <div className="text-blue-200 text-xs flex items-center gap-1.5">
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
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${msg.role === "assistant" ? "bg-blue-100 text-blue-600" : "bg-slate-200 text-slate-600"}`}>
                    {msg.role === "assistant" ? <Bot size={14} /> : <User size={14} />}
                  </div>
                  <div className={`max-w-[78%] ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col gap-1`}>
                    <div className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-line ${msg.role === "assistant" ? "bg-white border border-slate-100 text-slate-700 shadow-sm" : "bg-blue-600 text-white"}`}>
                      {msg.content.replace(/\*\*(.*?)\*\*/g, "$1")}
                    </div>
                    <span className="text-[10px] text-slate-400 px-1">{msg.time}</span>
                  </div>
                </motion.div>
              ))}

              {typing && (
                <motion.div className="flex gap-2.5" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <Bot size={14} className="text-blue-600" />
                  </div>
                  <div className="bg-white border border-slate-100 rounded-2xl px-4 py-3 shadow-sm">
                    <div className="flex gap-1">
                      {[0,1,2].map(i => (
                        <motion.div key={i} className="w-2 h-2 bg-blue-400 rounded-full"
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
                {SUGGESTIONS.slice(0, 3).map(s => (
                  <button key={s} onClick={() => send(s)}
                    className="flex-shrink-0 text-xs bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1.5 rounded-xl hover:bg-blue-100 transition font-medium whitespace-nowrap">
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
                className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-300 text-slate-800 placeholder:text-slate-400" />
              <motion.button onClick={() => send()} disabled={!input.trim()}
                className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center hover:bg-blue-500 transition disabled:opacity-40"
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
