"use client";
import { useState } from "react";
import { Save, Coins, CreditCard, FileText, Landmark, Percent } from "lucide-react";

type Row = Record<string, unknown>;
const n = (v: unknown) => (v == null || v === "" ? 0 : Number(v)) || 0;
const sv = (v: unknown) => (v == null ? "" : String(v));

const MODES = [
  { key: "Espèce", label: "ESPÈCE", icon: Coins },
  { key: "Chèque", label: "CHÈQUE", icon: CreditCard },
  { key: "Traite", label: "TRAITE", icon: FileText },
  { key: "Virement", label: "VIREMENT", icon: Landmark },
  { key: "Retenu", label: "RETENU", icon: Percent },
];

export default function ReglementForm({ initial, sens, accent, onClose, onSaved }: {
  initial: Row; sens: "C" | "F"; accent: string; onClose: () => void; onSaved: (msg: string) => void;
}) {
  const isNew = initial.id == null;
  const [mode, setMode] = useState(sv(initial.modePay) || "Espèce");
  const [f, setF] = useState<Row>({
    id: initial.id, numPiece: sv(initial.numPiece), datePay: initial.datePay ? String(initial.datePay).slice(0, 16) : new Date().toISOString().slice(0, 16),
    tiersNom: sv(initial.tiersNom), montant: initial.montant ?? 0, banque: sv(initial.banque),
    numDoc: sv(initial.numDoc), echeance: sv(initial.echeance), etat: sv(initial.etat) || "Encaissé", commentaire: sv(initial.commentaire),
  });
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: unknown) => setF((p) => ({ ...p, [k]: v }));

  async function submit() {
    if (!f.tiersNom || n(f.montant) <= 0) { onSaved("Erreur: Tiers et Montant requis"); return; }
    setBusy(true);
    const body = { ...f, sens, modePay: mode };
    const r = await fetch(`/api/erp?resource=reglements`, {
      method: isNew ? "POST" : "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }).then((x) => x.json());
    setBusy(false);
    onSaved(r.ok ? (isNew ? "Règlement enregistré" : "Règlement modifié") : "Erreur: " + (r.error ?? "échec"));
  }

  const tiersLabel = sens === "C" ? "Client" : "Fournisseur";
  const needsBanque = mode !== "Espèce";
  const needsCheque = mode === "Chèque" || mode === "Traite";

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm overflow-y-auto p-4" onClick={onClose}>
      <div className="max-w-3xl mx-auto bg-[var(--bg-primary)] rounded-2xl border border-[var(--border-primary)] shadow-2xl my-4" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 rounded-t-2xl" style={{ background: accent }}>
          <h2 className="font-bold text-white text-sm uppercase">Créer règlement {sens === "C" ? "client" : "fournisseur"} : {sv(f.tiersNom) || "—"}</h2>
          <button onClick={onClose} className="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-sm font-bold">FERMER</button>
        </div>

        {/* Payment-mode tabs */}
        <div className="flex gap-1 px-4 pt-3 border-b border-[var(--border-primary)] bg-[var(--bg-card)] overflow-x-auto">
          {MODES.map((m) => (
            <button key={m.key} onClick={() => setMode(m.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition ${mode === m.key ? "" : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
              style={mode === m.key ? { borderColor: accent, color: accent } : undefined}>
              <m.icon size={15} /> {m.label}
            </button>
          ))}
        </div>

        {/* Form body */}
        <div className="p-5 grid sm:grid-cols-3 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-[var(--text-secondary)]">N° Règlement</span>
            <input value={sv(f.numPiece)} onChange={(e) => set("numPiece", e.target.value)} placeholder={isNew ? "auto" : ""} className="px-2.5 py-1.5 text-sm bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg focus:outline-none" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-[var(--text-secondary)]">Date</span>
            <input type="datetime-local" value={sv(f.datePay)} onChange={(e) => set("datePay", e.target.value)} className="px-2.5 py-1.5 text-sm bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg focus:outline-none" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-[var(--text-secondary)]">{tiersLabel} <span className="text-red-500">*</span></span>
            <input value={sv(f.tiersNom)} onChange={(e) => set("tiersNom", e.target.value)} className="px-2.5 py-1.5 text-sm bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg focus:outline-none" />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-[var(--text-secondary)]">Montant <span className="text-red-500">*</span></span>
            <input type="number" step="any" value={sv(f.montant)} onChange={(e) => set("montant", e.target.value)} className="px-2.5 py-1.5 text-sm bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg focus:outline-none font-bold" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-[var(--text-secondary)]">État</span>
            <select value={sv(f.etat)} onChange={(e) => set("etat", e.target.value)} className="px-2.5 py-1.5 text-sm bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg focus:outline-none">
              {["Encaissé", "en cours", "Impayé", "Retourné"].map((o) => <option key={o}>{o}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-[var(--text-secondary)]">N° Document (vente)</span>
            <input value={sv(f.numDoc)} onChange={(e) => set("numDoc", e.target.value)} className="px-2.5 py-1.5 text-sm bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg focus:outline-none" />
          </label>

          {needsBanque && (
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-[var(--text-secondary)]">Banque / Compte</span>
              <input value={sv(f.banque)} onChange={(e) => set("banque", e.target.value)} className="px-2.5 py-1.5 text-sm bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg focus:outline-none" />
            </label>
          )}
          {needsCheque && (
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-[var(--text-secondary)]">Échéance</span>
              <input type="date" value={sv(f.echeance)} onChange={(e) => set("echeance", e.target.value)} className="px-2.5 py-1.5 text-sm bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg focus:outline-none" />
            </label>
          )}

          <label className="flex flex-col gap-1 sm:col-span-3">
            <span className="text-[11px] font-semibold text-[var(--text-secondary)]">Commentaire</span>
            <textarea value={sv(f.commentaire)} onChange={(e) => set("commentaire", e.target.value)} rows={2} className="px-2.5 py-1.5 text-sm bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg focus:outline-none resize-none" />
          </label>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--border-primary)] bg-[var(--bg-card)] rounded-b-2xl">
          <div className="text-sm text-[var(--text-secondary)]">Mode : <span className="font-bold" style={{ color: accent }}>{mode}</span></div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm rounded-xl border border-[var(--border-primary)] text-[var(--text-secondary)]">Annuler</button>
            <button onClick={submit} disabled={busy} className="px-5 py-2 text-sm font-medium text-white rounded-xl disabled:opacity-50 flex items-center gap-2" style={{ background: accent }}><Save size={15} /> {busy ? "…" : "Valider"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
