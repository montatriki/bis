"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Search, Plus, Pencil, Trash2, Printer, Download, RefreshCw, X,
  ChevronLeft, ChevronRight, ChevronUp, ChevronDown, FileText, ArrowRightLeft, Network,
} from "lucide-react";
import { findModule, findSub, writeResource, newRecordDefaults, type Column, type View } from "@/lib/erp-modules";
import ArticleForm from "@/components/erp/ArticleForm";
import ChampListe from "@/components/erp/ChampListe";
import ReglementForm from "@/components/erp/ReglementForm";
import DocumentLines from "@/components/erp/DocumentLines";
import ArticleMouvements from "@/components/erp/ArticleMouvements";
import ArticleNomenclature from "@/components/erp/ArticleNomenclature";
import TransformDialog from "@/components/erp/TransformDialog";
import FilterBar from "@/components/erp/FilterBar";
import BalanceGlobale from "@/components/erp/BalanceGlobale";
import TresorerieView from "@/components/erp/TresorerieView";
import CrmView from "@/components/erp/CrmView";
import MouvementDepotView from "@/components/erp/MouvementDepotView";
import GpaoView from "@/components/erp/GpaoView";
import SeriesView from "@/components/erp/SeriesView";
import InventaireView from "@/components/erp/InventaireView";
import EntretienVehicules from "@/components/erp/EntretienVehicules";
import TransfertsView from "@/components/erp/TransfertsView";
import ReferentielsArticlesView from "@/components/erp/ReferentielsArticlesView";
import ChargesView from "@/components/erp/ChargesView";
import ProjetsView from "@/components/erp/ProjetsView";
import DroitsView from "@/components/erp/DroitsView";
import SettingsView from "@/components/erp/SettingsView";
import ReportsView from "@/components/erp/ReportsView";
import { confirmer } from "@/lib/alertes";

