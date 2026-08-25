"use client";
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import ValorisationFamilles from "@/components/erp/ValorisationFamilles";
import DetailAchats from "@/components/erp/DetailAchats";
import DetailCreances from "@/components/erp/DetailCreances";
import DetailRuptures from "@/components/erp/DetailRuptures";
import { erreur } from "@/lib/alertes";
import { MOIS_LONGS } from "@/lib/vente-stats";
import {
  Users, Truck, TrendingUp, AlertTriangle,
  ArrowUpRight, ArrowDownRight, Cpu, Brain,
  BarChart2, MessageCircle
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


const TunisiaMap = dynamic(() => import("@/components/map/TunisiaMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-[var(--bg-primary)] rounded-2xl animate-pulse flex items-center justify-center">
      <span className="text-[var(--text-secondary)] text-sm font-bold">Chargement carte télémétrique...</span>
    </div>
  ),
});

// Séparateur de milliers sur tous les montants du tableau de bord.
const fmt0 = (n: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n ?? 0);
const fmtPct = (n: number) => `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(n ?? 0)}%`;

type Alerte = { type: string; niveau: "critique" | "avertissement" | "info"; message: string; detail?: string };
type TopClient = { nom: string; codeCli: number | null; ca: number; docs: number };
type DocRecent = { refDoc: string; typeDoc: string; raisonSocial: string | null; dateDoc: string | null; ttcNet: number };

type ClientRisque = {
  codeCli: number; nom: string; ville: string | null; jours: number; solde: number;
  score: number; commercial: string | null;
  telCommercial: string | null; telClient: string | null;
  whatsapp: { tel: string; vers: "commercial" | "client" } | null;
};

type Insights = {
  periode: { mois: number; annee: number };
  objectif: {
    objectifCA: number; realise: number; taux: number; reste: number; nbVendeurs: number;
    parVendeur: { vendeur: string; ca: number; objectifCA: number; taux: number }[];
  };
  clientsRisque: {
    total: number; seuilJours: number;
    jamaisCommande: number; inactifs: number; nbClients: number;
    rows: ClientRisque[];
  };
  rupturesStock: {
    nb: number; nbArticles: number; taux: number; valeurManquante: number;
    rows: { refArt: string; designation: string; stock: number; stMin: number; suggere: number; puAchat: number }[];
  };
  rupturesDebout: {
    nb: number; taux: number; seuilDefaut: number; nbAvecSeuil: number;
    rows: { refArt: string; designation: string; stock: number; stMin: number; seuilApplique: number; manque: number }[];
  };
};


/**
 * Lien de relance WhatsApp. `wa.me` ouvre l'application (mobile ou web) avec le
 * message pré-rempli ; l'utilisateur garde la main sur l'envoi.
 */
function lienWhatsapp(c: ClientRisque): string | null {
  if (!c.whatsapp) return null;
  const texte =
    c.whatsapp.vers === "commercial"
      ? `Bonjour ${c.commercial ?? ""}, le client « ${c.nom} »${c.ville ? ` (${c.ville})` : ""} n'a pas commandé depuis ${c.jours} jours${c.solde > 0 ? ` et présente une créance de ${fmt0(c.solde)} TND` : ""}. Peux-tu programmer une visite de relance ?`
      : `Bonjour, cela fait ${c.jours} jours sans commande de votre part. Pouvons-nous convenir d'un rendez-vous ?`;
  return `https://wa.me/${c.whatsapp.tel}?text=${encodeURIComponent(texte)}`;
}

