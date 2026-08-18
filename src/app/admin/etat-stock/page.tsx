"use client";
import { useEffect, useState } from "react";
import { Warehouse, Search, AlertTriangle, Boxes, FileDown, Printer, Truck } from "lucide-react";

type Emplacement = {
  emplacement: string;
  /** `depot` = entrepôt fixe, `vehicule` = camion d'un commercial. */
  type: "depot" | "vehicule";
  matricule: string | null;
  commercial: string | null;
  quantite: number; valeur: number; refs: number;
};

type Ligne = {
  refArt: string; designation: string; kind: string; unite: string | null;
  enStock: number; stMin: number; puAchat: number; valeur: number;
  pmp: number; tarif1Ht: number; prixValorisation: number;
  famille: number | null; sousFamille: number | null;
  magasin: number; depot: number;
  emplacements: { emplacement: string; quantite: number }[];
  alerte: "rupture" | "sous-seuil" | null;
  nonVentile: number;
};

type Groupe = { code: string; libelle: string; nb: number; quantite: number; valeur: number };

type Etat = {
  emplacements: Emplacement[];
  valorisation: string;
  groupBy: string | null;
  groupes: Groupe[] | null;
  familles: { code: string; label: string }[];
  sousFamilles: { code: string; label: string }[];
  totaux: {
    valeurVehicules: number; valeurDepot: number; valeurTotale: number;
    nbArticles: number; nbRuptures: number; nbSousSeuil: number;
  };
  rows: Ligne[];
  total: number;
};

const fmt0 = (n: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n ?? 0);

