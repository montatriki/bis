"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { ShoppingBag, FileText, TrendingUp, Clock, Phone, MessageSquare, AlertTriangle, Package, ChevronRight, Star } from "lucide-react";

const RECENT_ORDERS = [
  { id: "BL-2026-0087", date: "15/05/2026", amount: 2340.50, status: "Livré", items: 8, statusColor: "bg-emerald-100 text-emerald-700" },
  { id: "BL-2026-0074", date: "10/05/2026", amount: 1850.00, status: "Livré", items: 5, statusColor: "bg-emerald-100 text-emerald-700" },
  { id: "BL-2026-0061", date: "05/05/2026", amount: 3100.75, status: "Livré", items: 12, statusColor: "bg-emerald-100 text-emerald-700" },
  { id: "BC-2026-0042", date: "17/05/2026", amount: 1640.00, status: "En attente", items: 6, statusColor: "bg-amber-100 text-amber-700" },
];

const RECOMMANDED = [
  { ref: "P001", name: "Coffret Échecs 2025", price: "14.875 TND", tag: "Populaire" },
  { ref: "P009", name: "Surprise DouDou 12 pcs", price: "26.18 TND", tag: "Nouveau" },
  { ref: "P011", name: "Jeux de bois 4 en 1", price: "19.04 TND", tag: "Tendance" },
];

