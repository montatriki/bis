"use client";
import { motion } from "framer-motion";
import { TrendingUp, CheckSquare, AlertTriangle, Users, ArrowRight, Phone, FileText, Target } from "lucide-react";
import Link from "next/link";
import { COMMERCIAL_PERFORMANCE } from "@/lib/dummy-data";

const PENDING_DOCS = [
  { id: "BC-2026-0042", type: "Bon de commande", commercial: "Mokhtar", client: "AGIL BEJA SUD", amount: 5840, discount: 8, urgency: "normal" },
  { id: "BC-2026-0043", type: "Bon de commande", commercial: "FOUED", client: "Grossiste El Wafa", amount: 3200, discount: 6, urgency: "normal" },
  { id: "AV-2026-0011", type: "Avoir", commercial: "HICHEM", client: "librairie saphir", amount: 1240, discount: 0, urgency: "urgent" },
  { id: "REM-2026-005", type: "Remise except. 18%", commercial: "Mokhtar", client: "AGIL MAHDIA", amount: 7100, discount: 18, urgency: "urgent" },
];

const LIVE_AGENTS = [
  { name: "Mokhtar Trabelsi", status: "active", visited: 14, total: 17, ca: 3506, obj: 5000, lastAction: "Visite AGIL BEJA SUD" },
  { name: "HICHEM", status: "offline", visited: 8, total: 14, ca: 2100, obj: 5000, lastAction: "Hors ligne depuis 2h" },
  { name: "FOUED", status: "moving", visited: 11, total: 15, ca: 4200, obj: 5000, lastAction: "En déplacement → Monastir" },
  { name: "Anis Ben Salem", status: "stopped", visited: 6, total: 12, ca: 1800, obj: 4000, lastAction: "Pause — 18 min" },
];

