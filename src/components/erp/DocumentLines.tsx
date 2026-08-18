"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Save, Plus, Trash2, Search, X, FileText, Loader2, CheckCircle2, RotateCcw, Lock } from "lucide-react";
import { computeDocument, type LineInput } from "@/lib/document-calc";
import { docTypeRule } from "@/lib/document-types";

type Row = Record<string, unknown>;
const n = (v: unknown) => (v == null || v === "" ? 0 : Number(v)) || 0;
const sv = (v: unknown) => (v == null ? "" : String(v));
const fmtMoney = (v: number) =>
  new Intl.NumberFormat("fr-TN", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(Number(v) || 0);

type EditLine = LineInput & { key: string };

let seq = 0;
const newKey = () => `l${++seq}`;

const emptyLine = (): EditLine => ({
  key: newKey(),
  refArt: "",
  designation: "",
  unite: "U",
  qte: 1,
  puHt: 0,
  remise: 0,
  tauxTva: 19,
  tauxFodec: 0,
});

/**
 * Éditeur des lignes d'un document (articles vendus/achetés).
 * Les totaux sont calculés en direct côté client puis revalidés au serveur.
 */
export default function DocumentLines({
  refDoc,
  accent,
  onClose,
  onSaved,
  readOnly = false,
}: {
  refDoc: string;
  accent: string;
  onClose: () => void;
  onSaved?: (msg: string) => void;
  readOnly?: boolean;
}) {
  const [lines, setLines] = useState<EditLine[]>([]);
  const [doc, setDoc] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [picker, setPicker] = useState<string | null>(null); // key of line being filled

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/erp/document-lines?refDoc=${encodeURIComponent(refDoc)}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.error) setErr(d.error);
        else {
          setDoc(d.document ?? null);
          setLines(
            (d.rows ?? []).map((r: Row) => ({
              key: newKey(),
              refArt: sv(r.refArt),
              designation: sv(r.designation),
              unite: sv(r.unite) || "U",
              qte: n(r.qte),
              puHt: n(r.puHt),
              remise: n(r.remise),
              tauxTva: n(r.tauxTva),
              tauxFodec: n(r.tauxFodec),
            }))
          );
        }
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) { setErr("Chargement impossible"); setLoading(false); }
      });
    return () => { cancelled = true; };
  }, [refDoc]);

  // Recalcul en direct — mêmes règles que le serveur.
  const { lines: computed, totals } = useMemo(
    () => computeDocument(lines, n(doc?.timbre)),
    [lines, doc]
  );

  const patch = useCallback((key: string, field: keyof LineInput, value: unknown) => {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, [field]: value } : l)));
  }, []);

  const addLine = () => setLines((ls) => [...ls, emptyLine()]);
  const removeLine = (key: string) => setLines((ls) => ls.filter((l) => l.key !== key));

  // Un document validé a déjà impacté stock et solde : ses lignes sont figées.
  const isValide = Boolean(doc?.valide);
  const locked = readOnly || isValide;
  const rule = docTypeRule(doc?.typeDoc as string | undefined);

  async function toggleValidation() {
    setBusy(true);
    setErr(null);
    const action = isValide ? "devalider" : "valider";
    const r = await fetch(`/api/erp/document-validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refDoc, action }),
    })
      .then((x) => x.json())
      .catch(() => ({ ok: false, message: "réseau" }));
    setBusy(false);
    if (r.ok) {
      setDoc((d) => (d ? { ...d, valide: !isValide } : d));
      onSaved?.(r.message ?? "Document mis à jour");
    } else {
      setErr(r.message ?? r.error ?? "Échec de la validation");
    }
  }

  async function save() {
    setBusy(true);
    setErr(null);
    const r = await fetch(`/api/erp/document-lines`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        refDoc,
        lines: lines.map(({ key, ...l }) => l), // eslint-disable-line @typescript-eslint/no-unused-vars
      }),
    })
      .then((x) => x.json())
      .catch(() => ({ error: "réseau" }));
    setBusy(false);
    if (r.ok) {
      setDoc(r.document ?? doc);
      onSaved?.("Lignes enregistrées");
      onClose();
    } else {
      setErr(r.error ?? "Échec de l'enregistrement");
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* header */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[var(--border-primary)]">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: accent + "18", color: accent }}
          >
            <FileText size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-[var(--text-primary)] truncate">
              Lignes du document {refDoc}
            </div>
            {doc && (
              <div className="text-xs text-[var(--text-secondary)] truncate">
                {sv(doc.typeDoc)} · {sv(doc.raisonSocial) || "—"}
                {doc.dateDoc ? ` · ${new Date(String(doc.dateDoc)).toLocaleDateString("fr-FR")}` : ""}
              </div>
            )}
          </div>
          {!loading && doc && (
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold shrink-0 ${
                isValide ? "bg-emerald-500/12 text-emerald-600" : "bg-slate-500/12 text-[var(--text-secondary)]"
              }`}
              title={`Type ${rule.label} — stock ${rule.tStock}, solde ${rule.tSolde}`}
            >
              {isValide ? <Lock size={12} /> : <FileText size={12} />}
              {isValide ? "Validé" : "Brouillon"}
            </span>
          )}
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[var(--bg-primary)] text-[var(--text-secondary)]">
            <X size={18} />
          </button>
        </div>

        {isValide && (
          <div className="mx-5 mt-3 px-3 py-2 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs flex items-center gap-2">
            <Lock size={13} className="shrink-0" />
            Document validé — stock et solde client déjà impactés. Dévalidez pour modifier les lignes.
          </div>
        )}

        {err && (
          <div className="mx-5 mt-3 px-3 py-2 rounded-lg bg-red-500/10 text-red-500 text-sm">{err}</div>
        )}

        {/* table */}
        <div className="flex-1 overflow-auto px-5 py-4">
          {loading ? (
            <div className="py-16 text-center text-[var(--text-secondary)]">
              <Loader2 className="animate-spin mx-auto mb-2" size={22} /> Chargement…
            </div>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-[var(--text-secondary)]">
                  <th className="text-left font-semibold py-2 px-2">Référence</th>
                  <th className="text-left font-semibold py-2 px-2">Désignation</th>
                  <th className="text-right font-semibold py-2 px-2 w-20">Qté</th>
                  <th className="text-right font-semibold py-2 px-2 w-28">P.U. HT</th>
                  <th className="text-right font-semibold py-2 px-2 w-20">Rem %</th>
                  <th className="text-right font-semibold py-2 px-2 w-20">TVA %</th>
                  <th className="text-right font-semibold py-2 px-2 w-32">Total HT</th>
                  <th className="text-right font-semibold py-2 px-2 w-32">Total TTC</th>
                  {!locked && <th className="w-10" />}
                </tr>
              </thead>
              <tbody>
                {computed.map((c, i) => {
                  const l = lines[i];
                  return (
                    <tr key={l.key} className="border-t border-[var(--border-primary)]">
                      <td className="py-1.5 px-2">
                        <div className="flex items-center gap-1">
                          <input
                            readOnly={locked}
                            value={l.refArt}
                            onChange={(e) => patch(l.key, "refArt", e.target.value)}
                            className="w-28 px-2 py-1 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-md focus:outline-none"
                          />
                          {!locked && (
                            <button
                              onClick={() => setPicker(l.key)}
                              title="Rechercher un article"
                              className="p-1 rounded-md hover:bg-[var(--bg-primary)] text-[var(--text-secondary)]"
                            >
                              <Search size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="py-1.5 px-2">
                        <input
                          readOnly={locked}
                          value={l.designation}
                          onChange={(e) => patch(l.key, "designation", e.target.value)}
                          className="w-full px-2 py-1 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-md focus:outline-none"
                        />
                      </td>
                      {(["qte", "puHt", "remise", "tauxTva"] as const).map((f) => (
                        <td key={f} className="py-1.5 px-2">
                          <input
                            readOnly={locked}
                            type="number"
                            step="any"
                            value={String(l[f] ?? 0)}
                            onChange={(e) => patch(l.key, f, e.target.value === "" ? 0 : Number(e.target.value))}
                            className="w-full px-2 py-1 text-right bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-md focus:outline-none"
                          />
                        </td>
                      ))}
                      <td className="py-1.5 px-2 text-right font-semibold tabular-nums">{fmtMoney(c.thtNet)}</td>
                      <td className="py-1.5 px-2 text-right font-semibold tabular-nums">{fmtMoney(c.ttcNet)}</td>
                      {!locked && (
                        <td className="py-1.5 px-2">
                          <button
                            onClick={() => removeLine(l.key)}
                            className="p-1 rounded-md hover:bg-red-500/10 text-red-500"
                            title="Supprimer la ligne"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
                {computed.length === 0 && (
                  <tr>
                    <td colSpan={locked ? 8 : 9} className="py-10 text-center text-[var(--text-secondary)]">
                      Aucune ligne. {!locked && "Cliquez sur « Ajouter une ligne »."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {!locked && !loading && (
            <button
              onClick={addLine}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-lg border border-dashed border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]"
            >
              <Plus size={15} /> Ajouter une ligne
            </button>
          )}
        </div>

        {/* totals + actions */}
        <div className="border-t border-[var(--border-primary)] px-5 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-x-6 gap-y-1 text-sm">
            <Total label="Total brut" value={totals.thtBrut} />
            <Total label="Remise" value={totals.totRemise} />
            <Total label="Total HT" value={totals.thtNet} />
            <Total label="TVA" value={totals.totTva} />
            <Total label="Total TTC" value={totals.ttcNet} strong accent={accent} />
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold rounded-lg border border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]"
            >
              Fermer
            </button>
            {!locked && (
              <button
                onClick={save}
                disabled={busy || loading}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg text-white disabled:opacity-60"
                style={{ background: accent }}
              >
                {busy ? <Loader2 className="animate-spin" size={15} /> : <Save size={15} />} Enregistrer
              </button>
            )}
            {!readOnly && !loading && (
              <button
                onClick={toggleValidation}
                disabled={busy || (!isValide && computed.length === 0)}
                title={
                  isValide
                    ? "Annuler les mouvements de stock et de solde"
                    : `Appliquer les mouvements (stock ${rule.tStock}, solde ${rule.tSolde})`
                }
                className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg disabled:opacity-60 ${
                  isValide
                    ? "border border-[var(--border-primary)] text-amber-600 hover:bg-amber-500/10"
                    : "text-white bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                {busy ? (
                  <Loader2 className="animate-spin" size={15} />
                ) : isValide ? (
                  <RotateCcw size={15} />
                ) : (
                  <CheckCircle2 size={15} />
                )}
                {isValide ? "Dévalider" : "Valider"}
              </button>
            )}
          </div>
        </div>
      </div>

      {picker && (
        <ArticlePicker
          accent={accent}
          onClose={() => setPicker(null)}
          onPick={(a) => {
            setLines((ls) =>
              ls.map((l) =>
                l.key === picker
                  ? {
                      ...l,
                      refArt: sv(a.refArt),
                      designation: sv(a.designation),
                      unite: sv(a.unite) || "U",
                      puHt: n(a.tarif1Ht),
                      tauxTva: n(a.tauxTva),
                      tauxFodec: n(a.tauxFodec),
                    }
                  : l
              )
            );
            setPicker(null);
          }}
        />
      )}
    </div>
  );
}

function Total({ label, value, strong, accent }: { label: string; value: number; strong?: boolean; accent?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide">{label}</span>
      <span
        className={`tabular-nums ${strong ? "text-base font-bold" : "font-semibold text-[var(--text-primary)]"}`}
        style={strong ? { color: accent } : undefined}
      >
        {fmtMoney(value)}
      </span>
    </div>
  );
}

/** Recherche d'article dans le catalogue, réutilise /api/erp?resource=articles. */
function ArticlePicker({ accent, onClose, onPick }: { accent: string; onClose: () => void; onPick: (a: Row) => void }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      fetch(`/api/erp?resource=articles&page=0${q ? `&search=${encodeURIComponent(q)}` : ""}`)
        .then((r) => r.json())
        .then((d) => { if (!cancelled) { setRows(d.rows ?? []); setLoading(false); } })
        .catch(() => { if (!cancelled) setLoading(false); });
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q]);

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border-primary)]">
          <Search size={16} className="text-[var(--text-secondary)]" />
          <input
            autoFocus
            value={q}
            onChange={(e) => { setQ(e.target.value); setLoading(true); }}
            placeholder="Rechercher un article (référence, désignation)…"
            className="flex-1 px-2 py-1.5 text-sm bg-transparent focus:outline-none text-[var(--text-primary)]"
          />
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--bg-primary)] text-[var(--text-secondary)]">
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-auto">
          {loading && <div className="py-8 text-center text-[var(--text-secondary)] text-sm">Recherche…</div>}
          {!loading && rows.length === 0 && (
            <div className="py-8 text-center text-[var(--text-secondary)] text-sm">Aucun article trouvé.</div>
          )}
          {rows.map((a) => (
            <button
              key={sv(a.refArt)}
              onClick={() => onPick(a)}
              className="w-full text-left px-4 py-2.5 border-b border-[var(--border-primary)] hover:bg-[var(--bg-primary)] flex items-center gap-3"
            >
              <span className="text-xs font-mono text-[var(--text-secondary)] w-24 shrink-0 truncate">{sv(a.refArt)}</span>
              <span className="flex-1 text-sm text-[var(--text-primary)] truncate">{sv(a.designation)}</span>
              <span className="text-sm font-semibold tabular-nums" style={{ color: accent }}>
                {fmtMoney(n(a.tarif1Ht))}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
