"use client";
import { useEffect, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";

// Graphiques du tableau de bord — alimentés par la base.
//
// Ces deux courbes affichaient des séries inventées (`MONTHLY_CA`, et quatre
// commerciaux codés en dur dont deux n'existent pas). Elles lisent désormais
// `/api/dashboard` et `/api/objectifs`, comme le reste du tableau de bord.

const axeStyle = { fontSize: 10, fill: "var(--text-secondary)" } as const;
const tooltipStyle = {
  borderRadius: 12, border: "1px solid var(--border-primary)",
  background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 11,
} as const;

/** Cadre commun : état de chargement et absence de données. */
function Cadre({ vide, children }: { vide: boolean; children: React.ReactElement }) {
  if (vide) {
    return (
      <div className="w-full h-[220px] flex items-center justify-center text-xs text-[var(--text-secondary)] opacity-70">
        Aucune donnée sur la période.
      </div>
    );
  }
  return <ResponsiveContainer width="100%" height={220}>{children}</ResponsiveContainer>;
}

type PointCA = { mois: string; ca: number; encaissements: number };

export function CAAreaChart() {
  const [data, setData] = useState<PointCA[] | null>(null);

  useEffect(() => {
    let annule = false;
    fetch("/api/dashboard?scope=admin")
      .then((r) => r.json())
      .then((d) => {
        if (annule) return;
        // `serie` porte le CA mensuel ; les encaissements suivent la même
        // granularité quand l'API les fournit.
        const serie = (d.serie ?? []) as { mois: string; ca: number; encaissements?: number }[];
        setData(serie.map((p) => ({
          mois: p.mois, ca: p.ca ?? 0, encaissements: p.encaissements ?? 0,
        })));
      })
      .catch(() => { if (!annule) setData([]); });
    return () => { annule = true; };
  }, []);

  if (!data) {
    return <div className="w-full h-[220px] bg-[var(--bg-primary)]/40 rounded-2xl animate-pulse" />;
  }
  const aEncaissements = data.some((p) => p.encaissements > 0);

  return (
    <Cadre vide={data.length === 0}>
      <AreaChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="caGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="encGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--text-primary)" stopOpacity={0.2} />
            <stop offset="95%" stopColor="var(--text-primary)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
        <XAxis dataKey="mois" tick={axeStyle} axisLine={false} tickLine={false} />
        <YAxis tick={axeStyle} axisLine={false} tickLine={false}
          tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
        <Tooltip formatter={(v) => [`${Number(v).toLocaleString("fr-FR")} TND`]} contentStyle={tooltipStyle} />
        <Area type="monotone" dataKey="ca" stroke="var(--accent-primary)" strokeWidth={2} fill="url(#caGrad)" name="CA" />
        {aEncaissements && (
          <Area type="monotone" dataKey="encaissements" stroke="var(--text-primary)" strokeWidth={2} fill="url(#encGrad)" name="Encaissements" />
        )}
      </AreaChart>
    </Cadre>
  );
}

type PointVendeur = { name: string; ca: number; obj: number };

export function CommercialBarChart() {
  const [data, setData] = useState<PointVendeur[] | null>(null);

  useEffect(() => {
    let annule = false;
    fetch("/api/objectifs")
      .then((r) => r.json())
      .then((d) => {
        if (annule) return;
        const rows = (d.rows ?? []) as { vendeur: string; ca: number; objectifCA: number }[];
        setData(rows.slice(0, 8).map((r) => ({
          name: r.vendeur, ca: r.ca ?? 0, obj: r.objectifCA ?? 0,
        })));
      })
      .catch(() => { if (!annule) setData([]); });
    return () => { annule = true; };
  }, []);

  if (!data) {
    return <div className="w-full h-[200px] bg-[var(--bg-primary)]/40 rounded-2xl animate-pulse" />;
  }

  return (
    <Cadre vide={data.length === 0}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
        <XAxis dataKey="name" tick={axeStyle} axisLine={false} tickLine={false} />
        <YAxis tick={axeStyle} axisLine={false} tickLine={false}
          tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
        <Tooltip formatter={(v) => [`${Number(v).toLocaleString("fr-FR")} TND`]} contentStyle={tooltipStyle} />
        <Bar dataKey="ca" fill="var(--accent-primary)" radius={[4, 4, 0, 0]} name="CA réalisé" />
        <Bar dataKey="obj" fill="var(--border-primary)" radius={[4, 4, 0, 0]} name="Objectif" />
      </BarChart>
    </Cadre>
  );
}
