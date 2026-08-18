"use client";
import { useCallback, useEffect, useState } from "react";
import { X, Loader2, ChevronRight, ArrowLeft, Layers, Printer } from "lucide-react";

// Valorisation du stock par famille puis sous-famille d'articles.
//
// Les articles ne portent qu'un code numérique de famille ; les libellés
// viennent de `RefTable` (kind = famille-art / sousfamille-art), repris du
// référentiel `fam_art` / `sous_fam_art` de l'ERP d'origine.
//
// On expose la **valorisation du stock** et non le CA vendu : l'import ne
// contient que des en-têtes de documents (14 lignes de vente pour 5 008
// documents), ventiler le CA par famille donnerait un chiffre trompeur.

type Ligne = {
  code: string; libelle: string; nbArticles: number;
  quantite: number; valeurAchat: number; valeurVente: number; margePotentielle: number;
};
type Reponse = {
  niveau: "famille" | "sousFamille";
  famille: string | null; familleLibelle: string | null;
  rows: Ligne[];
  totaux: { nbArticles: number; valeurAchat: number; valeurVente: number };
};

const fmt = (v: unknown) =>
  new Intl.NumberFormat("fr-TN", { maximumFractionDigits: 0 }).format(Number(v) || 0);
const fmtQ = (v: unknown) =>
  new Intl.NumberFormat("fr-TN", { maximumFractionDigits: 2 }).format(Number(v) || 0);

export default function ValorisationFamilles({
  accent, onClose,
}: { accent: string; onClose: () => void }) {
  const [famille, setFamille] = useState<string | null>(null);
  const [data, setData] = useState<Reponse | null>(null);
  const [load, setLoad] = useState(true);

  const charger = useCallback(() => {
    const qs = new URLSearchParams({ resource: "familles" });
    if (famille) qs.set("famille", famille);
    Promise.resolve()
      .then(() => setLoad(true))
      .then(() => fetch(`/api/erp?${qs}`))
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoad(false));
  }, [famille]);

  useEffect(charger, [charger]);

  const total = data?.totaux.valeurVente ?? 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto print:bg-white print:p-0">
      <div className="bg-[var(--bg-card)] rounded-2xl shadow-2xl w-full max-w-4xl my-4 flex flex-col print:shadow-none print:max-w-none">

        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-primary)]">
          <div className="flex items-center gap-2 min-w-0">
            {famille && (
              <button onClick={() => setFamille(null)} title="Retour aux familles"
                className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--accent-light)] print:hidden">
                <ArrowLeft size={16} />
              </button>
            )}
            <Layers size={17} style={{ color: accent }} />
            <div className="min-w-0">
              <div className="font-bold text-[var(--text-primary)] text-sm truncate">
                {data?.familleLibelle
                  ? `Sous-familles de « ${data.familleLibelle} »`
                  : "Valorisation du stock par famille"}
              </div>
              <div className="text-[var(--text-secondary)] text-[11px]">
                Valeur du stock au tarif de vente — {fmt(data?.totaux.nbArticles)} article(s)
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

        <div className="overflow-x-auto max-h-[58vh] print:max-h-none">
          <table className="w-full text-xs">
            <thead className="bg-[var(--bg-primary)] sticky top-0">
              <tr className="text-[var(--text-secondary)] uppercase text-[10px]">
                <th className="px-3 py-2 text-left">{data?.niveau === "sousFamille" ? "Sous-famille" : "Famille"}</th>
                <th className="px-3 py-2 text-right">Articles</th>
                <th className="px-3 py-2 text-right">Quantité</th>
                <th className="px-3 py-2 text-right">Valeur achat</th>
                <th className="px-3 py-2 text-right">Valeur vente</th>
                <th className="px-3 py-2 text-right">Marge pot.</th>
                <th className="px-3 py-2 w-28">Part</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-primary)]">
              {load && (
                <tr><td colSpan={7} className="px-3 py-10 text-center text-[var(--text-secondary)]">
                  <Loader2 className="animate-spin inline" size={18} />
                </td></tr>
              )}
              {!load && (data?.rows.length ?? 0) === 0 && (
                <tr><td colSpan={7} className="px-3 py-10 text-center text-[var(--text-secondary)]">
                  Aucun article dans cette catégorie.
                </td></tr>
              )}
              {data?.rows.map((r) => {
                const part = total > 0 ? (r.valeurVente / total) * 100 : 0;
                // Le clic descend au niveau sous-famille (uniquement depuis
                // le niveau famille).
                const cliquable = data.niveau === "famille";
                return (
                  <tr key={r.code}
                    onClick={() => cliquable && setFamille(r.code)}
                    className={`hover:bg-[var(--accent-light)]/40 ${cliquable ? "cursor-pointer" : ""}`}>
                    <td className="px-3 py-2 font-semibold text-[var(--text-primary)]">
                      <span className="flex items-center gap-1.5">
                        {/* Douze sous-familles (codes 31 à 43) ont été créées
                            après l'export du référentiel : elles n'ont pas de
                            libellé, on affiche le code plutôt qu'un vide. */}
                        {r.libelle === r.code ? `Sans libellé (${r.code})` : r.libelle}
                        {cliquable && <ChevronRight size={12} className="opacity-40 print:hidden" />}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">{fmt(r.nbArticles)}</td>
                    <td className="px-3 py-2 text-right">{fmtQ(r.quantite)}</td>
                    <td className="px-3 py-2 text-right">{fmt(r.valeurAchat)}</td>
                    <td className="px-3 py-2 text-right font-bold">{fmt(r.valeurVente)}</td>
                    <td className="px-3 py-2 text-right text-emerald-600">{fmt(r.margePotentielle)}</td>
                    <td className="px-3 py-2">
                      <div className="h-1.5 rounded-full bg-[var(--bg-primary)] overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${part}%`, background: accent }} />
                      </div>
                      <div className="text-[9px] text-[var(--text-secondary)] mt-0.5 text-right">
                        {part.toFixed(1)} %
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3 border-t border-[var(--border-primary)] flex flex-wrap items-center gap-4 justify-between">
          <div className="text-[11px] text-[var(--text-secondary)] max-w-md">
            Valorisation du stock disponible (les quantités négatives sont ignorées).
            Le détail des ventes par article n&apos;est pas disponible : l&apos;import ne contient
            que les en-têtes de documents.
          </div>
          <div className="flex gap-5 text-right">
            <div>
              <div className="text-[9px] font-bold uppercase text-[var(--text-secondary)]">Valeur achat</div>
              <div className="text-sm font-bold tabular-nums">{fmt(data?.totaux.valeurAchat)} TND</div>
            </div>
            <div>
              <div className="text-[9px] font-bold uppercase text-[var(--text-secondary)]">Valeur vente</div>
              <div className="text-sm font-black tabular-nums" style={{ color: accent }}>
                {fmt(data?.totaux.valeurVente)} TND
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
