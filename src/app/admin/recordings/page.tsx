"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Play, Pause, Mic, Search, Filter } from "lucide-react";

const RECORDINGS = [
  { id: 1, commercial: "Mokhtar Trabelsi", client: "AGIL BEJA SUD", date: "15/05/2026", time: "11:22", duration: "3:24", ca: 1840, sentiment: "neutral", summary: "Client demande une remise supplémentaire de 5%. Problème de délai de livraison signalé. Commande passée pour coffret echec (×10) + jeux ludo (×5).", keywords: ["remise", "livraison", "commande"] },
  { id: 2, commercial: "FOUED", client: "AGIL MAHDIA", date: "14/05/2026", time: "14:10", duration: "5:12", ca: 2300, sentiment: "positive", summary: "Très bonne visite. Client satisfait. Nouvelle commande importante pour toute la gamme jeux 2026.", keywords: ["satisfait", "nouvelle gamme", "commande"] },
  { id: 3, commercial: "HICHEM", client: "librairie saphir", date: "13/05/2026", time: "09:45", duration: "2:47", ca: 640, sentiment: "negative", summary: "Client mécontent du dernier délai de livraison. Réclamation sur 2 articles défectueux.", keywords: ["réclamation", "défectueux", "délai"] },
  { id: 4, commercial: "Mokhtar Trabelsi", client: "SOCIÉTÉ SPICE LAND", date: "12/05/2026", time: "16:30", duration: "4:08", ca: 890, sentiment: "positive", summary: "Client intéressé par la nouvelle gamme puzzles 2026. Commande test passée.", keywords: ["nouveau produit", "puzzles", "test"] },
];

const SENTIMENT = {
  positive: { label: "Positif", cls: "bg-emerald-100 text-emerald-700", icon: "😊" },
  neutral: { label: "Neutre", cls: "bg-amber-100 text-amber-700", icon: "😐" },
  negative: { label: "Négatif", cls: "bg-red-100 text-red-700", icon: "😟" },
};

export default function RecordingsPage() {
  const [playing, setPlaying] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  const filtered = RECORDINGS.filter(r =>
    r.commercial.toLowerCase().includes(search.toLowerCase()) ||
    r.client.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Enregistrements vocaux</h1>
          <p className="text-slate-500 text-sm">Accès confidentiel — Administrateur uniquement</p>
        </div>
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
          <div className="w-2 h-2 rounded-full bg-red-500 blink" />
          <span className="text-red-700 text-xs font-medium">🔒 Confidentiel</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total enregistrements", value: "47", icon: "🎤" },
          { label: "Durée totale", value: "3h 24min", icon: "⏱️" },
          { label: "Visites analysées", value: "41", icon: "📊" },
          { label: "Alertes IA", value: "3", icon: "⚠️" },
        ].map((s, i) => (
          <motion.div key={s.label} className="bg-white rounded-2xl border border-slate-100 p-4"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <div className="text-2xl mb-2">{s.icon}</div>
            <div className="text-xl font-bold text-slate-800">{s.value}</div>
            <div className="text-slate-400 text-xs">{s.label}</div>
          </motion.div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-4 p-4 border-b border-slate-100">
          <div className="relative flex-1 max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl w-full focus:outline-none focus:border-blue-300"
              placeholder="Rechercher..." />
          </div>
          <button className="flex items-center gap-2 text-slate-500 hover:text-slate-700 text-sm px-3 py-2 border border-slate-200 rounded-xl hover:bg-slate-50 transition">
            <Filter size={14} /> Filtrer
          </button>
        </div>

        <div className="divide-y divide-slate-50">
          {filtered.map((r, i) => {
            const s = SENTIMENT[r.sentiment as keyof typeof SENTIMENT];
            const isPlaying = playing === r.id;
            return (
              <motion.div key={r.id} className="p-5 hover:bg-slate-50 transition"
                initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
                <div className="flex items-start gap-4">
                  {/* Play button */}
                  <button onClick={() => setPlaying(isPlaying ? null : r.id)}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition ${isPlaying ? "bg-blue-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-600"}`}>
                    {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-semibold text-slate-800 text-sm">{r.commercial}</span>
                      <span className="text-slate-400 text-xs">→</span>
                      <span className="font-medium text-slate-700 text-sm">{r.client}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${s.cls}`}>{s.icon} {s.label}</span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-slate-400 text-xs">
                      <span>📅 {r.date} à {r.time}</span>
                      <span>⏱️ {r.duration}</span>
                      <span>💰 CA visite: {r.ca} TND</span>
                    </div>

                    {/* Audio bar (demo) */}
                    {isPlaying && (
                      <motion.div className="mt-3 flex items-center gap-3"
                        initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                        <div className="flex-1 h-8 bg-slate-100 rounded-lg overflow-hidden relative">
                          <div className="absolute inset-0 flex items-center gap-0.5 px-2">
                            {[...Array(50)].map((_, j) => (
                              <div key={j} className="flex-1 bg-blue-300 rounded-full"
                                style={{ height: `${20 + Math.sin(j * 0.5) * 60}%` }} />
                            ))}
                          </div>
                          <motion.div className="absolute left-0 top-0 bottom-0 bg-blue-500/20"
                            initial={{ width: 0 }} animate={{ width: "40%" }}
                            transition={{ duration: 5, ease: "linear" }} />
                        </div>
                        <span className="text-xs text-slate-400">1:22 / {r.duration}</span>
                      </motion.div>
                    )}

                    {/* AI Summary */}
                    <div className="mt-3 bg-blue-50 border border-blue-100 rounded-xl p-3">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 mb-1.5">
                        <span>🤖</span> Résumé IA
                      </div>
                      <p className="text-slate-600 text-xs leading-relaxed">{r.summary}</p>
                      <div className="flex gap-1.5 mt-2 flex-wrap">
                        {r.keywords.map(k => (
                          <span key={k} className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">{k}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