/** Carte d'un emplacement : entrepôt ou véhicule d'un commercial. */
function CarteEmplacement({ e, actif, onClick }: { e: Emplacement; actif: boolean; onClick: () => void }) {
  const vehicule = e.type === "vehicule";
  return (
    <button onClick={onClick}
      className={`text-left bg-[var(--bg-card)] rounded-2xl border shadow-sm p-4 transition hover:shadow-md ${
        actif ? "border-[var(--accent-primary)]" : "border-[var(--border-primary)]"}`}>
      <div className="flex items-center gap-2.5 mb-2">
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
          vehicule ? "bg-amber-500/10 text-amber-500" : "bg-purple-500/10 text-purple-500"}`}>
          {vehicule ? <Truck size={15} /> : <Warehouse size={15} />}
        </div>
        <div className="min-w-0">
          {/* Le commercial prime sur le libellé brut : « mokhtar 206TU7140 »
              ne dit pas de qui il s'agit au premier coup d'œil. */}
          <div className="font-extrabold text-xs truncate" title={e.emplacement}>
            {e.commercial ?? e.emplacement}
          </div>
          <div className="text-[10px] text-[var(--text-secondary)] opacity-70 flex items-center gap-1">
            {vehicule ? (
              <>{e.matricule ?? e.emplacement}</>
            ) : (
              <>ENTREPÔT</>
            )}
          </div>
        </div>
      </div>
      <div className={`font-extrabold text-sm tabular-nums ${e.valeur < 0 ? "text-red-600" : ""}`}>
        {fmt0(e.valeur)} <span className="text-[10px] opacity-60">TND</span>
      </div>
      <div className="text-[10px] text-[var(--text-secondary)] opacity-70 mt-0.5">
        {fmt0(e.refs)} réf. · {fmt0(e.quantite)} unités
      </div>
    </button>
  );
}

const selCls = "text-xs bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]";

/** Familles d'articles, telles que stockées dans `Article.kind`. */
const FAMILLES = [
  { value: "", label: "Tous les articles" },
  { value: "P", label: "Produits finis" },
  { value: "MP", label: "Matières premières" },
  { value: "SF", label: "Semi-finis" },
];

export default function EtatStockPage() {
  const [data, setData] = useState<Etat | null>(null);
  const [loading, setLoading] = useState(true);
  const [emplacement, setEmplacement] = useState("");
  const [kind, setKind] = useState("");
  const [search, setSearch] = useState("");
  const [famille, setFamille] = useState("");
  const [sousFamille, setSousFamille] = useState("");
  // Signe du stock : cases cumulables, comme l'écran d'origine.
  const [signes, setSignes] = useState<string[]>([]);
  const [groupBy, setGroupBy] = useState("");
  const [valorisation, setValorisation] = useState("pmp");
  // Recherche différée : évite une requête à chaque frappe.
  const [recherche, setRecherche] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setRecherche(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const qs = new URLSearchParams();
    if (emplacement) qs.set("emplacement", emplacement);
    if (kind) qs.set("kind", kind);
    if (recherche) qs.set("search", recherche);
    if (famille) qs.set("famille", famille);
    if (sousFamille) qs.set("sousFamille", sousFamille);
    if (signes.length) qs.set("stock", signes.join(","));
    if (groupBy) qs.set("groupBy", groupBy);
    if (valorisation !== "pmp") qs.set("valorisation", valorisation);
    let annule = false;
    fetch(`/api/etat-stock${qs.toString() ? `?${qs}` : ""}`)
      .then((r) => r.json())
      .then((d) => { if (!annule) { setData(d); setLoading(false); } })
      .catch(() => { if (!annule) setLoading(false); });
    return () => { annule = true; };
  }, [emplacement, kind, recherche, famille, sousFamille, signes, groupBy, valorisation]);

  /** Export CSV de l'état filtré — équivalent du bouton EXCEL d'origine. */
  function exporter() {
    if (!data) return;
    const entetes = ["Référence","Désignation","Famille","Magasin","Dépôt","Stock total","Prix","Valeur"];
    const nomFam = new Map(data.familles.map((f) => [f.code, f.label]));
    const lignes = data.rows.map((r) => [
      r.refArt, r.designation,
      r.famille != null ? (nomFam.get(String(r.famille)) ?? r.famille) : "",
      r.magasin, r.depot, r.enStock, r.prixValorisation, r.valeur,
      // Le point-virgule sépare les colonnes : on le neutralise dans les valeurs.
    ].map((v) => String(v).replace(/;/g, ",")).join(";"));
    // BOM UTF-8 : sans lui Excel affiche « DÃ©pÃ´t ».
    const csv = "\uFEFF" + [entetes.join(";"), ...lignes].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = `etat-stock_${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const KPIS = data
    ? [
        { label: "Stock en dépôt", value: data.totaux.valeurDepot, icon: Warehouse, tone: "text-purple-500", bg: "bg-purple-500/10" },
        { label: "Stock en véhicules", value: data.totaux.valeurVehicules, icon: Truck, tone: "text-amber-500", bg: "bg-amber-500/10" },
        { label: "Valeur totale", value: data.totaux.valeurTotale, icon: Boxes, tone: "text-emerald-500", bg: "bg-emerald-500/10" },
      ]
    : [];

  return (
    <div className="space-y-6 animate-fade-in text-[var(--text-primary)]">
      <div className="flex items-center justify-between border-b border-[var(--border-primary)] pb-4 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight">État du stock</h1>
            <span className="text-[10px] font-extrabold bg-[var(--accent-light)] text-[var(--accent-primary)] px-2.5 py-0.5 rounded-full border border-[var(--border-primary)] uppercase tracking-wider">
              Magasin & Dépôt
            </span>
          </div>
          <p className="text-[var(--text-secondary)] opacity-80 text-xs mt-1">
            Répartition des quantités et valorisation par emplacement
          </p>
        </div>
        {data && (
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider">
            <span className="bg-red-500/10 text-red-500 border border-red-500/20 px-2.5 py-1 rounded-full">
              {fmt0(data.totaux.nbRuptures)} ruptures
            </span>
            {data.totaux.nbSousSeuil > 0 && (
              <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2.5 py-1 rounded-full">
                {fmt0(data.totaux.nbSousSeuil)} sous seuil
              </span>
            )}
          </div>
        )}
      </div>

      {/* Valorisation */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {KPIS.map((k) => (
          <div key={k.label} className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-primary)] shadow-sm p-4 flex items-center gap-3">
            <div className={`w-10 h-10 ${k.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
              <k.icon size={18} className={k.tone} />
            </div>
            <div className="min-w-0">
              <div className="text-[var(--text-secondary)] text-[10px] font-bold uppercase tracking-wide truncate">{k.label}</div>
              <div className="font-extrabold text-lg tabular-nums">{fmt0(k.value)} <span className="text-[10px] opacity-60">TND</span></div>
            </div>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-2 bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-2xl px-4 py-3 shadow-sm">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] opacity-70" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un article ou une référence…"
            className="w-full pl-9 pr-3 py-2 text-xs bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg focus:outline-none focus:border-[var(--accent-primary)] text-[var(--text-primary)]" />
        </div>
        <select value={kind} onChange={(e) => setKind(e.target.value)} className={selCls}>
          {FAMILLES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <select value={emplacement} onChange={(e) => setEmplacement(e.target.value)}
          className={selCls}>
          <option value="">Tous les emplacements</option>
          {data?.emplacements.map((e) => (
            <option key={e.emplacement} value={e.emplacement}>{e.emplacement}</option>
          ))}
        </select>

        {/* Famille / sous-famille : mêmes sélecteurs que l'état d'origine. */}
        <select value={famille} onChange={(e) => setFamille(e.target.value)} className={selCls}>
          <option value="">Toutes les familles</option>
          {data?.familles.map((f) => <option key={f.code} value={f.code}>{f.label}</option>)}
        </select>
        <select value={sousFamille} onChange={(e) => setSousFamille(e.target.value)} className={selCls}>
          <option value="">Toutes les sous-familles</option>
          {data?.sousFamilles.map((f) => <option key={f.code} value={f.code}>{f.label}</option>)}
        </select>

        <div className="w-full flex flex-wrap items-center gap-4 pt-1">
          {/* Signe du stock : cases cumulables. */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)]">Stock</span>
            {[["positif","Positif"],["negatif","Négatif"],["zero","= 0"]].map(([v, l]) => (
              <label key={v} className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input type="checkbox" checked={signes.includes(v)}
                  onChange={(e) => setSignes((p) => e.target.checked ? [...p, v] : p.filter((x) => x !== v))}
                  className="accent-[var(--accent-primary)]" />
                {l}
              </label>
            ))}
          </div>

          {/* Regroupement : sous-totaux par famille ou sous-famille. */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)]">Groupement</span>
            <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)} className={selCls}>
              <option value="">Aucun</option>
              <option value="famille">Par famille</option>
              <option value="sousfamille">Par sous-famille</option>
            </select>
          </div>

          {/* Base de valorisation : les trois donnent des totaux différents. */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)]">Valorisation</span>
            {[["pmp","PMP"],["dpa","DPA"],["vente","Prix vente"]].map(([v, l]) => (
              <label key={v} className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input type="radio" name="valo" checked={valorisation === v}
                  onChange={() => setValorisation(v)} className="accent-[var(--accent-primary)]" />
                {l}
              </label>
            ))}
          </div>

          <div className="ml-auto flex gap-2">
            <button onClick={() => window.print()} title="Imprimer l'état"
              className="w-9 h-9 rounded-lg border border-[var(--border-primary)] flex items-center justify-center
                         text-[var(--text-secondary)] hover:bg-[var(--bg-primary)] transition">
              <Printer size={15} />
            </button>
            <button onClick={exporter} title="Exporter en Excel (CSV)"
              className="w-9 h-9 rounded-lg border border-[var(--border-primary)] flex items-center justify-center
                         text-[var(--text-secondary)] hover:bg-[var(--bg-primary)] transition">
              <FileDown size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Entrepôts fixes */}
      {data && data.emplacements.some((e) => e.type === "depot") && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.emplacements.filter((e) => e.type === "depot").map((e) => (
            <CarteEmplacement key={e.emplacement} e={e}
              actif={emplacement === e.emplacement}
              onClick={() => setEmplacement(emplacement === e.emplacement ? "" : e.emplacement)} />
          ))}
        </div>
      )}

      {/* Stock embarqué, un bloc par commercial : c'est la question que se pose
          l'exploitant — « qui a quoi dans son camion ? ». */}
      {data && data.emplacements.some((e) => e.type === "vehicule") && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Truck size={15} className="text-amber-500" />
            <h3 className="font-extrabold text-sm">Stock embarqué par commercial</h3>
            <span className="text-[10px] text-[var(--text-secondary)]">
              {data.emplacements.filter((e) => e.type === "vehicule").length} véhicule(s)
            </span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.emplacements.filter((e) => e.type === "vehicule").map((e) => (
              <CarteEmplacement key={e.emplacement} e={e}
                actif={emplacement === e.emplacement}
                onClick={() => setEmplacement(emplacement === e.emplacement ? "" : e.emplacement)} />
            ))}
          </div>
        </div>
      )}

      {/* Sous-totaux par famille ou sous-famille, quand un groupement est
          demandé : c'est la lecture que l'état d'origine imprime. */}
      {data?.groupes && data.groupes.length > 0 && (
        <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-primary)] shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--border-primary)] bg-[var(--bg-primary)]/40 flex items-center justify-between">
            <h3 className="font-extrabold text-sm">
              {groupBy === "famille" ? "Par famille" : "Par sous-famille"}
            </h3>
            <span className="text-[10px] text-[var(--text-secondary)]">
              {data.groupes.length} groupe(s)
            </span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg-primary)]/40 text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
              <tr>
                <th className="px-5 py-2.5 text-left font-bold">Groupe</th>
                <th className="px-5 py-2.5 text-right font-bold">Articles</th>
                <th className="px-5 py-2.5 text-right font-bold">Quantité</th>
                <th className="px-5 py-2.5 text-right font-bold">Valeur</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-primary)]">
              {data.groupes.map((g) => (
                <tr key={g.code || g.libelle}>
                  <td className="px-5 py-2.5 font-semibold">{g.libelle}</td>
                  <td className="px-5 py-2.5 text-right tabular-nums">{fmt0(g.nb)}</td>
                  <td className="px-5 py-2.5 text-right tabular-nums">{fmt0(g.quantite)}</td>
                  <td className="px-5 py-2.5 text-right tabular-nums font-bold">{fmt0(g.valeur)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Détail par article */}
      <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-primary)] shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border-primary)] bg-[var(--bg-primary)]/40 flex items-center justify-between">
          <h3 className="font-extrabold text-sm">Détail par article</h3>
          {data && (
            <span className="text-[10px] text-[var(--text-secondary)]">
              {fmt0(data.rows.length)} affichés sur {fmt0(data.total)}
            </span>
          )}
        </div>

        {loading ? (
          <div className="p-5 space-y-2">
            {[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-10 bg-[var(--bg-primary)] rounded-lg animate-pulse" />)}
          </div>
        ) : !data || data.rows.length === 0 ? (
          <p className="text-xs text-[var(--text-secondary)] py-10 text-center opacity-70">Aucun article</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-[var(--bg-primary)]/50 text-[var(--text-secondary)]">
                <tr className="text-[10px] uppercase tracking-wider">
                  <th className="text-left font-black px-5 py-2.5">Article</th>
                  <th className="text-right font-black px-3 py-2.5">Magasin</th>
                  <th className="text-right font-black px-3 py-2.5">Dépôt</th>
                  <th className="text-right font-black px-3 py-2.5">Stock total</th>
                  <th className="text-right font-black px-5 py-2.5">Valeur</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-primary)]">
                {data.rows.map((r) => (
                  <tr key={r.refArt} className="hover:bg-[var(--accent-light)]/40 transition">
                    <td className="px-5 py-2.5">
                      <div className="font-bold truncate max-w-[280px]" title={r.designation}>{r.designation}</div>
                      <div className="text-[10px] text-[var(--text-secondary)] opacity-70 font-mono flex items-center gap-1.5">
                        {r.refArt}
                        {r.alerte === "rupture" && (
                          <span className="text-red-500 font-bold flex items-center gap-0.5"><AlertTriangle size={9} /> rupture</span>
                        )}
                        {r.alerte === "sous-seuil" && (
                          <span className="text-amber-500 font-bold flex items-center gap-0.5"><AlertTriangle size={9} /> sous seuil</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-bold text-amber-600">{fmt0(r.magasin)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-bold text-purple-600">{fmt0(r.depot)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-bold">{fmt0(r.enStock)}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums font-extrabold text-[var(--accent-primary)]">{fmt0(r.valeur)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
