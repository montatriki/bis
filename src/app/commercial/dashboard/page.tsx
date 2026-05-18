"use client";
import { motion } from "framer-motion";
import { Users, MapPin, ShoppingBag, TrendingUp, Clock, CheckCircle, AlertTriangle, ChevronRight, Phone, CreditCard } from "lucide-react";
import { DUMMY_CLIENTS } from "@/lib/dummy-data";

const TODAY_STATS = [
  { label: "CA du jour", value: "3 506 TND", target: "5 000 TND", pct: 70, icon: TrendingUp, color: "text-blue-600", bg: "bg-blue-50" },
  { label: "Clients visités", value: "14 / 17", target: "Objectif: 17", pct: 82, icon: Users, color: "text-emerald-600", bg: "bg-emerald-50" },
  { label: "Recouvrement", value: "2 180 TND", target: "Objectif: 3 200 TND", pct: 68, icon: CreditCard, color: "text-purple-600", bg: "bg-purple-50" },
  { label: "Km parcourus", value: "142 km", target: "Estimé: 195 km", pct: 73, icon: MapPin, color: "text-amber-600", bg: "bg-amber-50" },
];

const NEXT_CLIENTS = DUMMY_CLIENTS.slice(5, 9).map((c, i) => ({
  ...c,
  time: `${14 + i}:${i % 2 === 0 ? "00" : "30"}`,
}));

const PENDING_DOCS = [
  { id: "BL-2026-1247", client: "AGIL BEJA SUD", amount: 840, type: "BL", urgent: true },
  { id: "BC-2026-0089", client: "librairie saphir", amount: 430, type: "BC", urgent: false },
  { id: "RV-2026-0012", client: "Grossiste El Wafa", amount: 1560, type: "RV", urgent: false },
];

