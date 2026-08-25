"use client";
import { useEffect, useState } from "react";
import {
  TrendingUp, TrendingDown, Wallet, Users,
  ArrowUpRight, ArrowDownRight, AlertTriangle, Percent, FileText,
  CalendarRange, Warehouse, Store, Package, Target,
} from "lucide-react";
import { erreur, succes } from "@/lib/alertes";
import { MOIS_LONGS } from "@/lib/vente-stats";

/** Objectif mensuel d'un vendeur, rapproché de son réalisé. */
type LigneObjectif = {
  vendeur: string; objectifCA: number; ca: number;
  docs: number; clients: number; pct: number | null; ecart: number | null;
};

type Emplacement = {
  emplacement: string; type: "depot" | "magasin";
  quantite: number; valeur: number; refs: number;
};

type Synthese = {
  ventes: { ttc: number; ht: number };
  achats: { ttc: number; ht: number };
  marge: {
    brute: number; taux: number; comparable: boolean;
    periodeVentes: { du: string | null; au: string | null };
    periodeAchats: { du: string | null; au: string | null };
  };
  creancesClients: number;
  dettesFournisseurs: number;
  stock: {
    valeur: number; nbArticles: number; nbRuptures: number;
    nbStockNegatif: number; valeurStockNegatif: number;
    valeurDepot: number; valeurMagasin: number;
    emplacements: Emplacement[]; nbEmplacements: number;
  };
  tresorerie: { solde: number; encaissements: number; decaissements: number; nbComptes: number };
  ventesParType: { type: string; count: number; total: number }[];
  topClients: { name: string; ca: number; solde: number }[];
  topArticles: {
    source: "ventes" | "stock";
    rows: { refArt: string; designation: string; quantite: number; valeur: number }[];
  };
  ruptures: { name: string; stock: number; min: number; reference: string }[];
};

/** Raccourcis de période proposés au-dessus du tableau. */
const RACCOURCIS: { label: string; calc: () => { du: string; au: string } }[] = [
  {
    label: "Ce mois", calc: () => {
      const n = new Date();
      return { du: iso(new Date(n.getFullYear(), n.getMonth(), 1)), au: iso(n) };
    },
  },
  {
    label: "Mois dernier", calc: () => {
      const n = new Date();
      return {
        du: iso(new Date(n.getFullYear(), n.getMonth() - 1, 1)),
        au: iso(new Date(n.getFullYear(), n.getMonth(), 0)),
      };
    },
  },
  {
    label: "12 derniers mois", calc: () => {
      const n = new Date();
      return { du: iso(new Date(n.getFullYear(), n.getMonth() - 11, 1)), au: iso(n) };
    },
  },
  {
    label: "Cette année", calc: () => {
      const n = new Date();
      return { du: iso(new Date(n.getFullYear(), 0, 1)), au: iso(n) };
    },
  },
];

const iso = (d: Date) => d.toISOString().slice(0, 10);

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-TN", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(n);
const fmt0 = (n: number) =>
  new Intl.NumberFormat("fr-TN", { maximumFractionDigits: 0 }).format(n);

// keyed by the label the API sends
const TYPE_COLOR: Record<string, string> = {
  "Devis": "bg-slate-400", "B. Commande": "bg-amber-500", "B. Livraison": "bg-blue-500",
  "Factures": "bg-emerald-500", "Avoirs": "bg-red-400", "Retours": "bg-purple-400",
};

