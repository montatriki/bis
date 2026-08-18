"use client";
import { useCallback, useEffect, useState } from "react";
import { X, Loader2, ChevronRight, ArrowLeft, Truck, Printer } from "lucide-react";

// Détail des achats — fenêtre ouverte depuis la carte « Achats » du tableau
// de bord.
//
// Trois axes de lecture : par fournisseur, par mois, par type de document.
// Un clic sur une ligne montre les documents qui la composent.
//
// Le total porte sur les **bons de réception (BRE)**, seuls documents qui
// matérialisent une entrée réelle de marchandise — c'est la règle appliquée
// partout ailleurs (cf. /api/synthese). L'axe « type » élargit à tous les
// documents d'achat pour montrer la répartition complète.

type Groupe = { libelle: string; nb: number; montant: number; montantHt: number };
type Doc = { refDoc: string; typeDoc: string | null; dateDoc: string | null; libelle: string; montant: number };
type Reponse = {
  axe: string; niveau: "groupes" | "documents"; cible?: string;
  rows: (Groupe | Doc)[];
  totaux: { nb: number; montant: number; montantHt?: number };
};

const fmt = (v: unknown) => new Intl.NumberFormat("fr-TN", { maximumFractionDigits: 0 }).format(Number(v) || 0);
const fmtD = (v: unknown) => (v ? new Date(String(v)).toLocaleDateString("fr-FR") : "—");

const AXES = [
  { v: "fournisseur", l: "Par fournisseur" },
  { v: "mois", l: "Par mois" },
  { v: "type", l: "Par type de document" },
] as const;

/** Libellé lisible d'un mois « 2026-06 ». */
const MOIS = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
const libMois = (s: string) => {
  const m = /^(\d{4})-(\d{2})$/.exec(s);
  return m ? `${MOIS[Number(m[2]) - 1]} ${m[1]}` : s;
};