export default function CommercialDashboardPage() {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <motion.div className="bg-gradient-to-r from-emerald-700 to-emerald-600 rounded-2xl p-6 text-white"
        initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="text-emerald-200 text-sm mb-1">{greeting},</div>
            <h1 className="text-2xl font-bold">Mokhtar Trabelsi</h1>
            <div className="text-emerald-200 text-sm mt-1 flex items-center gap-2">
              <MapPin size={13} /> Zone Nord — Béja · 17/05/2026
            </div>
          </div>
          <div className="bg-white/10 rounded-2xl p-4">
            <div className="text-emerald-200 text-xs mb-1 font-semibold uppercase tracking-wide">Véhicule</div>
            <div className="font-bold">206TU7140 — Peugeot 206</div>
            <div className="flex items-center gap-1.5 mt-2">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-emerald-200 text-xs">En mission · 0 km/h</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {TODAY_STATS.map((s, i) => (
          <motion.div key={s.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
            <div className={`w-10 h-10 ${s.bg} rounded-xl flex items-center justify-center mb-3`}>
              <s.icon size={18} className={s.color} />
            </div>
            <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-slate-500 text-sm mt-1">{s.label}</div>
            <div className="text-slate-400 text-xs mt-0.5 mb-2">{s.target}</div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <motion.div className={`h-full rounded-full ${s.pct >= 80 ? "bg-emerald-500" : s.pct >= 60 ? "bg-amber-500" : "bg-red-400"}`}
                initial={{ width: 0 }} animate={{ width: `${s.pct}%` }} transition={{ duration: 0.8, delay: 0.3 + i * 0.07 }} />
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Next visits */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-bold text-slate-800 flex items-center gap-2">
                <Clock size={16} className="text-blue-500" /> Prochains clients
              </h2>
              <a href="/commercial/planning" className="text-blue-600 text-sm hover:text-blue-500 flex items-center gap-1">
                Voir planning <ChevronRight size={14} />
              </a>
            </div>
            <div className="divide-y divide-slate-50">
              {NEXT_CLIENTS.map((c, i) => (
                <motion.div key={c.name} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition"
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.06 }}>
                  <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold text-emerald-600">
                    {i + 6}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-800 text-sm truncate">{c.name}</div>
                    <div className="text-slate-400 text-xs flex items-center gap-1.5">
                      <MapPin size={10} /> {c.city} · {c.time}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {c.balance > 3000 && (
                      <AlertTriangle size={14} className="text-red-500" />
                    )}
                    <span className={`text-xs font-semibold ${c.balance > 0 ? "text-red-600" : "text-emerald-600"}`}>
                      {c.balance > 0 ? `${c.balance.toFixed(0)} TND` : "À jour"}
                    </span>
                    <a href="tel:+21698000000" className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition">
                      <Phone size={14} />
                    </a>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Pending docs */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100">
              <h2 className="font-bold text-slate-800 flex items-center gap-2">
                <ShoppingBag size={16} className="text-purple-500" /> Documents en attente
                <span className="ml-auto text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">{PENDING_DOCS.length}</span>
              </h2>
            </div>
            <div className="divide-y divide-slate-50">
              {PENDING_DOCS.map((doc, i) => (
                <div key={doc.id} className="flex items-center gap-4 px-5 py-4">
                  <div className={`text-xs font-bold px-2 py-1 rounded-lg ${doc.type === "BL" ? "bg-blue-100 text-blue-700" : doc.type === "BC" ? "bg-purple-100 text-purple-700" : "bg-emerald-100 text-emerald-700"}`}>
                    {doc.type}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-800 text-sm">{doc.id}</div>
                    <div className="text-slate-400 text-xs">{doc.client}</div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {doc.urgent && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-md font-semibold">Urgent</span>}
                    <span className="font-bold text-slate-800 text-sm">{doc.amount} TND</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="space-y-3">
          <h3 className="font-bold text-slate-700 text-sm px-1">Actions rapides</h3>
          {[
            { label: "Mes clients", desc: "Fiche client + commande", href: "/commercial/clients", icon: Users, color: "bg-emerald-600 text-white" },
            { label: "Carte GPS", desc: "Position et tournée", href: "/commercial/map", icon: MapPin, color: "bg-white text-slate-800 border border-slate-200" },
            { label: "Catalogue", desc: "Passer une commande", href: "/commercial/catalogue", icon: ShoppingBag, color: "bg-white text-slate-800 border border-slate-200" },
            { label: "Recouvrement", desc: "Encaissements du jour", href: "/commercial/recouvrement", icon: CreditCard, color: "bg-white text-slate-800 border border-slate-200" },
          ].map(action => (
            <a key={action.label} href={action.href}
              className={`${action.color} rounded-2xl p-4 hover:opacity-90 transition flex items-center gap-3 group`}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${action.color.includes("emerald-600") ? "bg-white/20" : "bg-slate-100"}`}>
                <action.icon size={17} className={action.color.includes("emerald-600") ? "text-white" : "text-slate-500"} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">{action.label}</div>
                <div className={`text-xs mt-0.5 ${action.color.includes("emerald-600") ? "opacity-70" : "text-slate-400"}`}>{action.desc}</div>
              </div>
              <ChevronRight size={15} className={`opacity-40 group-hover:opacity-80 transition ${action.color.includes("emerald-600") ? "text-white" : "text-slate-400"}`} />
            </a>
          ))}

          {/* Today summary */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 mt-2">
            <h4 className="font-bold text-slate-700 text-sm mb-3 flex items-center gap-2">
              <CheckCircle size={14} className="text-emerald-500" /> Résumé du jour
            </h4>
            {[
              ["Mission en cours", "#2548", "text-blue-600"],
              ["Bons émis", "8", "text-slate-700"],
              ["Encaissements", "2 180 TND", "text-emerald-600"],
              ["Retours traités", "0", "text-slate-700"],
            ].map(([label, value, color]) => (
              <div key={label} className="flex justify-between py-2 border-b border-slate-50 last:border-0 text-sm">
                <span className="text-slate-500">{label}</span>
                <span className={`font-bold ${color}`}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