const STATS_FALLBACK = [
  { label: "Chiffre d'affaires", value: "—", sub: "chargement…", up: true, icon: TrendingUp, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100" },
  { label: "Achats", value: "—", sub: "chargement…", up: null, icon: Truck, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100" },
  { label: "Clients", value: "—", sub: "chargement…", up: false, icon: Users, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-100" },
  { label: "Ruptures stock", value: "—", sub: "chargement…", up: false, icon: AlertTriangle, color: "text-red-500", bg: "bg-red-50", border: "border-red-100" },
];

/**
 * Les quatre indicateurs de tête, construits depuis `/api/insights`.
 * Ordre demandé : objectif, clients à risque, ruptures stock, ruptures debout.
 */
function widgetsDepuisInsights(d: Insights) {
  const periode = `${MOIS_LONGS[d.periode.mois - 1]} ${d.periode.annee}`;
  return [
    {
      icon: "🎯", code: "OBJECTIF", title: "Objectif du mois",
      value: d.objectif.objectifCA > 0 ? fmtPct(d.objectif.taux) : "—",
      detail: d.objectif.objectifCA > 0
        ? `${fmt0(d.objectif.realise)} / ${fmt0(d.objectif.objectifCA)} TND — ${periode}`
        : `Aucun objectif fixé pour ${periode}`,
      action: "Voir par vendeur",
      color: "bg-purple-500/10 border-purple-500/20", titleColor: "text-purple-500", valueColor: "text-purple-500",
    },
    {
      icon: "⚠️", code: "CLIENTS_RISQUE", title: "Clients à risque de perte",
      value: `${fmt0(d.clientsRisque.total)} clients`,
      detail: d.clientsRisque.jamaisCommande > 0
        ? `${fmt0(d.clientsRisque.inactifs)} sans commande depuis +${d.clientsRisque.seuilJours} j · `
          + `${fmt0(d.clientsRisque.jamaisCommande)} jamais servis — sur ${fmt0(d.clientsRisque.nbClients)} clients`
        : `Sans commande depuis plus de ${d.clientsRisque.seuilJours} jours `
          + `— sur ${fmt0(d.clientsRisque.nbClients)} clients`,
      action: "Relancer sur WhatsApp",
      color: "bg-amber-500/10 border-amber-500/20", titleColor: "text-amber-500", valueColor: "text-amber-500",
    },
    {
      icon: "📦", code: "RUPTURES_STOCK", title: "Ruptures stock",
      // Exprimé en part du catalogue : « 30 % du catalogue en rupture ».
      value: fmtPct(d.rupturesStock.taux),
      detail: `${fmt0(d.rupturesStock.nb)} articles à zéro sur ${fmt0(d.rupturesStock.nbArticles)} référencés`,
      action: "Voir les articles",
      color: "bg-red-500/10 border-red-500/20", titleColor: "text-red-500", valueColor: "text-red-500",
    },
    {
      icon: "📉", code: "RUPTURES_DEBOUT", title: "Ruptures debout",
      value: `${fmt0(d.rupturesDebout.nb)} articles`,
      detail: d.rupturesDebout.nb > 0
        ? `Sous le seuil${d.rupturesDebout.nbAvecSeuil === 0 ? ` de ${d.rupturesDebout.seuilDefaut} u.` : " minimum"}`
          + ` — ${fmtPct(d.rupturesDebout.taux)} du catalogue`
        : "Aucun article sous son seuil minimum",
      action: "Voir les articles",
      color: "bg-blue-500/10 border-blue-500/20", titleColor: "text-blue-500", valueColor: "text-blue-500",
    },
  ];
}




export default function AdminDashboard() {
  // Fenêtre « valorisation par famille », ouverte depuis la carte Chiffre d'affaires.
  const [voirFamilles, setVoirFamilles] = useState(false);
  // Fenêtre « détail des achats », ouverte depuis la carte Achats.
  const [voirAchats, setVoirAchats] = useState(false);
  // Fenêtre « créances & trésorerie », ouverte depuis la carte Créances.
  const [voirCreances, setVoirCreances] = useState(false);
  // Fenêtre « ruptures de stock », ouverte depuis la carte Ruptures.
  const [voirRuptures, setVoirRuptures] = useState(false);
  // Couche affichée sur la carte de supervision (trafic / clients / zones).
  const [coucheGis, setCoucheGis] = useState<"trafic" | "clients" | "zones">("trafic");
  // Le thème retenu est lu une fois à la construction de l'état : le poser
  // depuis un effet provoquait un second rendu et un flash du thème par défaut.
  // `localStorage` peut être indisponible (fenêtre privée) : on retombe alors
  // sur le thème par défaut.
  const [activeTheme, setActiveTheme] = useState<"latte" | "espresso" | "matcha">(() => {
    if (typeof window === "undefined") return "latte";
    try {
      const saved = localStorage.getItem("bis-dashboard-theme");
      return saved === "espresso" || saved === "matcha" || saved === "latte" ? saved : "latte";
    } catch {
      return "latte";
    }
  });
  const [selectedAgent, setSelectedAgent] = useState<any>(null);

  // Live ERP stats from Postgres via /api/synthese
  const [STATS, setStats] = useState(STATS_FALLBACK);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/synthese").then((r) => r.json()).then((d) => {
      if (cancelled || !d?.ventes) return;
      setStats([
        { label: "Chiffre d'affaires", value: `${fmt0(d.ventes.ttc)} TND`, sub: `${fmt0(d.ventes.nb)} documents`, up: true, icon: TrendingUp, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100" },
        { label: "Achats", value: `${fmt0(d.achats.ttc)} TND`, sub: `${fmt0(d.achats.nb)} documents`, up: null, icon: Truck, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100" },
        { label: "Créances clients", value: `${fmt0(d.creancesClients)} TND`, sub: `Trésorerie: ${fmt0(d.tresorerie.solde)}`, up: false, icon: Users, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-100" },
        { label: "Ruptures stock", value: `${d.stock.nbRuptures}`, sub: `${d.stock.nbArticles} articles · ${fmt0(d.stock.valeur)} TND`, up: false, icon: AlertTriangle, color: "text-red-500", bg: "bg-red-50", border: "border-red-100" },
      ]);
    });
    return () => { cancelled = true; };
  }, []);

  // Alertes d'exploitation, top clients et derniers documents — données réelles.
  const [alertes, setAlertes] = useState<Alerte[]>([]);
  const [topClients, setTopClients] = useState<TopClient[]>([]);
  const [recents, setRecents] = useState<DocRecent[]>([]);
  const [insights, setInsights] = useState<Insights | null>(null);
  /** Objectifs en cours de saisie, par vendeur — l'admin les fixe depuis la modale. */
  const [objSaisie, setObjSaisie] = useState<Record<string, string>>({});
  const [objEnCours, setObjEnCours] = useState<string | null>(null);

  /** Recharge les indicateurs après une saisie, pour que les taux suivent. */
  async function rechargerInsights() {
    const ins = await fetch("/api/insights").then((r) => r.json()).catch(() => null);
    if (ins?.objectif) setInsights(ins);
  }

  /** Fixe l'objectif du mois pour un vendeur. */
  async function enregistrerObjectif(vendeur: string) {
    if (!insights) return;
    const brut = objSaisie[vendeur];
    const montant = Number(String(brut ?? "").replace(/\s/g, "").replace(",", "."));
    if (!Number.isFinite(montant) || montant < 0) {
      await erreur("Saisissez un montant positif.", "Objectif invalide");
      return;
    }
    setObjEnCours(vendeur);
    const r = await fetch("/api/objectifs", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vendeur, montant,
        mois: insights.periode.mois, annee: insights.periode.annee,
        objectifCA: montant,
      }),
    }).then((x) => x.json()).catch(() => ({ error: "réseau" }));
    setObjEnCours(null);
    if (!r.ok) {
      await erreur(r.error ?? "Enregistrement impossible");
      return;
    }
    setObjSaisie((prev) => { const n = { ...prev }; delete n[vendeur]; return n; });
    await rechargerInsights();
  }

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/alertes").then((r) => r.json()),
      fetch("/api/dashboard?scope=admin").then((r) => r.json()),
      fetch("/api/erp?resource=documents&nature=Vente&type=%25&page=0").then((r) => r.json()),
      fetch("/api/insights").then((r) => r.json()),
    ])
      .then(([a, d, docs, ins]) => {
        if (cancelled) return;
        setAlertes(a.alertes ?? []);
        setTopClients(d.topClients ?? []);
        setRecents((docs.rows ?? []).slice(0, 8));
        if (ins?.objectif) setInsights(ins);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const widgets = insights ? widgetsDepuisInsights(insights) : [];

  const maxClientCA = Math.max(1, ...topClients.map((c) => c.ca));

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

  // Application des variables CSS du thème courant — aucun changement d'état ici.
  useEffect(() => {
    applyTheme(activeTheme);
    // `applyTheme` ne lit que son argument : le relancer à chaque rendu serait inutile.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTheme]);

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
          <div key={s.label}
            onClick={i === 0 ? () => setVoirFamilles(true)
                   : i === 1 ? () => setVoirAchats(true)
                   : i === 2 ? () => setVoirCreances(true)
                   : () => setVoirRuptures(true)}
            role="button"
            title={i === 0 ? "Voir la répartition par famille d'articles"
                 : i === 1 ? "Voir le détail des achats (fournisseur, mois, type)"
                 : i === 2 ? "Voir les créances par ancienneté, commercial, client et la trésorerie"
                 : "Voir les articles en rupture, par famille et les stocks négatifs"}
            className="bg-white rounded-2xl border border-[var(--border-primary)] shadow-sm p-5 relative overflow-hidden group transition-all duration-300 animate-fade-in cursor-pointer hover:shadow-md hover:-translate-y-0.5"
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
              <div className="text-[var(--text-secondary)] font-bold text-xs mt-1 flex items-center gap-1">
                {s.label}
                {i <= 1 && <ArrowUpRight size={11} className="opacity-50" />}
              </div>
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
            
            {/* Sélecteur de couche cartographique */}
            <div className="flex items-center gap-1.5 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg p-0.5">
              {([
                { v: "trafic", l: "Trafic" },
                { v: "clients", l: "Clients" },
                { v: "zones", l: "Zones" },
              ] as const).map((c) => (
                <button key={c.v} onClick={() => setCoucheGis(c.v)}
                  className={`px-2.5 py-1 text-[9px] font-bold rounded transition ${
                    coucheGis === c.v
                      ? "bg-white text-[var(--text-primary)] shadow-sm"
                      : "text-[var(--text-secondary)] opacity-80 hover:text-[var(--text-primary)]"
                  }`}>
                  {c.l}
                </button>
              ))}
            </div>
          </div>
          <div className="h-[390px] min-h-[390px] w-full relative"><TunisiaMap couche={coucheGis} /></div>
        </div>

        {/* Top clients réels — remplace la télémétrie GPS (aucune donnée GPS en base) */}
        <div className="space-y-3 flex flex-col justify-start animate-fade-in" style={{ animationDelay: "0.12s" }}>
          <div className="flex items-center justify-between px-1">
            <h3 className="font-extrabold text-[var(--text-secondary)] text-sm">
              Meilleurs clients — {topClients.length} affichés
            </h3>
            <span className="text-[9px] font-extrabold bg-[var(--accent-light)] text-[var(--accent-primary)] px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              12 derniers mois
            </span>
          </div>

          <div className="space-y-2.5 max-h-[405px] overflow-y-auto pr-1">
            {topClients.length === 0 && (
              <div className="py-10 text-center text-xs text-[var(--text-secondary)]">Chargement…</div>
            )}
            {topClients.map((c, i) => {
              const part = maxClientCA > 0 ? (c.ca / maxClientCA) * 100 : 0;
              return (
                <div key={String(c.codeCli ?? c.nom)}
                  className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-primary)] shadow-sm p-3.5 animate-fade-in"
                  style={{ animationDelay: `${i * 0.04}s` }}>
                  <div className="flex items-start justify-between mb-2 gap-2">
                    <div className="min-w-0">
                      <div className="font-extrabold text-[var(--text-primary)] text-xs tracking-tight truncate" title={c.nom}>
                        {c.nom}
                      </div>
                      <div className="text-[var(--text-secondary)] opacity-70 text-[10px] font-mono mt-0.5">
                        {c.docs} document(s)
                      </div>
                    </div>
                    <span className="text-[10px] font-black text-[var(--text-primary)] tabular-nums shrink-0">
                      {fmt0(c.ca)} TND
                    </span>
                  </div>
                  <div className="w-full bg-[var(--bg-primary)] h-1.5 rounded-full overflow-hidden border border-[var(--border-primary)]">
                    <div className="bg-gradient-primary h-full rounded-full" style={{ width: `${part}%` }} />
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
            <h2 className="font-extrabold text-[var(--text-primary)] text-sm">Indicateurs de pilotage</h2>
            <p className="text-[var(--text-secondary)] opacity-70 text-[10px]">Objectifs, rétention client et tension sur les stocks — calculés en base</p>
          </div>
          <span className="text-[9px] bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-2.5 py-0.5 rounded-full font-black ml-auto uppercase">Données réelles</span>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {widgets.length === 0 &&
            [0, 1, 2, 3].map((i) => (
              <div key={i} className="h-44 rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-primary)]/40 animate-pulse" />
            ))}
          {widgets.map((w, i) => (
            <div key={w.code} className={`rounded-2xl border p-4 ${w.color} relative overflow-hidden group transition-all duration-300 flex flex-col justify-between animate-fade-in hover:shadow-lg hover:shadow-black/5`}
              style={{ animationDelay: `${0.18 + i * 0.05}s` }}>

              <div>
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
              <p className="text-[var(--text-secondary)] opacity-70 text-[10px]">Objectifs fixés vs Ventes réalisées</p>
            </div>
            <Link href="/admin/commerciaux"
              className="text-[10px] font-black uppercase text-[var(--accent-primary)] hover:underline flex items-center gap-1">
              Fiches <ArrowUpRight size={12} />
            </Link>
          </div>
          <CommercialBarChart />
        </div>
      </div>

      {/* Alertes d'exploitation & activité récente — données réelles */}
      <div className="grid lg:grid-cols-2 gap-6 animate-fade-in" style={{ animationDelay: "0.22s" }}>
        {/* Alertes calculées depuis l'état de la base */}
        <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-primary)] shadow-sm overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-primary)] bg-[var(--bg-primary)]/40">
            <h3 className="font-extrabold text-[var(--text-primary)] text-sm">Alertes d&apos;exploitation</h3>
            <span className="text-[9px] bg-red-500/10 text-red-500 border border-red-500/20 px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider">
              {alertes.length} ACTIVES
            </span>
          </div>
          <div className="divide-y divide-[var(--border-primary)] max-h-[280px] overflow-y-auto">
            {alertes.length === 0 && (
              <div className="px-5 py-10 text-center text-xs text-[var(--text-secondary)]">
                Aucune alerte — tout est nominal.
              </div>
            )}
            {alertes.map((a, i) => (
              <div key={i} className={`flex items-start gap-3 px-5 py-3.5 ${a.niveau === "critique" ? "bg-red-500/5" : ""}`}>
                <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                  a.niveau === "critique" ? "bg-red-500" : a.niveau === "avertissement" ? "bg-amber-500" : "bg-blue-500"
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold text-[var(--text-secondary)] opacity-70 uppercase tracking-wider">{a.type}</span>
                    {a.niveau === "critique" && (
                      <span className="text-[8px] bg-red-500/15 text-red-500 px-1.5 rounded font-black border border-red-500/20">CRITIQUE</span>
                    )}
                  </div>
                  <div className="text-xs text-[var(--text-primary)] font-bold mt-1">{a.message}</div>
                  {a.detail && <div className="text-[10px] text-[var(--text-secondary)] opacity-70 mt-0.5">{a.detail}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Derniers documents enregistrés */}
        <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-primary)] shadow-sm overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-primary)] bg-[var(--bg-primary)]/40">
            <div>
              <h3 className="font-extrabold text-[var(--text-primary)] text-sm">Activité récente</h3>
              <p className="text-[var(--text-secondary)] opacity-70 text-[10px] mt-0.5">Derniers documents enregistrés</p>
            </div>
          </div>
          <div className="divide-y divide-[var(--border-primary)] max-h-[280px] overflow-y-auto">
            {recents.length === 0 && (
              <div className="px-5 py-10 text-center text-xs text-[var(--text-secondary)]">Aucun document récent.</div>
            )}
            {recents.map((d) => (
              <div key={d.refDoc} className="flex items-center gap-3 px-5 py-3">
                <span className="text-[9px] font-black px-2 py-1 rounded-lg bg-[var(--accent-light)] text-[var(--accent-primary)] flex-shrink-0">
                  {d.typeDoc}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-[var(--text-primary)] truncate">{d.refDoc}</div>
                  <div className="text-[10px] text-[var(--text-secondary)] opacity-70 truncate">
                    {d.raisonSocial || "—"}
                    {d.dateDoc ? ` · ${new Date(d.dateDoc).toLocaleDateString("fr-FR")}` : ""}
                  </div>
                </div>
                <span className="text-[11px] font-black text-[var(--text-primary)] tabular-nums flex-shrink-0">
                  {fmt0(d.ttcNet)} TND
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Détail d'un indicateur */}
      {selectedAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fade-in"
          onClick={() => setSelectedAgent(null)}>
          <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl relative animate-scale-in"
            onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="px-6 py-5 border-b border-[var(--border-primary)] flex items-center justify-between bg-[var(--bg-primary)]/45">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{selectedAgent.icon}</span>
                <div>
                  <h3 className="font-extrabold text-sm text-[var(--text-primary)]">{selectedAgent.title}</h3>
                  <div className="text-[10px] text-[var(--text-secondary)] opacity-80 mt-0.5">{selectedAgent.value}</div>
                </div>
              </div>
              <button onClick={() => setSelectedAgent(null)} className="w-7 h-7 rounded-full bg-[var(--bg-primary)] border border-[var(--border-primary)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition font-black text-sm">
                &times;
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto max-h-[70vh] space-y-5">
              {/* Objectif du mois — réalisé par vendeur */}
              {selectedAgent.code === "OBJECTIF" && insights && (
                <div className="space-y-4">
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    Objectif de chiffre d&apos;affaires fixé pour {MOIS_LONGS[insights.periode.mois - 1]} {insights.periode.annee},
                    comparé aux ventes réellement enregistrées.
                  </p>

                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { l: "Réalisé", v: fmt0(insights.objectif.realise) },
                      { l: "Objectif", v: fmt0(insights.objectif.objectifCA) },
                      { l: "Reste à faire", v: fmt0(insights.objectif.reste) },
                    ].map((x) => (
                      <div key={x.l} className="bg-[var(--bg-primary)]/50 border border-[var(--border-primary)] rounded-2xl p-3 text-center">
                        <div className="text-[9px] font-black uppercase text-[var(--text-secondary)] tracking-wider">{x.l}</div>
                        <div className="text-sm font-black text-[var(--text-primary)] mt-1 tabular-nums">{x.v}</div>
                        <div className="text-[9px] text-[var(--text-secondary)] opacity-70">TND</div>
                      </div>
                    ))}
                  </div>

                  {insights.objectif.parVendeur.length === 0 ? (
                    <p className="text-xs text-[var(--text-secondary)] text-center py-6 opacity-70">
                      Aucun objectif enregistré pour cette période.
                    </p>
                  ) : (
                    <div className="bg-[var(--bg-primary)]/50 border border-[var(--border-primary)] rounded-2xl p-4 space-y-3">
                      <div className="text-[10px] font-black uppercase text-[var(--text-secondary)] tracking-wider">Réalisé par vendeur</div>
                      {insights.objectif.parVendeur.map((v) => (
                        <div key={v.vendeur}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="font-bold text-[var(--text-primary)]">{v.vendeur}</span>
                            <span className="font-mono text-[var(--text-primary)] tabular-nums">
                              {fmt0(v.ca)} / {fmt0(v.objectifCA)} TND
                              <span className={`ml-2 font-black ${v.taux >= 100 ? "text-emerald-500" : v.taux >= 80 ? "text-amber-500" : "text-red-500"}`}>
                                {fmtPct(v.taux)}
                              </span>
                            </span>
                          </div>
                          <div className="w-full bg-[var(--bg-primary)] h-1.5 rounded-full overflow-hidden border border-[var(--border-primary)]">
                            <div className={`h-full rounded-full ${v.taux >= 100 ? "bg-emerald-500" : v.taux >= 80 ? "bg-amber-500" : "bg-red-500"}`}
                              style={{ width: `${Math.min(100, v.taux)}%` }} />
                          </div>
                          {/* Saisie de l'objectif : sans elle, un vendeur sans
                              objectif restait bloqué à 0 % sans moyen de le fixer. */}
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <input
                              type="number" min={0} step={100}
                              value={objSaisie[v.vendeur] ?? (v.objectifCA || "")}
                              onChange={(e) => setObjSaisie((p) => ({ ...p, [v.vendeur]: e.target.value }))}
                              placeholder="Objectif TND"
                              className="w-32 px-2 py-1 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-card)] text-[var(--text-primary)] text-[11px] tabular-nums"
                            />
                            <button
                              onClick={() => enregistrerObjectif(v.vendeur)}
                              disabled={objEnCours === v.vendeur}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[var(--accent-primary)] text-white disabled:opacity-40">
                              {objEnCours === v.vendeur ? "…" : "Fixer"}
                            </button>
                            {v.objectifCA <= 0 && (
                              <span className="text-[10px] text-amber-500 font-semibold">objectif non fixé</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex justify-end pt-3">
                    <button onClick={() => setSelectedAgent(null)} className="px-4 py-2 text-xs font-bold rounded-xl border border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-primary)] transition">
                      Fermer
                    </button>
                  </div>
                </div>
              )}

              {/* Clients à risque — relance WhatsApp vers le commercial */}
              {selectedAgent.code === "CLIENTS_RISQUE" && insights && (
                <div className="space-y-4">
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    Clients sans commande depuis plus de {insights.clientsRisque.seuilJours} jours.
                    Le bouton WhatsApp ouvre une conversation avec le commercial en charge,
                    message de relance pré-rempli.
                  </p>

                  <div className="space-y-2.5">
                    {insights.clientsRisque.rows.map((c) => {
                      const lien = lienWhatsapp(c);
                      return (
                        <div key={c.codeCli} className="flex flex-col sm:flex-row justify-between sm:items-center gap-2.5 text-xs bg-[var(--bg-primary)]/50 border border-[var(--border-primary)] rounded-2xl p-4">
                          <div className="min-w-0">
                            <div className="font-extrabold text-[var(--text-primary)] truncate">{c.nom}</div>
                            <div className="flex items-center gap-2 mt-1 text-[10px] text-[var(--text-secondary)] opacity-80 flex-wrap">
                              <span>Sans commande depuis {fmt0(c.jours)} j</span>
                              {c.solde > 0 && (
                                <>
                                  <span className="w-1 h-1 bg-[var(--text-secondary)] rounded-full opacity-40" />
                                  <span>Créance: {fmt0(c.solde)} TND</span>
                                </>
                              )}
                              {c.commercial && (
                                <>
                                  <span className="w-1 h-1 bg-[var(--text-secondary)] rounded-full opacity-40" />
                                  <span>Commercial: {c.commercial}</span>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 ml-auto sm:ml-0 flex-shrink-0">
                            <span className="text-[10px] font-black text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                              {c.score}% risque
                            </span>
                            {lien ? (
                              <a
                                href={lien}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={c.whatsapp?.vers === "commercial"
                                  ? `Relancer ${c.commercial} sur WhatsApp`
                                  : "Contacter le client sur WhatsApp (commercial sans numéro)"}
                                className="px-3 py-1.5 text-[10px] font-black rounded-lg transition bg-emerald-500 text-white hover:bg-emerald-600 flex items-center gap-1.5"
                              >
                                <MessageCircle size={12} />
                                {c.whatsapp?.vers === "commercial" ? "Relancer" : "Client"}
                              </a>
                            ) : (
                              <span className="px-3 py-1.5 text-[10px] font-bold rounded-lg bg-[var(--bg-primary)] text-[var(--text-secondary)] border border-[var(--border-primary)]">
                                Sans numéro
                              </span>
                            )}
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

              {/* Ruptures de stock — articles à zéro */}
              {selectedAgent.code === "RUPTURES_STOCK" && insights && (
                <div className="space-y-4">
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    {fmt0(insights.rupturesStock.nb)} articles sont à zéro, soit {fmtPct(insights.rupturesStock.taux)} du
                    catalogue vendable ({fmt0(insights.rupturesStock.nbArticles)} références).
                  </p>

                  <div className="bg-[var(--bg-primary)]/50 border border-[var(--border-primary)] rounded-2xl p-4 space-y-3">
                    <div className="text-[10px] font-black uppercase text-[var(--text-secondary)] tracking-wider">
                      Articles à réapprovisionner
                    </div>
                    <div className="space-y-2.5">
                      {insights.rupturesStock.rows.map((a) => (
                        <div key={a.refArt} className="flex justify-between items-start text-xs border-b border-[var(--border-primary)]/40 pb-2 last:border-0 last:pb-0 gap-3">
                          <div className="min-w-0">
                            <span className="font-extrabold text-[var(--text-primary)] break-words">{a.designation || a.refArt}</span>
                            <div className="text-[10px] text-[var(--text-secondary)] opacity-85 mt-0.5 font-mono">
                              Réf. {a.refArt} · stock {fmt0(a.stock)}{a.stMin > 0 ? ` / min ${fmt0(a.stMin)}` : ""}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <span className="font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded text-[10px] whitespace-nowrap">
                              {fmt0(a.suggere)} u. suggérées
                            </span>
                            <div className="text-[10px] text-[var(--text-secondary)] opacity-85 mt-0.5 tabular-nums">
                              P.A: {fmt0(a.puAchat)} TND
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3 justify-end pt-3">
                    <button onClick={() => setSelectedAgent(null)} className="px-4 py-2 text-xs font-bold rounded-xl border border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-primary)] transition">
                      Fermer
                    </button>
                    <Link href="/admin/modules/stock" className="px-4 py-2 text-xs font-black rounded-xl bg-red-600 text-white hover:bg-red-700 shadow-md shadow-red-500/10 transition">
                      Ouvrir le module Stock
                    </Link>
                  </div>
                </div>
              )}

              {/* Ruptures debout — sous le seuil minimum */}
              {selectedAgent.code === "RUPTURES_DEBOUT" && insights && (
                <div className="space-y-4">
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    Articles encore disponibles mais passés sous leur seuil minimum : ils se vendent
                    toujours et tomberont en rupture sans réapprovisionnement.
                  </p>

                  {insights.rupturesDebout.rows.length === 0 ? (
                    <p className="text-xs text-[var(--text-secondary)] text-center py-8 opacity-70">
                      ✓ Aucun article sous son seuil minimum.
                    </p>
                  ) : (
                    <div className="bg-[var(--bg-primary)]/50 border border-[var(--border-primary)] rounded-2xl p-4 space-y-2.5">
                      {insights.rupturesDebout.rows.map((a) => (
                        <div key={a.refArt} className="flex justify-between items-start text-xs border-b border-[var(--border-primary)]/40 pb-2 last:border-0 last:pb-0 gap-3">
                          <div className="min-w-0">
                            <span className="font-extrabold text-[var(--text-primary)] break-words">{a.designation || a.refArt}</span>
                            <div className="text-[10px] text-[var(--text-secondary)] opacity-85 mt-0.5 font-mono">Réf. {a.refArt}</div>
                          </div>
                          <div className="text-right flex-shrink-0 tabular-nums">
                            <span className="font-bold text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded text-[10px] whitespace-nowrap">
                              {fmt0(a.stock)} / min {fmt0(a.stMin)}
                            </span>
                            <div className="text-[10px] text-[var(--text-secondary)] opacity-85 mt-0.5">
                              manque {fmt0(a.manque)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex justify-end pt-3">
                    <button onClick={() => setSelectedAgent(null)} className="px-4 py-2 text-xs font-bold rounded-xl border border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-primary)] transition">
                      Fermer
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Répartition du stock par famille — ouverte depuis la carte CA. */}
      {voirFamilles && (
        <ValorisationFamilles accent="var(--accent-primary)" onClose={() => setVoirFamilles(false)} />
      )}

      {/* Détail des achats — ouvert depuis la carte Achats. */}
      {voirAchats && (
        <DetailAchats accent="var(--accent-primary)" onClose={() => setVoirAchats(false)} />
      )}

      {/* Créances & trésorerie — ouvert depuis la carte Créances clients. */}
      {voirCreances && (
        <DetailCreances accent="var(--accent-primary)" onClose={() => setVoirCreances(false)} />
      )}

      {/* Ruptures de stock — ouvert depuis la carte Ruptures stock. */}
      {voirRuptures && (
        <DetailRuptures accent="var(--accent-primary)" onClose={() => setVoirRuptures(false)} />
      )}

    </div>
  );
}
