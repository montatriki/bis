"use client";
import { useState, useEffect } from "react";
import { ArrowRightLeft, X, Loader2, ArrowRight } from "lucide-react";
import { docTypeRule } from "@/lib/document-types";

type Row = Record<string, unknown>;
const sv = (v: unknown) => (v == null ? "" : String(v));

/**
 * Transformation d'un document vers le type suivant de la chaîne commerciale
 * (Devis → Commande → BL → Facture).
 */
export default function TransformDialog({
  doc,
  accent,
  onClose,
  onDone,
}: {
  doc: Row;
  accent: string;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const refDoc = sv(doc.refDoc);
  const typeDoc = sv(doc.typeDoc);

  const [targets, setTargets] = useState<string[]>([]);
  const [choice, setChoice] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/erp/document-transform?typeDoc=${encodeURIComponent(typeDoc)}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const t: string[] = d.targets ?? [];
        setTargets(t);
        setChoice(t[0] ?? "");
        setLoading(false);
      })
      .catch(() => { if (!cancelled) { setErr("Chargement impossible"); setLoading(false); } });
    return () => { cancelled = true; };
  }, [typeDoc]);

  async function run() {
    if (!choice) return;
    setBusy(true);
    setErr(null);
    const r = await fetch(`/api/erp/document-transform`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refDocs: [refDoc], typeTarget: choice }),
    })
      .then((x) => x.json())
      .catch(() => ({ ok: false, message: "réseau" }));
    setBusy(false);
    if (r.ok) { onDone(r.message ?? "Document transformé"); onClose(); }
    else setErr(r.message ?? r.error ?? "Échec de la transformation");
  }

  const dejaTransforme = Boolean(doc.transformeEn);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[var(--border-primary)]">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: accent + "18", color: accent }}>
            <ArrowRightLeft size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-[var(--text-primary)] truncate">Transformer {refDoc}</div>
            <div className="text-xs text-[var(--text-secondary)] truncate">
              {docTypeRule(typeDoc).label} · {sv(doc.raisonSocial) || "—"}
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[var(--bg-primary)] text-[var(--text-secondary)]">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          {err && <div className="px-3 py-2 rounded-lg bg-red-500/10 text-red-500 text-sm">{err}</div>}

          {dejaTransforme ? (
            <div className="px-3 py-2 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 text-sm">
              Ce document a déjà été transformé en <b>{sv(doc.transformeEn)}</b>.
            </div>
          ) : loading ? (
            <div className="py-6 text-center text-[var(--text-secondary)] text-sm">
              <Loader2 className="animate-spin mx-auto mb-2" size={20} /> Chargement…
            </div>
          ) : targets.length === 0 ? (
            <div className="px-3 py-2 rounded-lg bg-slate-500/10 text-[var(--text-secondary)] text-sm">
              Aucune transformation possible depuis un document de type <b>{typeDoc}</b>.
            </div>
          ) : (
            <>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                Type de document cible
              </div>
              <div className="grid gap-2">
                {targets.map((t) => {
                  const r = docTypeRule(t);
                  const on = choice === t;
                  return (
                    <button
                      key={t}
                      onClick={() => setChoice(t)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition ${
                        on ? "border-transparent text-white" : "border-[var(--border-primary)] hover:bg-[var(--bg-primary)]"
                      }`}
                      style={on ? { background: accent } : undefined}
                    >
                      <span className="text-xs font-mono opacity-70 w-10 shrink-0">{typeDoc}</span>
                      <ArrowRight size={14} className="shrink-0 opacity-60" />
                      <span className="font-semibold text-sm">{r.label}</span>
                      <span className={`ml-auto text-[10px] ${on ? "opacity-80" : "text-[var(--text-secondary)]"}`}>
                        stock {r.tStock} · solde {r.tSolde}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Le document cible est créé en <b>brouillon</b> : les lignes sont recopiées,
                mais stock et solde ne bougeront qu&apos;à sa validation.
              </p>
            </>
          )}
        </div>

        <div className="border-t border-[var(--border-primary)] px-5 py-3 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold rounded-lg border border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]"
          >
            Annuler
          </button>
          {!dejaTransforme && targets.length > 0 && (
            <button
              onClick={run}
              disabled={busy || loading || !choice}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg text-white disabled:opacity-60"
              style={{ background: accent }}
            >
              {busy ? <Loader2 className="animate-spin" size={15} /> : <ArrowRightLeft size={15} />} Transformer
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
