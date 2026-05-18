"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, ShoppingCart, FileText, AlertTriangle, MapPin, Phone, Star } from "lucide-react";
import { DUMMY_CLIENTS, DUMMY_PRODUCTS } from "@/lib/dummy-data";
import RiskBadge from "@/components/ui/RiskBadge";

const CREDIT_LIMIT = 5000;

const RECOMMENDED: Record<string, string[]> = {
  "GMS": ["coffret echec 2025", "coffret scrable 2025"],
  "librairie": ["Conte hikayeti 2026", "mini puzzel 2 en 1 70 pcs"],
  "magasin": ["jeux de bois 4 en 1", "Domino bois 28pcs"],
  "default": ["coffret echec 2025", "jeux ludo bois"],
};

export default function ClientsPage() {
  const [search, setSearch] = useState("");
  const [govFilter, setGovFilter] = useState("Tous");
  const [showBasket, setShowBasket] = useState<typeof DUMMY_CLIENTS[0] | null>(null);
  const [showBalanceAlert, setShowBalanceAlert] = useState(false);
  const [basketItems] = useState([
    { name: "coffret echec 2025", qty: 2, price: 12.5, rem: 0 },
    { name: "jeux ludo bois", qty: 3, price: 10.0, rem: 5 },
  ]);

  const govs = ["Tous", ...new Set(DUMMY_CLIENTS.map(c => c.governorate))];
  const filtered = DUMMY_CLIENTS.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) &&
    (govFilter === "Tous" || c.governorate === govFilter)
  );

  const totalCreances = DUMMY_CLIENTS.reduce((s, c) => s + c.balance, 0);

  function openBasket(c: typeof DUMMY_CLIENTS[0]) {
    setShowBasket(c);
    const basketTotal = basketItems.reduce((s, i) => s + i.qty * i.price, 0);
    if (c.balance + basketTotal > CREDIT_LIMIT) {
      setShowBalanceAlert(true);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Mes clients</h1>
          <p className="text-slate-500 text-sm">{filtered.length} / {DUMMY_CLIENTS.length} clients</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2 text-center">
          <div className="text-lg font-bold text-blue-700">{totalCreances.toFixed(0)} TND</div>
          <div className="text-blue-500 text-xs">Créances totales</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl w-full focus:outline-none focus:border-blue-300 placeholder:text-slate-400"
            placeholder="Rechercher un client..." />
        </div>
        <select value={govFilter} onChange={e => setGovFilter(e.target.value)}
          className="py-2.5 px-3 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-blue-300">
          {govs.map(g => <option key={g}>{g}</option>)}
        </select>
      </div>

      {/* Client grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((c, i) => {
          const recs = RECOMMENDED[c.category] || RECOMMENDED.default;
          return (
            <motion.div key={c.name}
              className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 hover:shadow-md transition"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 font-bold text-sm flex items-center justify-center flex-shrink-0">
                    {c.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-800 text-sm truncate">{c.name}</div>
                    <div className="text-slate-400 text-xs flex items-center gap-1">
                      <MapPin size={10} />{c.city} — {c.governorate}
                    </div>
                  </div>
                </div>
                <RiskBadge score={c.riskScore} />
              </div>

              {/* AI Recommendation badge */}
              <div className="mb-3 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                <div className="flex items-center gap-1.5 mb-1">
                  <Star size={10} className="text-amber-500" />
                  <span className="text-xs font-semibold text-amber-700">Recommandés IA</span>
                </div>
                <div className="text-xs text-amber-600 truncate">{recs.join(" · ")}</div>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="bg-slate-50 rounded-xl p-2 text-center">
                  <div className="text-xs text-slate-400">Solde</div>
                  <div className={`font-bold text-sm ${c.balance > 0 ? "text-red-600" : "text-emerald-600"}`}>
                    {c.balance > 0 ? `${c.balance.toFixed(2)} TND` : "0.000"}
                  </div>
                </div>
                <div className="bg-slate-50 rounded-xl p-2 text-center">
                  <div className="text-xs text-slate-400">Catégorie</div>
                  <div className="font-medium text-slate-700 text-xs truncate">{c.category}</div>
                </div>
              </div>

              {c.balance > CREDIT_LIMIT * 0.8 && (
                <div className="mb-3 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
                  <AlertTriangle size={11} className="text-red-500 flex-shrink-0" />
                  <span className="text-xs text-red-600 font-medium">Solde proche du plafond ({CREDIT_LIMIT.toLocaleString()} TND)</span>
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={() => openBasket(c)}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs bg-blue-50 text-blue-700 border border-blue-200 py-2 rounded-xl hover:bg-blue-100 transition font-medium">
                  <ShoppingCart size={12} /> Panier
                </button>
                <button className="flex-1 flex items-center justify-center gap-1.5 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 py-2 rounded-xl hover:bg-emerald-100 transition font-medium">
                  <FileText size={12} /> BL
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Balance Alert Modal */}
      <AnimatePresence>
        {showBasket && showBalanceAlert && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6"
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                  <AlertTriangle size={20} className="text-red-600" />
                </div>
                <div>
                  <div className="font-bold text-slate-800">⚠️ ATTENTION — Plafond crédit</div>
                  <div className="text-slate-500 text-xs">{showBasket.name}</div>
                </div>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-2 text-sm mb-5">
                <div className="flex justify-between"><span className="text-slate-600">Solde actuel</span><span className="font-bold text-red-600">{showBasket.balance.toFixed(3)} TND</span></div>
                <div className="flex justify-between"><span className="text-slate-600">Plafond autorisé</span><span className="font-bold">{CREDIT_LIMIT.toLocaleString()} TND</span></div>
                <div className="flex justify-between border-t border-red-200 pt-2"><span className="text-slate-600">Après commande</span><span className="font-bold text-red-700">{(showBasket.balance + 75).toFixed(3)} TND ⚠️</span></div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setShowBalanceAlert(false); }}
                  className="flex-1 bg-amber-500 text-white py-2.5 rounded-xl font-medium hover:bg-amber-400 transition text-sm">
                  Continuer quand même
                </button>
                <button onClick={() => { setShowBasket(null); setShowBalanceAlert(false); }}
                  className="flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-xl hover:bg-slate-50 transition text-sm">
                  Annuler
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Basket Modal */}
      <AnimatePresence>
        {showBasket && !showBalanceAlert && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
              <div className="bg-slate-800 text-white p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-lg truncate">{showBasket.name}</div>
                    <div className="text-slate-400 text-xs mt-0.5">MF: 1584153T/A/M/000</div>
                  </div>
                  <button onClick={() => setShowBasket(null)} className="p-2 hover:bg-white/10 rounded-xl transition"><X size={18} /></button>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-700 text-sm text-slate-300">
                  <div>Commercial: Mokhtar Trabelsi</div>
                  <div>N° ticket: TIC252816 | 17-05-2026 11:22</div>
                </div>
              </div>
              <div className="p-5">
                <div className="text-sm font-semibold text-slate-700 mb-3">Articles</div>
                <div className="space-y-2 mb-4">
                  {basketItems.map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl text-sm">
                      <div>
                        <div className="font-medium text-slate-800">{item.name}</div>
                        {item.rem > 0 && <div className="text-red-500 text-xs">REM: {item.rem}%</div>}
                      </div>
                      <div className="text-right">
                        <div className="text-slate-400 text-xs">Qté: {item.qty}</div>
                        <div className="font-semibold">{(item.price * item.qty * (1 - item.rem / 100)).toFixed(3)}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="border-t border-slate-100 pt-3 space-y-1.5">
                  {[["Montant HT", (basketItems.reduce((s, i) => s + i.qty * i.price, 0)).toFixed(3)], ["TVA 19%", (basketItems.reduce((s, i) => s + i.qty * i.price, 0) * 0.19).toFixed(3)], ["Net à payer", (basketItems.reduce((s, i) => s + i.qty * i.price, 0) * 1.19).toFixed(3)]].map(([k, v]) => (
                    <div key={k} className="flex justify-between text-sm">
                      <span className="text-slate-500">{k}</span>
                      <span className="font-semibold">{v} TND</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 p-5 border-t border-slate-100">
                <button className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl font-medium hover:bg-blue-500 transition text-sm">🖨️ IMPRIMER</button>
                <button onClick={() => setShowBasket(null)} className="flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-xl font-medium hover:bg-slate-50 transition text-sm">Fermer</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
