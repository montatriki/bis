"use client";
import { useState, useEffect } from "react";
import { Search, Printer, RotateCcw } from "lucide-react";
import type { FilterField } from "@/lib/erp-modules";

// Advanced filter bar (matches the external "Liste des réglements" filter row).
// Collects values locally, applies on "Afficher" (does not auto-refetch on each keystroke).
export default function FilterBar({ fields, sens, optionsQuery, accent, initial, periodeDispo, onApply, onPrint }: {
  fields: FilterField[]; sens?: string;
  /** Paramètres supplémentaires pour charger les listes déroulantes (ex. `nature=Vente`). */
  optionsQuery?: string;
  accent: string;
  /** Valeurs pré-remplies à l'ouverture (période par défaut, notamment). */
  initial?: Record<string, string>;
  /**
   * Bornes réelles de l'historique disponible. Affichées sous la barre : sans
   * cette indication, une période saisie hors plage renvoie une liste vide
   * sans que rien ne dise pourquoi.
   */
  periodeDispo?: { du: string; au: string } | null;
  onApply: (values: Record<string, string>) => void; onPrint: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(initial ?? {});
  const [options, setOptions] = useState<Record<string, string[]>>({});

  useEffect(() => {
    // load select options declared as "resource.field"
    const selects = fields.filter((f) => f.type === "select") as Extract<FilterField, { type: "select" }>[];
    const groups = [...new Set(selects.map((f) => f.optionsKey.split(".")[0]))];
    let cancelled = false;
    Promise.all(groups.map((g) => fetch(`/api/erp?resource=${g}${sens ? `&sens=${sens}` : ""}${optionsQuery ? `&${optionsQuery}` : ""}`).then((r) => r.json()).then((d) => [g, d] as const)))
      .then((results) => {
        if (cancelled) return;
        const opt: Record<string, string[]> = {};
        for (const f of selects) {
          const [grp, field] = f.optionsKey.split(".");
          const data = results.find(([g]) => g === grp)?.[1];
          opt[f.key] = (data?.[field] ?? []) as string[];
        }
        setOptions(opt);
      });
    return () => { cancelled = true; };
  }, [fields, sens, optionsQuery]);

  const set = (k: string, v: string) => setValues((p) => ({ ...p, [k]: v }));

  // Les raccourcis n'ont de sens que sur les écrans qui filtrent par période.
  const aPeriode = fields.some((f) => f.key === "dateDu") && fields.some((f) => f.key === "dateAu");
  // L'horloge n'est lue qu'à l'initialisation de l'état, jamais pendant le
  // rendu : les bornes resteraient sinon instables d'un rendu à l'autre.
  const [raccourcis] = useState(() => {
    const annee = new Date().getFullYear();
    return [
      // « Tout l'historique » vide les bornes plutôt que de les fixer : c'est
      // la seule valeur qui reste juste quand de nouvelles pièces sont saisies.
      { label: "Tout l'historique", du: "", au: "" },
      { label: `Année ${annee}`, du: `${annee}-01-01`, au: `${annee}-12-31` },
      { label: `Année ${annee - 1}`, du: `${annee - 1}-01-01`, au: `${annee - 1}-12-31` },
      { label: "30 derniers jours", du: new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10), au: `${annee}-12-31` },
    ];
  });
  // `2024-07-31` → `31/07/2024`, par découpage : construire une `Date` ici
  // serait à la fois impur et sensible au fuseau.
  const fmtJour = (v: string) => {
    const [a, m, j] = (v ?? "").split("-");
    return a && m && j ? `${j}/${m}/${a}` : v ?? "";
  };
  // Réinitialiser revient aux valeurs par défaut (période comprise), pas à un
  // écran sans filtre : c'est le comportement de l'ERP d'origine.
  const reset = () => { setValues(initial ?? {}); onApply(initial ?? {}); };

  return (
    <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-primary)] shadow-sm p-3">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
        {fields.map((f) => (
          <label key={f.key} className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide truncate">{f.label}</span>
            {f.type === "select" ? (
              <select value={values[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)}
                className="px-2.5 py-1.5 text-sm bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg focus:outline-none">
                <option value="">Tous</option>
                {(options[f.key] ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : (
              <input type={f.type === "date" ? "date" : f.type === "number" ? "number" : "text"} step="any"
                value={values[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)}
                className="px-2.5 py-1.5 text-sm bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg focus:outline-none" />
            )}
          </label>
        ))}
      </div>
      {/* Raccourcis de période : l'historique repris couvre plusieurs
          exercices, et saisir deux dates à la main pour cadrer une liste est
          le geste le plus fréquent de ces écrans. */}
      {aPeriode && (
        <div className="flex items-center flex-wrap gap-2 mt-2.5">
          <span className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide">Période</span>
          {raccourcis.map((r) => (
            <button key={r.label} type="button"
              onClick={() => { const v = { ...values, dateDu: r.du, dateAu: r.au }; setValues(v); onApply(v); }}
              className="px-2.5 py-1 rounded-lg text-xs border border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-[var(--accent-light)]">
              {r.label}
            </button>
          ))}
          {periodeDispo?.du && (
            <span className="text-[11px] text-[var(--text-secondary)] opacity-70">
              Données disponibles du {fmtJour(periodeDispo.du)} au {fmtJour(periodeDispo.au)}
            </span>
          )}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 mt-3">
        <button onClick={reset} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-[var(--accent-light)]"><RotateCcw size={14} /> Réinitialiser</button>
        <button onClick={onPrint} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-amber-500 text-white font-medium hover:bg-amber-600"><Printer size={14} /> Imprimer</button>
        <button onClick={() => onApply(values)} className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm text-white font-medium" style={{ background: accent }}><Search size={14} /> Afficher</button>
      </div>
    </div>
  );
}
