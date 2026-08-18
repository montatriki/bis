"use client";
import { useCallback, useEffect, useState } from "react";
import { X, Plus, Trash2, Loader2, Network, Calculator, Check, AlertTriangle } from "lucide-react";

// Nomenclature d'un article — écran « Nomenclature » de la fiche produit de
// l'ERP d'origine (`products-management/nomenclature.js`).
//
// La nomenclature liste les composants qui entrent dans la fabrication d'un
// article : référence, désignation, quantité et type (matière première,
// semi-fini, charge). Le bouton CBN calcule le besoin net à partir de là.

type LigneNom = {
  id: number; refArt: string; desArt: string | null;
  typeComposant: string; qte: number; numSequence: number;
};
type Nomenclature = {
  refArt: string; desArt: string | null; qteBase: number;
  elaboration: boolean; exploitation: boolean;
  lignes: LigneNom[];
};
type ArticleRef = { refArt: string; designation: string; unite: string | null };

const fmtQ = (v: unknown) => new Intl.NumberFormat("fr-TN", { maximumFractionDigits: 3 }).format(Number(v) || 0);

const TYPES = [
  { v: "MP", l: "Matière première" },
  { v: "SF", l: "Semi-fini" },
  { v: "CH", l: "Charge / consommable" },
];

export default function ArticleNomenclature({
  refArt, designation, accent, onClose,
}: {
  refArt: string; designation?: string; accent: string; onClose: () => void;
}) {
  const [nom, setNom] = useState<Nomenclature | null>(null);
  const [load, setLoad] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [articles, setArticles] = useState<ArticleRef[]>([]);
  const [ligne, setLigne] = useState({ refArt: "", qte: "", typeComposant: "MP" });
  const [cbn, setCbn] = useState<{ refArt: string; designation: string | null; besoinNet: number }[] | null>(null);

  const flash = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 4000); };

  const charger = useCallback(() => {
    // Idem : le chargement passe par la chaîne asynchrone pour éviter un
    // setState synchrone dans l'effet.
    Promise.resolve()
      .then(() => setLoad(true))
      .then(() => fetch(`/api/gpao?vue=nomenclature&refArt=${encodeURIComponent(refArt)}`))
      .then((r) => r.json())
      .then((d) => setNom(d.row ?? null))
      .catch(() => setNom(null))
      .finally(() => setLoad(false));
  }, [refArt]);

  useEffect(charger, [charger]);

  // Référentiel des composants sélectionnables.
  useEffect(() => {
    fetch("/api/catalogue?limit=500")
      .then((r) => r.json())
      .then((d) => setArticles(d.rows ?? []))
      .catch(() => {});
  }, []);

  /** Crée la nomenclature de l'article si elle n'existe pas encore. */
  async function creerNomenclature() {
    setBusy(true);
    const r = await fetch("/api/gpao", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vue: "nomenclature", refArt, desArt: designation, qteBase: 1 }),
    }).then((x) => x.json()).catch(() => ({ error: "réseau" }));
    setBusy(false);
    if (r.error) return flash(r.error, false);
    flash("Nomenclature créée");
    charger();
  }

  async function ajouterLigne() {
    if (!ligne.refArt) return flash("Choisissez un composant", false);
    const qte = Number(ligne.qte);
    if (!Number.isFinite(qte) || qte <= 0) return flash("Quantité invalide", false);
    // Un article ne peut pas se contenir lui-même : l'API refuse aussi les
    // cycles indirects, on évite juste l'aller-retour évident.
    if (ligne.refArt === refArt) return flash("Un article ne peut pas être son propre composant", false);

    setBusy(true);
    const r = await fetch("/api/gpao", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vue: "nomenclature-ligne", refNom: refArt, refArt: ligne.refArt, qte, typeComposant: ligne.typeComposant }),
    }).then((x) => x.json()).catch(() => ({ error: "réseau" }));
    setBusy(false);
    if (r.error) return flash(r.error, false);
    setLigne({ refArt: "", qte: "", typeComposant: "MP" });
    flash("Composant ajouté");
    charger();
  }

  async function supprimerLigne(id: number) {
    if (!confirm("Retirer ce composant de la nomenclature ?")) return;
    setBusy(true);
    const r = await fetch(`/api/gpao?vue=nomenclature-ligne&id=${id}`, { method: "DELETE" })
      .then((x) => x.json()).catch(() => ({ error: "réseau" }));
    setBusy(false);
    if (r.error) return flash(r.error, false);
    flash("Composant retiré");
    charger();
  }

  /** Calcul du besoin net pour une unité fabriquée. */
  async function calculerCbn() {
    setBusy(true);
    const r = await fetch(`/api/gpao?vue=cbn&refArt=${encodeURIComponent(refArt)}&quantite=1`)
      .then((x) => x.json()).catch(() => ({ error: "réseau" }));
    setBusy(false);
    if (r.error) return flash(r.error, false);
    setCbn(r.besoins ?? r.rows ?? []);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-[var(--bg-card)] rounded-2xl shadow-2xl w-full max-w-4xl my-4 flex flex-col">

        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-primary)]">
          <div className="flex items-center gap-2 min-w-0">
            <Network size={17} style={{ color: accent }} />
            <div className="min-w-0">
              <div className="font-bold text-[var(--text-primary)] text-sm truncate">Nomenclature : {refArt}</div>
              {designation && <div className="text-[var(--text-secondary)] text-xs truncate">{designation}</div>}
            </div>
          </div>
          <button onClick={onClose} aria-label="Fermer"
            className="p-2 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--accent-light)]">
            <X size={16} />
          </button>
        </div>

        {toast && (
          <div className={`mx-5 mt-3 px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2 ${
            toast.ok ? "bg-emerald-500/10 text-emerald-700" : "bg-red-500/10 text-red-600"}`}>
            {toast.ok ? <Check size={13} /> : <AlertTriangle size={13} />} {toast.msg}
          </div>
        )}

        {load ? (
          <div className="py-16 text-center text-[var(--text-secondary)]"><Loader2 className="animate-spin inline" size={20} /></div>
        ) : !nom ? (
          // Pas encore de nomenclature : on propose de la créer plutôt que
          // d'afficher un tableau vide sans issue.
          <div className="px-5 py-12 text-center">
            <Network size={30} className="mx-auto mb-3 text-[var(--text-secondary)] opacity-30" />
            <div className="text-sm text-[var(--text-secondary)] mb-4">
              Aucune nomenclature définie pour cet article.
            </div>
            <button onClick={creerNomenclature} disabled={busy}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: accent }}>
              Créer la nomenclature
            </button>
          </div>
        ) : (
          <>
            {/* Saisie d'un composant */}
            <div className="px-5 py-3 border-b border-[var(--border-primary)] grid grid-cols-2 md:grid-cols-4 gap-2.5">
              <label className="flex flex-col gap-1 md:col-span-2">
                <span className="text-[10px] font-semibold uppercase text-[var(--text-secondary)]">Composant</span>
                <select value={ligne.refArt} onChange={(e) => setLigne((l) => ({ ...l, refArt: e.target.value }))}
                  className="px-2.5 py-1.5 text-sm bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg">
                  <option value="">Choisir un article…</option>
                  {articles.filter((a) => a.refArt !== refArt).map((a) => (
                    <option key={a.refArt} value={a.refArt}>{a.designation} ({a.refArt})</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase text-[var(--text-secondary)]">Qté</span>
                <input value={ligne.qte} onChange={(e) => setLigne((l) => ({ ...l, qte: e.target.value }))}
                  inputMode="decimal" placeholder="1"
                  className="px-2.5 py-1.5 text-sm bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase text-[var(--text-secondary)]">Type</span>
                <select value={ligne.typeComposant} onChange={(e) => setLigne((l) => ({ ...l, typeComposant: e.target.value }))}
                  className="px-2.5 py-1.5 text-sm bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg">
                  {TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
                </select>
              </label>
            </div>

            <div className="px-5 py-2 flex items-center gap-2 border-b border-[var(--border-primary)]">
              <button onClick={ajouterLigne} disabled={busy}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 disabled:opacity-50"
                style={{ background: accent }}>
                <Plus size={13} /> Ajouter le composant
              </button>
              <button onClick={calculerCbn} disabled={busy || nom.lignes.length === 0}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--border-primary)] text-[var(--text-secondary)] flex items-center gap-1.5 disabled:opacity-40">
                <Calculator size={13} /> CBN (pour 1 unité)
              </button>
              <span className="ml-auto text-[11px] text-[var(--text-secondary)]">
                {nom.lignes.length} composant(s) · base {fmtQ(nom.qteBase)}
              </span>
            </div>

            <div className="overflow-x-auto max-h-[45vh]">
              <table className="w-full text-xs">
                <thead className="bg-[var(--bg-primary)] sticky top-0">
                  <tr className="text-[var(--text-secondary)] uppercase text-[10px]">
                    <th className="px-3 py-2 text-left">Composant</th>
                    <th className="px-3 py-2 text-left">Désignation</th>
                    <th className="px-3 py-2 text-right">Qté</th>
                    <th className="px-3 py-2 text-left">Type</th>
                    <th className="px-3 py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-primary)]">
                  {nom.lignes.length === 0 && (
                    <tr><td colSpan={5} className="px-3 py-10 text-center text-[var(--text-secondary)]">
                      Aucun composant — ajoutez la première ligne ci-dessus.
                    </td></tr>
                  )}
                  {nom.lignes.map((l) => (
                    <tr key={l.id} className="hover:bg-[var(--accent-light)]/40">
                      <td className="px-3 py-1.5 font-mono">{l.refArt}</td>
                      <td className="px-3 py-1.5 truncate max-w-[260px]">{l.desArt ?? "—"}</td>
                      <td className="px-3 py-1.5 text-right font-semibold">{fmtQ(l.qte)}</td>
                      <td className="px-3 py-1.5">
                        {TYPES.find((t) => t.v === l.typeComposant)?.l ?? l.typeComposant}
                      </td>
                      <td className="px-3 py-1.5">
                        <button onClick={() => supprimerLigne(l.id)} disabled={busy}
                          className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 disabled:opacity-40" title="Retirer">
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Résultat du calcul de besoin net */}
            {cbn && (
              <div className="px-5 py-3 border-t border-[var(--border-primary)]">
                <div className="text-[11px] font-bold uppercase text-[var(--text-secondary)] mb-2">
                  Besoin net pour 1 unité
                </div>
                {cbn.length === 0 ? (
                  <div className="text-xs text-[var(--text-secondary)]">Aucun besoin : le stock couvre la fabrication.</div>
                ) : (
                  <div className="space-y-1">
                    {cbn.slice(0, 8).map((b) => (
                      <div key={b.refArt} className="flex justify-between text-xs">
                        <span className="truncate">{b.designation ?? b.refArt}</span>
                        <span className="font-semibold tabular-nums">{fmtQ(b.besoinNet)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
