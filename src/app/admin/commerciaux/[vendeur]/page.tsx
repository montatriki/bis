"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, TrendingUp, FileText, Users, AlertTriangle, Target, ShoppingBag,
} from "lucide-react";

type Fiche = {
  vendeur: string;
  periode: { du: string; au: string };
  kpis: {
    ca: number; docs: number; clients: number; impaye: number;
    panierMoyen: number; objectifCA: number; tauxObjectif: number | null;
  };
  serie: { mois: string; ca: number; docs: number }[];
  parType: { type: string; count: number; total: number }[];
  topClients: { codeCli: number; nom: string; ca: number; docs: number }[];
  derniers: {
    refDoc: string; typeDoc: string; dateDoc: string | null;
    raisonSocial: string | null; ttcNet: number; soldeDoc: number;
  }[];
};

const fmt0 = (n: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n ?? 0);

export default function FicheCommercial({ params }: { params: Promise<{ vendeur: string }> }) {
  const { vendeur } = use(params);
  const nom = decodeURIComponent(vendeur);
  const [data, setData] = useState<Fiche | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/commerciaux?vendeur=${encodeURIComponent(nom)}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [nom]);

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-[var(--bg-primary)] rounded-xl animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-32 bg-[var(--bg-primary)] rounded-2xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  const maxSerie = Math.max(1, ...data.serie.map((s) => Math.abs(s.ca)));

  const KPIS = [
    { label: "Chiffre d'affaires", value: fmt0(data.kpis.ca), unit: "TND", sub: `Panier moyen: ${fmt0(data.kpis.panierMoyen)}`, icon: TrendingUp },
    { label: "Documents", value: fmt0(data.kpis.docs), unit: "", sub: "sur 12 mois", icon: FileText },
    { label: "Clients servis", value: fmt0(data.kpis.clients), unit: "", sub: "clients distincts", icon: Users },
    { label: "Impayés", value: fmt0(data.kpis.impaye), unit: "TND", sub: "restant dû", icon: AlertTriangle },
  ];

  return (
    <div className="space-y-6 animate-fade-in text-[var(--text-primary)]">
      {/* En-tête */}
      <div className="flex items-center justify-between border-b border-[var(--border-primary)] pb-4 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/admin/commerciaux"
            className="w-9 h-9 rounded-xl border border-[var(--border-primary)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-light)] transition flex-shrink-0">
            <ArrowLeft size={16} />
          </Link>
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-white font-black text-lg flex-shrink-0"
            style={{ background: "var(--accent-primary)" }}>
            {nom.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold tracking-tight truncate">{nom}</h1>
            <p className="text-[var(--text-secondary)] opacity-80 text-xs mt-0.5">
              Fiche d&apos;activité commerciale — 12 derniers mois
            </p>
          </div>
        </div>

        {data.kpis.tauxObjectif !== null && (
          <div className="text-right flex-shrink-0">
            <div className="text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1 justify-end">
              <Target size={12} /> Objectif
            </div>
            <div className={`text-lg font-extrabold tabular-nums ${data.kpis.tauxObjectif >= 100 ? "text-emerald-500" : data.kpis.tauxObjectif >= 80 ? "text-amber-500" : "text-red-500"}`}>
              {fmt0(data.kpis.tauxObjectif)}%
            </div>
            <div className="text-[10px] text-[var(--text-secondary)] opacity-70">
              sur {fmt0(data.kpis.objectifCA)} TND
            </div>
          </div>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {KPIS.map((k, i) => (
          <div key={k.label} className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-primary)] shadow-sm p-5 animate-fade-in" style={{ animationDelay: `${i * 0.05}s` }}>
            <div className="w-10 h-10 bg-[var(--accent-light)] rounded-xl flex items-center justify-center border border-[var(--border-primary)] mb-2">
              <k.icon size={19} className="text-[var(--accent-primary)]" />
            </div>
            <div className="text-2xl font-extrabold tracking-tight tabular-nums">
              {k.value} {k.unit && <span className="text-sm font-bold text-[var(--text-secondary)]">{k.unit}</span>}
            </div>
            <div className="text-[var(--text-secondary)] font-bold text-xs mt-1">{k.label}</div>
            <div className="text-[var(--text-secondary)] opacity-70 text-[10px] mt-0.5">{k.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Évolution mensuelle */}
        <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-primary)] shadow-sm p-5">
          <h3 className="font-extrabold text-sm flex items-center gap-2 mb-4 border-b border-[var(--border-primary)] pb-2">
            <TrendingUp size={15} className="text-[var(--accent-primary)]" /> Évolution mensuelle du CA
          </h3>
          {data.serie.length === 0 ? (
            <p className="text-xs text-[var(--text-secondary)] py-6 text-center opacity-70">Aucune activité</p>
          ) : (
            <div className="space-y-2.5">
              {data.serie.map((s) => (
                <div key={s.mois}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-bold">{s.mois} <span className="opacity-60 font-normal">({s.docs})</span></span>
                    <span className="font-mono font-bold tabular-nums">{fmt0(s.ca)} TND</span>
                  </div>
                  <div className="w-full bg-[var(--bg-primary)] h-2 rounded-full overflow-hidden border border-[var(--border-primary)]">
                    <div className="bg-gradient-primary h-full rounded-full" style={{ width: `${(Math.abs(s.ca) / maxSerie) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Meilleurs clients du commercial */}
        <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-primary)] shadow-sm p-5">
          <h3 className="font-extrabold text-sm flex items-center gap-2 mb-4 border-b border-[var(--border-primary)] pb-2">
            <Users size={15} className="text-[var(--accent-primary)]" /> Meilleurs clients
          </h3>
          {data.topClients.length === 0 ? (
            <p className="text-xs text-[var(--text-secondary)] py-6 text-center opacity-70">Aucun client</p>
          ) : (
            <div className="space-y-2">
              {data.topClients.map((c, i) => (
                <div key={c.codeCli} className="flex items-center gap-3 py-2 border-b border-[var(--border-primary)]/40 last:border-0">
                  <div className="w-7 h-7 rounded-lg bg-[var(--accent-light)] border border-[var(--border-primary)] flex items-center justify-center text-[var(--accent-primary)] font-black text-xs flex-shrink-0">{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-xs truncate" title={c.nom}>{c.nom}</div>
                    <div className="text-[10px] text-[var(--text-secondary)] opacity-70">{fmt0(c.docs)} document(s)</div>
                  </div>
                  <div className="font-mono font-extrabold text-xs text-[var(--accent-primary)] tabular-nums">{fmt0(c.ca)} TND</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Répartition par type de document */}
      <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-primary)] shadow-sm p-5">
        <h3 className="font-extrabold text-sm flex items-center gap-2 mb-4 border-b border-[var(--border-primary)] pb-2">
          <ShoppingBag size={15} className="text-[var(--accent-primary)]" /> Répartition par type de document
        </h3>
        <div className="flex flex-wrap gap-3">
          {data.parType.map((t) => (
            <div key={t.type} className="bg-[var(--bg-primary)]/50 border border-[var(--border-primary)] rounded-xl px-4 py-2.5">
              <div className="text-[10px] font-black uppercase text-[var(--text-secondary)] tracking-wider">{t.type}</div>
              <div className="text-sm font-extrabold tabular-nums mt-0.5">{fmt0(t.total)} TND</div>
              <div className="text-[10px] text-[var(--text-secondary)] opacity-70">{fmt0(t.count)} document(s)</div>
            </div>
          ))}
        </div>
      </div>

      {/* Derniers documents */}
      <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-primary)] shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border-primary)] bg-[var(--bg-primary)]/40">
          <h3 className="font-extrabold text-sm flex items-center gap-2">
            <FileText size={15} className="text-[var(--accent-primary)]" /> Derniers documents
          </h3>
        </div>
        {data.derniers.length === 0 ? (
          <p className="text-xs text-[var(--text-secondary)] py-8 text-center opacity-70">Aucun document</p>
        ) : (
          <div className="divide-y divide-[var(--border-primary)]">
            {data.derniers.map((d) => (
              <div key={d.refDoc} className="flex items-center gap-3 px-5 py-3">
                <span className="text-[9px] font-black px-2 py-1 rounded-lg bg-[var(--accent-light)] text-[var(--accent-primary)] flex-shrink-0">
                  {d.typeDoc}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold truncate">{d.refDoc}</div>
                  <div className="text-[10px] text-[var(--text-secondary)] opacity-70 truncate">
                    {d.raisonSocial || "—"}
                    {d.dateDoc ? ` · ${new Date(d.dateDoc).toLocaleDateString("fr-FR")}` : ""}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-[11px] font-black tabular-nums">{fmt0(d.ttcNet)} TND</div>
                  {d.soldeDoc > 0 && (
                    <div className="text-[10px] text-amber-500 font-bold tabular-nums">reste {fmt0(d.soldeDoc)}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