const fmtMoney = (n: number) => new Intl.NumberFormat("fr-TN", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(Number(n) || 0);
const fmtDate = (v: string) => (v ? new Date(v).toLocaleDateString("fr-FR") : "—");
type Row = Record<string, unknown>;

function baseParams(view: View): string {
  switch (view.kind) {
    case "partners": return `resource=partners&nature=${view.nature}${view.charge ? "&charge=1" : ""}`;
    case "articles": return `resource=articles${view.articleKind ? `&articleKind=${view.articleKind}` : ""}`;
    case "documents": return `resource=documents&nature=${view.nature}&type=${encodeURIComponent(view.type ?? "%")}`;
    case "ref": return `resource=ref&kind=${view.refKind}`;
    case "reglements": return `resource=reglements&sens=${view.sens}`;
    case "accounts": return `resource=accounts`;
    case "machines": return `resource=machines`;
    case "vehicules": return `resource=vehicules`;
    case "borderaux": return `resource=borderaux`;
    case "tresobalance": return `resource=tresobalance`;
    case "generic": return `resource=${view.resource}`;
    default: return "";
  }
}

// id key for a row given the view
function rowId(view: View, row: Row): string {
  if (view.kind === "articles") return String(row.refArt);
  if (view.kind === "partners") return String(row.id);
  if (view.kind === "documents") return String(row.refDoc);
  return String(row.id ?? row.code ?? "");
}

/**
 * Période d'ouverture d'une liste de documents.
 *
 * L'ERP d'origine ouvre sur l'exercice courant. Appliqué tel quel ici, ce
 * réglage masquait 73 % des pièces : l'historique repris commence en 2023 et
 * une liste s'ouvrait vide (documents charge, tous datés de 2024-2025) alors
 * que les données étaient bien en base — l'écran donnait à tort l'impression
 * d'un module non alimenté.
 *
 * La liste s'ouvre donc sans borne de période, et l'API renvoie les bornes
 * réelles de l'historique (`periodeDisponible`) pour renseigner la barre de
 * filtres. L'exercice courant reste à un clic.
 */
function periodeVide() {
  return { dateDu: "", dateAu: "" };
}

/** `2026-08-17T…` → `2026-08-17`, format attendu par `<input type="date">`. */
function jour(v: string | null | undefined) {
  return v ? String(v).slice(0, 10) : "";
}

export default function ModuleView({ moduleSlug, subSlug }: { moduleSlug: string; subSlug: string }) {
  // Mémoïsés : `sub.columns` alimente les hooks du formulaire ; recalculer
  // ces objets à chaque rendu relancerait les effets en boucle.
  const mod = useMemo(() => findModule(moduleSlug), [moduleSlug]);
  const sub = useMemo(() => (mod ? findSub(mod, subSlug) : undefined), [mod, subSlug]);

  // Stable d'un rendu à l'autre : sinon la barre de filtres se réinitialiserait.
  const periodeParDefaut = useMemo(() => periodeVide(), []);
  // Bornes réelles de l'historique, renvoyées par l'API : affichées dans la
  // barre de filtres pour que l'opérateur sache sur quoi porte la liste.
  const [periodeDispo, setPeriodeDispo] = useState<{ du: string; au: string } | null>(null);

  const [rows, setRows] = useState<Row[]>([]);
  const [meta, setMeta] = useState<{ total: number; pages: number }>({ total: 0, pages: 0 });
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  // Les listes de documents s'ouvrent sur la période par défaut : la première
  // requête doit donc porter les mêmes bornes que la barre de filtres.
  const [barFilters, setBarFilters] = useState<Record<string, string>>(
    () => (sub?.view.kind === "documents" ? periodeVide() : {}),
  );
  const [sort, setSort] = useState<{ field: string; dir: "asc" | "desc" } | null>(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<Row | null>(null); // row being edited, {} = new
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [linesFor, setLinesFor] = useState<string | null>(null); // refDoc whose lines are open
  const [transformFor, setTransformFor] = useState<Row | null>(null); // document being transformed
  // Écrans ouverts depuis un article sélectionné, comme la barre d'outils de la
  // liste des produits de l'ERP d'origine.
  const [mouvementsFor, setMouvementsFor] = useState<Row | null>(null);
  const [nomenclatureFor, setNomenclatureFor] = useState<Row | null>(null);

  // Toutes les colonnes déclarées (formulaire compris) ...
  const colsToutes: Column[] = useMemo(() => sub?.columns ?? [], [sub]);
  // ... et celles réellement affichées dans le tableau : une fiche complète
  // compte une trentaine de champs, illisibles en colonnes.
  const cols: Column[] = useMemo(() => colsToutes.filter((c) => c.list !== false), [colsToutes]);
  const view = sub?.view;
  const wres = view ? writeResource(view) : null;

  const [reloadKey, setReloadKey] = useState(0);
  // Un export parcourt toutes les pages : le drapeau évite qu'un second clic
  // relance le parcours pendant qu'il est en cours.
  const [exportEnCours, setExportEnCours] = useState(false);
  const fetchRows = useCallback(() => setReloadKey((k) => k + 1), []);

  // Pas de rafraîchissement automatique : un rechargement toutes les 30 s
  // faisait clignoter le tableau, perdait la position de défilement et la
  // ligne survolée en pleine consultation. L'actualisation est déclenchée
  // explicitement (bouton « Actualiser ») ou après une écriture.

  useEffect(() => {
    if (!view || ["info", "settings", "reports", "tresorerie", "crm", "mvtdepot"].includes(view.kind)) return;
    let cancelled = false;
    const parts = [baseParams(view), `page=${page}`];
    if (search) parts.push(`search=${encodeURIComponent(search)}`);
    if (sort) parts.push(`sort=${sort.field}&dir=${sort.dir}`);
    for (const [k, v] of Object.entries(filters)) if (v.trim()) parts.push(`f_${k}=${encodeURIComponent(v.trim())}`);
    for (const [k, v] of Object.entries(barFilters)) if (v && v.trim()) parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v.trim())}`);
    fetch(`/api/erp?${parts.join("&")}`).then((r) => r.json()).then((d) => {
      if (cancelled) return;
      setRows(d.rows ?? []);
      setMeta({ total: d.total ?? (d.rows?.length ?? 0), pages: d.pages ?? 1 });
      setTotal(d.sum?.montant ?? d.sum?.ttcNet ?? null);
      if (d.periodeDisponible?.du) {
        setPeriodeDispo({ du: jour(d.periodeDisponible.du), au: jour(d.periodeDisponible.au) });
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [view, page, search, sort, filters, barFilters, reloadKey]);

  // Hooks du formulaire : déclarés avant tout retour anticipé, sinon leur
  // ordre changerait d'un rendu à l'autre.
  // Mémoïsé : sert de dépendance aux hooks du formulaire, un nouveau tableau
  // à chaque rendu les relancerait en boucle.
  const editableCols = useMemo(() => colsToutes.filter((c) => c.form), [colsToutes]);

  // Champs du formulaire regroupés par section, dans l'ordre de déclaration.
  const groupesForm = useMemo(() => {
    const m = new Map<string, Column[]>();
    for (const c of editableCols) {
      const g = c.groupe ?? "";
      m.set(g, [...(m.get(g) ?? []), c]);
    }
    return [...m.entries()];
  }, [editableCols]);

  // Valeurs proposées aux champs à liste (commercial, ville, famille…).
  // Chargées une fois par écran : ce sont des référentiels, pas des données
  // de ligne.
  const [optionsForm, setOptionsForm] = useState<Record<string, string[]>>({});
  useEffect(() => {
    const cles = [...new Set(editableCols.map((c) => c.optionsKey).filter(Boolean))] as string[];
    if (cles.length === 0) return;
    let annule = false;
    const groupes = [...new Set(cles.map((k) => k.split(".")[0]))];
    Promise.all(
      groupes.map((g) =>
        fetch(`/api/erp?resource=${g}${view?.kind === "partners" ? `&nature=${view.nature}` : ""}`)
          .then((r) => r.json())
          .then((d) => [g, d] as const)
          .catch(() => [g, {}] as const),
      ),
    ).then((res) => {
      if (annule) return;
      const out: Record<string, string[]> = {};
      for (const c of editableCols) {
        if (!c.optionsKey) continue;
        const [grp, champ] = c.optionsKey.split(".");
        const data = res.find(([g]) => g === grp)?.[1] as Record<string, string[]> | undefined;
        out[c.key] = data?.[champ] ?? [];
      }
      setOptionsForm(out);
    });
    return () => { annule = true; };
  }, [editableCols, view]);

  if (!mod || !sub || !view) return <div className="p-8 text-center text-slate-400">Module introuvable.</div>;

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2500); };

  async function save(form: Row) {
    if (!wres) return;
    setBusy(true);
    const isNew = !editing || Object.keys(editing).length === 0;
    const r = await fetch(`/api/erp?resource=${wres}`, {
      method: isNew ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...newRecordDefaults(view!), ...form }),
    }).then((x) => x.json());
    setBusy(false);
    if (r.ok) { setEditing(null); flash(isNew ? "Enregistré avec succès" : "Modifié avec succès"); fetchRows(); }
    else flash("Erreur: " + (r.error ?? "échec"));
  }

  async function remove() {
    if (!wres || !selected) return;
    if (!(await confirmer("Confirmer la suppression de cet enregistrement ?", { danger: true }))) return;
    setBusy(true);
    const r = await fetch(`/api/erp?resource=${wres}&id=${encodeURIComponent(selected)}`, { method: "DELETE" }).then((x) => x.json());
    setBusy(false);
    if (r.ok) { setSelected(null); flash("Supprimé"); fetchRows(); }
    else flash("Erreur: " + (r.error ?? "échec"));
  }

  // L'export ne portait que sur `rows`, c'est-à-dire la page affichée : 50 lignes
  // sur 4 568 clients. On parcourt donc toutes les pages, avec les filtres
  // courants, avant de composer le fichier.
  async function exportExcel() {
    if (!view || exportEnCours) return;
    setExportEnCours(true);
    try {
      const parts = [baseParams(view)];
      if (search) parts.push(`search=${encodeURIComponent(search)}`);
      if (sort) parts.push(`sort=${sort.field}&dir=${sort.dir}`);
      for (const [k, v] of Object.entries(filters)) if (v.trim()) parts.push(`f_${k}=${encodeURIComponent(v.trim())}`);
      for (const [k, v] of Object.entries(barFilters)) if (v && v.trim()) parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v.trim())}`);

      const toutes: Row[] = [];
      // Garde-fou : au-delà de 200 pages on s'arrête, un export de cette taille
      // relève de la base, pas du navigateur.
      for (let p = 0; p < 200; p++) {
        const d = await fetch(`/api/erp?${[...parts, `page=${p}`].join("&")}`).then((r) => r.json());
        const lot: Row[] = d.rows ?? [];
        toutes.push(...lot);
        if (lot.length === 0 || toutes.length >= (d.total ?? 0)) break;
      }

      const source = toutes.length ? toutes : rows;
      const header = cols.map((c) => c.label).join(";");
      const lignes = source.map((row) => cols.map((c) => String(row[c.key] ?? "").replace(/;/g, ",")).join(";"));
      const csv = "\uFEFF" + [header, ...lignes].join("\n");
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a"); a.href = url; a.download = `${sub!.slug}.csv`; a.click(); URL.revokeObjectURL(url);
    } finally {
      setExportEnCours(false);
    }
  }

  function toggleSort(c: Column) {
    if (!c.sortable) return;
    setSort((s) => (s?.field === c.key ? { field: c.key, dir: s.dir === "asc" ? "desc" : "asc" } : { field: c.key, dir: "asc" }));
  }

  function renderCell(row: Row, c: Column) {
    const v = row[c.key];

    // Ancienneté du dernier contact. `null` n'est pas une absence de donnée
    // mais une information en soi — aucune visite enregistrée — et c'est le
    // cas le plus important à voir, donc il se traite avant le tiret générique.
    if (c.type === "jours") {
      const j = v == null ? null : Number(v);
      const bande =
        j === null ? { fond: "bg-slate-800", texte: "text-white", lib: "Jamais" }
        : j <= 30 ? { fond: "bg-emerald-500", texte: "text-white", lib: `${j} j` }
        : j <= 60 ? { fond: "bg-lime-500", texte: "text-white", lib: `${j} j` }
        : j <= 90 ? { fond: "bg-amber-500", texte: "text-white", lib: `${j} j` }
        : j <= 180 ? { fond: "bg-orange-500", texte: "text-white", lib: `${j} j` }
        : { fond: "bg-rose-600", texte: "text-white", lib: `${j} j` };
      return (
        <span className={`inline-block min-w-[3.5rem] text-center text-xs font-bold px-2 py-0.5 rounded-md ${bande.fond} ${bande.texte}`}>
          {bande.lib}
        </span>
      );
    }

    if (v == null || v === "" || v === "NULL") return <span className="text-slate-300">—</span>;
    if (c.type === "money") { const n = Number(v); return <span className={n < 0 ? "text-rose-600" : ""}>{fmtMoney(n)}</span>; }
    if (c.type === "num") return String(v);
    if (c.type === "date") return <span className="text-slate-500 text-xs">{fmtDate(String(v))}</span>;
    if (c.type === "badge") return <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-[var(--accent-light)] text-[var(--accent-primary)]">{String(v)}</span>;
    return String(v);
  }

  const isInfo = view.kind === "info";
  const isBalance = view.kind === "tresobalance";
  const isTreso = view.kind === "tresorerie";
  const isCrm = view.kind === "crm";
  const isMvt = view.kind === "mvtdepot";
  const isGpao = view.kind === "gpao";
  const isSeries = view.kind === "series";
  const isInventaire = view.kind === "inventaire";
  const isEntretien = view.kind === "entretien";
  const isTransferts = view.kind === "transferts";
  const isRefArt = view.kind === "refarticles";
  const isCharges = view.kind === "charges";
  const isProjets = view.kind === "projets";
  const isDroits = view.kind === "droits";
  const isSettings = view.kind === "settings";
  const isReports = view.kind === "reports";
  const hasFilters = cols.some((c) => c.filter);

  return (
    // `data-impression="contenu"` : seule cette zone part à l'imprimante — le
    // gabarit @media print masque le reste (menu, barres d'action).
    <div className="space-y-3 text-[var(--text-primary)]" data-impression="contenu">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 border-b border-[var(--border-primary)] pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: mod.color }} />
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-secondary)]">{mod.label}</span>
          </div>
          <h1 className="text-xl font-extrabold tracking-tight mt-0.5">{sub.label}</h1>
        </div>
        {/* Les vues autonomes ne remplissent pas `meta` : afficher le compteur
            reviendrait à montrer le total de l'écran précédemment consulté. */}
        {meta.total > 0 && !isInfo && !isEntretien && !isTransferts && (
          <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl px-4 py-2 text-center shadow-sm">
            <div className="text-base font-bold" style={{ color: mod.color }}>{meta.total.toLocaleString("fr-TN")}</div>
            <div className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wide">enregistrements</div>
          </div>
        )}
      </div>

      {/* Submenu tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {mod.subs.map((sm) => (
          <Link key={sm.slug} href={`/admin/modules/${mod.slug}/${sm.slug}`}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition border ${sm.slug === sub.slug ? "text-white border-transparent shadow-sm" : "bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border-primary)] hover:text-[var(--text-primary)]"}`}
            style={sm.slug === sub.slug ? { background: mod.color } : undefined}>
            {sm.label}
          </Link>
        ))}
      </div>

      {/* Advanced filter bar */}
      {sub.filterBar && (
        <FilterBar
          fields={sub.filterBar}
          sens={view.kind === "reglements" ? view.sens : undefined}
          optionsQuery={view.kind === "documents" ? `nature=${view.nature}` : undefined}
          initial={view.kind === "documents" ? periodeParDefaut : undefined}
          periodeDispo={periodeDispo}
          accent={mod.color}
          onApply={(v) => { setBarFilters(v); setPage(0); }}
          onPrint={() => window.print()}
        />
      )}

      {/* Trésorerie balance globale — dedicated Du/Au + RÉSULTAT screen */}
      {isBalance && <BalanceGlobale accent={mod.color} />}

      {/* Cockpit trésorerie : chéquiers, chèques, bordereaux, extraits */}
      {isTreso && <TresorerieView accent={mod.color} />}

      {/* CRM : pipeline des opportunités / tickets SAV */}
      {isCrm && view.kind === "crm" && <CrmView accent={mod.color} mode={view.crmMode} />}

      {/* Bons de sortie / transfert / retour (Gestion Tourner) */}
      {isMvt && view.kind === "mvtdepot" && <MouvementDepotView accent={mod.color} typeDoc={view.typeDoc} />}

      {/* GPAO : données techniques, calcul des besoins nets, planification */}
      {isGpao && view.kind === "gpao" && <GpaoView accent={mod.color} mode={view.gpaoMode} />}

      {/* Suivi des numéros de série */}
      {isSeries && <SeriesView accent={mod.color} />}

      {/* Inventaire physique : comptage, écarts, régularisation */}
      {isInventaire && <InventaireView accent={mod.color} />}
      {isEntretien && <EntretienVehicules accent={mod.color} />}
      {isTransferts && <TransfertsView accent={mod.color} />}

      {/* Référentiels articles : familles, sous-familles, unités, catalogue */}
      {isRefArt && <ReferentielsArticlesView accent={mod.color} />}

      {/* Charges fixes et marge nette par article */}
      {isCharges && <ChargesView accent={mod.color} />}

      {/* Projets et jalonnements */}
      {isProjets && <ProjetsView accent={mod.color} />}

      {/* Droits d'accès par utilisateur */}
      {isDroits && <DroitsView accent={mod.color} />}

      {/* Paramétrages screen */}
      {isSettings && view.kind === "settings" && <SettingsView scope={view.scope} accent={mod.color} />}

      {/* Rapports screen */}
      {isReports && view.kind === "reports" && <ReportsView scope={view.scope} accent={mod.color} />}

      {!isBalance && !isTreso && !isCrm && !isMvt && !isGpao && !isSeries && !isInventaire && !isEntretien && !isTransferts && !isRefArt && !isCharges && !isProjets && !isDroits && !isSettings && !isReports && (
      <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-primary)] shadow-sm overflow-hidden">
        {isInfo ? (
          <div className="p-12 text-center text-[var(--text-secondary)]">
            <FileText size={40} className="mx-auto mb-3 opacity-20" />
            <div className="font-semibold text-[var(--text-primary)]">{view.message ?? sub.label}</div>
            <p className="text-sm mt-1 opacity-70">Module disponible — écran dédié</p>
          </div>
        ) : (
          <div className="p-3 space-y-3">
            {/* Toolbar */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 min-w-48">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} placeholder="Recherche globale…"
                  className="pl-9 pr-4 py-2 text-sm bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl w-full focus:outline-none" />
              </div>
              <button title="Actualiser" onClick={() => fetchRows()} className="p-2 rounded-xl border border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-[var(--accent-light)]"><RefreshCw size={15} /></button>
              {wres && (
                <>
                  <button title="Ajouter" onClick={() => setEditing({})} className="flex items-center gap-1.5 text-white px-3 py-2 rounded-xl text-sm font-medium" style={{ background: mod.color }}><Plus size={15} /> Ajouter</button>
                  <button title="Modifier" disabled={!selected} onClick={() => { const row = rows.find((r) => rowId(view, r) === selected); if (row) setEditing(row); }}
                    className="p-2 rounded-xl border border-[var(--border-primary)] text-blue-600 hover:bg-blue-50 disabled:opacity-30"><Pencil size={15} /></button>
                  <button title="Supprimer" disabled={!selected} onClick={remove}
                    className="p-2 rounded-xl border border-[var(--border-primary)] text-red-600 hover:bg-red-50 disabled:opacity-30"><Trash2 size={15} /></button>
                </>
              )}
              {view.kind === "articles" && (
                <>
                  <button title="Mouvements de l'article" disabled={!selected}
                    onClick={() => { const row = rows.find((r) => rowId(view, r) === selected); if (row) setMouvementsFor(row); }}
                    className="flex items-center gap-1.5 border border-[var(--border-primary)] px-3 py-2 rounded-xl text-sm hover:bg-[var(--accent-light)] disabled:opacity-30"
                    style={{ color: mod.color }}><ArrowRightLeft size={15} /> Mouvements</button>
                  <button title="Nomenclature de l'article" disabled={!selected}
                    onClick={() => { const row = rows.find((r) => rowId(view, r) === selected); if (row) setNomenclatureFor(row); }}
                    className="flex items-center gap-1.5 border border-[var(--border-primary)] px-3 py-2 rounded-xl text-sm text-violet-600 hover:bg-violet-50 disabled:opacity-30">
                    <Network size={15} /> Nomenclature</button>
                </>
              )}
              {view.kind === "documents" && (
                <>
                  <button title="Lignes du document" disabled={!selected} onClick={() => selected && setLinesFor(selected)}
                    className="flex items-center gap-1.5 border border-[var(--border-primary)] px-3 py-2 rounded-xl text-sm hover:bg-[var(--accent-light)] disabled:opacity-30" style={{ color: mod.color }}><FileText size={15} /> Lignes</button>
                  <button title="Transformer le document" disabled={!selected}
                    onClick={() => { const row = rows.find((r) => rowId(view, r) === selected); if (row) setTransformFor(row); }}
                    className="flex items-center gap-1.5 border border-[var(--border-primary)] px-3 py-2 rounded-xl text-sm text-violet-600 hover:bg-violet-50 disabled:opacity-30"><ArrowRightLeft size={15} /> Transformer</button>
                </>
              )}
              <button title="Imprimer" data-impression="masquer" onClick={() => window.print()} className="p-2 rounded-xl border border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-[var(--accent-light)]"><Printer size={15} /></button>
              <button title="Exporter Excel" data-impression="masquer" onClick={exportExcel} disabled={exportEnCours} className="flex items-center gap-1.5 border border-[var(--border-primary)] text-emerald-600 px-3 py-2 rounded-xl text-sm hover:bg-emerald-50 disabled:opacity-40"><Download size={15} /> {exportEnCours ? "Export…" : "Excel"}</button>
            </div>

            {/* Table */}
            <div className="overflow-auto rounded-xl border border-[var(--border-primary)] max-h-[calc(100vh-320px)]">
              <table className="w-full text-sm border-collapse">
                <thead className="bg-[var(--bg-primary)] border-b border-[var(--border-primary)] sticky top-0 z-10">
                  <tr>
                    {wres && <th className="w-8 px-2" />}
                    {cols.map((c) => {
                      const isNum = c.type === "money" || c.type === "num";
                      return (
                        <th key={c.key} onClick={() => toggleSort(c)}
                          className={`px-3 py-2.5 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide whitespace-nowrap ${isNum ? "text-right" : "text-left"} ${c.sortable ? "cursor-pointer select-none hover:text-[var(--text-primary)]" : ""}`}>
                          <span className={`inline-flex items-center gap-1 ${isNum ? "flex-row-reverse" : ""}`}>
                            {c.label}
                            {sort?.field === c.key && (sort.dir === "asc" ? <ChevronUp size={11} /> : <ChevronDown size={11} />)}
                          </span>
                        </th>
                      );
                    })}
                  </tr>
                  {hasFilters && (
                    <tr className="bg-[var(--bg-card)]">
                      {wres && <th className="px-2" />}
                      {cols.map((c) => (
                        <th key={c.key} className="px-2 py-1.5">
                          {c.filter ? (
                            <input value={filters[c.key] ?? ""} onChange={(e) => { setFilters((f) => ({ ...f, [c.key]: e.target.value })); setPage(0); }}
                              placeholder="🔍" className="w-full min-w-[80px] px-2 py-1 text-xs bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg focus:outline-none font-normal normal-case" />
                          ) : null}
                        </th>
                      ))}
                    </tr>
                  )}
                </thead>
                <tbody>
                  {rows.map((row, i) => {
                    const id = rowId(view, row);
                    const sel = selected === id;
                    return (
                      <motion.tr key={id || i} onClick={() => wres && setSelected(sel ? null : id)}
                        onDoubleClick={() => view.kind === "documents" && id && setLinesFor(id)}
                        title={view.kind === "documents" ? "Double-cliquer pour voir les lignes" : undefined}
                        className={`transition border-b border-[var(--border-primary)]/60 ${view.kind === "documents" ? "cursor-pointer" : "cursor-default"} ${sel ? "bg-[var(--accent-light)]" : i % 2 ? "bg-[var(--bg-primary)]/30 hover:bg-[var(--accent-light)]" : "hover:bg-[var(--accent-light)]"}`}
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.008, 0.2) }}>
                        {wres && <td className="px-2 text-center align-middle"><input type="radio" checked={sel} readOnly className="accent-current" style={{ accentColor: mod.color }} /></td>}
                        {cols.map((c) => {
                          const isLongText = !c.type || c.type === "text";
                          const isName = ["designation", "raisonSocial", "libelle"].includes(c.key);
                          const isStrong = ["raisonSocial", "designation", "label", "libelle", "refArt", "refDoc"].includes(c.key);
                          const raw = row[c.key];
                          const titleAttr = isLongText && raw != null ? String(raw) : undefined;
                          // name columns get more width; long text truncates via an inner div (reliable in tables)
                          const widthPx = isName ? 280 : isLongText ? 150 : undefined;
                          const numClass = c.type === "money" || c.type === "num" ? "font-medium tabular-nums text-right" : "";
                          const strongClass = isStrong ? "font-medium text-[var(--text-primary)]" : "text-[var(--text-secondary)]";
                          return (
                            <td key={c.key} title={titleAttr}
                              className={`px-3 h-11 align-middle whitespace-nowrap ${numClass} ${strongClass}`}
                              style={widthPx ? { maxWidth: widthPx } : undefined}>
                              {isLongText
                                ? <div className="truncate" style={widthPx ? { maxWidth: widthPx } : undefined}>{renderCell(row, c)}</div>
                                : renderCell(row, c)}
                            </td>
                          );
                        })}
                      </motion.tr>
                    );
                  })}
                  {!loading && rows.length === 0 && <tr><td colSpan={cols.length + 1} className="px-3 py-10 text-center text-slate-400 text-sm">Aucun enregistrement</td></tr>}
                  {loading && <tr><td colSpan={cols.length + 1} className="px-3 py-10 text-center text-slate-400 text-sm">Chargement…</td></tr>}
                </tbody>
                {total != null && (
                  <tfoot className="bg-[var(--bg-primary)] border-t-2 border-[var(--border-primary)] sticky bottom-0">
                    <tr>
                      {wres && <td />}
                      {cols.map((c, ci) => {
                        const totalCol = cols.find((x) => x.type === "money");
                        if (ci === 0 && c.key !== totalCol?.key) return <td key={c.key} className="px-3 py-2.5 font-bold text-[var(--text-primary)] text-xs uppercase tracking-wide">Total</td>;
                        if (c.key === totalCol?.key) return <td key={c.key} className="px-3 py-2.5 font-black tabular-nums" style={{ color: mod.color }}>{fmtMoney(total)} TND</td>;
                        return <td key={c.key} />;
                      })}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* Pager */}
            <div className="flex items-center justify-between px-1">
              <span className="text-xs text-[var(--text-secondary)]">{meta.total.toLocaleString("fr-TN")} ligne(s){meta.pages > 1 ? ` · page ${page + 1}/${meta.pages}` : ""}</span>
              {meta.pages > 1 && (
                <div className="flex gap-1">
                  <button disabled={page === 0} onClick={() => setPage(page - 1)} className="p-1.5 border border-[var(--border-primary)] rounded-lg text-[var(--text-secondary)] disabled:opacity-30 hover:bg-[var(--accent-light)]"><ChevronLeft size={14} /></button>
                  <button disabled={page + 1 >= meta.pages} onClick={() => setPage(page + 1)} className="p-1.5 border border-[var(--border-primary)] rounded-lg text-[var(--text-secondary)] disabled:opacity-30 hover:bg-[var(--accent-light)]"><ChevronRight size={14} /></button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      )}

      {/* Lignes du document (articles vendus/achetés) */}
      {/* Mouvements et nomenclature de l'article sélectionné. */}
      {mouvementsFor && (
        <ArticleMouvements
          refArt={String(mouvementsFor.refArt)}
          designation={String(mouvementsFor.designation ?? "")}
          accent={mod.color}
          onClose={() => setMouvementsFor(null)}
        />
      )}

      {nomenclatureFor && (
        <ArticleNomenclature
          refArt={String(nomenclatureFor.refArt)}
          designation={String(nomenclatureFor.designation ?? "")}
          accent={mod.color}
          onClose={() => setNomenclatureFor(null)}
        />
      )}

      {linesFor && (
        <DocumentLines
          refDoc={linesFor}
          accent={mod.color}
          onClose={() => setLinesFor(null)}
          onSaved={(m) => { flash(m); fetchRows(); }}
        />
      )}

      {/* Transformation Devis → BL → Facture */}
      {transformFor && (
        <TransformDialog
          doc={transformFor}
          accent={mod.color}
          onClose={() => setTransformFor(null)}
          onDone={(m) => { flash(m); setSelected(null); fetchRows(); }}
        />
      )}

      {/* CRUD modal */}
      {/* Rich Fiche article form for articles */}
      {editing && view.kind === "articles" && (
        <ArticleForm
          initial={editing}
          accent={mod.color}
          onClose={() => setEditing(null)}
          onSaved={(m) => { flash(m); if (!m.startsWith("Erreur")) { setEditing(null); fetchRows(); } }}
        />
      )}

      {/* Rich Fiche règlement form */}
      {editing && view.kind === "reglements" && (
        <ReglementForm
          initial={editing}
          sens={view.sens}
          accent={mod.color}
          onClose={() => setEditing(null)}
          onSaved={(m) => { flash(m); if (!m.startsWith("Erreur")) { setEditing(null); fetchRows(); } }}
        />
      )}

      {/* Generic modal for other non-article, non-reglement resources */}
      {editing && view.kind !== "articles" && view.kind !== "reglements" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setEditing(null)}>
          <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-primary)] w-full max-w-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-primary)]" style={{ background: mod.color + "12" }}>
              <h3 className="font-bold text-sm">{Object.keys(editing).length === 0 ? "Ajouter" : "Modifier"} — {sub.label}</h3>
              <button onClick={() => setEditing(null)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"><X size={18} /></button>
            </div>
            <form className="p-5 grid sm:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto" onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const form: Row = {};
              for (const c of editableCols) form[c.key] = fd.get(c.key);
              // carry id keys for update
              if ((view.kind === "partners" || view.kind === "accounts" || view.kind === "machines") && editing && editing.id != null) form.id = editing.id;
              if (view.kind === "documents" && editing && editing.refDoc) form.refDoc = editing.refDoc;
              save(form);
            }}>
              {/* Champs regroupés par section : une fiche de 20 champs en liste
                  continue est illisible et masque les erreurs de saisie. */}
              {groupesForm.map(([groupe, champs]) => (
                <div key={groupe} className="sm:col-span-2">
                  {groupe && (
                    <div className="text-[10px] font-black uppercase tracking-wider mb-2 pb-1
                                    border-b border-[var(--border-primary)]"
                      style={{ color: mod.color }}>
                      {groupe}
                    </div>
                  )}
                  <div className="grid sm:grid-cols-2 gap-3">
                    {champs.map((c) => (
                      <label key={c.key}
                        className={`flex flex-col gap-1 text-xs ${c.large ? "sm:col-span-2" : ""}`}>
                        <span className="font-semibold text-[var(--text-secondary)]">
                          {c.label}{c.required && <span className="text-red-500"> *</span>}
                        </span>
                        {c.optionsKey ? (
                          <ChampListe
                            nom={c.key}
                            valeurInitiale={editing[c.key] != null ? String(editing[c.key]) : ""}
                            options={optionsForm[c.key] ?? []}
                            placeholder={`Choisir ${c.label.toLowerCase()}…`}
                            accent={mod.color}
                          />
                        ) : (
                          <input name={c.key} required={c.required}
                            // Les dates arrivent en ISO complet ; <input type="date">
                            // n'accepte que YYYY-MM-DD.
                            defaultValue={editing[c.key] != null
                              ? (c.type === "date" ? String(editing[c.key]).slice(0, 10) : String(editing[c.key]))
                              : ""}
                            type={c.type === "money" || c.type === "num" ? "number" : c.type === "date" ? "date" : "text"} step="any"
                            className="px-3 py-2 text-sm bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg focus:outline-none" />
                        )}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              <div className="sm:col-span-2 flex justify-end gap-2 pt-2 border-t border-[var(--border-primary)] mt-2">
                <button type="button" onClick={() => setEditing(null)} className="px-4 py-2 text-sm rounded-xl border border-[var(--border-primary)] text-[var(--text-secondary)]">Annuler</button>
                <button type="submit" disabled={busy} className="px-4 py-2 text-sm font-medium text-white rounded-xl disabled:opacity-50" style={{ background: mod.color }}>{busy ? "…" : "Enregistrer"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[var(--bg-card)] border border-[var(--border-primary)] shadow-xl rounded-xl px-4 py-3 text-sm font-medium animate-fade-in">
          {toast}
        </div>
      )}
    </div>
  );
}
