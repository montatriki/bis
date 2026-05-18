"use client";
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { 
  Users, Truck, TrendingUp, AlertTriangle, 
  ArrowUpRight, ArrowDownRight, Cpu, Brain, 
  Battery, Radio, BarChart2
} from "lucide-react";
const CAAreaChart = dynamic(() => import("@/components/charts/CAChart").then(m => m.CAAreaChart), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[250px] bg-[var(--bg-primary)]/40 rounded-2xl animate-pulse flex items-center justify-center border border-[var(--border-primary)]">
      <span className="text-[var(--text-secondary)] text-[10px] font-bold">Chargement graphique...</span>
    </div>
  ),
});

const CommercialBarChart = dynamic(() => import("@/components/charts/CAChart").then(m => m.CommercialBarChart), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[250px] bg-[var(--bg-primary)]/40 rounded-2xl animate-pulse flex items-center justify-center border border-[var(--border-primary)]">
      <span className="text-[var(--text-secondary)] text-[10px] font-bold">Chargement graphique...</span>
    </div>
  ),
});

import { DEMO_VEHICLES } from "@/lib/dummy-data";

const TunisiaMap = dynamic(() => import("@/components/map/TunisiaMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-[var(--bg-primary)] rounded-2xl animate-pulse flex items-center justify-center">
      <span className="text-[var(--text-secondary)] text-sm font-bold">Chargement carte télémétrique...</span>
    </div>
  ),
});

