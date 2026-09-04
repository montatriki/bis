"use client";
import { useRef, useState } from "react";
import { htVersTtc, recalculerTarif } from "@/lib/tarif-article";
import { Save, Plus, X, Barcode, Tag, Network, MapPin, FileSpreadsheet, Boxes, Layers, Camera, ImagePlus, Trash2 } from "lucide-react";
import { compresserImage } from "@/lib/image";

type Row = Record<string, unknown>;
const n = (v: unknown) => (v == null || v === "" ? 0 : Number(v)) || 0;
const sv = (v: unknown) => (v == null ? "" : String(v));

const UNITS = ["U", "Pièce", "Kg", "Litre", "Carton", "Paquet", "Mètre", "horaires"];
const KINDS = [
  { label: "Produit fini", kind: "P" },
  { label: "P.semi-fini", kind: "SF" },
  { label: "M.première", kind: "MP" },
];

// ---- composants de champ (hors rendu : pas recréés à chaque frappe) ----
const INPUT = "w-full px-3 py-2 text-sm bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl " +
  "text-[var(--text-primary)] placeholder:text-slate-400 outline-none transition " +
  "focus:border-[color:var(--fiche-accent)] focus:ring-2 focus:ring-[color:var(--fiche-ring)]";
const LABEL = "text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]";

