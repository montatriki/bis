"use client";
import { useState } from "react";
import { htVersTtc, recalculerTarif } from "@/lib/tarif-article";
import { Save, Plus, X, Barcode, Tag, Network, MapPin, FileSpreadsheet, Boxes, Layers } from "lucide-react";

type Row = Record<string, unknown>;
const n = (v: unknown) => (v == null || v === "" ? 0 : Number(v)) || 0;
const sv = (v: unknown) => (v == null ? "" : String(v));

const UNITS = ["U", "Pièce", "Kg", "Litre", "Carton", "Paquet", "Mètre", "horaires"];
const KINDS = [
  { label: "Produit fini", kind: "P" },
  { label: "P.semi-fini", kind: "SF" },
  { label: "M.première", kind: "MP" },
];

// ---- hoisted field components (props-driven, not created during render) ----
function Field({ label, value, onChange, type = "text", req }: { label: string; value: string; onChange: (v: string) => void; type?: string; req?: boolean }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold text-[var(--text-secondary)]">{label}{req && <span className="text-red-500"> *</span>}</span>
      <input type={type} step="any" value={value} onChange={(e) => onChange(e.target.value)}
        className="px-2.5 py-1.5 text-sm bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg focus:outline-none" />
    </label>
  );
}
function ReadField({ label, value }: { label: string; value: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold text-[var(--text-secondary)]">{label}</span>
      <input readOnly value={value} className="px-2.5 py-1.5 text-sm bg-[var(--accent-light)] border border-[var(--border-primary)] rounded-lg font-bold" />
    </label>
  );
}
function SelectField({ label, value, onChange, opts, req }: { label: string; value: string; onChange: (v: string) => void; opts: string[]; req?: boolean }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold text-[var(--text-secondary)]">{label}{req && <span className="text-red-500"> *</span>}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="px-2.5 py-1.5 text-sm bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg focus:outline-none">
        <option value="">—</option>{opts.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}
function CheckField({ label, checked, onChange, accent }: { label: string; checked: boolean; onChange: (v: boolean) => void; accent: string }) {
  return (
    <label className="flex items-center gap-2 text-sm cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ accentColor: accent }} className="w-4 h-4" />
      <span className="text-[var(--text-primary)]">{label}</span>
    </label>
  );
}
function Section({ icon: Icon, children, title, accent }: { icon: React.ElementType; children: React.ReactNode; title?: string; accent: string }) {
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl p-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: accent + "18", color: accent }}><Icon size={18} /></div>
        <div className="flex-1 min-w-0">{title && <div className="text-xs font-bold text-[var(--text-secondary)] mb-2 uppercase tracking-wide">{title}</div>}{children}</div>
      </div>
    </div>
  );
}

