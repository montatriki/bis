"use client";
import { useCallback, useEffect, useState } from "react";
import { X, Loader2, AlertTriangle, PackageX } from "lucide-react";

// Détail des ruptures de stock — fenêtre ouverte depuis la carte
// « Ruptures stock » du tableau de bord.
//
// Le compteur seul (« 269 ») n'indique aucune action. On répond ici à : quels
// articles, dans quelle famille, la marchandise existe-t-elle ailleurs, et
// quelles anomalies d'inventaire fausse la valorisation.

type Ligne = {
  refArt?: string; cle?: string; libelle: string;
  stock?: number; mini?: number; nb?: number;
  montant: number; aRegulariser?: number; negatif?: boolean;
};
type Reponse = {
  axe: string; niveau: "articles" | "groupes"; rows: Ligne[]; unite?: string;
  resume?: {
    nbRuptures: number; nbNegatifs: number; nbSousMini: number; nbArticles: number;
    valeurARegulariser: number; seuilsConfigures: boolean;
  };
  totaux: { nb: number; montant: number };
};

const fmt = (v: unknown) => new Intl.NumberFormat("fr-TN", { maximumFractionDigits: 0 }).format(Number(v) || 0);

const AXES = [
  { v: "articles", l: "Articles en rupture" },
  { v: "famille", l: "Par famille" },
  { v: "depot", l: "Disponible en dépôt" },
  { v: "negatifs", l: "Stock négatif" },
] as const;

export default function DetailRuptures({ accent, onClose }: { accent: string; onClose: () => void }) {
  const [axe, setAxe] = useState<string>("articles");
  const [data, setData] = useState<Reponse | null>(null);
  const [load, setLoad] = useState(true);
  // Le résumé ne vient qu'avec l'axe « articles » : on le conserve pour
  // l'afficher quel que soit l'onglet ouvert.
  const [resume, setResume] = useState<Reponse["resume"] | null>(null);

  const charger = useCallback((a: string) => {
    fetch(`/api/ruptures?axe=${a}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d.error ? null : d);
        if (d?.resume) setResume(d.resume);
        setLoad(false);
      })
      .catch(() => setLoad(false));
  }, []);

  useEffect(() => { charger(axe); }, [axe, charger]);

  const rows = data?.rows ?? [];
  const enArticles = data?.niveau === "articles";

  return (
    <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm flex items-center justify-center p-4"
         onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[88vh] flex flex-col"
           onClick={(e) => e.stopPropagation()}>

        <header className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0"
               style={{ background: accent }}>
            <PackageX size={17} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-extrabold text-sm text-slate-800">Ruptures de stock</div>
            <div className="text-xs text-slate-500">Articles vendables à zéro ou en négatif</div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 transition">
            <X size={15} />
          </button>
        </header>

        {resume && (
          <div className="px-5 py-3 border-b border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Tuile titre="En rupture" valeur={fmt(resume.nbRuptures)} sur={`sur ${fmt(resume.nbArticles)}`} />
            <Tuile titre="Stock négatif" valeur={fmt(resume.nbNegatifs)} sur="à régulariser" alerte />
            <Tuile titre="À reconstituer" valeur={`${fmt(resume.valeurARegulariser)}`} sur="TND" alerte />
            <Tuile titre="Sous le minimum" valeur={resume.seuilsConfigures ? fmt(resume.nbSousMini) : "—"}
                   sur={resume.seuilsConfigures ? "articles" : "seuils non paramétrés"} />
          </div>
        )}

        <div className="px-5 py-3 border-b border-slate-100 flex gap-1.5 flex-wrap">
          {AXES.map((a) => (
            <button key={a.v} onClick={() => { setLoad(true); setAxe(a.v); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                axe === a.v ? "text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
              style={axe === a.v ? { background: accent } : undefined}>
              {a.l}
            </button>
          ))}
        </div>

        {/* Un stock négatif n'est pas une rupture : c'est une erreur de saisie
            qui minore la valorisation. Le dire explicitement évite qu'on tente
            de « réapprovisionner » un écart d'inventaire. */}
        {axe === "negatifs" && (
          <div className="px-5 py-2.5 bg-amber-50 border-b border-amber-100 text-[11px] text-amber-800 flex items-start gap-2">
            <AlertTriangle size={13} className="shrink-0 mt-0.5" />
            Un stock négatif est physiquement impossible : il vient de sorties
            enregistrées sans les entrées correspondantes. Ces écarts se corrigent
            par un inventaire, pas par une commande.
          </div>
        )}
        {axe === "depot" && (
          <div className="px-5 py-2.5 bg-blue-50 border-b border-blue-100 text-[11px] text-blue-800">
            Articles en rupture globale mais encore présents dans un dépôt ou un
            véhicule : un transfert suffit, inutile de racheter.
          </div>
        )}

        <div className="overflow-auto flex-1">
          {load ? (
            <div className="py-16 flex justify-center"><Loader2 className="animate-spin text-slate-300" /></div>
          ) : rows.length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-500">
              {axe === "depot"
                ? "Aucun article en rupture n'est disponible dans un autre dépôt."
                : "Aucune donnée"}
            </div>
          ) : enArticles ? (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 sticky top-0">
                <tr>
                  <th className="px-4 py-2.5 text-left font-bold">Référence</th>
                  <th className="px-4 py-2.5 text-left font-bold">Désignation</th>
                  <th className="px-4 py-2.5 text-right font-bold">Stock</th>
                  <th className="px-4 py-2.5 text-right font-bold">
                    {axe === "negatifs" ? "À reconstituer" : "Prix vente"}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.map((r) => (
                  <tr key={r.refArt} className={r.negatif || axe === "negatifs" ? "bg-red-50/40" : ""}>
                    <td className="px-4 py-2.5 font-semibold text-slate-700 text-xs">{r.refArt}</td>
                    <td className="px-4 py-2.5 text-slate-600 truncate max-w-[280px]">{r.libelle}</td>
                    <td className={`px-4 py-2.5 text-right font-bold tabular-nums ${
                      (r.stock ?? 0) < 0 ? "text-red-600" : "text-slate-500"}`}>
                      {fmt(r.stock)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-slate-700">
                      {fmt(axe === "negatifs" ? r.montant : (r.aRegulariser || r.montant))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <ul className="divide-y divide-slate-50">
              {rows.map((g) => (
                <li key={g.cle ?? g.libelle} className="px-5 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-slate-800 truncate">{g.libelle}</div>
                    <div className="text-xs text-slate-500">
                      {g.nb} article(s){axe === "depot" ? " disponibles ici" : " en rupture"}
                    </div>
                  </div>
                  <div className="text-right shrink-0 tabular-nums">
                    <div className="font-bold text-sm text-slate-800">{fmt(g.montant)}</div>
                    <div className="text-[10px] text-slate-400">
                      {data?.unite === "quantite" ? "unités dispo." : "TND"}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Tuile({ titre, valeur, sur, alerte }: { titre: string; valeur: string; sur: string; alerte?: boolean }) {
  return (
    <div>
      <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">{titre}</div>
      <div className={`text-lg font-extrabold tabular-nums ${alerte ? "text-red-600" : "text-slate-800"}`}>
        {valeur}
      </div>
      <div className="text-[10px] text-slate-400">{sur}</div>
    </div>
  );
}
