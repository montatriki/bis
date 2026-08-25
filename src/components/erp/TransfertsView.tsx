"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { confirmer } from "@/lib/alertes";
import { Loader2, Plus, Check, X, Trash2, Search, ArrowRight, AlertTriangle,
  Pencil, Printer, FileDown, ArrowUpCircle } from "lucide-react";

// Liste des transferts de stock — reprend l'écran « Liste des transferts » de
// l'ERP d'origine : filtres document / commercial / période, colonnes dépôt
// d'origine et de destination, suivi généré / facturé / comptabilisé.
//
// Différence assumée avec l'original : la validation déplace réellement le
// stock d'un emplacement à l'autre. Dans l'ancienne application, les cases
// n'étaient que des témoins et la marchandise devait être bougée à la main.

type Doc = {
  refDoc: string; dateDoc: string | null; libDoc: string | null;
  commercial: string | null; raisonSocial: string | null; codeCli: number | null;
  transferFrom: string | null; transferTo: string | null;
  thtNet: number; ttcNet: number; soldeDoc: number; totalRegle: number;
  generer: boolean; facturer: boolean; comptabiliser: boolean;
  valide: boolean; utilisateur: string | null;
};

const fmt3 = (v: unknown) =>
  new Intl.NumberFormat("fr-TN", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(Number(v) || 0);
const fmtD = (v: string | null) => (v ? new Date(v).toLocaleDateString("fr-FR") : "—");

/** Période par défaut : l'année civile en cours, comme l'écran d'origine. */
function anneeCourante() {
  const a = new Date().getFullYear();
  return { du: `${a}-01-01`, au: `${a}-12-31` };
}

export default function TransfertsView({ accent }: { accent: string }) {
  const periode = useMemo(() => anneeCourante(), []);
  const [du, setDu] = useState(periode.du);
  const [au, setAu] = useState(periode.au);
  const [commercial, setCommercial] = useState("");
  const [depot, setDepot] = useState("");
  const [etat, setEtat] = useState("");
  const [rows, setRows] = useState<Doc[]>([]);
  const [totaux, setTotaux] = useState({ ht: 0, ttc: 0, solde: 0 });
  const [depots, setDepots] = useState<string[]>([]);
  const [commerciaux, setCommerciaux] = useState<string[]>([]);
  const [load, setLoad] = useState(true);
  const [reload, setReload] = useState(0);
  const [sel, setSel] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [form, setForm] = useState(false);
  const [busy, setBusy] = useState(false);
  /** Transfert ouvert en consultation / modification. */
  const [fiche, setFiche] = useState<string | null>(null);

  const flash = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 5000);
  }, []);

  useEffect(() => {
    let annule = false;
    const qs = new URLSearchParams({ du, au });
    if (commercial) qs.set("commercial", commercial);
    if (depot) qs.set("depot", depot);
    if (etat) qs.set("etat", etat);
    fetch(`/api/transferts?${qs}`)
      .then((r) => r.json())
      .then((d) => {
        if (annule) return;
        setRows(d.rows ?? []);
        setTotaux(d.totaux ?? { ht: 0, ttc: 0, solde: 0 });
        setDepots(d.depots ?? []);
        setCommerciaux(d.commerciaux ?? []);
        setLoad(false);
      })
      .catch(() => { if (!annule) setLoad(false); });
    return () => { annule = true; };
  }, [du, au, commercial, depot, etat, reload]);

  async function agir(refDoc: string, action: "valider" | "devalider", forcer = false) {
    setBusy(true);
    const r = await fetch("/api/transferts", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refDoc, action, forcer }),
    }).then((x) => x.json()).catch(() => ({ error: "réseau" }));
    setBusy(false);

    // Stock insuffisant : on propose de forcer plutôt que de bloquer, mais
    // l'écart est annoncé article par article.
    if (r.code === "stock-insuffisant") {
      const forcer = await confirmer("", {
        titre: "Stock insuffisant",
        html: `${r.error}<br><br>Le dépôt d'origine passera en négatif.`,
        intitule: "Valider quand même",
        danger: true,
      });
      if (forcer) return agir(refDoc, action, true);
      return;
    }
    flash(r.message ?? r.error ?? "Échec", Boolean(r.ok));
    if (r.ok) setReload((k) => k + 1);
  }

  /** Export CSV de la liste filtrée — équivalent du bouton « imprimer liste ». */
  function exporter() {
    const entetes = ["Référence","Date","Commercial","Dépôt du","Dépôt au",
                     "Total HT","Total TTC","Généré","Facturé","Comptabilisé","Utilisateur"];
    const lignes = rows.map((d) => [
      d.refDoc, fmtD(d.dateDoc), d.commercial ?? "", d.transferFrom ?? "", d.transferTo ?? "",
      fmt3(d.thtNet), fmt3(d.ttcNet),
      d.generer ? "oui" : "non", d.facturer ? "oui" : "non", d.comptabiliser ? "oui" : "non",
      d.utilisateur ?? "",
      // Le point-virgule sépare les colonnes : on le neutralise dans les valeurs.
    ].map((v) => String(v).replace(/;/g, ",")).join(";"));
    // BOM UTF-8 : sans lui Excel affiche « DÃ©pÃ´t ».
    const csv = "\uFEFF" + [entetes.join(";"), ...lignes].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = `transferts_${du}_${au}.csv`; a.click();
    URL.revokeObjectURL(url);
    flash(`${rows.length} ligne(s) exportée(s)`);
  }

  /** Ouvre la fiche en mode impression : le bon de transfert du document. */
  function imprimer(refDoc: string) {
    setFiche(refDoc);
    // La fiche déclenche l'impression une fois ses lignes chargées.
    setTimeout(() => window.dispatchEvent(new CustomEvent("transfert:imprimer")), 900);
  }

  async function supprimer(refDoc: string) {
    if (!(await confirmer(`Supprimer le transfert ${refDoc} ?`, { danger: true }))) return;
    const r = await fetch(`/api/transferts?refDoc=${encodeURIComponent(refDoc)}`, { method: "DELETE" })
      .then((x) => x.json()).catch(() => ({ error: "réseau" }));
    flash(r.message ?? r.error ?? "Échec", Boolean(r.ok));
    if (r.ok) { setSel(null); setReload((k) => k + 1); }
  }

  return (
    <div className="space-y-3">
      {toast && (
        <div className={`fixed top-20 right-6 z-50 px-4 py-2.5 rounded-xl text-sm font-semibold shadow-xl ${
          toast.ok ? "bg-slate-900 text-white" : "bg-red-600 text-white"}`}>
          {toast.msg}
        </div>
      )}

      {/* Barre de filtres : mêmes critères que l'écran d'origine. */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-2xl p-3 flex flex-wrap items-end gap-3">
        <Champ label="Dépôt">
          <select value={depot} onChange={(e) => { setLoad(true); setDepot(e.target.value); }} className={cls}>
            <option value="">Tous</option>
            {depots.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </Champ>
        <Champ label="Commercial">
          <select value={commercial} onChange={(e) => { setLoad(true); setCommercial(e.target.value); }} className={cls}>
            <option value="">Tous</option>
            {commerciaux.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Champ>
        <Champ label="Du">
          <input type="date" value={du} onChange={(e) => { setLoad(true); setDu(e.target.value); }} className={cls} />
        </Champ>
        <Champ label="Au">
          <input type="date" value={au} onChange={(e) => { setLoad(true); setAu(e.target.value); }} className={cls} />
        </Champ>
        <Champ label="État">
          <select value={etat} onChange={(e) => { setLoad(true); setEtat(e.target.value); }} className={cls}>
            <option value="">Tous</option>
            <option value="attente">À valider</option>
            <option value="valide">Validés</option>
          </select>
        </Champ>

        {/* Barre d'outils : les mêmes actions que l'écran d'origine —
            rechercher, ajouter, modifier, supprimer, imprimer le document,
            transformer, exporter la liste. Celles qui portent sur une ligne
            restent inactives tant qu'aucune n'est sélectionnée. */}
        <div className="flex gap-1.5 ml-auto items-center">
          <Outil titre="Rechercher" onClick={() => setReload((k) => k + 1)}>
            <Search size={15} />
          </Outil>
          <Outil titre="Modifier / consulter" disabled={!sel}
            onClick={() => sel && setFiche(sel)}>
            <Pencil size={15} />
          </Outil>
          <Outil titre="Supprimer" ton="suppr" disabled={!sel}
            onClick={() => sel && supprimer(sel)}>
            <Trash2 size={15} />
          </Outil>
          <Outil titre="Imprimer le bon de transfert" disabled={!sel}
            onClick={() => sel && imprimer(sel)}>
            <Printer size={15} />
          </Outil>
          <Outil titre="Valider / dévalider" disabled={!sel}
            onClick={() => {
              const d = rows.find((r) => r.refDoc === sel);
              if (d) agir(d.refDoc, d.valide ? "devalider" : "valider");
            }}>
            <ArrowUpCircle size={15} />
          </Outil>
          <Outil titre="Exporter la liste (CSV)" onClick={exporter}>
            <FileDown size={15} />
          </Outil>

          {/* Séparateur : l'action principale se distingue des outils. */}
          <div className="w-px h-6 bg-[var(--border-primary)] mx-1" />

          <button onClick={() => setForm(true)}
            className="flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-sm font-semibold text-white
                       transition hover:opacity-90"
            style={{ background: accent }}>
            <Plus size={15} /> Nouveau transfert
          </button>
        </div>
      </div>

      <div className="flex gap-6 flex-wrap px-1">
        <Total titre="Total HT" valeur={totaux.ht} />
        <Total titre="Total TTC" valeur={totaux.ttc} />
        <Total titre="Documents" valeur={rows.length} brut />
      </div>

      <div className="overflow-auto rounded-2xl border border-[var(--border-primary)] max-h-[58vh]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--bg-primary)] sticky top-0 z-10">
            <tr className="text-[10px] uppercase tracking-wide text-[var(--text-secondary)]">
              <th className="px-3 py-2.5 w-8" />
              <th className="px-3 py-2.5 text-left font-bold">Référence</th>
              <th className="px-3 py-2.5 text-left font-bold">Date</th>
              <th className="px-3 py-2.5 text-left font-bold">Commercial</th>
              <th className="px-3 py-2.5 text-left font-bold">Dépôt du</th>
              <th className="px-3 py-2.5 text-left font-bold">Dépôt au</th>
              <th className="px-3 py-2.5 text-right font-bold">Total HT</th>
              <th className="px-3 py-2.5 text-right font-bold">Total TTC</th>
              <th className="px-3 py-2.5 text-center font-bold">Généré</th>
              <th className="px-3 py-2.5 text-center font-bold">Facturé</th>
              <th className="px-3 py-2.5 text-center font-bold">Compta.</th>
              <th className="px-3 py-2.5 text-left font-bold">Utilisateur</th>
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-primary)]">
            {load ? (
              <tr><td colSpan={13} className="py-14 text-center">
                <Loader2 className="animate-spin inline text-slate-300" /></td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={13} className="py-14 text-center text-sm text-[var(--text-secondary)]">
                Aucun transfert sur cette période. Créez-en un avec « Nouveau transfert ».
              </td></tr>
            ) : rows.map((d) => (
              <tr key={d.refDoc}
                  onClick={() => setSel(sel === d.refDoc ? null : d.refDoc)}
                  className={`cursor-pointer transition ${sel === d.refDoc ? "bg-[var(--accent-light)]" : "hover:bg-[var(--bg-primary)]"}`}>
                <td className="px-3 py-2 text-center">
                  <input type="radio" readOnly checked={sel === d.refDoc} style={{ accentColor: accent }} />
                </td>
                <td className="px-3 py-2 font-bold text-[var(--text-primary)]">{d.refDoc}</td>
                <td className="px-3 py-2 text-xs">{fmtD(d.dateDoc)}</td>
                <td className="px-3 py-2 text-xs">{d.commercial ?? "—"}</td>
                <td className="px-3 py-2 text-xs font-semibold">{d.transferFrom ?? "—"}</td>
                <td className="px-3 py-2 text-xs font-semibold">{d.transferTo ?? "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmt3(d.thtNet)}</td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold">{fmt3(d.ttcNet)}</td>
                <td className="px-3 py-2 text-center"><Case on={d.generer} /></td>
                <td className="px-3 py-2 text-center"><Case on={d.facturer} /></td>
                <td className="px-3 py-2 text-center"><Case on={d.comptabiliser} /></td>
                <td className="px-3 py-2 text-xs text-[var(--text-secondary)]">{d.utilisateur ?? "—"}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {d.valide ? (
                    <button onClick={(e) => { e.stopPropagation(); agir(d.refDoc, "devalider"); }} disabled={busy}
                      className="text-[10px] font-bold px-2 py-1 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100">
                      Dévalider
                    </button>
                  ) : (
                    <>
                      <button onClick={(e) => { e.stopPropagation(); agir(d.refDoc, "valider"); }} disabled={busy}
                        className="text-[10px] font-bold px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100">
                        Valider
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); supprimer(d.refDoc); }}
                        className="ml-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-100">
                        <Trash2 size={11} />
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-[var(--text-secondary)] px-1">
        La validation déplace réellement les quantités du dépôt d&apos;origine vers le dépôt
        de destination et reporte le coût moyen pondéré. Un transfert dévalidé restitue le stock.
      </p>

      {fiche && (
        <FicheTransfert refDoc={fiche} accent={accent}
          onClose={() => setFiche(null)}
          onChange={() => setReload((k) => k + 1)} />
      )}

      {form && (
        <FormTransfert accent={accent} depots={depots}
          onClose={() => setForm(false)}
          onCree={(m) => { setForm(false); flash(m); setReload((k) => k + 1); }} />
      )}
    </div>
  );
}

const cls = "px-3 py-2 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-card)] text-sm";

/**
 * Bouton de la barre d'outils.
 *
 * L'ERP d'origine empile six pastilles pleines et saturées (vert, jaune, rouge,
 * bleu…) : lisible sur son thème d'origine, criard sur celui-ci et sans
 * hiérarchie — tout crie aussi fort. On garde donc un seul bouton plein pour
 * l'action principale, les autres restant discrets ; la couleur ne sert plus
 * qu'à signaler ce qui est destructif.
 */
const TONS: Record<string, string> = {
  // Action destructive : la seule à mériter une couleur d'alerte, et seulement
  // au survol, pour ne pas attirer l'œil en permanence.
  suppr: "text-[var(--text-secondary)] hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200",
};

function Outil({
  titre, ton, disabled, onClick, children,
}: {
  titre: string; ton?: string; disabled?: boolean;
  onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button title={titre} aria-label={titre} onClick={onClick} disabled={disabled}
      className={`w-9 h-9 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-card)]
        flex items-center justify-center transition
        disabled:opacity-35 disabled:cursor-not-allowed
        ${ton ? TONS[ton] : "text-[var(--text-secondary)] hover:bg-[var(--bg-primary)] hover:text-[var(--text-primary)]"}`}>
      {children}
    </button>
  );
}

function Champ({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)] mb-1">{label}</span>
      {children}
    </label>
  );
}

function Case({ on }: { on: boolean }) {
  return on
    ? <Check size={14} className="inline text-emerald-600" />
    : <X size={13} className="inline text-slate-300" />;
}

function Total({ titre, valeur, brut }: { titre: string; valeur: number; brut?: boolean }) {
  return (
    <div>
      <div className="text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)]">{titre}</div>
      <div className="text-base font-extrabold tabular-nums text-[var(--text-primary)]">
        {brut ? valeur : `${fmt3(valeur)} TND`}
      </div>
    </div>
  );
}

type LigneSaisie = { refArt: string; designation: string; qte: number; puHt: number; dispo: number };

function FormTransfert({
  accent, depots, onClose, onCree,
}: {
  accent: string; depots: string[]; onClose: () => void; onCree: (m: string) => void;
}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [recherche, setRecherche] = useState("");
  const [trouves, setTrouves] = useState<{ refArt: string; designation: string; puAchat: number }[]>([]);
  const [lignes, setLignes] = useState<LigneSaisie[]>([]);
  const [stockSource, setStockSource] = useState<Record<string, number>>({});
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // Stock du dépôt d'origine : sans lui, on saisit à l'aveugle et le transfert
  // échoue à la validation.
  useEffect(() => {
    let annule = false;
    if (!from) {
      // Vidage différé : modifier l'état dans le corps de l'effet provoque un
      // rendu en cascade.
      const t = setTimeout(() => { if (!annule) setStockSource({}); }, 0);
      return () => { annule = true; clearTimeout(t); };
    }
    fetch(`/api/erp?resource=stock-depot&emplacement=${encodeURIComponent(from)}`)
      .then((r) => r.json())
      .then((d) => {
        if (annule) return;
        const m: Record<string, number> = {};
        for (const r of d.rows ?? []) m[r.refArt] = r.quantite;
        setStockSource(m);
      })
      .catch(() => {});
    return () => { annule = true; };
  }, [from]);

  useEffect(() => {
    let annule = false;
    if (recherche.trim().length < 2) {
      const t = setTimeout(() => { if (!annule) setTrouves([]); }, 0);
      return () => { annule = true; clearTimeout(t); };
    }
    const t = setTimeout(() => {
      fetch(`/api/erp?resource=articles&search=${encodeURIComponent(recherche)}`)
        .then((r) => r.json())
        .then((d) => { if (!annule) setTrouves((d.rows ?? []).slice(0, 8)); })
        .catch(() => {});
    }, 250);
    return () => { annule = true; clearTimeout(t); };
  }, [recherche]);

  const totalHt = lignes.reduce((t, l) => t + l.qte * l.puHt, 0);

  async function valider() {
    setErreur(null);
    setEnvoi(true);
    const r = await fetch("/api/transferts", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transferFrom: from, transferTo: to, lignes }),
    }).then((x) => x.json()).catch(() => ({ error: "réseau" }));
    setEnvoi(false);
    if (r.ok) onCree(r.message ?? "Transfert créé"); else setErreur(r.error ?? "Échec");
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col"
           onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-100 font-bold text-sm">Nouveau transfert de stock</div>

        <div className="p-5 space-y-3 overflow-auto">
          <div className="flex items-end gap-3">
            <Champ label="Dépôt d'origine">
              <select value={from} onChange={(e) => setFrom(e.target.value)} className={cls}>
                <option value="">— Choisir —</option>
                {depots.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </Champ>
            <ArrowRight size={18} className="mb-2.5 text-slate-400" />
            <Champ label="Dépôt de destination">
              <select value={to} onChange={(e) => setTo(e.target.value)} className={cls}>
                <option value="">— Choisir —</option>
                {depots.filter((d) => d !== from).map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </Champ>
          </div>

          <Champ label="Ajouter un article">
            <input value={recherche} onChange={(e) => setRecherche(e.target.value)}
              placeholder="Référence ou désignation…" className={`${cls} w-full`} disabled={!from} />
          </Champ>

          {trouves.length > 0 && (
            <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 max-h-44 overflow-auto">
              {trouves.map((a) => {
                const dispo = stockSource[a.refArt] ?? 0;
                return (
                  <button key={a.refArt}
                    onClick={() => {
                      setLignes((p) => p.some((l) => l.refArt === a.refArt) ? p
                        : [...p, { refArt: a.refArt, designation: a.designation, qte: 1, puHt: a.puAchat, dispo }]);
                      setRecherche(""); setTrouves([]);
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex justify-between gap-3">
                    <span className="truncate">{a.designation}</span>
                    <span className={`text-xs shrink-0 ${dispo > 0 ? "text-emerald-600" : "text-red-500"}`}>
                      {fmt3(dispo)} dispo
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {lignes.length > 0 && (
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase text-slate-500">
                <tr>
                  <th className="text-left py-1">Article</th>
                  <th className="text-right py-1 w-24">Qté</th>
                  <th className="text-right py-1 w-24">Dispo</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {lignes.map((l, i) => (
                  <tr key={l.refArt}>
                    <td className="py-1.5 truncate max-w-[240px]">{l.designation}</td>
                    <td className="py-1.5 text-right">
                      <input type="number" min={0} step="any" value={l.qte}
                        onChange={(e) => setLignes((p) => p.map((x, j) =>
                          j === i ? { ...x, qte: Number(e.target.value) } : x))}
                        className="w-20 px-2 py-1 rounded-lg border border-slate-200 text-right text-sm" />
                    </td>
                    <td className={`py-1.5 text-right text-xs ${l.qte > l.dispo ? "text-red-600 font-bold" : "text-slate-500"}`}>
                      {fmt3(l.dispo)}
                    </td>
                    <td className="py-1.5 text-right">
                      <button onClick={() => setLignes((p) => p.filter((_, j) => j !== i))}
                        className="text-red-500"><Trash2 size={13} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {lignes.some((l) => l.qte > l.dispo) && (
            <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 flex gap-2">
              <AlertTriangle size={13} className="shrink-0 mt-0.5" />
              Certaines quantités dépassent le stock disponible : la validation sera refusée
              sauf confirmation explicite.
            </div>
          )}

          {erreur && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{erreur}</div>
          )}
        </div>

        <div className="flex items-center gap-3 px-5 py-4 border-t border-slate-100">
          <div className="text-sm">
            <span className="text-slate-500">Total HT :</span>{" "}
            <b className="tabular-nums">{fmt3(totalHt)}</b>
          </div>
          <button onClick={onClose}
            className="ml-auto px-4 py-2.5 rounded-xl text-sm font-semibold border border-slate-200 text-slate-600">
            Annuler
          </button>
          <button onClick={valider} disabled={envoi || !from || !to || lignes.length === 0}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
            style={{ background: accent }}>
            {envoi ? "…" : "Créer le transfert"}
          </button>
        </div>
      </div>
    </div>
  );
}

type LigneDoc = {
  id: number; refArt: string; designation: string; qte: number; puHt: number;
  remise: number; tauxTva: number; thtNet: number; ttcNet: number; ordre: number;
  stockSource: number; stockDest: number; qteDeduite?: boolean;
};

/**
 * Fiche d'un transfert : en-tête et lignes d'articles.
 *
 * Reprend le « Formulaire transfert » de l'ERP d'origine — référence, date,
 * dépôt du / dépôt au, code mission, puis le détail des articles avec leur
 * disponible dans chaque dépôt et les totaux HT / TVA / TTC.
 */
function FicheTransfert({
  refDoc, accent, onClose, onChange,
}: {
  refDoc: string; accent: string; onClose: () => void; onChange: () => void;
}) {
  const [doc, setDoc] = useState<Doc | null>(null);
  const [lignes, setLignes] = useState<LigneDoc[]>([]);
  const [totaux, setTotaux] = useState({ ht: 0, tva: 0, ttc: 0 });
  const [load, setLoad] = useState(true);

  useEffect(() => {
    let annule = false;
    fetch(`/api/transferts?refDoc=${encodeURIComponent(refDoc)}`)
      .then((r) => r.json())
      .then((d) => {
        if (annule) return;
        setDoc(d.row ?? null);
        setLignes(d.lignes ?? []);
        setTotaux(d.totaux ?? { ht: 0, tva: 0, ttc: 0 });
        setLoad(false);
      })
      .catch(() => { if (!annule) setLoad(false); });
    return () => { annule = true; };
  }, [refDoc]);

  // Impression déclenchée depuis la barre d'outils : on attend que les lignes
  // soient là, sinon la feuille sortirait vide.
  useEffect(() => {
    const h = () => { if (!load) window.print(); };
    window.addEventListener("transfert:imprimer", h);
    return () => window.removeEventListener("transfert:imprimer", h);
  }, [load]);

  return (
    <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm flex items-center justify-center p-4"
         onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col print:max-w-none print:shadow-none"
           onClick={(e) => e.stopPropagation()}>

        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3 print:hidden">
          <div className="font-bold text-sm flex-1">
            Formulaire transfert
            <span className="ml-2 font-medium text-slate-400">{refDoc}</span>
          </div>
          <button title="Imprimer" onClick={() => window.print()}
            className="w-9 h-9 rounded-xl bg-yellow-400 text-white flex items-center justify-center">
            <Printer size={15} />
          </button>
          <button onClick={onClose}
            className="w-9 h-9 rounded-xl border border-slate-200 text-slate-400 flex items-center justify-center">
            <X size={15} />
          </button>
        </div>

        {load ? (
          <div className="py-20 text-center"><Loader2 className="animate-spin inline text-slate-300" /></div>
        ) : !doc ? (
          <div className="py-20 text-center text-sm text-slate-500">Transfert introuvable</div>
        ) : (
          <div className="overflow-auto flex-1">
            {/* En-tête : les mêmes champs que le formulaire d'origine. */}
            <div className="px-5 py-4 grid grid-cols-2 md:grid-cols-4 gap-3 border-b border-slate-100">
              <Info label="Référence document" valeur={doc.refDoc} />
              <Info label="Date document" valeur={fmtD(doc.dateDoc)} />
              <Info label="Dépôt du" valeur={doc.transferFrom ?? "—"} />
              <Info label="Dépôt au" valeur={doc.transferTo ?? "—"} />
              <Info label="Libellé" valeur={doc.libDoc ?? "—"} />
              <Info label="Commercial" valeur={doc.commercial ?? "—"} />
              <Info label="Utilisateur" valeur={doc.utilisateur ?? "—"} />
              <Info label="État" valeur={doc.valide ? "Validé" : "À valider"} />
            </div>

            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 sticky top-0">
                <tr>
                  <th className="px-3 py-2.5 text-left font-bold">#</th>
                  <th className="px-3 py-2.5 text-left font-bold">Référence</th>
                  <th className="px-3 py-2.5 text-left font-bold">Désignation</th>
                  <th className="px-3 py-2.5 text-right font-bold">PU HT</th>
                  <th className="px-3 py-2.5 text-right font-bold">Remise</th>
                  <th className="px-3 py-2.5 text-right font-bold">Qté</th>
                  <th className="px-3 py-2.5 text-right font-bold">Stock départ</th>
                  <th className="px-3 py-2.5 text-right font-bold">Stock arrivée</th>
                  <th className="px-3 py-2.5 text-right font-bold">Valeur HT</th>
                  <th className="px-3 py-2.5 text-right font-bold">Valeur TTC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {lignes.length === 0 ? (
                  <tr><td colSpan={10} className="py-10 text-center text-sm text-slate-500">
                    Aucune ligne d&apos;article sur ce transfert.
                  </td></tr>
                ) : lignes.map((l, i) => (
                  <tr key={l.id}>
                    <td className="px-3 py-2 text-slate-400">{l.ordre || i + 1}</td>
                    <td className="px-3 py-2 font-semibold text-xs">{l.refArt}</td>
                    <td className="px-3 py-2 truncate max-w-[240px]">{l.designation}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmt3(l.puHt)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-400">{l.remise || 0}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold"
                        title={l.qteDeduite ? "Quantité déduite de la valeur et du prix unitaire" : undefined}>
                      {fmt3(l.qte)}{l.qteDeduite && <span className="text-slate-400 font-normal"> *</span>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-500">{fmt3(l.stockSource)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-500">{fmt3(l.stockDest)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmt3(l.thtNet)}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">{fmt3(l.ttcNet)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!load && doc && (
          <div className="px-5 py-4 border-t border-slate-100 flex flex-wrap gap-6 items-center">
            <Total titre="Total HT" valeur={totaux.ht} />
            <Total titre="Total TVA" valeur={totaux.tva} />
            <Total titre="Total TTC" valeur={totaux.ttc} />
            <div className="ml-auto flex gap-2 print:hidden">
              <button onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-slate-200 text-slate-600">
                Fermer
              </button>
              <button
                onClick={async () => {
                  const r = await fetch("/api/transferts", {
                    method: "PUT", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ refDoc, action: doc.valide ? "devalider" : "valider", forcer: true }),
                  }).then((x) => x.json()).catch(() => ({}));
                  if (r.ok) { onChange(); onClose(); }
                }}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white"
                style={{ background: accent }}>
                {doc.valide ? "Dévalider" : "Valider le transfert"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Info({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div>
      <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</div>
      <div className="text-sm font-semibold text-slate-800 truncate">{valeur}</div>
    </div>
  );
}