export default function DetailAchats({ accent, onClose }: { accent: string; onClose: () => void }) {
  const [axe, setAxe] = useState<string>("fournisseur");
  const [cible, setCible] = useState<string | null>(null);
  const [data, setData] = useState<Reponse | null>(null);
  const [load, setLoad] = useState(true);

  const charger = useCallback(() => {
    const qs = new URLSearchParams({ resource: "achats-detail", axe });
    if (cible) qs.set("cible", cible);
    Promise.resolve()
      .then(() => setLoad(true))
      .then(() => fetch(`/api/erp?${qs}`))
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoad(false));
  }, [axe, cible]);

  useEffect(charger, [charger]);

  const total = data?.totaux.montant ?? 0;
  const enDetail = data?.niveau === "documents";

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto print:bg-white print:p-0">
      <div className="bg-[var(--bg-card)] rounded-2xl shadow-2xl w-full max-w-4xl my-4 flex flex-col print:shadow-none print:max-w-none">

        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-primary)]">
          <div className="flex items-center gap-2 min-w-0">
            {enDetail && (
              <button onClick={() => setCible(null)} title="Retour"
                className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--accent-light)] print:hidden">
                <ArrowLeft size={16} />
              </button>
            )}
            <Truck size={17} style={{ color: accent }} />
            <div className="min-w-0">
              <div className="font-bold text-[var(--text-primary)] text-sm truncate">
                {enDetail
                  ? `Documents — ${axe === "mois" ? libMois(String(cible)) : cible}`
                  : "Détail des achats"}
              </div>
              <div className="text-[var(--text-secondary)] text-[11px]">
                {fmt(data?.totaux.nb)} document(s) · bons de réception
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 print:hidden">
            <button onClick={() => window.print()}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--border-primary)] text-[var(--text-secondary)] flex items-center gap-1.5">
              <Printer size={13} /> Imprimer
            </button>
            <button onClick={onClose} aria-label="Fermer"
              className="p-2 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--accent-light)]">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Choix de l'axe — masqué quand on regarde le détail d'un groupe. */}
        {!enDetail && (
          <div className="px-5 py-2.5 border-b border-[var(--border-primary)] flex gap-2 print:hidden">
            {AXES.map((a) => (
              <button key={a.v} onClick={() => { setAxe(a.v); setCible(null); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  axe === a.v ? "text-white" : "text-[var(--text-secondary)] border border-[var(--border-primary)]"
                }`}
                style={axe === a.v ? { background: accent } : undefined}>
                {a.l}
              </button>
            ))}
          </div>
        )}

        <div className="overflow-x-auto max-h-[56vh] print:max-h-none">
          <table className="w-full text-xs">
            <thead className="bg-[var(--bg-primary)] sticky top-0">
              <tr className="text-[var(--text-secondary)] uppercase text-[10px]">
                {enDetail ? (
                  <>
                    <th className="px-3 py-2 text-left">Référence</th>
                    <th className="px-3 py-2 text-left">Type</th>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-left">Fournisseur</th>
                    <th className="px-3 py-2 text-right">Montant TTC</th>
                  </>
                ) : (
                  <>
                    <th className="px-3 py-2 text-left">
                      {axe === "fournisseur" ? "Fournisseur" : axe === "mois" ? "Mois" : "Type"}
                    </th>
                    <th className="px-3 py-2 text-right">Documents</th>
                    <th className="px-3 py-2 text-right">Montant HT</th>
                    <th className="px-3 py-2 text-right">Montant TTC</th>
                    <th className="px-3 py-2 w-28">Part</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-primary)]">
              {load && (
                <tr><td colSpan={5} className="px-3 py-10 text-center text-[var(--text-secondary)]">
                  <Loader2 className="animate-spin inline" size={18} />
                </td></tr>
              )}
              {!load && (data?.rows.length ?? 0) === 0 && (
                <tr><td colSpan={5} className="px-3 py-10 text-center text-[var(--text-secondary)]">
                  Aucun achat sur ce périmètre.
                </td></tr>
              )}

              {!load && enDetail && (data?.rows as Doc[] | undefined)?.map((d) => (
                <tr key={d.refDoc} className="hover:bg-[var(--accent-light)]/40">
                  <td className="px-3 py-2 font-mono font-semibold">{d.refDoc}</td>
                  <td className="px-3 py-2">{d.typeDoc ?? "—"}</td>
                  <td className="px-3 py-2">{fmtD(d.dateDoc)}</td>
                  <td className="px-3 py-2 truncate max-w-[240px]">{d.libelle}</td>
                  <td className="px-3 py-2 text-right font-bold">{fmt(d.montant)}</td>
                </tr>
              ))}

              {!load && !enDetail && (data?.rows as Groupe[] | undefined)?.map((g) => {
                const part = total > 0 ? (g.montant / total) * 100 : 0;
                return (
                  <tr key={g.libelle} onClick={() => setCible(g.libelle)}
                    className="hover:bg-[var(--accent-light)]/40 cursor-pointer">
                    <td className="px-3 py-2 font-semibold text-[var(--text-primary)]">
                      <span className="flex items-center gap-1.5">
                        {axe === "mois" ? libMois(g.libelle) : g.libelle}
                        <ChevronRight size={12} className="opacity-40 print:hidden" />
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">{fmt(g.nb)}</td>
                    <td className="px-3 py-2 text-right">{fmt(g.montantHt)}</td>
                    <td className="px-3 py-2 text-right font-bold">{fmt(g.montant)}</td>
                    <td className="px-3 py-2">
                      <div className="h-1.5 rounded-full bg-[var(--bg-primary)] overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${part}%`, background: accent }} />
                      </div>
                      <div className="text-[9px] text-[var(--text-secondary)] mt-0.5 text-right">{part.toFixed(1)} %</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3 border-t border-[var(--border-primary)] flex flex-wrap items-center justify-between gap-4">
          <div className="text-[11px] text-[var(--text-secondary)] max-w-md">
            Bons de réception uniquement : les factures reprennent souvent le même achat,
            les additionner le compterait deux fois.
            {" "}Le détail par article n&apos;est pas disponible — l&apos;import ne contient
            aucune ligne de document d&apos;achat.
          </div>
          <div className="flex gap-5 text-right">
            {data?.totaux.montantHt != null && (
              <div>
                <div className="text-[9px] font-bold uppercase text-[var(--text-secondary)]">Total HT</div>
                <div className="text-sm font-bold tabular-nums">{fmt(data.totaux.montantHt)} TND</div>
              </div>
            )}
            <div>
              <div className="text-[9px] font-bold uppercase text-[var(--text-secondary)]">Total TTC</div>
              <div className="text-sm font-black tabular-nums" style={{ color: accent }}>
                {fmt(data?.totaux.montant)} TND
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