export default function ClientDashboardPage() {
  const [showBalanceAlert, setShowBalanceAlert] = useState(false);
  const balance = 4428.262;
  const creditLimit = 5000;
  const creditPct = Math.min((balance / creditLimit) * 100, 100);

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <motion.div className="bg-gradient-to-r from-blue-700 to-blue-600 rounded-2xl p-6 text-white"
        initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="text-blue-200 text-sm mb-1">Bonjour,</div>
            <h1 className="text-2xl font-bold">AGIL BEJA SUD</h1>
            <div className="text-blue-200 text-sm mt-1">Dimanche 17 mai 2026 — Zone Béja</div>
          </div>
          {/* Commercial contact */}
          <div className="bg-white/10 rounded-2xl p-4 min-w-[200px]">
            <div className="text-blue-200 text-xs mb-2 font-semibold uppercase tracking-wide">Votre commercial</div>
            <div className="font-bold text-base mb-3">Mokhtar Trabelsi</div>
            <div className="flex gap-2">
              <a href="tel:+21698000000" className="flex items-center gap-1.5 bg-emerald-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-emerald-400 transition">
                <Phone size={12} /> Appeler
              </a>
              <button className="flex items-center gap-1.5 bg-white/20 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-white/30 transition">
                <MessageSquare size={12} /> Message
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Balance + credit limit */}
      {creditPct > 80 && (
        <motion.div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 flex items-start gap-3"
          initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
          <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={20} className="text-red-600" />
          </div>
          <div className="flex-1">
            <div className="font-bold text-red-800">Plafond de crédit presque atteint</div>
            <div className="text-red-600 text-sm mt-0.5">
              Solde actuel : <strong>{balance.toFixed(3)} TND</strong> sur limite {creditLimit.toLocaleString()} TND ({creditPct.toFixed(0)}%)
            </div>
            <div className="mt-2 h-2 bg-red-100 rounded-full overflow-hidden">
              <motion.div className="h-full bg-red-500 rounded-full"
                initial={{ width: 0 }} animate={{ width: `${creditPct}%` }} transition={{ duration: 0.8 }} />
            </div>
          </div>
        </motion.div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Commandes ce mois", value: "4", sub: "+2 vs mois dernier", icon: ShoppingBag, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Total achats (mai)", value: "7 290 TND", sub: "6 commandes traitées", icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Solde dû", value: `${balance.toFixed(0)} TND`, sub: "Cliquez pour détail", icon: FileText, color: "text-red-500", bg: "bg-red-50", onClick: () => setShowBalanceAlert(true) },
          { label: "Prochaine livraison", value: "19/05/2026", sub: "BC-2026-0042 en cours", icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
        ].map(({ label, value, sub, icon: Icon, color, bg, onClick }) => (
          <motion.div key={label}
            className={`bg-white rounded-2xl border border-slate-100 shadow-sm p-5 ${onClick ? "cursor-pointer hover:border-red-200 transition" : ""}`}
            onClick={onClick}
            whileHover={onClick ? { scale: 1.01 } : {}}>
            <div className={`w-10 h-10 ${bg} ${color} rounded-xl flex items-center justify-center mb-3`}>
              <Icon size={20} />
            </div>
            <div className={`text-xl font-bold ${color}`}>{value}</div>
            <div className="text-slate-500 text-sm mt-1">{label}</div>
            <div className="text-slate-400 text-xs mt-0.5">{sub}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent orders */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-bold text-slate-800">Dernières commandes</h2>
            <a href="/client/historique" className="text-blue-600 text-sm hover:text-blue-500 transition flex items-center gap-1">
              Voir tout <ChevronRight size={14} />
            </a>
          </div>
          <div className="divide-y divide-slate-50">
            {RECENT_ORDERS.map((o, i) => (
              <motion.div key={o.id} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}>
                <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <ShoppingBag size={16} className="text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-800 text-sm">{o.id}</div>
                  <div className="text-slate-400 text-xs">{o.date} · {o.items} articles</div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${o.statusColor}`}>{o.status}</span>
                  <span className="font-bold text-slate-800 text-sm">{o.amount.toLocaleString("fr-TN", { minimumFractionDigits: 2 })} TND</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Quick actions */}
        <div className="space-y-3">
          <h3 className="font-bold text-slate-700 text-sm px-1">Actions rapides</h3>
          {[
            { label: "Passer une commande", desc: "Parcourir le catalogue", href: "/client/commander", icon: ShoppingBag, color: "bg-blue-600 text-white", border: "" },
            { label: "Mes documents", desc: "BL, Factures, Avoirs", href: "/client/historique", icon: FileText, color: "bg-white text-slate-800", border: "border border-slate-200" },
            { label: "Suivre livraison", desc: "Voir l'avancement", href: "/client/suivi", icon: Package, color: "bg-white text-slate-800", border: "border border-slate-200" },
            { label: "Contacter commercial", desc: "Message ou appel direct", href: "#", icon: MessageSquare, color: "bg-white text-slate-800", border: "border border-slate-200", onClick: true },
          ].map(action => (
            <a key={action.label} href={action.href}
              className={`${action.color} ${action.border} rounded-2xl p-4 hover:opacity-90 transition flex items-center gap-3 group`}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${action.color.includes("blue-600") ? "bg-white/20" : "bg-slate-100"}`}>
                <action.icon size={17} className={action.color.includes("blue-600") ? "text-white" : "text-slate-500"} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">{action.label}</div>
                <div className={`text-xs mt-0.5 ${action.color.includes("blue-600") ? "opacity-70" : "text-slate-400"}`}>{action.desc}</div>
              </div>
              <ChevronRight size={15} className={`opacity-40 group-hover:opacity-80 transition ${action.color.includes("blue-600") ? "text-white" : "text-slate-400"}`} />
            </a>
          ))}
        </div>
      </div>

      {/* AI Recommendations */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center gap-2">
          <div className="w-7 h-7 bg-amber-100 rounded-lg flex items-center justify-center">
            <Star size={14} className="text-amber-600" />
          </div>
          <h2 className="font-bold text-slate-800">Recommandés pour vous</h2>
          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold ml-auto">IA</span>
        </div>
        <div className="p-5 grid sm:grid-cols-3 gap-4">
          {RECOMMANDED.map(p => (
            <div key={p.ref} className="border border-slate-100 rounded-xl p-4 hover:border-blue-200 hover:bg-blue-50/30 transition">
              <div className="w-full h-16 bg-gradient-to-br from-slate-100 to-slate-50 rounded-lg flex items-center justify-center mb-3">
                <Package size={24} className="text-slate-300" />
              </div>
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">{p.tag}</span>
              <div className="font-semibold text-slate-800 text-sm mt-2 leading-tight">{p.name}</div>
              <div className="font-bold text-blue-700 text-sm mt-1">{p.price}</div>
              <a href="/client/commander" className="mt-3 block text-center text-xs bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-500 transition font-medium">
                Commander
              </a>
            </div>
          ))}
        </div>
      </div>

      {/* Balance detail modal */}
      {showBalanceAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowBalanceAlert(false)}>
          <motion.div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            onClick={e => e.stopPropagation()}>
            <div className="bg-red-600 text-white p-5">
              <div className="font-bold text-lg">Détail du solde</div>
              <div className="text-red-200 text-sm">Plafond de crédit</div>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-center py-3 border-b border-slate-100">
                <span className="text-slate-500">Solde actuel</span>
                <span className="font-bold text-red-700 text-xl">{balance.toFixed(3)} TND</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-slate-100">
                <span className="text-slate-500">Plafond autorisé</span>
                <span className="font-bold text-slate-800">{creditLimit.toLocaleString()} TND</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-slate-100">
                <span className="text-slate-500">Disponible</span>
                <span className="font-bold text-emerald-700">{(creditLimit - balance).toFixed(3)} TND</span>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                Votre solde représente {creditPct.toFixed(0)}% de votre plafond. Contactez votre commercial pour régulariser votre compte.
              </div>
              <div className="flex gap-3">
                <a href="tel:+21698000000" className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 text-white py-3 rounded-xl font-semibold hover:bg-emerald-500 transition">
                  <Phone size={16} /> Appeler Mokhtar
                </a>
                <button onClick={() => setShowBalanceAlert(false)} className="flex-1 border border-slate-200 text-slate-600 py-3 rounded-xl font-semibold hover:bg-slate-50 transition">
                  Fermer
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
