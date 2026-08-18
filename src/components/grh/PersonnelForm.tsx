"use client";
import { useState, useEffect } from "react";
import { Save, X, User, Briefcase, Wallet, ShieldCheck, Loader2 } from "lucide-react";

type Row = Record<string, unknown>;
const sv = (v: unknown) => (v == null ? "" : String(v));
const n = (v: unknown) => (v == null || v === "" ? 0 : Number(v)) || 0;
const dv = (v: unknown) => (v ? String(v).slice(0, 10) : ""); // ISO -> yyyy-mm-dd

const SEXES = ["Homme", "Femme"];
const SITUATIONS = ["Célibataire", "Marié", "Divorcé", "Veuf"];

type RefList = { id: number; libelle: string }[];

/** Fiche employé — création et modification. */
export default function PersonnelForm({
  initial, accent, onClose, onSaved,
}: {
  initial: Row; accent: string; onClose: () => void; onSaved: () => void;
}) {
  const isNew = !initial.id;
  const [f, setF] = useState<Row>({
    codeEmploye: sv(initial.codeEmploye),
    nom: sv(initial.nom), prenom: sv(initial.prenom),
    cin: sv(initial.cin), lieuCin: sv(initial.lieuCin), dateCin: dv(initial.dateCin),
    sexe: sv(initial.sexe), dateNaiss: dv(initial.dateNaiss), lieuNaiss: sv(initial.lieuNaiss),
    situationFamiliale: sv(initial.situationFamiliale),
    chefFamille: Boolean(initial.chefFamille),
    nbrEnfants: n(initial.nbrEnfants), nbrHandicape: n(initial.nbrHandicape),
    adresse: sv(initial.adresse), tel: sv(initial.tel), email: sv(initial.email),
    numContrat: sv(initial.numContrat), contratDu: dv(initial.contratDu), contratAu: dv(initial.contratAu),
    dateEmbauche: dv(initial.dateEmbauche), dateDepart: dv(initial.dateDepart),
    partant: Boolean(initial.partant),
    traitement: sv(initial.traitement) || "M",
    salaireBase: n(initial.salaireBase), coutHoraire: n(initial.coutHoraire),
    njTraitNormal: initial.njTraitNormal != null ? n(initial.njTraitNormal) : 26,
    smigar: Boolean(initial.smigar), plafondCredit: n(initial.plafondCredit),
    soldeConge: n(initial.soldeConge), prixConge: n(initial.prixConge),
    numCnss: sv(initial.numCnss), typeCnss: sv(initial.typeCnss),
    actif: initial.actif == null ? true : Boolean(initial.actif),
    fonctionId: sv(initial.fonctionId), gradeId: sv(initial.gradeId),
    serviceId: sv(initial.serviceId), categorieId: sv(initial.categorieId), echelonId: sv(initial.echelonId),
  });

  const [refs, setRefs] = useState<Record<string, RefList>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      ["fonctions", "grades", "services", "categories", "echelons"].map((k) =>
        fetch(`/api/grh?resource=${k}`).then((r) => r.json()).then((d) => [k, d.rows ?? []] as const)
      )
    ).then((entries) => { if (!cancelled) setRefs(Object.fromEntries(entries)); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const set = (k: string, v: unknown) => setF((p) => ({ ...p, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!sv(f.nom).trim()) return setErr("Le nom est obligatoire");
    if (isNew && !sv(f.codeEmploye).trim()) return setErr("Le matricule est obligatoire");

    setBusy(true); setErr(null);
    const r = await fetch(`/api/grh?resource=personnel`, {
      method: isNew ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isNew ? f : { ...f, id: initial.id }),
    }).then((x) => x.json()).catch(() => ({ error: "réseau" }));
    setBusy(false);
    if (r.ok) onSaved();
    else setErr(r.error ?? "Échec de l'enregistrement");
  }

  const isHoraire = f.traitement === "H";

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <form onSubmit={submit}
        className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[var(--border-primary)]">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: accent + "18", color: accent }}>
            <User size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-[var(--text-primary)]">{isNew ? "Nouvel employé" : `${sv(f.nom)} ${sv(f.prenom)}`}</div>
            <div className="text-xs text-[var(--text-secondary)]">{isNew ? "Fiche employé" : `Matricule ${sv(f.codeEmploye)}`}</div>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-[var(--bg-primary)] text-[var(--text-secondary)]"><X size={18} /></button>
        </div>

        {err && <div className="mx-5 mt-3 px-3 py-2 rounded-lg bg-red-500/10 text-red-500 text-sm">{err}</div>}

        <div className="flex-1 overflow-auto px-5 py-4 space-y-4">
          <Section icon={User} title="Identité" accent={accent}>
            <div className="grid sm:grid-cols-3 gap-3">
              <Field label="Matricule" req value={sv(f.codeEmploye)} onChange={(v) => set("codeEmploye", v)} disabled={!isNew} />
              <Field label="Nom" req value={sv(f.nom)} onChange={(v) => set("nom", v)} />
              <Field label="Prénom" value={sv(f.prenom)} onChange={(v) => set("prenom", v)} />
              <Field label="CIN" value={sv(f.cin)} onChange={(v) => set("cin", v)} />
              <Field label="Lieu CIN" value={sv(f.lieuCin)} onChange={(v) => set("lieuCin", v)} />
              <Field label="Date CIN" type="date" value={sv(f.dateCin)} onChange={(v) => set("dateCin", v)} />
              <Select label="Sexe" value={sv(f.sexe)} onChange={(v) => set("sexe", v)} opts={SEXES} />
              <Field label="Date naissance" type="date" value={sv(f.dateNaiss)} onChange={(v) => set("dateNaiss", v)} />
              <Field label="Lieu naissance" value={sv(f.lieuNaiss)} onChange={(v) => set("lieuNaiss", v)} />
              <Select label="Situation familiale" value={sv(f.situationFamiliale)} onChange={(v) => set("situationFamiliale", v)} opts={SITUATIONS} />
              <Field label="Nbr enfants" type="number" value={String(f.nbrEnfants)} onChange={(v) => set("nbrEnfants", v)} />
              <Field label="Nbr handicapés" type="number" value={String(f.nbrHandicape)} onChange={(v) => set("nbrHandicape", v)} />
              <Field label="Téléphone" value={sv(f.tel)} onChange={(v) => set("tel", v)} />
              <Field label="Email" type="email" value={sv(f.email)} onChange={(v) => set("email", v)} />
              <Field label="Adresse" value={sv(f.adresse)} onChange={(v) => set("adresse", v)} />
            </div>
            <div className="flex gap-4 mt-3">
              <Check label="Chef de famille" checked={Boolean(f.chefFamille)} onChange={(v) => set("chefFamille", v)} accent={accent} />
              <Check label="Actif" checked={Boolean(f.actif)} onChange={(v) => set("actif", v)} accent={accent} />
            </div>
          </Section>

          <Section icon={Briefcase} title="Affectation & contrat" accent={accent}>
            <div className="grid sm:grid-cols-3 gap-3">
              <RefSelect label="Fonction" value={sv(f.fonctionId)} onChange={(v) => set("fonctionId", v)} list={refs.fonctions} />
              <RefSelect label="Grade" value={sv(f.gradeId)} onChange={(v) => set("gradeId", v)} list={refs.grades} />
              <RefSelect label="Service" value={sv(f.serviceId)} onChange={(v) => set("serviceId", v)} list={refs.services} />
              <RefSelect label="Catégorie" value={sv(f.categorieId)} onChange={(v) => set("categorieId", v)} list={refs.categories} />
              <RefSelect label="Échelon" value={sv(f.echelonId)} onChange={(v) => set("echelonId", v)} list={refs.echelons} />
              <Field label="N° contrat" value={sv(f.numContrat)} onChange={(v) => set("numContrat", v)} />
              <Field label="Contrat du" type="date" value={sv(f.contratDu)} onChange={(v) => set("contratDu", v)} />
              <Field label="Contrat au" type="date" value={sv(f.contratAu)} onChange={(v) => set("contratAu", v)} />
              <Field label="Date embauche" type="date" value={sv(f.dateEmbauche)} onChange={(v) => set("dateEmbauche", v)} />
              <Field label="Date départ" type="date" value={sv(f.dateDepart)} onChange={(v) => set("dateDepart", v)} />
            </div>
            <div className="mt-3"><Check label="Partant" checked={Boolean(f.partant)} onChange={(v) => set("partant", v)} accent={accent} /></div>
          </Section>

          <Section icon={Wallet} title="Rémunération" accent={accent}>
            <div className="grid sm:grid-cols-3 gap-3">
              <Select label="Régime" value={sv(f.traitement)} onChange={(v) => set("traitement", v)}
                opts={["M", "H"]} labels={{ M: "Mensuel", H: "Horaire" }} />
              {isHoraire
                ? <Field label="Coût horaire" type="number" value={String(f.coutHoraire)} onChange={(v) => set("coutHoraire", v)} />
                : <Field label="Salaire de base" type="number" value={String(f.salaireBase)} onChange={(v) => set("salaireBase", v)} />}
              <Field label="Jours de référence" type="number" value={String(f.njTraitNormal)} onChange={(v) => set("njTraitNormal", v)} />
              <Field label="Solde congé (j)" type="number" value={String(f.soldeConge)} onChange={(v) => set("soldeConge", v)} />
              <Field label="Prix congé" type="number" value={String(f.prixConge)} onChange={(v) => set("prixConge", v)} />
              <Field label="Plafond crédit" type="number" value={String(f.plafondCredit)} onChange={(v) => set("plafondCredit", v)} />
            </div>
            <div className="mt-3"><Check label="SMIG appliqué" checked={Boolean(f.smigar)} onChange={(v) => set("smigar", v)} accent={accent} /></div>
          </Section>

          <Section icon={ShieldCheck} title="CNSS" accent={accent}>
            <div className="grid sm:grid-cols-3 gap-3">
              <Field label="N° CNSS" value={sv(f.numCnss)} onChange={(v) => set("numCnss", v)} />
              <Field label="Type CNSS" value={sv(f.typeCnss)} onChange={(v) => set("typeCnss", v)} />
            </div>
          </Section>
        </div>

        <div className="border-t border-[var(--border-primary)] px-5 py-3 flex justify-end gap-2">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm font-semibold rounded-lg border border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]">Annuler</button>
          <button type="submit" disabled={busy}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg text-white disabled:opacity-60" style={{ background: accent }}>
            {busy ? <Loader2 className="animate-spin" size={15} /> : <Save size={15} />} Enregistrer
          </button>
        </div>
      </form>
    </div>
  );
}

