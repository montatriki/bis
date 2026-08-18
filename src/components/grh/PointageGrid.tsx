"use client";
import { useState, useEffect, useCallback } from "react";
import { Loader2, Save, RefreshCw, CalendarDays } from "lucide-react";

type Row = Record<string, unknown>;
const sv = (v: unknown) => (v == null ? "" : String(v));
const n = (v: unknown) => (v == null || v === "" ? 0 : Number(v)) || 0;

type Line = {
  codeEmploye: string;
  nom: string;
  regime: string;
  presenceJ: number; presenceH: number;
  ferieJ: number; ferieH: number;
  congeJ: number; congeH: number;
  absenceJ: number; absenceH: number;
  hSupp: number;
  dirty: boolean;
};

/**
 * Grille de pointage mensuel.
 * Comme dans l'ERP source, le régime de l'employé décide des colonnes actives :
 * régime M (mensuel) => jours, régime H (horaire) => heures.
 */
export default function PointageGrid({ accent, onFlash }: { accent: string; onFlash: (m: string) => void }) {
  const [sessions, setSessions] = useState<Row[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/grh?resource=sessions").then((r) => r.json()).then((d) => {
      if (cancelled) return;
      setSessions(d.rows ?? []);
      if (d.rows?.[0]) setSessionId(String(d.rows[0].id));
      setLoading(false);
    }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Construit les lignes de la grille : un employé actif = une ligne, pré-remplie
  // avec le pointage existant ou, à défaut, un mois complet (comme dans A).
  const buildLines = useCallback((pers: Row[], pts: Row[], sid: string): Line[] => {
    const byCode = new Map<string, Row>(pts.map((p) => [sv(p.codeEmploye), p]));
    const session = sessions.find((s) => String(s.id) === sid);
    const defJ = n(session?.nJours) || 26;

    return pers.map((e) => {
      const p = byCode.get(sv(e.codeEmploye));
      const regime = sv(e.traitement) === "H" ? "H" : "M";
      return {
        codeEmploye: sv(e.codeEmploye),
        nom: `${sv(e.nom)} ${sv(e.prenom)}`.trim(),
        regime,
        presenceJ: p ? n(p.presenceJ) : regime === "M" ? defJ : 0,
        presenceH: p ? n(p.presenceH) : regime === "H" ? n(session?.nHeures) : 0,
        ferieJ: n(p?.ferieJ), ferieH: n(p?.ferieH),
        congeJ: n(p?.congeJ), congeH: n(p?.congeH),
        absenceJ: n(p?.absenceJ), absenceH: n(p?.absenceH),
        hSupp: n(p?.hSupp),
        dirty: !p,
      };
    });
  }, [sessions]);

  const fetchGrid = useCallback(
    (sid: string) =>
      Promise.all([
        fetch("/api/grh?resource=personnel&actif=1").then((r) => r.json()),
        fetch(`/api/grh?resource=pointage&sessionId=${sid}`).then((r) => r.json()),
      ]),
    []
  );

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    fetchGrid(sessionId)
      .then(([pers, pts]) => {
        if (cancelled) return;
        setLines(buildLines(pers.rows ?? [], pts.rows ?? [], sessionId));
        setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [sessionId, fetchGrid, buildLines]);

  const reload = useCallback(() => {
    setLoading(true);
    fetchGrid(sessionId)
      .then(([pers, pts]) => { setLines(buildLines(pers.rows ?? [], pts.rows ?? [], sessionId)); setLoading(false); })
      .catch(() => setLoading(false));
  }, [sessionId, fetchGrid, buildLines]);

  function patch(code: string, field: keyof Line, value: number) {
    setLines((ls) => ls.map((l) => (l.codeEmploye === code ? { ...l, [field]: value, dirty: true } : l)));
  }

  async function saveAll() {
    const dirty = lines.filter((l) => l.dirty);
    if (dirty.length === 0) return onFlash("Aucune modification à enregistrer");
    setBusy(true);
    let ok = 0;
    for (const l of dirty) {
      const r = await fetch("/api/grh?resource=pointage", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...l, sessionId: Number(sessionId) }),
      }).then((x) => x.json()).catch(() => ({ ok: false }));
      if (r.ok) ok++;
    }
    setBusy(false);
    setLines((ls) => ls.map((l) => ({ ...l, dirty: false })));
    onFlash(`${ok} pointage(s) enregistré(s)`);
  }

  if (loading && sessions.length === 0) {
    return <div className="py-10 text-center text-[var(--text-secondary)]"><Loader2 className="animate-spin inline" size={18} /></div>;
  }

  if (sessions.length === 0) {
    return (
      <div className="p-6 rounded-xl border border-dashed border-[var(--border-primary)] text-center text-sm text-[var(--text-secondary)]">
        Aucune session de paie. Créez-en une dans l&apos;onglet <b>Paramètres</b> avant de saisir le pointage.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <CalendarDays size={16} style={{ color: accent }} />
        <select value={sessionId} onChange={(e) => { setLoading(true); setSessionId(e.target.value); }}
          className="px-3 py-2 text-sm bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl">
          {sessions.map((s) => <option key={sv(s.id)} value={sv(s.id)}>{sv(s.libelle)}</option>)}
        </select>
        <button onClick={reload}
          className="p-2 rounded-xl border border-[var(--border-primary)] text-[var(--text-secondary)]"><RefreshCw size={15} /></button>
        <button onClick={saveAll} disabled={busy}
          className="flex items-center gap-1.5 text-white px-3 py-2 rounded-xl text-sm font-medium disabled:opacity-50 ml-auto" style={{ background: accent }}>
          {busy ? <Loader2 className="animate-spin" size={15} /> : <Save size={15} />} Enregistrer le pointage
        </button>
      </div>

      <div className="overflow-auto rounded-xl border border-[var(--border-primary)] max-h-[60vh]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--bg-primary)] border-b border-[var(--border-primary)] sticky top-0 z-10">
            <tr className="text-[11px] uppercase tracking-wide text-[var(--text-secondary)]">
              <th className="px-3 py-2.5 text-left font-semibold">Employé</th>
              <th className="px-2 py-2.5 text-center font-semibold">Régime</th>
              <th className="px-2 py-2.5 text-right font-semibold w-24">Présence</th>
              <th className="px-2 py-2.5 text-right font-semibold w-24">Congé</th>
              <th className="px-2 py-2.5 text-right font-semibold w-24">Férié</th>
              <th className="px-2 py-2.5 text-right font-semibold w-24">Absence</th>
              <th className="px-2 py-2.5 text-right font-semibold w-24">H. supp</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="py-10 text-center text-[var(--text-secondary)]"><Loader2 className="animate-spin inline" size={18} /></td></tr>}
            {!loading && lines.length === 0 && (
              <tr><td colSpan={7} className="py-10 text-center text-[var(--text-secondary)] text-sm">Aucun employé actif à pointer.</td></tr>
            )}
            {!loading && lines.map((l) => {
              const h = l.regime === "H";
              return (
                <tr key={l.codeEmploye} className={`border-b border-[var(--border-primary)]/60 ${l.dirty ? "bg-amber-500/5" : ""}`}>
                  <td className="px-3 py-1.5">
                    <div className="font-medium text-[var(--text-primary)]">{l.nom}</div>
                    <div className="text-[10px] font-mono text-[var(--text-secondary)]">{l.codeEmploye}</div>
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-[var(--accent-light)] text-[var(--accent-primary)]">
                      {h ? "Horaire" : "Mensuel"}
                    </span>
                  </td>
                  <Cell value={h ? l.presenceH : l.presenceJ} onChange={(v) => patch(l.codeEmploye, h ? "presenceH" : "presenceJ", v)} suffix={h ? "h" : "j"} />
                  <Cell value={h ? l.congeH : l.congeJ} onChange={(v) => patch(l.codeEmploye, h ? "congeH" : "congeJ", v)} suffix={h ? "h" : "j"} />
                  <Cell value={h ? l.ferieH : l.ferieJ} onChange={(v) => patch(l.codeEmploye, h ? "ferieH" : "ferieJ", v)} suffix={h ? "h" : "j"} />
                  <Cell value={h ? l.absenceH : l.absenceJ} onChange={(v) => patch(l.codeEmploye, h ? "absenceH" : "absenceJ", v)} suffix={h ? "h" : "j"} />
                  <Cell value={l.hSupp} onChange={(v) => patch(l.codeEmploye, "hSupp", v)} suffix="h" />
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-[var(--text-secondary)]">
        Les lignes modifiées apparaissent en jaune. Le régime de l&apos;employé détermine si la saisie est en jours ou en heures.
      </p>
    </div>
  );
}

function Cell({ value, onChange, suffix }: { value: number; onChange: (v: number) => void; suffix: string }) {
  return (
    <td className="px-2 py-1.5">
      <div className="relative">
        <input type="number" step="any" value={String(value)}
          onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
          className="w-full px-2 py-1 pr-5 text-right bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-md focus:outline-none tabular-nums" />
        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-[var(--text-secondary)] pointer-events-none">{suffix}</span>
      </div>
    </td>
  );
}