const GPS_STATUS: Record<string, { label: string; dot: string; badge: string }> = {
  active: { label: "En mission", dot: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-700" },
  moving: { label: "En déplacement", dot: "bg-blue-500", badge: "bg-blue-100 text-blue-700" },
  stopped: { label: "Pause", dot: "bg-amber-500", badge: "bg-amber-100 text-amber-700" },
  offline: { label: "Hors ligne", dot: "bg-red-400", badge: "bg-red-100 text-red-600" },
};

const totalCA = LIVE_AGENTS.reduce((s, a) => s + a.ca, 0);
const totalObj = 19000;
const totalPct = Math.round((totalCA / totalObj) * 100);

export default function ManagerDashboard() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Tableau de bord Manager</h1>
          <p className="text-slate-500 text-sm">Dimanche 17 mai 2026 — Supervision en direct</p>
        </div>
        {PENDING_DOCS.some(d => d.urgency === "urgent") && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-red-700 text-sm font-semibold">{PENDING_DOCS.filter(d => d.urgency === "urgent").length} document(s) urgent(s)</span>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <div className="flex items-start justify-between mb-5">
          <div><h2 className="font-bold text-slate-800 text-lg">Performance du jour</h2><p className="text-slate-500 text-sm">CA équipe vs objectif journalier</p></div>
          <div className="text-right"><div className="text-3xl font-black text-blue-700">{totalPct}%</div><div className="text-slate-400 text-xs">de l'objectif</div></div>
        </div>
        <div className="mb-5">
          <div className="flex justify-between text-sm text-slate-500 mb-2">
            <span className="font-semibold">{totalCA.toLocaleString()} TND réalisés</span>
            <span>Objectif: {totalObj.toLocaleString()} TND</span>
          </div>
          <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
            <motion.div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-600"
              initial={{ width: 0 }} animate={{ width: `${Math.min(totalPct, 100)}%` }} transition={{ duration: 1, ease: "easeOut" }} />
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {LIVE_AGENTS.map((a, i) => {
            const pct = Math.round((a.ca / a.obj) * 100);
            const s = GPS_STATUS[a.status];
            return (
              <motion.div key={a.name} className="bg-slate-50 rounded-xl p-3"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-slate-800 text-sm truncate">{a.name.split(" ")[0]}</span>
                  <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                </div>
                <div className="text-lg font-bold text-slate-800">{pct}%</div>
                <div className="text-xs text-slate-500">{a.ca.toLocaleString()} TND</div>
                <div className="mt-2 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${pct >= 100 ? "bg-emerald-500" : pct >= 80 ? "bg-blue-500" : "bg-amber-500"}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <CheckSquare size={16} className="text-blue-500" />
              <h2 className="font-bold text-slate-800">Documents en attente</h2>
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">{PENDING_DOCS.length}</span>
            </div>
            <Link href="/manager/validation" className="text-blue-600 text-xs font-semibold hover:text-blue-700 flex items-center gap-1">Valider <ArrowRight size={12} /></Link>
          </div>
          <div className="divide-y divide-slate-50">
            {PENDING_DOCS.map(d => (
              <div key={d.id} className={`flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition ${d.urgency === "urgent" ? "bg-red-50/40" : ""}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-mono text-slate-400">{d.id}</span>
                    {d.urgency === "urgent" && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold">URGENT</span>}
                    {d.discount > 12 && <span className="text-[10px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded font-bold">Remise {d.discount}%</span>}
                  </div>
                  <div className="font-semibold text-slate-800 text-sm truncate">{d.client}</div>
                  <div className="text-slate-400 text-xs">{d.commercial} · {d.type}</div>
                </div>
                <div className="font-bold text-slate-800 text-sm flex-shrink-0">{d.amount.toLocaleString()} TND</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-emerald-500" />
              <h2 className="font-bold text-slate-800">Commerciaux — En direct</h2>
            </div>
            <Link href="/manager/supervision" className="text-blue-600 text-xs font-semibold hover:text-blue-700 flex items-center gap-1">Carte <ArrowRight size={12} /></Link>
          </div>
          <div className="divide-y divide-slate-50">
            {LIVE_AGENTS.map(a => {
              const s = GPS_STATUS[a.status];
              return (
                <div key={a.name} className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${a.status === "offline" ? "bg-slate-300" : "bg-blue-600"}`}>
                    {a.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-semibold text-slate-800 text-sm">{a.name.split(" ")[0]}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${s.badge} flex items-center gap-1 font-semibold`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />{s.label}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 truncate">{a.lastAction}</div>
                    <div className="text-xs text-slate-500 font-medium">{a.visited}/{a.total} visites · {a.ca.toLocaleString()} TND</div>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button className="w-7 h-7 flex items-center justify-center text-blue-500 hover:bg-blue-50 rounded-lg transition"><Phone size={12} /></button>
                    <button className="w-7 h-7 flex items-center justify-center text-slate-400 hover:bg-slate-100 rounded-lg transition"><FileText size={12} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={18} className="text-red-600" />
            <h3 className="font-bold text-red-800">Recouvrement — État critique</h3>
          </div>
          <div className="space-y-2.5">
            {[["Créances > 90 jours", "5 clients", "18 240 TND", true], ["Créances 60–90 jours", "3 clients", "6 100 TND", false], ["Chèques échus", "2 chèques", "5 200 TND", true]].map(([label, nb, amount, alert]) => (
              <div key={String(label)} className="flex items-center justify-between bg-white rounded-xl p-3 border border-red-100">
                <div><div className="text-sm font-semibold text-slate-800">{label}</div><div className="text-xs text-slate-500">{nb}</div></div>
                <div className={`font-bold text-sm ${alert ? "text-red-600" : "text-amber-600"}`}>{amount}</div>
              </div>
            ))}
          </div>
          <button className="mt-4 w-full text-sm bg-red-600 text-white py-2.5 rounded-xl font-medium hover:bg-red-500 transition">Envoyer rappels automatiques</button>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Target size={16} className="text-blue-500" />
            <h3 className="font-bold text-slate-800">Objectifs mensuel — Mai 2026</h3>
          </div>
          <div className="space-y-3">
            {COMMERCIAL_PERFORMANCE.map(c => {
              const pct = Math.round((c.ca / c.objectif) * 100);
              const color = pct >= 100 ? "bg-emerald-500" : pct >= 80 ? "bg-blue-500" : "bg-amber-500";
              const textColor = pct >= 100 ? "text-emerald-600" : pct >= 80 ? "text-blue-600" : "text-amber-600";
              return (
                <div key={c.name}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="font-semibold text-slate-700">{c.name}</span>
                    <span className={`font-bold ${textColor}`}>{pct}% · {c.ca.toLocaleString()} TND</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <Link href="/manager/objectifs" className="mt-4 flex items-center justify-center gap-2 text-sm text-blue-600 font-semibold hover:text-blue-700">
            Voir détail objectifs <ArrowRight size={13} />
          </Link>
        </div>
      </div>
    </div>
  );
}