function Field({ label, value, onChange, type = "text", req, suffixe, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; req?: boolean; suffixe?: string; placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1 min-w-0">
      <span className={LABEL}>{label}{req && <span className="text-red-500"> *</span>}</span>
      <span className="relative">
        <input type={type} step="any" inputMode={type === "number" ? "decimal" : undefined} value={value} placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)} className={INPUT + (suffixe ? " pr-10" : "")} />
        {suffixe && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-slate-400">{suffixe}</span>}
      </span>
    </label>
  );
}
function ReadField({ label, value, suffixe }: { label: string; value: string; suffixe?: string }) {
  return (
    <label className="flex flex-col gap-1 min-w-0">
      <span className={LABEL}>{label}</span>
      <span className="relative">
        <input readOnly value={value} className={INPUT + " bg-[var(--accent-light)] font-bold tabular-nums cursor-default" + (suffixe ? " pr-10" : "")} />
        {suffixe && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-slate-400">{suffixe}</span>}
      </span>
    </label>
  );
}
function SelectField({ label, value, onChange, opts: base, req }: { label: string; value: string; onChange: (v: string) => void; opts: string[]; req?: boolean }) {
  // La valeur courante (« PACKET », « PCS »… venues de la production) reste
  // proposée même si elle n'est pas dans la liste fixe : sinon le champ
  // affichait « — » alors que l'article a bien une unité.
  const opts = value && !base.includes(value) ? [value, ...base] : base;
  return (
    <label className="flex flex-col gap-1 min-w-0">
      <span className={LABEL}>{label}{req && <span className="text-red-500"> *</span>}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={INPUT}>
        <option value="">—</option>{opts.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}
/** Interrupteur à bascule : plus lisible qu'une case à cocher sur tablette. */
function Toggle({ label, checked, onChange, accent }: { label: string; checked: boolean; onChange: (v: boolean) => void; accent: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} aria-pressed={checked}
      className={`flex items-center justify-between gap-3 px-3 py-2 rounded-xl border text-sm transition ${
        checked ? "border-transparent text-[var(--text-primary)]" : "border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-card)]"}`}
      style={checked ? { background: accent + "18" } : undefined}>
      <span className="font-medium">{label}</span>
      <span className="relative inline-flex h-5 w-9 shrink-0 rounded-full transition"
        style={{ background: checked ? accent : "#cbd5e1" }}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${checked ? "left-[18px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}
function Section({ icon: Icon, children, title, hint, accent, className = "" }: {
  icon: React.ElementType; children: React.ReactNode; title: string; hint?: string; accent: string; className?: string;
}) {
  return (
    <section className={`bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-2xl p-4 sm:p-5 shadow-sm ${className}`}>
      <header className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: accent + "18", color: accent }}><Icon size={17} /></div>
        <div className="min-w-0">
          <div className="text-sm font-bold text-[var(--text-primary)]">{title}</div>
          {hint && <div className="text-[11px] text-[var(--text-secondary)] truncate">{hint}</div>}
        </div>
      </header>
      {children}
    </section>
  );
}
/** Tuile de synthèse en tête de fiche. */
function Tuile({ label, value, suffixe, accent }: { label: string; value: string; suffixe?: string; accent?: string }) {
  return (
    <div className="rounded-xl px-3 py-2 bg-white/10 border border-white/15 min-w-0">
      <div className="text-[10px] uppercase tracking-wider text-white/70 font-semibold truncate">{label}</div>
      <div className="text-base font-bold tabular-nums text-white truncate" style={accent ? { color: accent } : undefined}>
        {value}{suffixe && <span className="text-[11px] font-medium text-white/70 ml-1">{suffixe}</span>}
      </div>
    </div>
  );
}

export default function ArticleForm({ initial, onClose, onSaved, accent }: {
  initial: Row; onClose: () => void; onSaved: (msg: string) => void; accent: string;
}) {
  const isNew = !initial.refArt;
  // Photo : `undefined` = inchangée (celle en base, si elle existe), data URL =
  // nouvelle, `null` = à retirer. L'existante est affichée depuis l'API image,
  // la liste des articles ne la transporte pas.
  const [photo, setPhoto] = useState<string | null | undefined>(undefined);
  const [photoErreur, setPhotoErreur] = useState<string | null>(null);
  const [photoExistante, setPhotoExistante] = useState(Boolean(initial.refArt));
  const fichierRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  async function choisirPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoErreur(null);
    try { setPhoto(await compresserImage(file)); }
    catch { setPhotoErreur("Image illisible — réessayez"); }
    finally { e.target.value = ""; }
  }
  const apercu = photo === undefined
    ? (photoExistante && initial.refArt ? `/api/articles/photo?refArt=${encodeURIComponent(String(initial.refArt))}` : null)
    : photo;
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
    const body = { ...f, puAchatTtc, enStock: n(f.enStock) || stockFinal, ...(photo !== undefined ? { photo } : {}) };
    const r = await fetch(`/api/erp?resource=articles`, {
      method: isNew ? "POST" : "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }).then((x) => x.json());
    setBusy(false);
    onSaved(r.ok ? (isNew ? "Article enregistré" : "Article modifié") : "Erreur: " + (r.error ?? "échec"));
  }

  const libelleKind = KINDS.find((k) => k.kind === f.kind)?.label ?? "Produit fini";
  const fond = { ["--fiche-accent" as string]: accent, ["--fiche-ring" as string]: accent + "33" } as React.CSSProperties;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-stretch sm:items-center justify-center sm:p-4" onClick={onClose} style={fond}>
      <div className="w-full sm:max-w-6xl h-full sm:h-auto sm:max-h-[94vh] flex flex-col bg-[var(--bg-card)] sm:rounded-3xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Fiche article">

        {/* ── En-tête : identité de l'article, photo, chiffres clés ── */}
        <div className="shrink-0 text-white" style={{ background: `linear-gradient(135deg, ${accent} 0%, ${accent}cc 60%, #1e293b 140%)` }}>
          <div className="flex items-center justify-between px-4 sm:px-6 pt-3 sm:pt-4">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-white/80">
              <Barcode size={14} /> Fiche article {isNew ? "· nouveau" : ""}
            </div>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => setF((p) => ({ ...p, refArt: "", designation: "" }))} title="Nouvel article"
                className="hidden sm:flex items-center gap-1.5 text-xs font-semibold bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition"><Plus size={14} /> Nouveau</button>
              <button type="button" onClick={onClose} title="Fermer" aria-label="Fermer"
                className="bg-white/15 hover:bg-white/25 p-2 rounded-lg transition"><X size={16} /></button>
            </div>
          </div>

          <div className="px-4 sm:px-6 pb-4 sm:pb-5 pt-3 flex gap-4 sm:gap-6 items-start">
            {/* Photo : cliquable pour changer, actions dessous sur mobile */}
            <div className="shrink-0">
              <button type="button" onClick={() => fichierRef.current?.click()} title="Changer la photo"
                className="group relative w-24 h-24 sm:w-36 sm:h-36 rounded-2xl overflow-hidden bg-white/10 border-2 border-white/30 shadow-lg flex items-center justify-center">
                {apercu ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={apercu} alt="" className="w-full h-full object-cover"
                    onError={() => { if (photo === undefined) setPhotoExistante(false); }} />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-white/70"><ImagePlus size={26} /><span className="text-[10px] font-semibold">Ajouter</span></div>
                )}
                <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-xs font-semibold gap-1.5"><ImagePlus size={14} /> Changer</span>
              </button>
              <div className="flex gap-1 mt-2 justify-center">
                <button type="button" onClick={() => cameraRef.current?.click()} title="Prendre une photo"
                  className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 transition"><Camera size={14} /></button>
                <button type="button" onClick={() => fichierRef.current?.click()} title="Importer une image"
                  className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 transition"><ImagePlus size={14} /></button>
                {apercu && (
                  <button type="button" onClick={() => { setPhoto(null); setPhotoExistante(false); }} title="Retirer la photo"
                    className="p-1.5 rounded-lg bg-red-500/70 hover:bg-red-500 transition"><Trash2 size={14} /></button>
                )}
              </div>
              {photoErreur && <div className="text-[10px] text-red-200 mt-1 text-center">{photoErreur}</div>}
              {/* `capture` ouvre l'appareil photo arrière sur mobile ; l'autre champ ouvre la galerie / le disque. */}
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={choisirPhoto} className="hidden" />
              <input ref={fichierRef} type="file" accept="image/*" onChange={choisirPhoto} className="hidden" />
            </div>

            <div className="flex-1 min-w-0">
              <input value={sv(f.designation)} onChange={(e) => set("designation", e.target.value)} placeholder="Désignation de l'article *"
                aria-label="Désignation"
                className="w-full !bg-transparent !text-white text-xl sm:text-2xl font-bold placeholder:text-white/50 outline-none !border-0 !border-b !border-white/25 focus:!border-white !rounded-none !shadow-none pb-1 truncate"
                style={{ background: "transparent" }} />
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="px-2 py-0.5 rounded-md bg-white/15 font-mono font-semibold">{sv(f.refArt) || "réf. à saisir"}</span>
                <span className="px-2 py-0.5 rounded-md bg-white/15">{libelleKind}</span>
                {!!n(f.vendable) && <span className="px-2 py-0.5 rounded-md bg-emerald-400/25 text-emerald-100">Vendable</span>}
                {!!n(f.achetable) && <span className="px-2 py-0.5 rounded-md bg-sky-400/25 text-sky-100">Achetable</span>}
                {!!n(f.archiver) && <span className="px-2 py-0.5 rounded-md bg-red-400/30 text-red-100">Archivé</span>}
                {sv(f.codeBarre) && <span className="px-2 py-0.5 rounded-md bg-white/10 text-white/80 font-mono">CB {sv(f.codeBarre)}</span>}
              </div>
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Tuile label="PU achat HT" value={n(f.puAchat).toFixed(3)} suffixe="TND" />
                <Tuile label="Prix vente HT" value={n(f.tarif1Ht).toFixed(3)} suffixe="TND" />
                <Tuile label="Prix vente TTC" value={tarif1Ttc} suffixe="TND" />
                <Tuile label="Stock final" value={stockFinal} suffixe={sv(f.unite) || "U"} />
              </div>
            </div>
          </div>
        </div>

        {/* ── Corps : sections ── */}
        <div className="flex-1 overflow-y-auto bg-[var(--bg-primary)]/60 p-3 sm:p-5">
          <div className="grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">

            <Section icon={Barcode} title="Identification" hint="Références, codes et unités" accent={accent}>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Référence" req value={sv(f.refArt)} onChange={(v) => set("refArt", v)} />
                <Field label="Fab" value={sv(f.fab)} onChange={(v) => set("fab", v)} />
                <Field label="Référence origine" value={sv(f.refOrigine)} onChange={(v) => set("refOrigine", v)} />
                <Field label="Code à barre" value={sv(f.codeBarre)} onChange={(v) => set("codeBarre", v)} />
                <SelectField label="Unité de stockage" req value={sv(f.unite)} onChange={(v) => set("unite", v)} opts={UNITS} />
                <SelectField label="Unité d'entrée" req value={sv(f.uniteEntree)} onChange={(v) => set("uniteEntree", v)} opts={UNITS} />
                <Field label="Conversion" type="number" value={sv(f.conversion)} onChange={(v) => set("conversion", v)} />
              </div>
            </Section>

            <Section icon={Network} title="Classement" hint="Catalogue, famille, marque" accent={accent}>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><Field label="Catalogue" value={sv(f.catalogue)} onChange={(v) => set("catalogue", v)} /></div>
                <Field label="Famille" req value={sv(f.famille)} onChange={(v) => set("famille", v)} />
                <Field label="Sous famille" req value={sv(f.sousFamille)} onChange={(v) => set("sousFamille", v)} />
                <Field label="Marque" value={sv(f.marque)} onChange={(v) => set("marque", v)} />
                <Field label="Sous catégorie" value={sv(f.sousCategorie)} onChange={(v) => set("sousCategorie", v)} />
              </div>
              <label className="flex flex-col gap-1 mt-3">
                <span className={LABEL}>Caractéristiques</span>
                <textarea value={sv(f.caract)} onChange={(e) => set("caract", e.target.value)} rows={3} className={INPUT + " resize-none"} placeholder="Description libre visible sur la fiche" />
              </label>
            </Section>

            <Section icon={Tag} title="Achat & tarif de vente" hint="Marge, HT et TTC sont liés" accent={accent}>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: accent }}>Achat</div>
                <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: accent }}>Tarif de vente (1)</div>
                <Field label="PU achat HT" type="number" suffixe="TND" value={sv(f.puAchat)} onChange={(v) => majTarif("achat", String(v))} />
                <Field label="Marge" type="number" suffixe="%" value={sv(f.margePct)} onChange={(v) => majTarif("marge", String(v))} />
                <Field label="TVA" req type="number" suffixe="%" value={sv(f.tauxTva)} onChange={(v) => set("tauxTva", v)} />
                <Field label="Prix unitaire HT" type="number" suffixe="TND" value={sv(f.tarif1Ht)} onChange={(v) => majTarif("ht", String(v))} />
                <Field label="Fodec achat" type="number" suffixe="%" value={sv(f.fodecAchat)} onChange={(v) => set("fodecAchat", v)} />
                <Field label="Fodec vente" type="number" suffixe="%" value={sv(f.fodecVente)} onChange={(v) => set("fodecVente", v)} />
                <ReadField label="PU achat TTC" suffixe="TND" value={puAchatTtc} />
                <Field label="Prix unitaire TTC" type="number" suffixe="TND" value={tarif1Ttc} onChange={(v) => majTarif("ttc", String(v))} />
              </div>
            </Section>

            <Section icon={Boxes} title="Stock" hint="Seuils, entrées et sorties" accent={accent}>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Stock initial" type="number" value={sv(f.stockIni)} onChange={(v) => set("stockIni", v)} />
                <ReadField label="Stock final" value={stockFinal} />
                <Field label="Entrées" type="number" value={sv(f.entrer)} onChange={(v) => set("entrer", v)} />
                <Field label="Sorties" type="number" value={sv(f.sortie)} onChange={(v) => set("sortie", v)} />
                <Field label="Stock minimum" type="number" value={sv(f.stMin)} onChange={(v) => set("stMin", v)} />
                <Field label="Stock maximum" type="number" value={sv(f.stMax)} onChange={(v) => set("stMax", v)} />
                <Field label="Remise maximum" type="number" suffixe="%" value={sv(f.remiseMax)} onChange={(v) => set("remiseMax", v)} />
                <Field label="Commission" type="number" suffixe="%" value={sv(f.commission)} onChange={(v) => set("commission", v)} />
              </div>
              <div className="mt-3"><Toggle label="Remise par quantité" checked={!!n(f.remiseParQte)} onChange={(v) => set("remiseParQte", v ? 1 : 0)} accent={accent} /></div>
            </Section>

            <Section icon={Layers} title="Valorisation" hint="Méthode et coûts" accent={accent}>
              <div className="grid grid-cols-3 gap-3">
                <Field label="PU inventaire" type="number" value={sv(f.puInv)} onChange={(v) => set("puInv", v)} />
                <Field label="DPA" type="number" value={sv(f.dpa)} onChange={(v) => set("dpa", v)} />
                <Field label="PMP" type="number" value={sv(f.pmp)} onChange={(v) => set("pmp", v)} />
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3">
                <Toggle label="FIFO" checked={!!n(f.fifo)} onChange={(v) => set("fifo", v ? 1 : 0)} accent={accent} />
                <Toggle label="LIFO" checked={!!n(f.lifo)} onChange={(v) => set("lifo", v ? 1 : 0)} accent={accent} />
                <Toggle label="N° de série" checked={!!n(f.gerSerie)} onChange={(v) => set("gerSerie", v ? 1 : 0)} accent={accent} />
                <Toggle label="Gestion par lot" checked={!!n(f.gesLot)} onChange={(v) => set("gesLot", v ? 1 : 0)} accent={accent} />
              </div>
            </Section>

            <Section icon={MapPin} title="Type & statut" hint="Nature de l'article et disponibilité" accent={accent}>
              <div className="grid grid-cols-3 gap-2">
                {KINDS.map((kd) => {
                  const actif = f.kind === kd.kind;
                  return (
                    <button key={kd.kind} type="button" onClick={() => set("kind", kd.kind)} aria-pressed={actif}
                      className={`px-2 py-2 rounded-xl border text-xs font-semibold transition ${actif ? "text-white border-transparent shadow" : "border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-card)]"}`}
                      style={actif ? { background: accent } : undefined}>{kd.label}</button>
                  );
                })}
              </div>
              <div className="grid grid-cols-1 gap-2 mt-3">
                <Toggle label="Vendable" checked={!!n(f.vendable)} onChange={(v) => set("vendable", v ? 1 : 0)} accent={accent} />
                <Toggle label="Achetable" checked={!!n(f.achetable)} onChange={(v) => set("achetable", v ? 1 : 0)} accent={accent} />
                <Toggle label="Archivé" checked={!!n(f.archiver)} onChange={(v) => set("archiver", v ? 1 : 0)} accent="#dc2626" />
              </div>
            </Section>

            <Section icon={FileSpreadsheet} title="Comptabilité" hint="Comptes de vente et d'achat" accent={accent} className="md:col-span-2 xl:col-span-3">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <Field label="Compte vente" value={sv(f.cmpteVente)} onChange={(v) => set("cmpteVente", v)} />
                <Field label="Compte vente export" value={sv(f.cmpteVenteExp)} onChange={(v) => set("cmpteVenteExp", v)} />
                <Field label="Compte vente exonéré" value={sv(f.cmpteVenteExo)} onChange={(v) => set("cmpteVenteExo", v)} />
                <Field label="Compte achat local" value={sv(f.cmpteAchatLoc)} onChange={(v) => set("cmpteAchatLoc", v)} />
                <Field label="Compte achat import" value={sv(f.cmpteAchatImp)} onChange={(v) => set("cmpteAchatImp", v)} />
              </div>
            </Section>
          </div>
        </div>

        {/* ── Pied : actions ── */}
        <div className="shrink-0 flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-t border-[var(--border-primary)] bg-[var(--bg-card)]">
          <div className="text-[11px] text-[var(--text-secondary)] hidden sm:block">
            <span className="text-red-500">*</span> champs obligatoires · les prix HT / TTC / marge se recalculent entre eux
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button type="button" onClick={onClose} className="flex-1 sm:flex-none px-4 py-2.5 text-sm font-medium rounded-xl border border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-primary)] transition">Annuler</button>
            <button type="button" onClick={submit} disabled={busy}
              className="flex-1 sm:flex-none px-6 py-2.5 text-sm font-bold text-white rounded-xl disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg transition hover:brightness-110"
              style={{ background: accent }}><Save size={15} /> {busy ? "Enregistrement…" : "Enregistrer"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
