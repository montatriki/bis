"use client";
import { useState, useEffect } from "react";

export type DashboardData = {
  periode: { du: string; au: string };
  kpis: {
    ca: number; nbDocs: number; panierMoyen: number; valeurStock: number;
    creances: number; encaissements: number; nbClients: number; nbFournisseurs: number;
    nbArticles: number; ruptures: number; sousMini: number; tauxRupture: number;
  };
  serie: { mois: string; ca: number; docs: number }[];
  topClients: { nom: string; codeCli: number | null; ca: number; docs: number }[];
  parType: { type: string; count: number; total: number }[];
  aRisque?: { id: number; raisonSocial: string; soldeFin: number; tel: string | null; ville: string | null; gouvernorat: string | null }[];
  parCommercial?: { commercial: string; ca: number; docs: number }[];
  aValider?: { refDoc: string; typeDoc: string; raisonSocial: string | null; ttcNet: number; dateDoc: string | null; commercial: string | null }[];
  topRuptures?: { refArt: string; designation: string; enStock: number; stMin: number }[];
  alertes?: { ruptures: number; sousMini: number; docsNonValides: number; creancesElevees: number };
  missions?: number;
  nbMissions?: number;
  docsNonValides?: number;
};

/** Charge les données d'un tableau de bord depuis /api/dashboard. */
export function useDashboard(scope: "admin" | "manager" | "commercial", du?: string, au?: string) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const qs = new URLSearchParams({ scope });
    if (du) qs.set("du", du);
    if (au) qs.set("au", au);

    fetch(`/api/dashboard?${qs}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.error) setError(d.error);
        else setData(d);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) { setError("Chargement impossible"); setLoading(false); }
      });

    return () => { cancelled = true; };
  }, [scope, du, au]);

  return { data, loading, error };
}

export const fmtMoney = (v: unknown) =>
  new Intl.NumberFormat("fr-TN", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(Number(v) || 0);

/** Montant compact pour les tuiles : 12,4k / 1,37M. */
export const fmtCompact = (v: unknown) => {
  const x = Number(v) || 0;
  const abs = Math.abs(x);
  if (abs >= 1_000_000) return `${(x / 1_000_000).toFixed(2)} M`;
  if (abs >= 1_000) return `${(x / 1_000).toFixed(1)} k`;
  return x.toFixed(0);
};

export const fmtInt = (v: unknown) => new Intl.NumberFormat("fr-TN").format(Number(v) || 0);
