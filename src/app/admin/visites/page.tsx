"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MapPin, Search, Loader2, Check, Users, CalendarDays, Download, X } from "lucide-react";
import { dateLocaleIso } from "@/lib/date-locale";
import { formatDistance } from "@/lib/geo";

// Rapport des visites terrain : ce que les commerciaux ont pointé depuis
// leur liste clients (« je suis là »). Chaque ligne est un passage horodaté,
// avec le contrôle de présence sur place.

type Visite = {
  id: number; clientId: number; clientNom: string; adresse: string | null;
  commercialNom: string; visiteLe: string;
  distanceM: number | null; surPlace: boolean; positionCorrigee: boolean;
  commentaire: string | null;
};

type Resume = { visites: number; surPlace: number; clients: number };

export default function VisitesPage() {
  const aujourdhui = dateLocaleIso(new Date());
  const [du, setDu] = useState(aujourdhui);
  const [au, setAu] = useState(aujourdhui);
  const [commercial, setCommercial] = useState("");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<Visite[]>([]);
  const [resume, setResume] = useState<Resume>({ visites: 0, surPlace: 0, clients: 0 });
  const [total, setTotal] = useState(0);
  const [commerciaux, setCommerciaux] = useState<string[]>([]);
  /** Saisie du filtre commercial : 21 vendeurs, une liste déroulante seule
      obligeait à parcourir tout le menu des yeux. */
  const [rechercheCom, setRechercheCom] = useState("");
  const [listeComOuverte, setListeComOuverte] = useState(false);
  const [loading, setLoading] = useState(true);

  const charger = useCallback(() => {
    setLoading(true);
    const qs = new URLSearchParams({ du, au, limit: "500" });
    if (commercial) qs.set("commercial", commercial);
    if (search.trim()) qs.set("search", search.trim());
    fetch(`/api/visites?${qs}`)
      .then((r) => r.json())
      .then((d) => {
        setRows(d.rows ?? []);
        setResume(d.resume ?? { visites: 0, surPlace: 0, clients: 0 });
        setTotal(d.total ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [du, au, commercial, search]);

  // La saisie du nom de client ne doit pas déclencher une requête par lettre.
  useEffect(() => {
    const t = setTimeout(charger, 250);
    return () => clearTimeout(t);
  }, [charger]);

  // Liste des vendeurs pour le filtre — la même que les autres écrans admin.
  useEffect(() => {
    fetch("/api/commerciaux")
      .then((r) => r.json())
      .then((d) => setCommerciaux((d.rows ?? []).map((r: { vendeur: string }) => r.vendeur).filter(Boolean)))
      .catch(() => {});
  }, []);

  /** Vendeurs correspondant à la saisie, accents et casse ignorés. */
  const commerciauxFiltres = useMemo(() => {
    const q = rechercheCom.trim().toLowerCase();
    if (!q) return commerciaux;
    return commerciaux.filter((c) => c.toLowerCase().includes(q));
  }, [commerciaux, rechercheCom]);

  /** Export CSV du rapport affiché, pour l'archivage ou Excel. */
  function exporter() {
    const entetes = ["Date", "Heure", "Client", "Adresse", "Commercial", "Distance (m)", "Sur place", "Position corrigée", "Commentaire"];
    const lignes = rows.map((v) => {
      const d = new Date(v.visiteLe);
      return [
        d.toLocaleDateString("fr-FR"), d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
        v.clientNom, v.adresse ?? "", v.commercialNom,
        v.distanceM ?? "", v.surPlace ? "Oui" : "Non", v.positionCorrigee ? "Oui" : "Non",
        (v.commentaire ?? "").replace(/[\r\n;]+/g, " "),
      ].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";");
    });
    // BOM : sans lui, Excel affiche « Ã© » à la place des accents.
    const blob = new Blob(["﻿" + [entetes.join(";"), ...lignes].join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `visites_${du}_${au}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="space-y-5 animate-fade-in text-[var(--text-primary)]">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--border-primary)] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight">Visites terrain</h1>
            <span className="text-[10px] font-extrabold bg-[var(--accent-light)] text-[var(--accent-primary)] px-2.5 py-0.5 rounded-full border border-[var(--border-primary)] uppercase tracking-wider">
              {total} passage{total > 1 ? "s" : ""}
            </span>
          </div>
          <p className="text-[var(--text-secondary)] opacity-80 text-xs mt-1">
            Pointages « je suis là » enregistrés par les commerciaux depuis leur liste clients
          </p>
        </div>
        <button onClick={exporter} disabled={!rows.length}
          className="flex items-center gap-2 text-xs font-bold px-3.5 py-2 rounded-xl border border-[var(--border-primary)]
                     text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-light)] transition disabled:opacity-40">
          <Download size={14} /> Exporter CSV
        </button>
      </div>

      {/* Repères de la période */}
      <div className="grid grid-cols-3 gap-3">
        <Carte icone={<CalendarDays size={15} />} label="Passages" valeur={String(resume.visites)} />
        <Carte icone={<Check size={15} />} label="Sur place" valeur={String(resume.surPlace)}
          detail={resume.visites ? `${Math.round((resume.surPlace / resume.visites) * 100)} %` : undefined} />
        <Carte icone={<Users size={15} />} label="Clients visités" valeur={String(resume.clients)} />
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          <input type="date" value={du} onChange={(e) => setDu(e.target.value)} aria-label="Du"
            className="px-3 h-9 text-xs rounded-xl bg-[var(--bg-card)] border border-[var(--border-primary)] focus:outline-none focus:border-[var(--accent-primary)]/50" />
          <span className="text-xs text-[var(--text-secondary)]">au</span>
          <input type="date" value={au} onChange={(e) => setAu(e.target.value)} aria-label="Au"
            className="px-3 h-9 text-xs rounded-xl bg-[var(--bg-card)] border border-[var(--border-primary)] focus:outline-none focus:border-[var(--accent-primary)]/50" />
        </div>
        {/* Commercial : champ de recherche plutôt qu'une liste déroulante —
            avec 21 vendeurs, il fallait parcourir tout le menu des yeux. */}
        <div className="relative w-full sm:w-56">
          <Users size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] opacity-55 pointer-events-none" />
          <input
            value={listeComOuverte ? rechercheCom : (commercial || "")}
            onChange={(e) => { setRechercheCom(e.target.value); setListeComOuverte(true); }}
            onFocus={() => { setRechercheCom(""); setListeComOuverte(true); }}
            onBlur={() => setTimeout(() => setListeComOuverte(false), 150)}
            placeholder="Tous les commerciaux"
            aria-label="Filtrer par commercial"
            className="w-full pl-9 pr-8 h-9 text-xs rounded-xl bg-[var(--bg-card)] border border-[var(--border-primary)]
                       text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/60
                       focus:outline-none focus:border-[var(--accent-primary)]/50 focus:ring-2 focus:ring-[var(--accent-primary)]/12" />
          {commercial && (
            <button onClick={() => { setCommercial(""); setRechercheCom(""); }}
              aria-label="Tous les commerciaux"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--accent-light)] transition">
              <X size={13} />
            </button>
          )}
          {listeComOuverte && (
            <div className="absolute z-30 mt-1 w-full max-h-64 overflow-y-auto rounded-xl bg-[var(--bg-card)]
                            border border-[var(--border-primary)] shadow-xl py-1">
              <button onMouseDown={() => { setCommercial(""); setListeComOuverte(false); }}
                className="w-full text-left px-3 py-2 text-xs font-semibold hover:bg-[var(--accent-light)] transition">
                Tous les commerciaux
              </button>
              {commerciauxFiltres.length === 0 ? (
                <div className="px-3 py-3 text-xs text-[var(--text-secondary)]">Aucun commercial trouvé.</div>
              ) : commerciauxFiltres.map((c) => (
                <button key={c} onMouseDown={() => { setCommercial(c); setListeComOuverte(false); }}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-[var(--accent-light)] transition truncate
                              ${c === commercial ? "font-bold text-[var(--accent-primary)]" : "text-[var(--text-primary)]"}`}>
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] opacity-55" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nom du client…"
            className="w-full pl-9 pr-3 h-9 text-xs rounded-xl bg-[var(--bg-card)] border border-[var(--border-primary)] focus:outline-none focus:border-[var(--accent-primary)]/50" />
        </div>
      </div>

      {/* Tableau */}
      <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-primary)] overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-[var(--text-secondary)]"><Loader2 className="animate-spin inline" size={20} /></div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-sm text-[var(--text-secondary)]">
            Aucune visite pointée sur cette période.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] opacity-70 border-b border-[var(--border-primary)]">
                  <th className="text-left font-bold px-4 py-3">Date</th>
                  <th className="text-left font-bold px-4 py-3">Client</th>
                  <th className="text-left font-bold px-4 py-3">Adresse</th>
                  <th className="text-left font-bold px-4 py-3">Commercial</th>
                  <th className="text-right font-bold px-4 py-3">Présence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-primary)]">
                {rows.map((v) => {
                  const d = new Date(v.visiteLe);
                  return (
                    <tr key={v.id} className="hover:bg-[var(--accent-light)]/50 transition">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-semibold tabular-nums">{d.toLocaleDateString("fr-FR")}</div>
                        <div className="text-[11px] text-[var(--text-secondary)] opacity-70 tabular-nums">
                          {d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/admin/modules/vente/clients/${v.clientId}`}
                          className="font-bold hover:text-[var(--accent-primary)] transition">
                          {v.clientNom}
                        </Link>
                        {v.commentaire && (
                          <div className="text-[11px] text-[var(--text-secondary)] opacity-75 mt-0.5 max-w-md">{v.commentaire}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[var(--text-secondary)] text-xs">
                        <span className="flex items-center gap-1"><MapPin size={11} className="opacity-60" /> {v.adresse || "—"}</span>
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold">{v.commercialNom}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {v.distanceM === null ? (
                          <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-[var(--bg-primary)] text-[var(--text-secondary)] border border-[var(--border-primary)]">
                            Position inconnue
                          </span>
                        ) : v.surPlace ? (
                          <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Sur place · {formatDistance(v.distanceM)}
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
                            À {formatDistance(v.distanceM)}
                          </span>
                        )}
                        {v.positionCorrigee && (
                          <div className="text-[10px] text-[var(--accent-primary)] font-semibold mt-1">Position corrigée</div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {total > rows.length && (
        <p className="text-xs text-[var(--text-secondary)] text-center">
          {rows.length} lignes affichées sur {total} — affinez la période pour voir le reste.
        </p>
      )}
    </div>
  );
}

function Carte({ icone, label, valeur, detail }: { icone: React.ReactNode; label: string; valeur: string; detail?: string }) {
  return (
    <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-primary)] p-3.5">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] opacity-70">
        <span className="text-[var(--accent-primary)]">{icone}</span> {label}
      </div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className="text-2xl font-black tabular-nums" style={{ color: "var(--accent-primary)" }}>{valeur}</span>
        {detail && <span className="text-xs font-bold text-[var(--text-secondary)]">{detail}</span>}
      </div>
    </div>
  );
}