export default function SynthesePage() {
  const [data, setData] = useState<Synthese | null>(null);
  const [loading, setLoading] = useState(true);
  // Bornes appliquées à la synthèse ; vides = tout l'historique.
  const [du, setDu] = useState("");
  const [au, setAu] = useState("");

  // ── Objectifs par vendeur ────────────────────────────────────────────────
  // L'administrateur les fixe ici : sans saisie, un vendeur reste à 0 % sans
  // moyen de corriger, et le taux global n'a pas de sens.
  const maintenant = new Date();
  const [objMois, setObjMois] = useState(maintenant.getMonth() + 1);
  const [objAnnee, setObjAnnee] = useState(maintenant.getFullYear());
  const [objRows, setObjRows] = useState<LigneObjectif[]>([]);
  const [objTotaux, setObjTotaux] = useState({ totalCA: 0, totalObjectif: 0, sansObjectif: 0 });
  const [objSaisie, setObjSaisie] = useState<Record<string, string>>({});
  const [objEnCours, setObjEnCours] = useState<string | null>(null);
  const [objChargement, setObjChargement] = useState(true);
  // Objectif global, réparti entre les vendeurs.
  const [objTotal, setObjTotal] = useState("");
  const [objMode, setObjMode] = useState<"performance" | "egale">("performance");
  const [objRepartition, setObjEnRepartition] = useState(false);

  async function chargerObjectifs(mois = objMois, annee = objAnnee) {
    setObjChargement(true);
    const d = await fetch(`/api/objectifs?mois=${mois}&annee=${annee}`)
      .then((r) => r.json())
      .catch(() => null);
    if (d?.rows) {
      setObjRows(d.rows);
      setObjTotaux({
        totalCA: d.totalCA ?? 0,
        totalObjectif: d.totalObjectif ?? 0,
        sansObjectif: d.sansObjectif ?? 0,
      });
      setObjSaisie({});
    }
    setObjChargement(false);
  }

  useEffect(() => {
    // Le chargement est déclenché hors du rendu courant : appeler `setState`
    // directement depuis l'effet provoque un rendu en cascade.
    const t = setTimeout(() => { void chargerObjectifs(objMois, objAnnee); }, 0);
    return () => clearTimeout(t);
    // `chargerObjectifs` ne dépend que de ses arguments.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objMois, objAnnee]);

  /**
   * Répartit un objectif global entre les vendeurs.
   * Deux clés au choix : au prorata du réalisé (on demande plus à qui vend
   * plus), ou à parts égales (secteurs redécoupés, pas d'historique utile).
   */
  async function repartirObjectif() {
    const montant = Number(String(objTotal).replace(/\s/g, "").replace(",", "."));
    if (!Number.isFinite(montant) || montant <= 0) {
      await erreur("Saisissez un montant total positif.", "Objectif global invalide");
      return;
    }
    setObjEnRepartition(true);
    const r = await fetch("/api/objectifs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ total: montant, mois: objMois, annee: objAnnee, mode: objMode }),
    }).then((x) => x.json()).catch(() => ({ error: "réseau" }));
    setObjEnRepartition(false);
    if (!r.ok) { await erreur(r.error ?? "Répartition impossible"); return; }
    setObjTotal("");
    await chargerObjectifs();
    const detail = (r.repartition ?? [])
      .map((x: { vendeur: string; montant: number; part: number }) =>
        `${x.vendeur} : ${fmt0(x.montant)} TND (${x.part} %)`)
      .join("\n");
    await succes(detail, r.message);
  }

  /** Fixe l'objectif du mois pour un vendeur. */
  async function fixerObjectif(vendeur: string) {
    const brut = objSaisie[vendeur];
    const montant = Number(String(brut ?? "").replace(/\s/g, "").replace(",", "."));
    if (!Number.isFinite(montant) || montant < 0) {
      await erreur("Saisissez un montant positif.", "Objectif invalide");
      return;
    }
    setObjEnCours(vendeur);
    // En vue annuelle, un objectif individuel se ventile sur les douze mois :
    // le stockage reste mensuel, c'est l'affichage qui cumule.
    const r = objMois === 0
      ? await fetch("/api/objectifs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ total: montant, mois: 0, annee: objAnnee, vendeurs: [vendeur] }),
        }).then((x) => x.json()).catch(() => ({ error: "réseau" }))
      : await fetch("/api/objectifs", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vendeur, mois: objMois, annee: objAnnee, objectifCA: montant }),
        }).then((x) => x.json()).catch(() => ({ error: "réseau" }));
    setObjEnCours(null);
    if (!r.ok) { await erreur(r.error ?? "Enregistrement impossible"); return; }
    await chargerObjectifs();
    await succes(`Objectif de ${vendeur} fixé à ${fmt0(montant)} TND.`);
  }

  useEffect(() => {
    const qs = new URLSearchParams();
    if (du) qs.set("du", du);
    if (au) qs.set("au", au);
    // `setLoading(true)` posé directement dans l'effet déclenchait un rendu en
    // cascade. On le passe dans la même file que la réponse : l'écran affiche
    // les données précédentes le temps du chargement plutôt que de clignoter.
    let annule = false;
    const t = setTimeout(() => { if (!annule) setLoading(true); }, 0);
    fetch(`/api/synthese${qs.toString() ? `?${qs}` : ""}`)
      .then((r) => r.json())
      .then((d) => { if (!annule) setData(d); })
      .finally(() => { if (!annule) setLoading(false); });
    return () => { annule = true; clearTimeout(t); };
  }, [du, au]);

  const filtre = (
    <div className="flex flex-wrap items-center gap-2 bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-2xl px-4 py-3 shadow-sm">
      <CalendarRange size={15} className="text-[var(--accent-primary)] flex-shrink-0" />
      <span className="text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)]">Période</span>
      <input type="date" value={du} max={au || undefined} onChange={(e) => setDu(e.target.value)}
        className="text-xs bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg px-2.5 py-1.5 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]" />
      <span className="text-[10px] text-[var(--text-secondary)]">au</span>
      <input type="date" value={au} min={du || undefined} onChange={(e) => setAu(e.target.value)}
        className="text-xs bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg px-2.5 py-1.5 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]" />
      <div className="flex flex-wrap gap-1.5 ml-1">
        {RACCOURCIS.map((r) => (
          <button key={r.label} onClick={() => { const p = r.calc(); setDu(p.du); setAu(p.au); }}
            className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg border border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-[var(--accent-light)] hover:text-[var(--text-primary)] transition">
            {r.label}
          </button>
        ))}
        {(du || au) && (
          <button onClick={() => { setDu(""); setAu(""); }}
            className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg border border-[var(--border-primary)] text-[var(--accent-primary)] hover:bg-[var(--accent-light)] transition">
            Tout l&apos;historique
          </button>
        )}
      </div>
    </div>
  );

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-[var(--bg-primary)] rounded-xl animate-pulse" />
        {filtre}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-[var(--bg-primary)] rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const maxTypeTotal = Math.max(1, ...data.ventesParType.map((v) => Math.abs(v.total)));

  const KPIS = [
    { label: "Chiffre d'affaires", value: fmt0(data.ventes.ttc), unit: "TND", sub: `HT: ${fmt0(data.ventes.ht)}`, icon: TrendingUp, up: true },
    { label: "Achats", value: fmt0(data.achats.ttc), unit: "TND", sub: `HT: ${fmt0(data.achats.ht)}`, icon: TrendingDown, up: false },
    {
      label: "Marge brute", value: fmt0(data.marge.brute), unit: "TND",
      // Périodes décalées : on le dit au lieu d'afficher un taux trompeur.
      sub: data.marge.comparable
        ? `Taux: ${data.marge.taux.toFixed(1)}%`
        : "Périodes ventes/achats différentes",
      icon: Percent, up: data.marge.brute >= 0,
      alerte: !data.marge.comparable,
    },
    { label: "Valeur du stock", value: fmt0(data.stock.valeur), unit: "TND", sub: `${fmt0(data.stock.nbArticles)} articles · ${fmt0(data.stock.nbRuptures)} en rupture`, icon: Wallet, up: data.stock.nbRuptures === 0 },
  ];

  const SOLDES = [
    { label: "Valeur du magasin", value: data.stock.valeurMagasin, icon: Store, tone: "text-amber-500", bg: "bg-amber-500/10" },
    { label: "Valeur du dépôt", value: data.stock.valeurDepot, icon: Warehouse, tone: "text-purple-500", bg: "bg-purple-500/10" },
    { label: "Créances clients", value: data.creancesClients, icon: Users, tone: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Trésorerie", value: data.tresorerie.solde, icon: Wallet, tone: "text-emerald-500", bg: "bg-emerald-500/10" },
  ];

  return (
    <div className="space-y-6 animate-fade-in text-[var(--text-primary)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--border-primary)] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight">Synthèse Générale</h1>
            <span className="text-[10px] font-extrabold bg-[var(--accent-light)] text-[var(--accent-primary)] px-2.5 py-0.5 rounded-full border border-[var(--border-primary)] uppercase tracking-wider">
              Consolidation
            </span>
          </div>
          <p className="text-[var(--text-secondary)] opacity-80 text-xs mt-1">
            Vue consolidée — Ventes, Achats, Stock & Trésorerie
          </p>
        </div>
        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-1.5">
          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse-dot" />
          <span className="text-emerald-500 text-[10px] font-black uppercase tracking-wider">Données temps réel</span>
        </div>
      </div>

      {filtre}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {KPIS.map((k, i) => (
          <div key={k.label} className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-primary)] shadow-sm p-5 animate-fade-in" style={{ animationDelay: `${i * 0.05}s` }}>
            <div className="flex items-start justify-between mb-2">
              <div className="w-10 h-10 bg-[var(--accent-light)] rounded-xl flex items-center justify-center border border-[var(--border-primary)]">
                <k.icon size={19} className="text-[var(--accent-primary)]" />
              </div>
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5 ${k.up ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"}`}>
                {k.up ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
              </span>
            </div>
            <div className="text-2xl font-extrabold tracking-tight">
              {k.value} <span className="text-sm font-bold text-[var(--text-secondary)]">{k.unit}</span>
            </div>
            <div className="text-[var(--text-secondary)] font-bold text-xs mt-1">{k.label}</div>
            <div className="text-[var(--text-secondary)] opacity-70 text-[10px] mt-0.5">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Soldes row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {SOLDES.map((s, i) => (
          <div key={s.label} className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-primary)] shadow-sm p-4 flex items-center gap-3 animate-fade-in" style={{ animationDelay: `${0.2 + i * 0.05}s` }}>
            <div className={`w-9 h-9 ${s.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
              <s.icon size={16} className={s.tone} />
            </div>
            <div className="min-w-0">
              <div className="text-[var(--text-secondary)] text-[10px] font-bold uppercase tracking-wide truncate">{s.label}</div>
              <div className="font-extrabold text-sm">{fmt(s.value)} <span className="text-[10px] opacity-60">TND</span></div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Ventes par type */}
        <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-primary)] shadow-sm p-5">
          <div className="flex items-center justify-between mb-4 border-b border-[var(--border-primary)] pb-2">
            <h3 className="font-extrabold text-sm flex items-center gap-2"><FileText size={15} className="text-[var(--accent-primary)]" /> Documents de vente par type</h3>
          </div>
          <div className="space-y-3">
            {data.ventesParType.map((v, i) => (
              <div key={`${v.type}-${i}`}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-bold">{v.type} <span className="opacity-60 font-normal">({v.count})</span></span>
                  <span className="font-mono font-bold">{fmt0(v.total)} TND</span>
                </div>
                <div className="w-full bg-[var(--bg-primary)] h-2 rounded-full overflow-hidden border border-[var(--border-primary)]">
                  <div className={`h-full rounded-full ${TYPE_COLOR[v.type] ?? "bg-slate-400"}`} style={{ width: `${(Math.abs(v.total) / maxTypeTotal) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top clients */}
        <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-primary)] shadow-sm p-5">
          <div className="flex items-center justify-between mb-4 border-b border-[var(--border-primary)] pb-2">
            <h3 className="font-extrabold text-sm flex items-center gap-2"><Users size={15} className="text-[var(--accent-primary)]" /> Top clients par CA</h3>
          </div>
          {data.topClients.length === 0 ? (
            <p className="text-[var(--text-secondary)] text-xs py-6 text-center opacity-70">Aucune vente enregistrée</p>
          ) : (
            <div className="space-y-2">
              {data.topClients.map((c, i) => (
                <div key={c.name} className="flex items-center gap-3 py-2 border-b border-[var(--border-primary)]/40 last:border-0">
                  <div className="w-7 h-7 rounded-lg bg-[var(--accent-light)] border border-[var(--border-primary)] flex items-center justify-center text-[var(--accent-primary)] font-black text-xs flex-shrink-0">{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-xs truncate">{c.name}</div>
                    <div className="text-[10px] text-[var(--text-secondary)] opacity-70">Solde: {fmt0(c.solde)} TND</div>
                  </div>
                  <div className="font-mono font-extrabold text-xs text-[var(--accent-primary)]">{fmt0(c.ca)} TND</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Top articles */}
        <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-primary)] shadow-sm p-5">
          <div className="flex items-center justify-between mb-4 border-b border-[var(--border-primary)] pb-2 gap-2">
            <h3 className="font-extrabold text-sm flex items-center gap-2">
              <Package size={15} className="text-[var(--accent-primary)]" /> Top articles
            </h3>
            <span className="text-[9px] font-black uppercase tracking-wider bg-[var(--accent-light)] text-[var(--accent-primary)] px-2.5 py-0.5 rounded-full whitespace-nowrap">
              {data.topArticles.source === "ventes" ? "Par CA vendu" : "Par valeur en stock"}
            </span>
          </div>
          {data.topArticles.rows.length === 0 ? (
            <p className="text-[var(--text-secondary)] text-xs py-6 text-center opacity-70">Aucun article</p>
          ) : (
            <div className="space-y-2">
              {data.topArticles.rows.map((a, i) => (
                <div key={a.refArt} className="flex items-center gap-3 py-2 border-b border-[var(--border-primary)]/40 last:border-0">
                  <div className="w-7 h-7 rounded-lg bg-[var(--accent-light)] border border-[var(--border-primary)] flex items-center justify-center text-[var(--accent-primary)] font-black text-xs flex-shrink-0">{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-xs truncate" title={a.designation}>{a.designation}</div>
                    <div className="text-[10px] text-[var(--text-secondary)] opacity-70 font-mono">
                      {a.refArt} · {fmt0(a.quantite)} u.
                    </div>
                  </div>
                  <div className="font-mono font-extrabold text-xs text-[var(--accent-primary)] tabular-nums">{fmt0(a.valeur)} TND</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* État du stock par emplacement (magasin / dépôt) */}
        <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-primary)] shadow-sm p-5">
          <div className="flex items-center justify-between mb-4 border-b border-[var(--border-primary)] pb-2">
            <h3 className="font-extrabold text-sm flex items-center gap-2">
              <Warehouse size={15} className="text-[var(--accent-primary)]" /> État du stock par emplacement
            </h3>
          </div>
          {data.stock.emplacements.length === 0 ? (
            <p className="text-[var(--text-secondary)] text-xs py-6 text-center opacity-70">
              Aucune ventilation par emplacement
            </p>
          ) : (
            <div className="space-y-2">
              {data.stock.emplacements.map((e) => (
                <div key={e.emplacement} className="flex items-center gap-3 py-2 border-b border-[var(--border-primary)]/40 last:border-0">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${e.type === "depot" ? "bg-purple-500/10 text-purple-500" : "bg-amber-500/10 text-amber-500"}`}>
                    {e.type === "depot" ? <Warehouse size={14} /> : <Store size={14} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-xs truncate" title={e.emplacement}>{e.emplacement}</div>
                    <div className="text-[10px] text-[var(--text-secondary)] opacity-70">
                      {e.type === "depot" ? "Dépôt" : "Magasin"} · {fmt0(e.refs)} réf. · {fmt0(e.quantite)} u.
                    </div>
                  </div>
                  <div className="font-mono font-extrabold text-xs text-[var(--accent-primary)] tabular-nums">{fmt0(e.valeur)} TND</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>


      {/* Objectifs par vendeur — saisis par l'administrateur.
          La carte vit ici plutôt que dans une modale : c'est l'écran de pilotage,
          et un objectif non fixé laisse le taux de son vendeur sans valeur. */}
      <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-primary)] shadow-sm p-5">
        <div className="flex items-center justify-between mb-4 border-b border-[var(--border-primary)] pb-2 flex-wrap gap-3">
          <h3 className="font-extrabold text-sm flex items-center gap-2">
            <Target size={15} className="text-[var(--accent-primary)]" /> Objectifs par vendeur
          </h3>
          <div className="flex items-center gap-2">
            <select
              value={objMois}
              onChange={(e) => setObjMois(Number(e.target.value))}
              className="px-2 py-1 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] text-xs">
              {/* `0` = les douze mois cumulés : suivi d'un objectif annuel. */}
              <option value={0}>Année entière</option>
              {MOIS_LONGS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            <select
              value={objAnnee}
              onChange={(e) => setObjAnnee(Number(e.target.value))}
              className="px-2 py-1 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] text-xs">
              {[objAnnee + 1, objAnnee, objAnnee - 1, objAnnee - 2].map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Récapitulatif de la période choisie. */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {[
            { l: "Réalisé", v: `${fmt0(objTotaux.totalCA)} TND` },
            { l: "Objectif", v: `${fmt0(objTotaux.totalObjectif)} TND` },
            {
              l: "Atteinte",
              v: objTotaux.totalObjectif > 0
                ? `${Math.round((objTotaux.totalCA / objTotaux.totalObjectif) * 100)} %`
                : "—",
            },
            { l: "Sans objectif", v: `${objTotaux.sansObjectif} vendeur(s)` },
          ].map((x) => (
            <div key={x.l} className="bg-[var(--bg-primary)]/50 border border-[var(--border-primary)] rounded-xl p-3 text-center">
              <div className="text-[9px] font-black uppercase text-[var(--text-secondary)] tracking-wider">{x.l}</div>
              <div className="text-sm font-black text-[var(--text-primary)] mt-1 tabular-nums">{x.v}</div>
            </div>
          ))}
        </div>

        {/* Objectif global : un seul montant, réparti entre les vendeurs. */}
        <div className="bg-[var(--accent-light)] border border-[var(--border-primary)] rounded-xl p-4 mb-4">
          <div className="text-[10px] font-black uppercase text-[var(--text-secondary)] tracking-wider mb-2">
            Fixer un objectif global {objMois === 0 ? `pour ${objAnnee}` : `pour ${MOIS_LONGS[objMois - 1]} ${objAnnee}`}
          </div>
          <div className="flex items-end gap-2 flex-wrap">
            <div>
              <label className="block text-[10px] text-[var(--text-secondary)] mb-1">Montant total (TND)</label>
              <input
                type="number" min={0} step={1000}
                value={objTotal}
                onChange={(e) => setObjTotal(e.target.value)}
                placeholder="ex. 300000"
                className="w-40 px-2 py-1.5 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-card)] text-[var(--text-primary)] text-xs tabular-nums"
              />
            </div>
            <div>
              <label className="block text-[10px] text-[var(--text-secondary)] mb-1">Répartition</label>
              <select
                value={objMode}
                onChange={(e) => setObjMode(e.target.value as "performance" | "egale")}
                className="px-2 py-1.5 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-card)] text-[var(--text-primary)] text-xs">
                <option value="performance">Au prorata du réalisé</option>
                <option value="egale">À parts égales</option>
              </select>
            </div>
            <button
              onClick={repartirObjectif}
              disabled={objRepartition}
              className="px-4 py-1.5 rounded-lg text-xs font-bold bg-[var(--accent-primary)] text-white disabled:opacity-40">
              {objRepartition ? "Répartition…" : "Répartir"}
            </button>
          </div>
          <p className="text-[10px] text-[var(--text-secondary)] mt-2 leading-relaxed">
            {objMode === "performance"
              ? "Chaque vendeur reçoit une part proportionnelle à son chiffre réalisé sur la période — on demande davantage à qui vend davantage."
              : "Le montant est divisé également entre tous les vendeurs actifs — utile quand les secteurs viennent d'être redécoupés."}
            {objMois === 0 && " Le montant annuel est ventilé sur les douze mois."}
          </p>
        </div>

        {objChargement ? (
          <p className="text-[var(--text-secondary)] text-xs py-6 text-center opacity-70">Chargement…</p>
        ) : objRows.length === 0 ? (
          <p className="text-[var(--text-secondary)] text-xs py-6 text-center opacity-70">
            Aucune vente ni objectif sur cette période.
          </p>
        ) : (
          <div className="space-y-3">
            {objRows.map((v) => {
              const taux = v.pct ?? 0;
              const couleur = v.pct == null ? "bg-slate-400"
                : taux >= 100 ? "bg-emerald-500" : taux >= 80 ? "bg-amber-500" : "bg-red-500";
              return (
                <div key={v.vendeur} className="border-b border-[var(--border-primary)]/40 last:border-0 pb-3 last:pb-0">
                  <div className="flex justify-between items-baseline text-xs mb-1 gap-3 flex-wrap">
                    <span className="font-bold text-[var(--text-primary)]">{v.vendeur}</span>
                    <span className="font-mono text-[var(--text-primary)] tabular-nums">
                      {fmt0(v.ca)} / {fmt0(v.objectifCA)} TND
                      <span className={`ml-2 font-black ${
                        v.pct == null ? "text-[var(--text-secondary)]"
                        : taux >= 100 ? "text-emerald-500" : taux >= 80 ? "text-amber-500" : "text-red-500"
                      }`}>
                        {v.pct == null ? "—" : `${taux} %`}
                      </span>
                    </span>
                  </div>
                  <div className="w-full bg-[var(--bg-primary)] h-1.5 rounded-full overflow-hidden border border-[var(--border-primary)]">
                    <div className={`h-full rounded-full ${couleur}`} style={{ width: `${Math.min(100, taux)}%` }} />
                  </div>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <input
                      type="number" min={0} step={100}
                      value={objSaisie[v.vendeur] ?? (v.objectifCA || "")}
                      onChange={(e) => setObjSaisie((p) => ({ ...p, [v.vendeur]: e.target.value }))}
                      placeholder="Objectif TND"
                      className="w-32 px-2 py-1 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-xs tabular-nums"
                    />
                    <button
                      onClick={() => fixerObjectif(v.vendeur)}
                      disabled={objEnCours === v.vendeur}
                      className="px-3 py-1 rounded-lg text-xs font-bold bg-[var(--accent-primary)] text-white disabled:opacity-40">
                      {objEnCours === v.vendeur ? "…" : "Fixer"}
                    </button>
                    {v.objectifCA <= 0 && (
                      <span className="text-[10px] text-amber-500 font-semibold">objectif non fixé</span>
                    )}
                    {v.ecart != null && v.ecart !== 0 && (
                      <span className={`text-[10px] font-semibold ${v.ecart > 0 ? "text-emerald-500" : "text-red-500"}`}>
                        {v.ecart > 0 ? "+" : ""}{fmt0(v.ecart)} TND
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Anomalies d'inventaire : le stock négatif fausse la valorisation */}
      {data.stock.nbStockNegatif > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl px-4 py-3 flex items-start gap-3">
          <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-[var(--text-primary)]">
            <span className="font-bold">
              {fmt0(data.stock.nbStockNegatif)} article(s) en stock négatif
            </span>{" "}
            — impossible physiquement, la valorisation est minorée de{" "}
            <span className="font-bold">{fmt0(Math.abs(data.stock.valeurStockNegatif))} TND</span>.
            Ces écarts viennent de sorties enregistrées sans les entrées correspondantes
            et doivent être régularisés par un inventaire.
          </div>
        </div>
      )}

      {/* Ruptures */}
      <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-primary)] shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-primary)] bg-[var(--bg-primary)]/40">
          <h3 className="font-extrabold text-sm flex items-center gap-2"><AlertTriangle size={15} className="text-amber-500" /> Articles en rupture / sous seuil</h3>
          <span className="text-[9px] bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider">{data.ruptures.length}</span>
        </div>
        {data.ruptures.length === 0 ? (
          <p className="text-[var(--text-secondary)] text-xs py-8 text-center opacity-70">✓ Aucun article sous le seuil minimum</p>
        ) : (
          <div className="divide-y divide-[var(--border-primary)]">
            {data.ruptures.map((r) => (
              <div key={r.reference} className="flex items-center justify-between px-5 py-3">
                <div>
                  <div className="font-bold text-xs">{r.name}</div>
                  <div className="text-[10px] text-[var(--text-secondary)] opacity-70 font-mono">{r.reference}</div>
                </div>
                <div className="text-xs">
                  <span className="font-black text-red-500">{r.stock}</span>
                  <span className="text-[var(--text-secondary)] opacity-70"> / min {r.min}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
