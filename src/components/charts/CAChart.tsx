"use client";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { MONTHLY_CA } from "@/lib/dummy-data";

export function CAAreaChart() {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={MONTHLY_CA} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
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
        <XAxis dataKey="month" tick={{ fontSize: 10, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false}
          tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
        <Tooltip formatter={(v) => [`${Number(v).toLocaleString()} TND`]}
          contentStyle={{ borderRadius: 12, border: "1px solid var(--border-primary)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 11 }} />
        <Area type="monotone" dataKey="ca" stroke="var(--accent-primary)" strokeWidth={2} fill="url(#caGrad)" name="CA" />
        <Area type="monotone" dataKey="encaissement" stroke="var(--text-primary)" strokeWidth={2} fill="url(#encGrad)" name="Encaissement" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function CommercialBarChart() {
  const data = [
    { name: "Mokhtar", ca: 62400, obj: 60000 },
    { name: "HICHEM", ca: 54200, obj: 60000 },
    { name: "FOUED", ca: 71300, obj: 60000 },
    { name: "Anis", ca: 48900, obj: 55000 },
  ];
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
        <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false}
          tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
        <Tooltip formatter={(v) => [`${Number(v).toLocaleString()} TND`]}
          contentStyle={{ borderRadius: 12, border: "1px solid var(--border-primary)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 11 }} />
        <Bar dataKey="ca" fill="var(--accent-primary)" radius={[4, 4, 0, 0]} name="CA Réalisé" />
        <Bar dataKey="obj" fill="var(--border-primary)" radius={[4, 4, 0, 0]} name="Objectif" />
      </BarChart>
    </ResponsiveContainer>
  );
}