const STATS = [
  { label: "CA du jour", value: "12 450 TND", sub: "+8.2% vs hier", up: true, icon: TrendingUp, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100" },
  { label: "Véhicules actifs", value: "3 / 5", sub: "1 en panne, 1 pause", up: null, icon: Truck, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100" },
  { label: "Clients visités", value: "47 / 111", sub: "Taux: 42%", up: false, icon: Users, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-100" },
  { label: "Alertes actives", value: "3", sub: "2 urgentes", up: false, icon: AlertTriangle, color: "text-red-500", bg: "bg-red-50", border: "border-red-100" },
];

const AI_WIDGETS = [
  { icon: "🔮", code: "AGENT_PROJECTION_V4.2", confidence: 98, title: "Prévision CA semaine prochaine", value: "28 400 TND", detail: "±5% basé sur historique 6 mois + saisonnalité", action: "Voir détail", color: "bg-purple-500/10 border-purple-500/20", titleColor: "text-purple-400", valueColor: "text-purple-400" },
  { icon: "⚠️", code: "AGENT_RETENTION_V2.9", confidence: 91, title: "Clients à risque de perte", value: "3 clients", detail: "Sans visite depuis > 30 jours — score IA calculé", action: "Voir liste", color: "bg-amber-500/10 border-amber-500/20", titleColor: "text-amber-400", valueColor: "text-amber-400" },
  { icon: "📦", code: "AGENT_STOCKS_V3.1", confidence: 95, title: "Ruptures prévues (7 jours)", value: "2 articles", detail: "coffret echec 2025, jeux ludo bois — sous seuil critique", action: "Générer BC", color: "bg-red-500/10 border-red-500/20", titleColor: "text-red-400", valueColor: "text-red-400" },
  { icon: "💰", code: "AGENT_FRAUD_V1.8", confidence: 97, title: "Anomalies financières", value: "1 détectée", detail: "Règlement de 8500 TND inhabituel — vérification requise", action: "Voir détail", color: "bg-blue-500/10 border-blue-500/20", titleColor: "text-blue-400", valueColor: "text-blue-400" },
];

const ALERTS = [
  { type: "STOCK", icon: "📦", msg: "coffret echec 2025 — stock: 2 (min: 5)", time: "5 min", urgent: true },
  { type: "GPS", icon: "🚗", msg: "238TU1019 HICHEM — hors ligne depuis 2h", time: "2h", urgent: true },
  { type: "FINANCE", icon: "💰", msg: "Chèque 2500 TND échu — Librairie El Wafa", time: "1h", urgent: false },
];

const SYSTEM_LOGS = [
  { time: "00:29:45", source: "GPS_DEMO_206", msg: "Ping GPS validé — Sousse Route (Vitesse: 64 km/h)", type: "info" },
  { time: "00:28:12", source: "AI_PREDICT", msg: "Ajustement courbe prévision CA hebdomadaire (+28 400 TND)", type: "ai" },
  { time: "00:26:01", source: "SYS_SECURITY", msg: "Vérification anomalie financière chèque Librairie El Wafa OK", type: "success" },
  { time: "00:24:50", source: "STOCK_WARN", msg: "Alerte seuil critique: 'coffret echec 2025' sous le minimum", type: "warn" },
  { time: "00:22:15", source: "COMM_SYNC", msg: "Synchronisation catalogue hors ligne — Commercial Mokhtar", type: "info" }
];

const VEHICLE_STATUS = {
  active: { label: "En mission", dot: "bg-emerald-500", badge: "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" },
  moving: { label: "En déplacement", dot: "bg-blue-500", badge: "bg-blue-500/10 text-blue-500 border border-blue-500/20" },
  stopped: { label: "Arrêté", dot: "bg-amber-500", badge: "bg-amber-500/10 text-amber-500 border border-amber-500/20" },
  offline: { label: "Hors ligne", dot: "bg-red-400", badge: "bg-red-500/10 text-red-500 border border-red-500/20" },
};

export default function AdminDashboard() {
  const [activeTheme, setActiveTheme] = useState<"latte" | "espresso" | "matcha">("latte");
  const [selectedAgent, setSelectedAgent] = useState<any>(null);
  const [agentActionState, setAgentActionState] = useState<Record<string, string>>({});

  const applyTheme = (theme: "latte" | "espresso" | "matcha") => {
    if (typeof window === "undefined") return;
    const root = document.documentElement;
    if (theme === "latte") {
      root.style.setProperty("--bg-primary", "#faf8f5");
      root.style.setProperty("--bg-card", "#ffffff");
      root.style.setProperty("--text-primary", "#2c1b0c");
      root.style.setProperty("--text-secondary", "#6e5d4f");
      root.style.setProperty("--accent-primary", "#b56e2d");
      root.style.setProperty("--accent-light", "rgba(181, 110, 45, 0.07)");
      root.style.setProperty("--border-primary", "rgba(139, 90, 43, 0.08)");
      root.style.setProperty("--shadow-primary", "rgba(139, 90, 43, 0.03)");
      root.style.setProperty("--shadow-hover", "rgba(181, 110, 45, 0.09)");
    } else if (theme === "espresso") {
      root.style.setProperty("--bg-primary", "#18110b");
      root.style.setProperty("--bg-card", "#241a12");
      root.style.setProperty("--text-primary", "#faf7f4");
      root.style.setProperty("--text-secondary", "#dcd2c9");
      root.style.setProperty("--accent-primary", "#e09f3e");
      root.style.setProperty("--accent-light", "rgba(224, 159, 62, 0.15)");
      root.style.setProperty("--border-primary", "rgba(235, 220, 201, 0.12)");
      root.style.setProperty("--shadow-primary", "rgba(0, 0, 0, 0.4)");
      root.style.setProperty("--shadow-hover", "rgba(224, 159, 62, 0.25)");
    } else {
      root.style.setProperty("--bg-primary", "#fafaf7");
      root.style.setProperty("--bg-card", "#ffffff");
      root.style.setProperty("--text-primary", "#2d3b1e");
      root.style.setProperty("--text-secondary", "#5d6b4d");
      root.style.setProperty("--accent-primary", "#6e8b3d");
      root.style.setProperty("--accent-light", "rgba(110, 139, 61, 0.07)");
      root.style.setProperty("--border-primary", "rgba(110, 139, 61, 0.08)");
      root.style.setProperty("--shadow-primary", "rgba(110, 139, 61, 0.02)");
      root.style.setProperty("--shadow-hover", "rgba(110, 139, 61, 0.09)");
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem("bis-dashboard-theme");
    if (saved) {
      setActiveTheme(saved as any);
      applyTheme(saved as any);
    }
  }, []);

  const changeTheme = (theme: "latte" | "espresso" | "matcha") => {
    setActiveTheme(theme);
    applyTheme(theme);
    localStorage.setItem("bis-dashboard-theme", theme);
  };

  return (
    <div className="space-y-6 animate-fade-in text-[var(--text-primary)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--border-primary)] pb-4 animate-fade-in">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight text-[var(--text-primary)]">Tableau de bord</h1>
            <span className="text-[10px] font-extrabold bg-[var(--accent-light)] text-[var(--accent-primary)] px-2.5 py-0.5 rounded-full border border-[var(--border-primary)] uppercase tracking-wider">ANALYTICS SYSTEM</span>
          </div>
          <p className="text-[var(--text-secondary)] opacity-80 text-xs mt-1">Supervision globale, gestion de flotte & prévisions cognitives temps réel</p>
        </div>
        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-1.5 shadow-sm">
          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse-dot" />
          <span className="text-emerald-500 text-[10px] font-black uppercase tracking-wider">Système en ligne</span>
        </div>
      </div>

      {/* Design Engine Toggles */}
      <div className="bg-white rounded-2xl border border-[var(--border-primary)] shadow-sm p-4 flex flex-col md:flex-row items-center justify-between gap-4 bg-gradient-to-r from-[var(--bg-card)] to-[var(--bg-primary)]/20 transition-all duration-300 animate-fade-in" style={{ animationDelay: "0.05s" }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-[var(--accent-light)] rounded-xl flex items-center justify-center border border-[var(--border-primary)]">
            <Cpu size={16} className="text-[var(--accent-primary)]" />
          </div>
          <div>
            <div className="text-xs font-black text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-1.5">
              <span>Moteur de Rendu Visuel</span>
              <span className="text-[8px] bg-emerald-500/10 text-emerald-500 px-1.5 py-0.2 rounded font-mono font-bold animate-blink">ONLINE</span>
            </div>
            <p className="text-[10px] text-[var(--text-secondary)] opacity-85 mt-0.5">Basculez instantanément les compilations de couleur et d'ambiance de l'interface en temps réel</p>
          </div>
        </div>
        
        <div className="flex items-center gap-1.5 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl p-1 shadow-inner">
          {[
            { id: "latte", label: "☕ Latte Macchiato", desc: "Clair Caramel" },
            { id: "espresso", label: "🍫 Dark Espresso", desc: "Sable Sombre" },
            { id: "matcha", label: "🍵 Matcha Telemetry", desc: "Herbe Tactique" }
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => changeTheme(t.id as any)}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-black transition-all flex flex-col items-center flex-shrink-0 border border-transparent ${activeTheme === t.id ? "bg-[var(--accent-primary)] text-white shadow-md scale-105" : "text-[var(--text-secondary)] opacity-80 hover:bg-[var(--accent-light)] hover:text-[var(--text-primary)]"}`}
            >
              <span>{t.label}</span>
              <span className="text-[8px] opacity-75 font-mono mt-0.5 font-bold uppercase">{t.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Stats row with Interactive Sparklines */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STATS.map((s, i) => (
          <div key={s.label} className="bg-white rounded-2xl border border-[var(--border-primary)] shadow-sm p-5 relative overflow-hidden group transition-all duration-300 animate-fade-in"
            style={{ animationDelay: `${i * 0.06}s` }}>
            <div className="flex items-start justify-between mb-2">
              <div className="w-10 h-10 bg-[var(--accent-light)] rounded-xl flex items-center justify-center border border-[var(--border-primary)]">
                <s.icon size={19} className="text-[var(--accent-primary)]" />
              </div>
              {s.up !== null && (
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5 ${s.up ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"}`}>
                  {s.up ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                  {s.sub.split(" ")[0]}
                </span>
              )}
            </div>
            
            <div className="relative z-10">
              <div className="text-2xl font-extrabold text-[var(--text-primary)] tracking-tight">{s.value}</div>
              <div className="text-[var(--text-secondary)] font-bold text-xs mt-1">{s.label}</div>
              <div className="text-[var(--text-secondary)] opacity-70 text-[10px] mt-0.5">{s.sub}</div>
            </div>

            {/* Sparkline Visual Curve */}
            <div className="h-10 mt-3 flex items-end opacity-70 group-hover:opacity-100 transition-opacity">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 120 30" preserveAspectRatio="none">
                <path
                  d={
                    i === 0 
                      ? "M0,25 Q15,10 30,22 T60,5 T90,15 T120,2" 
                      : i === 1 
                        ? "M0,20 Q20,20 40,8 T80,18 T120,8" 
                        : i === 2 
                          ? "M0,5 Q20,15 40,15 T80,28 T120,22" 
                          : "M0,5 L20,12 L40,8 L60,25 L80,18 L120,28"
                  }
                  fill="none"
                  stroke={s.up ? "var(--accent-primary)" : s.up === false ? "#b84a39" : "var(--text-secondary)"}
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>
        ))}
      </div>

      {/* Map + Advanced Telemetry Vehicles */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-[var(--border-primary)] shadow-sm overflow-hidden flex flex-col animate-fade-in" style={{ animationDelay: "0.1s" }}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-primary)] bg-[var(--bg-primary)]/40">
            <div>
              <h2 className="font-extrabold text-[var(--text-primary)] text-sm">Supervision Cartographique GIS</h2>
              <p className="text-[var(--text-secondary)] opacity-70 text-[10px] mt-0.5">Mise à jour télémétrique en temps réel (GPS 30s)</p>
            </div>
            
            {/* GIS Toggles */}
            <div className="flex items-center gap-1.5 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg p-0.5">
              <button className="px-2.5 py-1 text-[9px] font-bold rounded bg-white text-[var(--text-primary)] shadow-sm transition">Trafic</button>
              <button className="px-2.5 py-1 text-[9px] font-bold rounded text-[var(--text-secondary)] opacity-80 hover:text-[var(--text-primary)] transition">Clients</button>
              <button className="px-2.5 py-1 text-[9px] font-bold rounded text-[var(--text-secondary)] opacity-80 hover:text-[var(--text-primary)] transition">Zones</button>
            </div>
          </div>
          <div className="h-[390px] min-h-[390px] w-full relative"><TunisiaMap /></div>
        </div>

        {/* Vehicles side-scroller with progress telemetry */}
        <div className="space-y-3 flex flex-col justify-start animate-fade-in" style={{ animationDelay: "0.12s" }}>
          <div className="flex items-center justify-between px-1">
            <h3 className="font-extrabold text-[var(--text-secondary)] text-sm">Flotte active — {DEMO_VEHICLES.filter(v => v.status !== "offline").length} en mission</h3>
            <span className="text-[9px] font-extrabold bg-[var(--accent-light)] text-[var(--accent-primary)] px-2.5 py-0.5 rounded-full uppercase tracking-wider">Temps réel</span>
          </div>

          <div className="space-y-3 max-h-[405px] overflow-y-auto pr-1">
            {DEMO_VEHICLES.map((v, i) => {
              const s = VEHICLE_STATUS[v.status as keyof typeof VEHICLE_STATUS];
              return (
                <div key={v.plate} className="bg-white rounded-2xl border border-[var(--border-primary)] shadow-sm p-4 relative group hover:scale-[1.01] transition-all duration-300 animate-fade-in"
                  style={{ animationDelay: `${i * 0.05}s` }}>
                  
                  {/* Top Driver Info */}
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="font-extrabold text-[var(--text-primary)] text-xs tracking-tight">{v.driver}</div>
                      <div className="text-[var(--text-secondary)] opacity-70 text-[10px] font-mono mt-0.5">{v.plate}</div>
                    </div>
                    <span className={`text-[8px] px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider flex items-center gap-1.5 ${s.badge}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${s.dot} animate-pulse-dot`} />
                      {s.label}
                    </span>
                  </div>

                  {/* Route Progress Bar */}
                  <div className="mb-3">
                    <div className="flex justify-between text-[9px] text-[var(--text-secondary)] opacity-70 mb-1">
                      <span>Progression visites</span>
                      <span className="font-bold text-[var(--text-primary)]">{v.visited} / {v.total}</span>
                    </div>
                    <div className="w-full bg-[var(--bg-primary)] h-1.5 rounded-full overflow-hidden border border-[var(--border-primary)]">
                      <div className="bg-gradient-primary h-full rounded-full" style={{ width: `${(v.visited / v.total) * 100}%` }} />
                    </div>
                  </div>

                  {/* Telemetry Metrics Grid */}
                  <div className="grid grid-cols-3 gap-1.5 mb-2.5">
                    {[
                      ["Objectif CA", `${(v.ca/1000).toFixed(1)}k TND`],
                      ["Vitesse", `${v.speed} km/h`],
                      ["Précision", "GPS OK"]
                    ].map(([l, val]) => (
                      <div key={l} className="bg-[var(--bg-primary)] rounded-lg p-1.5 text-center border border-[var(--border-primary)]">
                        <div className="text-[8px] font-bold text-[var(--text-secondary)] opacity-70 uppercase tracking-wide">{l}</div>
                        <div className="font-extrabold text-xs text-[var(--text-primary)] mt-0.5">{val}</div>
                      </div>
                    ))}
                  </div>

                  {/* Telemetry metadata footer */}
                  <div className="text-[9px] text-[var(--text-secondary)] bg-[var(--bg-primary)] rounded-lg px-2.5 py-1.5 truncate border border-[var(--border-primary)] font-mono mb-2">{v.lastAction}</div>

                  <div className="flex items-center justify-between text-[9px] text-[var(--text-secondary)] opacity-80 border-t border-[var(--border-primary)] pt-2 font-mono">
                    <span className="flex items-center gap-1"><Battery size={10} className="text-[var(--text-secondary)]" /> Batt: {95 - i * 8}%</span>
                    <span className="flex items-center gap-1"><Radio size={10} className="text-[var(--text-secondary)]" /> Sig: 98%</span>
                    <span className="flex items-center gap-1">🛰️ Sats: 12</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Cognitive AI Agent Insights */}
      <div className="animate-fade-in" style={{ animationDelay: "0.15s" }}>
        <div className="flex items-center gap-2 mb-4 border-b border-[var(--border-primary)] pb-2">
          <div className="w-7 h-7 bg-purple-500/10 rounded-lg flex items-center justify-center border border-purple-500/20 text-purple-500">
            <Brain size={15} />
          </div>
          <div>
            <h2 className="font-extrabold text-[var(--text-primary)] text-sm">Intelligence Artificielle — Insights & Recommandations</h2>
            <p className="text-[var(--text-secondary)] opacity-70 text-[10px]">Modèles neuronaux actifs & agents cognitifs autonomes</p>
          </div>
          <span className="text-[9px] bg-purple-500/10 text-purple-500 border border-purple-500/20 px-2.5 py-0.5 rounded-full font-black ml-auto animate-blink uppercase">IA ACTIVE</span>
        </div>
        
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {AI_WIDGETS.map((w, i) => (
            <div key={w.code} translate="no" className={`notranslate rounded-2xl border p-4 ${w.color} relative overflow-hidden group transition-all duration-300 flex flex-col justify-between animate-fade-in hover:shadow-lg hover:shadow-black/5`}
              style={{ animationDelay: `${0.18 + i * 0.05}s` }}>
              
              <div>
                <div className="flex items-center justify-between text-[8px] font-mono text-[var(--text-secondary)] bg-[var(--bg-primary)]/60 px-2 py-0.5 rounded border border-[var(--border-primary)] mb-2.5">
                  <span>{w.code}</span>
                  <span className="text-emerald-500 font-extrabold uppercase">Conf: {w.confidence}%</span>
                </div>

                <div className="text-xl mb-1.5">{w.icon}</div>
                <div className={`text-[9px] font-black uppercase tracking-wider mb-1 ${w.titleColor}`}>{w.title}</div>
                <div className={`text-xl font-black tracking-tight mb-1.5 ${w.valueColor}`}>{w.value}</div>
                <div className="text-xs text-[var(--text-secondary)] opacity-90 mb-3.5 leading-relaxed">{w.detail}</div>
              </div>
              
              <button 
                onClick={() => setSelectedAgent(w)}
                className={`text-xs font-black ${w.valueColor} hover:underline flex items-center gap-1 mt-auto uppercase`}
              >
                {w.action} <ArrowUpRight size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Performance Analytical Charts */}
      <div className="grid lg:grid-cols-2 gap-6 animate-fade-in" style={{ animationDelay: "0.2s" }}>
        <div className="bg-white rounded-2xl border border-[var(--border-primary)] shadow-sm p-5 hover:shadow-md transition">
          <div className="flex items-center justify-between mb-4 border-b border-[var(--border-primary)] pb-2">
            <div>
              <h3 className="font-extrabold text-[var(--text-primary)] text-sm">Évolution CA Mensuel & Recouvrements</h3>
              <p className="text-[var(--text-secondary)] opacity-70 text-[10px]">Graphique en aires cumulées — Analyse sur 12 mois</p>
            </div>
            <BarChart2 size={16} className="text-[var(--text-secondary)] opacity-60" />
          </div>
          <CAAreaChart />
        </div>
        
        <div className="bg-white rounded-2xl border border-[var(--border-primary)] shadow-sm p-5 hover:shadow-md transition">
          <div className="flex items-center justify-between mb-4 border-b border-[var(--border-primary)] pb-2">
            <div>
              <h3 className="font-extrabold text-[var(--text-primary)] text-sm">Performance par Commercial</h3>
              <p className="text-[var(--text-secondary)] opacity-70 text-[10px]">Objectifs fixés vs Ventes réalisées — Mai 2026</p>
            </div>
            <BarChart2 size={16} className="text-[var(--text-secondary)] opacity-60" />
          </div>
          <CommercialBarChart />
        </div>
      </div>

      {/* Incidents Alerts & Live Telemetry Terminal */}
      <div className="grid lg:grid-cols-2 gap-6 animate-fade-in" style={{ animationDelay: "0.22s" }}>
        {/* Active Alerts */}
        <div className="bg-white rounded-2xl border border-[var(--border-primary)] shadow-sm overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-primary)] bg-[var(--bg-primary)]/40">
            <h3 className="font-extrabold text-[var(--text-primary)] text-sm">Alertes critiques du système</h3>
            <span className="text-[9px] bg-red-500/10 text-red-500 border border-red-500/20 px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider">{ALERTS.length} ACTIVES</span>
          </div>
          <div className="divide-y divide-[var(--border-primary)]">
            {ALERTS.map((a, i) => (
              <div key={i} className={`flex items-start gap-3 px-5 py-4 ${a.urgent ? "bg-red-500/05" : ""}`}>
                <span className="text-lg flex-shrink-0 mt-0.5">{a.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold text-[var(--text-secondary)] opacity-70 uppercase tracking-wider">{a.type}</span>
                    {a.urgent && <span className="text-[8px] bg-red-500/15 text-red-500 px-1.5 py-0.2 rounded font-black border border-red-500/20 animate-blink">URGENT</span>}
                  </div>
                  <div className="text-xs text-[var(--text-primary)] font-bold mt-1">{a.msg}</div>
                  <div className="text-[10px] text-[var(--text-secondary)] opacity-60 mt-0.5 font-mono">Il y a {a.time}</div>
                </div>
                <button className="text-[10px] text-[var(--accent-primary)] font-black hover:underline uppercase flex-shrink-0 mt-0.5">Traiter</button>
              </div>
            ))}
          </div>
        </div>

        {/* Live Telemetry Terminal Console (Intelligent Logs) */}
        <div className="bg-white rounded-2xl border border-[var(--border-primary)] shadow-sm overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-primary)] bg-[var(--bg-primary)]/40">
            <div>
              <h3 className="font-extrabold text-[var(--text-primary)] text-sm">Console Événements Temps Réel</h3>
              <p className="text-[var(--text-secondary)] opacity-70 text-[10px] mt-0.5">Flux d'activités, télémétries et logs système</p>
            </div>
            <span className="flex items-center gap-1.5 text-[9px] font-black text-emerald-500 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20 uppercase tracking-wide">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse-dot" /> STREAMING
            </span>
          </div>

          <div translate="no" className="notranslate flex-1 p-4 bg-slate-950 font-mono text-[10px] text-slate-400 space-y-2 max-h-[250px] overflow-y-auto select-all">
            {SYSTEM_LOGS.map((l, i) => (
              <div key={i} className="flex items-start gap-2 hover:bg-slate-900/50 py-0.5 rounded px-1 transition-colors">
                <span className="text-amber-500/80 flex-shrink-0">[{l.time}]</span>
                <span className={`font-bold flex-shrink-0 ${l.type === "ai" ? "text-purple-400" : l.type === "warn" ? "text-red-400" : l.type === "success" ? "text-emerald-400" : "text-blue-400"}`}>
                  {l.source}:
                </span>
                <span className="text-slate-300 break-all leading-normal">{l.msg}</span>
              </div>
            ))}
            <div className="text-slate-500 animate-pulse text-[9px] pt-1">_ En attente de nouveaux paquets de données...</div>
          </div>
        </div>
      </div>

      {/* Modern Tactical AI Agent Details Modal Overlay */}
      {selectedAgent && (
        <div translate="no" className="notranslate fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl relative animate-scale-in">
            {/* Header */}
            <div className="px-6 py-5 border-b border-[var(--border-primary)] flex items-center justify-between bg-[var(--bg-primary)]/45">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{selectedAgent.icon}</span>
                <div>
                  <h3 className="font-extrabold text-sm text-[var(--text-primary)]">{selectedAgent.title}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[8px] font-mono text-[var(--text-secondary)] opacity-80">{selectedAgent.code}</span>
                    <span className="w-1 h-1 bg-[var(--text-secondary)] rounded-full opacity-40"></span>
                    <span className="text-[9px] text-emerald-500 font-extrabold">Conf: {selectedAgent.confidence}%</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setSelectedAgent(null)} className="w-7 h-7 rounded-full bg-[var(--bg-primary)] border border-[var(--border-primary)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition font-black text-sm">
                &times;
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto max-h-[70vh] space-y-5">
              {/* AGENT_PROJECTION_V4.2 */}
              {selectedAgent.code === "AGENT_PROJECTION_V4.2" && (
                <div className="space-y-4">
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    Modèle prédictif neuronal entraîné sur 6 mois d'historique de ventes + facteurs de saisonnalité.
                  </p>
                  
                  <div className="bg-[var(--bg-primary)]/50 border border-[var(--border-primary)] rounded-2xl p-4 space-y-2.5">
                    <div className="text-[10px] font-black uppercase text-[var(--text-secondary)] tracking-wider">Prévisions CA Journalières</div>
                    <div className="space-y-1.5">
                      {[
                        { day: "Lundi (Demain)", val: "23 800 TND", trend: "+4%" },
                        { day: "Mardi", val: "24 500 TND", trend: "+6%" },
                        { day: "Mercredi", val: "26 100 TND", trend: "+10%" },
                        { day: "Jeudi", val: "25 400 TND", trend: "-2%" },
                        { day: "Vendredi (Pic)", val: "28 400 TND", trend: "+15%" },
                        { day: "Samedi", val: "27 900 TND", trend: "+12%" },
                      ].map(d => (
                        <div key={d.day} className="flex justify-between items-center text-xs border-b border-[var(--border-primary)]/40 pb-1.5 last:border-0 last:pb-0">
                          <span className="font-bold text-[var(--text-primary)]">{d.day}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[var(--text-primary)]">{d.val}</span>
                            <span className={`text-[9px] font-black px-1.5 py-0.2 rounded ${d.trend.startsWith("+") ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"}`}>{d.trend}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="text-xs text-[var(--text-secondary)] bg-purple-500/05 border border-purple-500/10 rounded-2xl p-4 leading-relaxed">
                    💡 <strong>Insight IA :</strong> La hausse marquée en milieu et fin de semaine est corrélée aux cycles de livraison réguliers des grossistes (mardi/vendredi) ainsi qu'aux facteurs saisonniers climatiques favorables.
                  </div>

                  <div className="flex gap-3 justify-end pt-3">
                    <button onClick={() => setSelectedAgent(null)} className="px-4 py-2 text-xs font-bold rounded-xl border border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-primary)] transition">
                      Fermer
                    </button>
                    <button 
                      onClick={() => {
                        setAgentActionState(prev => ({ ...prev, [selectedAgent.code]: "SUCCESS" }));
                      }}
                      disabled={agentActionState[selectedAgent.code] === "SUCCESS"}
                      className={`px-4 py-2 text-xs font-black rounded-xl transition flex items-center gap-1.5 ${
                        agentActionState[selectedAgent.code] === "SUCCESS"
                          ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                          : "bg-purple-600 text-white hover:bg-purple-700 shadow-md shadow-purple-500/10"
                      }`}
                    >
                      {agentActionState[selectedAgent.code] === "SUCCESS" ? "✓ Synchronisé avec Trésorerie" : "Synchroniser Trésorerie"}
                    </button>
                  </div>
                </div>
              )}

              {/* AGENT_RETENTION_V2.9 */}
              {selectedAgent.code === "AGENT_RETENTION_V2.9" && (
                <div className="space-y-4">
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    Détection proactive des clients à haut risque d'attrition basée sur la fréquence des visites et le volume de commande.
                  </p>

                  <div className="space-y-2.5">
                    {[
                      { name: "AGIL SIDI KHLIFA", last: "34 jours", solde: "3 659 TND", score: "88% Risque" },
                      { name: "AGIL MAHDIA", last: "31 jours", solde: "3 408 TND", score: "72% Risque" },
                      { name: "librairie saphir", last: "41 jours", solde: "2 738 TND", score: "68% Risque" },
                    ].map(c => {
                      const key = `${selectedAgent.code}_${c.name}`;
                      const actionDone = agentActionState[key];
                      
                      return (
                        <div key={c.name} className="flex flex-col sm:flex-row justify-between sm:items-center gap-2.5 text-xs bg-[var(--bg-primary)]/50 border border-[var(--border-primary)] rounded-2xl p-4">
                          <div>
                            <div className="font-extrabold text-[var(--text-primary)]">{c.name}</div>
                            <div className="flex items-center gap-2 mt-1 text-[10px] text-[var(--text-secondary)] opacity-80">
                              <span>Dernière visite: {c.last}</span>
                              <span className="w-1 h-1 bg-[var(--text-secondary)] rounded-full opacity-40 text-[6px]"></span>
                              <span>Créance: {c.solde}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 ml-auto sm:ml-0">
                            <span className="text-[10px] font-black text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">{c.score}</span>
                            <button
                              onClick={() => {
                                setAgentActionState(prev => ({ ...prev, [key]: "PLANNED" }));
                              }}
                              disabled={actionDone === "PLANNED"}
                              className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition ${
                                actionDone === "PLANNED"
                                  ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                                  : "bg-amber-500 text-amber-950 hover:bg-amber-400"
                              }`}
                            >
                              {actionDone === "PLANNED" ? "✓ Planifié" : "Planifier visite"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex justify-end pt-3">
                    <button onClick={() => setSelectedAgent(null)} className="px-4 py-2 text-xs font-bold rounded-xl border border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-primary)] transition">
                      Fermer
                    </button>
                  </div>
                </div>
              )}

              {/* AGENT_STOCKS_V3.1 */}
              {selectedAgent.code === "AGENT_STOCKS_V3.1" && (
                <div className="space-y-4">
                  {agentActionState[selectedAgent.code] === "SUCCESS" ? (
                    <div className="space-y-4 text-center py-6 animate-fade-in">
                      <div className="w-12 h-12 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto text-xl animate-bounce">
                        ✓
                      </div>
                      <div className="space-y-1">
                        <h4 className="font-extrabold text-sm text-[var(--text-primary)]">Bon de Commande Généré !</h4>
                        <p className="text-xs text-[var(--text-secondary)] opacity-85 leading-relaxed">
                          BC #2026-0084 a été généré avec succès et envoyé au fournisseur <strong>SOUHA SA</strong> via EDI.
                        </p>
                      </div>

                      <div className="bg-[var(--bg-primary)]/60 border border-[var(--border-primary)] rounded-2xl p-4 text-left font-mono text-[10px] text-[var(--text-primary)] max-w-sm mx-auto space-y-1.5">
                        <div className="border-b border-[var(--border-primary)] pb-1.5 mb-1.5 flex justify-between font-bold">
                          <span>DOCUMENT: BC #2026-0084</span>
                          <span>DATE: 18/05/2026</span>
                        </div>
                        <div className="flex justify-between">
                          <span>coffret echec 2025 (20u)</span>
                          <span>250.00 TND</span>
                        </div>
                        <div className="flex justify-between">
                          <span>jeux ludo bois (15u)</span>
                          <span>150.00 TND</span>
                        </div>
                        <div className="border-t border-dashed border-[var(--border-primary)] pt-1.5 mt-1.5 flex justify-between font-black text-xs">
                          <span>TOTAL HT:</span>
                          <span>400.00 TND</span>
                        </div>
                        <div className="flex justify-between text-[9px] opacity-80">
                          <span>TVA 19%:</span>
                          <span>76.00 TND</span>
                        </div>
                        <div className="flex justify-between font-black text-xs text-emerald-500">
                          <span>TOTAL TTC:</span>
                          <span>476.00 TND</span>
                        </div>
                      </div>

                      <div className="pt-2">
                        <button onClick={() => setSelectedAgent(null)} className="px-4 py-2 text-xs font-bold rounded-xl border border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-primary)] transition">
                          Quitter
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                        Détection proactive de ruptures imminentes de stocks sous 7 jours. Générateur automatique de Bon de Commande réglementaire.
                      </p>

                      <div className="bg-[var(--bg-primary)]/50 border border-[var(--border-primary)] rounded-2xl p-4 space-y-3">
                        <div className="text-[10px] font-black uppercase text-[var(--text-secondary)] tracking-wider">Articles en rupture imminente</div>
                        
                        <div className="space-y-2.5">
                          {[
                            { name: "coffret echec 2025", stock: 2, min: 5, sugg: 20, price: "12.5 TND" },
                            { name: "jeux ludo bois", stock: 9, min: 10, sugg: 15, price: "10.0 TND" },
                          ].map(a => (
                            <div key={a.name} className="flex justify-between items-start text-xs border-b border-[var(--border-primary)]/40 pb-2 last:border-0 last:pb-0">
                              <div>
                                <span className="font-extrabold text-[var(--text-primary)]">{a.name}</span>
                                <div className="text-[10px] text-[var(--text-secondary)] opacity-85 mt-0.5">Stock: {a.stock} | Seuil min: {a.min}</div>
                              </div>
                              <div className="text-right">
                                <span className="font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded text-[10px]">{a.sugg} unités suggérées</span>
                                <div className="text-[10px] text-[var(--text-secondary)] opacity-85 mt-0.5">P.U: {a.price}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="text-[11px] text-[var(--text-secondary)] bg-red-500/05 border border-red-500/10 rounded-2xl p-4 leading-relaxed flex items-start gap-2.5">
                        <span className="text-base mt-0.5">⚠️</span>
                        <span>
                          <strong>Fournisseur sélectionné : SOUHA SA</strong><br />
                          En validant, le système génère un document PDF d'achat officiel et transmet la commande via le canal EDI sécurisé.
                        </span>
                      </div>

                      <div className="flex gap-3 justify-end pt-3">
                        <button onClick={() => setSelectedAgent(null)} className="px-4 py-2 text-xs font-bold rounded-xl border border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-primary)] transition">
                          Fermer
                        </button>
                        <button 
                          onClick={() => {
                            setAgentActionState(prev => ({ ...prev, [selectedAgent.code]: "SUCCESS" }));
                          }}
                          className="px-4 py-2 text-xs font-black rounded-xl bg-red-600 text-white hover:bg-red-700 shadow-md shadow-red-500/10 transition flex items-center gap-1.5"
                        >
                          ⚡ Valider & Envoyer le BC
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* AGENT_FRAUD_V1.8 */}
              {selectedAgent.code === "AGENT_FRAUD_V1.8" && (
                <div className="space-y-4">
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    Détection d'anomalies de flux et transactions atypiques par comparaison comportementale.
                  </p>

                  <div className="bg-blue-500/05 border border-blue-500/10 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center gap-2 border-b border-[var(--border-primary)]/50 pb-2">
                      <span className="text-base">🚨</span>
                      <div>
                        <div className="text-xs font-black text-blue-500">Alerte Réf: #TRX-94821</div>
                        <div className="text-[9px] text-[var(--text-secondary)] opacity-80">Score suspicion IA: 97%</div>
                      </div>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-[var(--text-secondary)]">Client ciblé:</span>
                        <span className="font-bold text-[var(--text-primary)]">AGIL BEJA SUD</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--text-secondary)]">Transaction:</span>
                        <span className="font-bold text-red-500">Règlement 8 500 TND</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--text-secondary)]">Facteur de risque:</span>
                        <span className="font-bold text-[var(--text-primary)]">Dépassement de 2.3x limite de crédit</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--text-secondary)]">Empreinte hash:</span>
                        <span className="font-mono text-[10px] text-[var(--text-secondary)]">0xfa849c...192f</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-xs text-[var(--text-secondary)] leading-relaxed bg-[var(--bg-primary)]/50 border border-[var(--border-primary)] rounded-2xl p-4">
                    🔎 <strong>Recommandation IA :</strong> Cette transaction a été bloquée temporairement car elle dévie du profil de règlement habituel de ce client (délai moyen de 45j vs versement immédiat hors norme).
                  </div>

                  {agentActionState[selectedAgent.code] ? (
                    <div className={`p-3 rounded-xl border text-center text-xs font-bold animate-fade-in ${
                      agentActionState[selectedAgent.code] === "APPROVED"
                        ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                        : "bg-red-500/10 text-red-500 border-red-500/20"
                    }`}>
                      {agentActionState[selectedAgent.code] === "APPROVED"
                        ? "✓ Transaction Approuvée & Enregistrée avec succès !"
                        : "✗ Compte suspendu temporairement pour enquête."}
                    </div>
                  ) : (
                    <div className="flex gap-2 sm:gap-3 justify-end pt-3">
                      <button onClick={() => setSelectedAgent(null)} className="px-4 py-2 text-xs font-bold rounded-xl border border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-primary)] transition">
                        Fermer
                      </button>
                      <button 
                        onClick={() => {
                          setAgentActionState(prev => ({ ...prev, [selectedAgent.code]: "BLOCKED" }));
                        }}
                        className="px-4 py-2 text-xs font-black rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/15 border border-red-500/20 transition"
                      >
                        Bloquer
                      </button>
                      <button 
                        onClick={() => {
                          setAgentActionState(prev => ({ ...prev, [selectedAgent.code]: "APPROVED" }));
                        }}
                        className="px-4 py-2 text-xs font-black rounded-xl bg-blue-600 text-white hover:bg-blue-500 shadow-md shadow-blue-500/10 transition"
                      >
                        Approuver
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
