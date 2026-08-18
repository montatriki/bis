"use client";
import { useCallback, useEffect, useState } from "react";
import { X, Printer, Search, Loader2, ArrowRightLeft } from "lucide-react";

// Mouvements d'un article — écran « Mouvements » de la fiche produit de l'ERP
// d'origine (`products-management/ProductsMouvements.js`).
//
// Colonnes et totaux repris à l'identique : chaque ligne est une entrée ou une
// sortie datée, avec le stock résultant, et le bas d'écran récapitule
// stock de départ / entrées / sorties / stock final sur la période.

type Ligne = {
  num: number; id: number; date: string; document: string | null;
  libelle: string | null; tiers: string | null;
  entrer: number; sortie: number; stock: number;
  puHt: number; valeurHt: number; valeurTtc: number;
  utilisateur: string | null; depot: string | null; typeDoc: string | null; sens: string;
};
type Totaux = { stockDepart: number; entrees: number; sorties: number; stockFinal: number; valeurHt: number };

const fmt = (v: unknown) =>
  new Intl.NumberFormat("fr-TN", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(Number(v) || 0);
const fmtQ = (v: unknown) => new Intl.NumberFormat("fr-TN", { maximumFractionDigits: 3 }).format(Number(v) || 0);
const fmtD = (v: unknown) =>
  v ? new Date(String(v)).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

/** Année civile en cours, période par défaut de l'écran d'origine. */
const anneeCourante = () => {
  const a = new Date().getFullYear();
  return { du: `${a}-01-01`, au: `${a}-12-31` };
};

export default function ArticleMouvements({
  refArt, designation, accent, onClose,
}: {
  refArt: string; designation?: string; accent: string; onClose: () => void;
}) {
  const [periode, setPeriode] = useState(anneeCourante);
  const [depot, setDepot] = useState("");
  const [depots, setDepots] = useState<{ code: string; label: string }[]>([]);
  const [rows, setRows] = useState<Ligne[]>([]);
  const [totaux, setTotaux] = useState<Totaux | null>(null);
  const [load, setLoad] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(() => {
    const qs = new URLSearchParams({ vue: "article", refArt, du: periode.du, au: periode.au });
    if (depot) qs.set("depot", depot);
    // `setLoad` est appelé dans la chaîne asynchrone : un setState synchrone
    // dans le corps de l'effet déclencherait un rendu en cascade.
    Promise.resolve()
      .then(() => setLoad(true))
      .then(() => fetch(`/api/mouvements-depot?${qs}`))
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setErreur(d.error); return; }
        setRows(d.rows ?? []);
        setTotaux(d.totaux ?? null);
        setErreur(null);
      })
      .catch(() => setErreur("Chargement impossible"))
      .finally(() => setLoad(false));
  }, [refArt, periode, depot]);

  useEffect(charger, [charger]);

  // Emplacements disponibles pour le filtre dépôt.
  useEffect(() => {
    fetch("/api/mouvements-depot?vue=emplacements")
      .then((r) => r.json())
      .then((d) => setDepots([...(d.depots ?? []), ...(d.vehicules ?? [])]))
      .catch(() => {});
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto print:bg-white print:p-0">
      <div className="bg-[var(--bg-card)] rounded-2xl shadow-2xl w-full max-w-6xl my-4 flex flex-col print:shadow-none print:max-w-none">

        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-primary)] print:hidden">
          <div className="flex items-center gap-2 min-w-0">
            <ArrowRightLeft size={17} style={{ color: accent }} />
            <div className="min-w-0">
              <div className="font-bold text-[var(--text-primary)] text-sm truncate">
                Mouvements : {refArt}
              </div>
              {designation && (
                <div className="text-[var(--text-secondary)] text-xs truncate">{designation}</div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
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

        {/* Filtres : dépôt + période, comme l'écran d'origine. */}
        <div className="px-5 py-3 border-b border-[var(--border-primary)] grid grid-cols-2 md:grid-cols-4 gap-2.5 print:hidden">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase text-[var(--text-secondary)]">Dépôt</span>
            <select value={depot} onChange={(e) => setDepot(e.target.value)}
              className="px-2.5 py-1.5 text-sm bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg">
              <option value="">Tous les dépôts</option>
              {depots.map((d) => <option key={d.code} value={d.code}>{d.label || d.code}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase text-[var(--text-secondary)]">Période du</span>
            <input type="date" value={periode.du} onChange={(e) => setPeriode((p) => ({ ...p, du: e.target.value }))}
              className="px-2.5 py-1.5 text-sm bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase text-[var(--text-secondary)]">Période au</span>
            <input type="date" value={periode.au} min={periode.du}
              onChange={(e) => setPeriode((p) => ({ ...p, au: e.target.value }))}
              className="px-2.5 py-1.5 text-sm bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg" />
          </label>
          <button onClick={charger}
            className="self-end px-4 py-1.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-1.5"
            style={{ background: accent }}>
            <Search size={14} /> Afficher
          </button>
        </div>

        <div className="overflow-x-auto max-h-[52vh] print:max-h-none print:overflow-visible">
          <table className="w-full text-xs">
            <thead className="bg-[var(--bg-primary)] sticky top-0">
              <tr className="text-[var(--text-secondary)] uppercase text-[10px]">
                <th className="px-2 py-2 text-left">N°</th>
                <th className="px-2 py-2 text-left">Date</th>
                <th className="px-2 py-2 text-left">Document</th>
                <th className="px-2 py-2 text-left">Libellé</th>
                <th className="px-2 py-2 text-left">Tiers</th>
                <th className="px-2 py-2 text-right">Entrer</th>
                <th className="px-2 py-2 text-right">Sortie</th>
                <th className="px-2 py-2 text-right">Stock</th>
                <th className="px-2 py-2 text-right">PU HT</th>
                <th className="px-2 py-2 text-right">Valeur HT</th>
                <th className="px-2 py-2 text-right">Valeur TTC</th>
                <th className="px-2 py-2 text-left">Utilisateur</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-primary)]">
              {load && (
                <tr><td colSpan={12} className="px-3 py-10 text-center text-[var(--text-secondary)]">
                  <Loader2 className="animate-spin inline" size={18} />
                </td></tr>
              )}
              {!load && erreur && (
                <tr><td colSpan={12} className="px-3 py-10 text-center text-red-600">{erreur}</td></tr>
              )}
              {!load && !erreur && rows.length === 0 && (
                <tr><td colSpan={12} className="px-3 py-10 text-center text-[var(--text-secondary)]">
                  Aucun mouvement sur cette période.
                </td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-[var(--accent-light)]/40">
                  <td className="px-2 py-1.5 text-[var(--text-secondary)]">{r.num}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap">{fmtD(r.date)}</td>
                  <td className="px-2 py-1.5 font-mono">{r.document ?? "—"}</td>
                  <td className="px-2 py-1.5 truncate max-w-[160px]">{r.libelle ?? "—"}</td>
                  <td className="px-2 py-1.5 truncate max-w-[160px]">{r.tiers ?? "—"}</td>
                  <td className="px-2 py-1.5 text-right text-emerald-600 font-semibold">
                    {r.entrer > 0 ? fmtQ(r.entrer) : ""}
                  </td>
                  <td className="px-2 py-1.5 text-right text-red-600 font-semibold">
                    {r.sortie > 0 ? fmtQ(r.sortie) : ""}
                  </td>
                  <td className="px-2 py-1.5 text-right font-bold">{fmtQ(r.stock)}</td>
                  <td className="px-2 py-1.5 text-right">{fmt(r.puHt)}</td>
                  <td className="px-2 py-1.5 text-right">{fmt(r.valeurHt)}</td>
                  <td className="px-2 py-1.5 text-right">{fmt(r.valeurTtc)}</td>
                  <td className="px-2 py-1.5 truncate max-w-[110px]">{r.utilisateur ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Récapitulatif : les quatre totaux du bas de l'écran d'origine. */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 px-5 py-4 border-t border-[var(--border-primary)]">
          <Total label="Stock départ" valeur={fmtQ(totaux?.stockDepart ?? 0)} />
          <Total label="Entrer" valeur={fmtQ(totaux?.entrees ?? 0)} couleur="text-emerald-600" />
          <Total label="Sortie" valeur={fmtQ(totaux?.sorties ?? 0)} couleur="text-red-600" />
          <Total label="Stock final" valeur={fmtQ(totaux?.stockFinal ?? 0)} gras />
        </div>
      </div>
    </div>
  );
}

function Total({ label, valeur, couleur, gras }: { label: string; valeur: string; couleur?: string; gras?: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)]/50 px-3 py-2">
      <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">{label}</div>
      <div className={`text-sm ${gras ? "font-black" : "font-bold"} ${couleur ?? "text-[var(--text-primary)]"} tabular-nums`}>
        {valeur}
      </div>
    </div>
  );
}