function Section({ icon: Icon, title, accent, children }: { icon: React.ElementType; title: string; accent: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--border-primary)] p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: accent + "18", color: accent }}><Icon size={15} /></div>
        <span className="text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">{title}</span>
      </div>
      {children}
    </div>
  );
}

function Field({ label, value, onChange, type = "text", req, disabled }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; req?: boolean; disabled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold text-[var(--text-secondary)]">{label}{req && <span className="text-red-500"> *</span>}</span>
      <input type={type} step="any" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}
        className="px-2.5 py-1.5 text-sm bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg focus:outline-none disabled:opacity-60" />
    </label>
  );
}

function Select({ label, value, onChange, opts, labels }: {
  label: string; value: string; onChange: (v: string) => void; opts: string[]; labels?: Record<string, string>;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold text-[var(--text-secondary)]">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="px-2.5 py-1.5 text-sm bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg focus:outline-none">
        <option value="">—</option>
        {opts.map((o) => <option key={o} value={o}>{labels?.[o] ?? o}</option>)}
      </select>
    </label>
  );
}

function RefSelect({ label, value, onChange, list }: {
  label: string; value: string; onChange: (v: string) => void; list?: RefList;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold text-[var(--text-secondary)]">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="px-2.5 py-1.5 text-sm bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg focus:outline-none">
        <option value="">—</option>
        {(list ?? []).map((o) => <option key={o.id} value={String(o.id)}>{o.libelle}</option>)}
      </select>
    </label>
  );
}

function Check({ label, checked, onChange, accent }: { label: string; checked: boolean; onChange: (v: boolean) => void; accent: string }) {
  return (
    <label className="flex items-center gap-2 text-sm cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ accentColor: accent }} className="w-4 h-4" />
      <span className="text-[var(--text-primary)]">{label}</span>
    </label>
  );
}