export default function ArticleForm({ initial, onClose, onSaved, accent }: {
  initial: Row; onClose: () => void; onSaved: (msg: string) => void; accent: string;
}) {
  const isNew = !initial.refArt;
  const [f, setF] = useState<Row>({
    fab: sv(initial.fab), refArt: sv(initial.refArt), refOrigine: sv(initial.refOrigine), codeBarre: sv(initial.codeBarre),
    unite: sv(initial.unite) || "U", uniteEntree: sv(initial.uniteEntree) || "U", conversion: initial.conversion ?? 1,
    designation: sv(initial.designation), caract: sv(initial.caract),
    catalogue: sv(initial.catalogue), famille: sv(initial.famille), sousFamille: sv(initial.sousFamille), marque: sv(initial.marque), sousCategorie: sv(initial.sousCategorie),
    cmpteVente: sv(initial.cmpteVente), cmpteVenteExp: sv(initial.cmpteVenteExp), cmpteVenteExo: sv(initial.cmpteVenteExo), cmpteAchatLoc: sv(initial.cmpteAchatLoc), cmpteAchatImp: sv(initial.cmpteAchatImp),
    tauxTva: initial.tauxTva ?? 19, puAchat: initial.puAchat ?? 0, fodecAchat: initial.fodecAchat ?? 0,
    fodecVente: initial.fodecVente ?? 0, margePct: initial.margePct ?? 0, tarif1Ht: initial.tarif1Ht ?? 0,
    stockIni: initial.stockIni ?? 0, entrer: initial.entrer ?? 0, sortie: initial.sortie ?? 0, enStock: initial.enStock ?? 0,
    stMin: initial.stMin ?? 0, stMax: initial.stMax ?? 0, remiseMax: initial.remiseMax ?? 0, commission: initial.commission ?? 0, remiseParQte: initial.remiseParQte ? 1 : 0,
    puInv: initial.puInv ?? 0, dpa: initial.dpa ?? 0, pmp: initial.pmp ?? 0,
    fifo: initial.fifo ? 1 : 0, lifo: initial.lifo ? 1 : 0, gerSerie: initial.gerSerie ? 1 : 0, gesLot: initial.gesLot ? 1 : 0,
    vendable: initial.vendable != null ? (initial.vendable ? 1 : 0) : 1, achetable: initial.achetable != null ? (initial.achetable ? 1 : 0) : 1, archiver: initial.archiver ? 1 : 0,
    kind: sv(initial.kind) || "P",
  });
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: unknown) => setF((p) => ({ ...p, [k]: v }));

  // Taxes de l'article : le FODEC entre dans l'assiette de la TVA, on ne peut
  // donc pas se contenter de `× (1 + tva)`.
  const taxesAchat = { tauxTva: n(f.tauxTva), tauxFodec: n(f.fodecAchat) };
  const taxesVente = { tauxTva: n(f.tauxTva), tauxFodec: n(f.fodecVente) };

  const puAchatTtc = htVersTtc(n(f.puAchat), taxesAchat).toFixed(3);
  const tarif1Ttc = htVersTtc(n(f.tarif1Ht), taxesVente).toFixed(3);

  /**
   * Marge, prix HT et prix TTC sont liés : modifier l'un recalcule les autres,
   * dans les deux sens, comme la fiche article de l'ERP d'origine.
   */
  const majTarif = (champ: "marge" | "ht" | "ttc" | "achat", valeur: string) => {
    setF((p) => {
      const base = {
        puAchat: n(p.puAchat), margePct: n(p.margePct),
        prixHt: n(p.tarif1Ht), prixTtc: htVersTtc(n(p.tarif1Ht), taxesVente),
      };
      if (champ === "marge") base.margePct = n(valeur);
      if (champ === "ht") base.prixHt = n(valeur);
      if (champ === "ttc") base.prixTtc = n(valeur);
      if (champ === "achat") base.puAchat = n(valeur);

      const r = recalculerTarif(champ, base, taxesVente);
      return {
        ...p,
        // La saisie en cours est conservée telle quelle : la réécrire
        // empêcherait de taper « 2.4 » (arrondi à chaque frappe).
        puAchat: champ === "achat" ? valeur : p.puAchat,
        margePct: champ === "marge" ? valeur : r.margePct,
        tarif1Ht: champ === "ht" ? valeur : r.prixHt,
      };
    });
  };
  const stockFinal = (n(f.stockIni) + n(f.entrer) - n(f.sortie)).toFixed(0);

  async function submit() {
    if (!f.refArt || !f.designation) { onSaved("Erreur: Référence et Désignation obligatoires"); return; }
    setBusy(true);
    const body = { ...f, puAchatTtc, enStock: n(f.enStock) || stockFinal };
    const r = await fetch(`/api/erp?resource=articles`, {
      method: isNew ? "POST" : "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }).then((x) => x.json());
    setBusy(false);
    onSaved(r.ok ? (isNew ? "Article enregistré" : "Article modifié") : "Erreur: " + (r.error ?? "échec"));
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm overflow-y-auto p-4" onClick={onClose}>
      <div className="max-w-5xl mx-auto bg-[var(--bg-primary)] rounded-2xl border border-[var(--border-primary)] shadow-2xl my-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 sticky top-0 z-10 rounded-t-2xl" style={{ background: accent }}>
          <h2 className="font-bold text-white text-sm">Fiche article</h2>
          <div className="flex gap-2">
            <button onClick={submit} disabled={busy} title="Enregistrer" className="bg-white/20 hover:bg-white/30 text-white p-2 rounded-lg disabled:opacity-50"><Save size={16} /></button>
            <button onClick={() => setF((p) => ({ ...p, refArt: "", designation: "" }))} title="Nouveau" className="bg-white/20 hover:bg-white/30 text-white p-2 rounded-lg"><Plus size={16} /></button>
            <button onClick={onClose} title="Fermer" className="bg-white/20 hover:bg-white/30 text-white p-2 rounded-lg"><X size={16} /></button>
          </div>
        </div>

        <div className="p-4 grid lg:grid-cols-2 gap-3">
          <Section icon={Barcode} accent={accent}>
            <div className="grid grid-cols-2 gap-2.5">
              <Field label="Fab" value={sv(f.fab)} onChange={(v) => set("fab", v)} />
              <Field label="Référence" req value={sv(f.refArt)} onChange={(v) => set("refArt", v)} />
              <Field label="Référence origine" value={sv(f.refOrigine)} onChange={(v) => set("refOrigine", v)} />
              <Field label="Code à barre" value={sv(f.codeBarre)} onChange={(v) => set("codeBarre", v)} />
              <SelectField label="Unité de Stockage" req value={sv(f.unite)} onChange={(v) => set("unite", v)} opts={UNITS} />
              <SelectField label="Unité d'entrée" req value={sv(f.uniteEntree)} onChange={(v) => set("uniteEntree", v)} opts={UNITS} />
              <Field label="Conversion" type="number" value={sv(f.conversion)} onChange={(v) => set("conversion", v)} />
            </div>
          </Section>

          <Section icon={Tag} accent={accent}>
            <Field label="Désignation fr" req value={sv(f.designation)} onChange={(v) => set("designation", v)} />
            <label className="flex flex-col gap-1 mt-2">
              <span className="text-[11px] font-semibold text-[var(--text-secondary)]">Caractéristiques</span>
              <textarea value={sv(f.caract)} onChange={(e) => set("caract", e.target.value)} rows={3} className="px-2.5 py-1.5 text-sm bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg focus:outline-none resize-none" />
            </label>
          </Section>

          <Section icon={Network} accent={accent}>
            <div className="grid gap-2.5">
              <Field label="Catalogue" value={sv(f.catalogue)} onChange={(v) => set("catalogue", v)} />
              <Field label="Famille" req value={sv(f.famille)} onChange={(v) => set("famille", v)} />
              <Field label="Sous famille" req value={sv(f.sousFamille)} onChange={(v) => set("sousFamille", v)} />
              <div className="grid grid-cols-2 gap-2.5">
                <Field label="Marque" value={sv(f.marque)} onChange={(v) => set("marque", v)} />
                <Field label="Sous catégorie" value={sv(f.sousCategorie)} onChange={(v) => set("sousCategorie", v)} />
              </div>
            </div>
          </Section>

          <Section icon={FileSpreadsheet} title="Comptabilité" accent={accent}>
            <div className="grid grid-cols-2 gap-2.5">
              <Field label="Compte Vente" value={sv(f.cmpteVente)} onChange={(v) => set("cmpteVente", v)} />
              <Field label="Compte Vente Export" value={sv(f.cmpteVenteExp)} onChange={(v) => set("cmpteVenteExp", v)} />
              <Field label="Compte Vente Exonoré" value={sv(f.cmpteVenteExo)} onChange={(v) => set("cmpteVenteExo", v)} />
              <Field label="Compte Achat Local" value={sv(f.cmpteAchatLoc)} onChange={(v) => set("cmpteAchatLoc", v)} />
              <Field label="Compte Achat Import" value={sv(f.cmpteAchatImp)} onChange={(v) => set("cmpteAchatImp", v)} />
            </div>
          </Section>

          <Section icon={Tag} title="Achat & Tarif de vente" accent={accent}>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="text-[11px] font-bold" style={{ color: accent }}>Achat</div>
                <Field label="TVA %" req type="number" value={sv(f.tauxTva)} onChange={(v) => set("tauxTva", v)} />
                <Field label="PU achat HT" type="number" value={sv(f.puAchat)} onChange={(v) => majTarif("achat", String(v))} />
                <Field label="Fodec achat" type="number" value={sv(f.fodecAchat)} onChange={(v) => set("fodecAchat", v)} />
                <ReadField label="PU achat TTC" value={puAchatTtc} />
              </div>
              <div className="space-y-2">
                <div className="text-[11px] font-bold" style={{ color: accent }}>Tarif de vente (1)</div>
                <Field label="Fodec Vente" type="number" value={sv(f.fodecVente)} onChange={(v) => set("fodecVente", v)} />
                <Field label="Marge %" type="number" value={sv(f.margePct)} onChange={(v) => majTarif("marge", String(v))} />
                <Field label="Prix unitaire HT" type="number" value={sv(f.tarif1Ht)} onChange={(v) => majTarif("ht", String(v))} />
                <Field label="Prix unitaire TTC" type="number" value={tarif1Ttc} onChange={(v) => majTarif("ttc", String(v))} />
              </div>
            </div>
          </Section>

          <Section icon={Boxes} title="Stock" accent={accent}>
            <div className="grid grid-cols-2 gap-2.5">
              <Field label="Stock initial" type="number" value={sv(f.stockIni)} onChange={(v) => set("stockIni", v)} />
              <Field label="Entrées" type="number" value={sv(f.entrer)} onChange={(v) => set("entrer", v)} />
              <Field label="Sortie" type="number" value={sv(f.sortie)} onChange={(v) => set("sortie", v)} />
              <ReadField label="Stock final" value={stockFinal} />
              <Field label="Stock Minimum" type="number" value={sv(f.stMin)} onChange={(v) => set("stMin", v)} />
              <Field label="Stock maximum" type="number" value={sv(f.stMax)} onChange={(v) => set("stMax", v)} />
              <Field label="Remise maximum" type="number" value={sv(f.remiseMax)} onChange={(v) => set("remiseMax", v)} />
              <Field label="Commission" type="number" value={sv(f.commission)} onChange={(v) => set("commission", v)} />
            </div>
            <div className="mt-2"><CheckField label="Remise par qte" checked={!!n(f.remiseParQte)} onChange={(v) => set("remiseParQte", v ? 1 : 0)} accent={accent} /></div>
          </Section>

          <Section icon={Layers} title="Valorisation" accent={accent}>
            <div className="grid grid-cols-3 gap-2.5">
              <Field label="pu inv" type="number" value={sv(f.puInv)} onChange={(v) => set("puInv", v)} />
              <Field label="dpa" type="number" value={sv(f.dpa)} onChange={(v) => set("dpa", v)} />
              <Field label="pmp" type="number" value={sv(f.pmp)} onChange={(v) => set("pmp", v)} />
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <CheckField label="FIFO" checked={!!n(f.fifo)} onChange={(v) => set("fifo", v ? 1 : 0)} accent={accent} />
              <CheckField label="LIFO" checked={!!n(f.lifo)} onChange={(v) => set("lifo", v ? 1 : 0)} accent={accent} />
              <CheckField label="Num série" checked={!!n(f.gerSerie)} onChange={(v) => set("gerSerie", v ? 1 : 0)} accent={accent} />
              <CheckField label="par lot" checked={!!n(f.gesLot)} onChange={(v) => set("gesLot", v ? 1 : 0)} accent={accent} />
            </div>
          </Section>

          <Section icon={MapPin} title="Type d'article" accent={accent}>
            <div className="grid grid-cols-2 gap-2.5">
              {KINDS.map((kd) => (
                <label key={kd.kind} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" name="kind" checked={f.kind === kd.kind} onChange={() => set("kind", kd.kind)} style={{ accentColor: accent }} className="w-4 h-4" />
                  <span>{kd.label}</span>
                </label>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2.5 mt-3 pt-3 border-t border-[var(--border-primary)]">
              <CheckField label="Vendable" checked={!!n(f.vendable)} onChange={(v) => set("vendable", v ? 1 : 0)} accent={accent} />
              <CheckField label="Achetable" checked={!!n(f.achetable)} onChange={(v) => set("achetable", v ? 1 : 0)} accent={accent} />
              <CheckField label="archiver" checked={!!n(f.archiver)} onChange={(v) => set("archiver", v ? 1 : 0)} accent={accent} />
            </div>
          </Section>
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-[var(--border-primary)] sticky bottom-0 bg-[var(--bg-primary)] rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-xl border border-[var(--border-primary)] text-[var(--text-secondary)]">Annuler</button>
          <button onClick={submit} disabled={busy} className="px-5 py-2 text-sm font-medium text-white rounded-xl disabled:opacity-50 flex items-center gap-2" style={{ background: accent }}><Save size={15} /> {busy ? "…" : "Enregistrer"}</button>
        </div>
      </div>
    </div>
  );
}
