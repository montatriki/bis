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
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 print:bg-white print:p-0"
      onClick={onClose}>
      {/* Feuille glissante sur mobile, carte centrée sur bureau. `dvh` et non
          `vh` : la barre d'adresse mobile rognait l'en-tête. */}
      <div onClick={(e) => e.stopPropagation()}
        className="bg-[var(--bg-card)] shadow-2xl w-full sm:max-w-4xl
                   max-h-[92dvh] sm:max-h-[88vh] rounded-t-3xl sm:rounded-2xl
                   flex flex-col overflow-hidden print:shadow-none print:max-w-none print:max-h-none">

        <div className="sm:hidden pt-2.5 pb-1 flex justify-center shrink-0 print:hidden">
          <span className="h-1 w-10 rounded-full bg-[var(--text-secondary)]/25" />
        </div>

        <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-[var(--border-primary)] shrink-0">
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
            <button onClick={() => window.print()} title="Imprimer"
              className="h-9 px-2.5 sm:px-3 rounded-xl text-xs font-semibold border border-[var(--border-primary)]
                         text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)]
                         transition flex items-center gap-1.5">
              <Printer size={14} /> <span className="hidden sm:inline">Imprimer</span>
            </button>
            <button onClick={onClose} aria-label="Fermer"
              className="w-9 h-9 rounded-xl flex items-center justify-center text-[var(--text-secondary)]
                         hover:bg-[var(--accent-light)] hover:text-[var(--text-primary)] transition">
              <X size={17} />
            </button>
          </div>
        </div>

        {/* Mobile : sept colonnes serrées sur 390 px sont illisibles — une
            carte par famille, avec les chiffres en grille de deux. */}
        <div className="sm:hidden flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-2 print:hidden">
          {load && (
            <div className="py-10 text-center text-[var(--text-secondary)]">
              <Loader2 className="animate-spin inline" size={18} />
            </div>
          )}
          {!load && (data?.rows.length ?? 0) === 0 && (
            <div className="py-10 text-center text-sm text-[var(--text-secondary)]">
              Aucun article dans cette catégorie.
            </div>
          )}
          {data?.rows.map((r) => {
            const part = total > 0 ? (r.valeurVente / total) * 100 : 0;
            const cliquable = data.niveau === "famille";
            return (
              <button key={r.code} onClick={() => cliquable && setFamille(r.code)}
                disabled={!cliquable}
                className="w-full text-left rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-primary)]
                           p-3 transition disabled:cursor-default enabled:hover:border-[var(--accent-primary)]/30">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-[13px] text-[var(--text-primary)] truncate">
                    {r.libelle === r.code ? `Sans libellé (${r.code})` : r.libelle}
                  </span>
                  <span className="flex items-center gap-1 shrink-0 text-[11px] font-bold" style={{ color: accent }}>
                    {part.toFixed(1)} %
                    {cliquable && <ChevronRight size={13} className="opacity-40" />}
                  </span>
                </div>

                <div className="mt-1.5 h-1.5 rounded-full bg-[var(--bg-card)] overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${part}%`, background: accent }} />
                </div>

                <div className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
                  <Chiffre label="Articles" valeur={fmt(r.nbArticles)} />
                  <Chiffre label="Quantité" valeur={fmtQ(r.quantite)} />
                  <Chiffre label="Valeur achat" valeur={fmt(r.valeurAchat)} />
                  <Chiffre label="Valeur vente" valeur={fmt(r.valeurVente)} fort />
                  <Chiffre label="Marge potentielle"
                    valeur={fmt(r.margePotentielle)}
                    // Une marge négative n'est pas un détail : elle se voit.
                    classe={r.margePotentielle < 0 ? "text-red-600" : "text-emerald-600"} />
                </div>
              </button>
            );
          })}
        </div>

        <div className="hidden sm:block flex-1 min-h-0 overflow-auto print:max-h-none print:block">
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
                    <td className={`px-3 py-2 text-right font-semibold ${r.margePotentielle < 0 ? "text-red-600" : "text-emerald-600"}`}>
                      {fmt(r.margePotentielle)}
                    </td>
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

        {/* Les totaux d'abord : c'est ce qu'on vient chercher. La note
            explicative passe dessous sur mobile plutôt que de les comprimer.
            `env(safe-area-inset-bottom)` réserve la zone du geste iOS. */}
        <div className="px-4 sm:px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-3
                        border-t border-[var(--border-primary)] bg-[var(--bg-card)] shrink-0
                        flex flex-col-reverse sm:flex-row sm:items-center gap-3 sm:justify-between">
          <div className="text-[11px] leading-snug text-[var(--text-secondary)] sm:max-w-md">
            Valorisation du stock disponible (les quantités négatives sont ignorées).
            Le détail des ventes par article n&apos;est pas disponible : l&apos;import ne contient
            que les en-têtes de documents.
          </div>
          <div className="flex items-end justify-between sm:justify-end gap-5 sm:text-right shrink-0">
            <div>
              <div className="text-[9px] font-bold uppercase tracking-wide text-[var(--text-secondary)] opacity-75">Valeur achat</div>
              <div className="text-sm font-bold tabular-nums whitespace-nowrap">{fmt(data?.totaux.valeurAchat)} TND</div>
            </div>
            <div>
              <div className="text-[9px] font-bold uppercase tracking-wide text-[var(--text-secondary)] opacity-75">Valeur vente</div>
              <div className="text-base sm:text-sm font-black tabular-nums whitespace-nowrap" style={{ color: accent }}>
                {fmt(data?.totaux.valeurVente)} TND
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Libellé et valeur d'un chiffre, dans les cartes de la vue mobile. */
function Chiffre({ label, valeur, fort, classe }: {
  label: string; valeur: string; fort?: boolean; classe?: string;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[9px] font-bold uppercase tracking-wide text-[var(--text-secondary)] opacity-70">{label}</div>
      <div className={`tabular-nums truncate ${fort ? "font-black text-[var(--text-primary)]" : "font-semibold"} ${classe ?? ""}`}>
        {valeur}
      </div>
    </div>
  );
}
