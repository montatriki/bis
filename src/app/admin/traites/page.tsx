"use client";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  FileText, Plus, Loader2, Check, AlertTriangle, Search, Printer,
  Trash2, Pencil, Settings2, Eye, EyeOff, Banknote, Clock, RotateCcw,
} from "lucide-react";
import TraitePrint from "./TraitePrint";
import { montantEnLettres, formatDT } from "@/lib/traite-montant";

// Traites bancaires (lettres de change / الكمبيالة) — module KEMBYELTY, ADMIN.
//
// Saisie d'une traite, aperçu au millimètre, puis impression sur le formulaire
// PRÉ-IMPRIMÉ : seules les valeurs sortent, dans les cases du papier. Le
// calibrage (décalage X/Y) rattrape les marges propres à chaque imprimante et
// est mémorisé, comme le fait le logiciel du même nom.

type Traite = {
  id: number; reference: string; numeroOrdre: string | null;
  codeTiers: number | null; tireNom: string; tireAdresse: string | null;
  beneficiaire: string;
  ribBanque: string | null; ribAgence: string | null;
  ribCompte: string | null; ribCle: string | null;
  domiciliation: string | null; valeurEn: string | null; nomCedant: string | null;
  montant: number; montantLettres: string | null;
  lieuCreation: string | null; dateCreation: string; echeance: string | null;
  etat: string; nbImpressions: number; derniereImpr: string | null;
  offsetX: number; offsetY: number; notes: string | null;
};

type TiersRef = { id: number; raisonSocial: string | null; adresse: string | null; ville: string | null };

const ETAT_CFG: Record<string, { bg: string; text: string }> = {
  "Brouillon": { bg: "bg-slate-100",  text: "text-slate-600" },
  "Imprimée":  { bg: "bg-blue-50",    text: "text-blue-700" },
  "Remise":    { bg: "bg-indigo-50",  text: "text-indigo-700" },
  "Payée":     { bg: "bg-emerald-50", text: "text-emerald-700" },
  "Impayée":   { bg: "bg-red-50",     text: "text-red-600" },
  "Annulée":   { bg: "bg-slate-100",  text: "text-slate-400" },
};

const fmtDate = (v: unknown) =>
  v ? new Date(String(v)).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

/** yyyy-mm-dd pour les <input type="date">. */
const pourInput = (v: unknown) => {
  if (!v) return "";
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
};

/** Clé de mémorisation du calibrage imprimante (poste de travail). */
const CLE_CALIBRAGE = "kembyelty-calibrage";

const VIDE = {
  numeroOrdre: "", codeTiers: "", tireNom: "", tireAdresse: "",
  beneficiaire: "", ribBanque: "", ribAgence: "", ribCompte: "", ribCle: "",
  domiciliation: "", valeurEn: "", nomCedant: "",
  montant: "", lieuCreation: "", dateCreation: new Date().toISOString().slice(0, 10),
  echeance: "", notes: "",
};

type Formulaire = typeof VIDE;

export default function TraitesPage() {
  const [rows, setRows] = useState<Traite[]>([]);
  const [etats, setEtats] = useState<string[]>([]);
  const [filtre, setFiltre] = useState("Tous");
  const [recherche, setRecherche] = useState("");
  const [load, setLoad] = useState(true);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const [form, setForm] = useState<Formulaire>(VIDE);
  const [editionId, setEditionId] = useState<number | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const [tiers, setTiers] = useState<TiersRef[]>([]);
  const [reperes, setReperes] = useState(true);
  // Le calibrage dépend de l'imprimante du poste : relu une fois au montage.
  // `localStorage` n'existe pas au rendu serveur, d'où l'initialiseur paresseux.
  const [calibrage, setCalibrage] = useState<{ x: number; y: number }>(() => {
    if (typeof window === "undefined") return { x: 0, y: 0 };
    try {
      const brut = window.localStorage.getItem(CLE_CALIBRAGE);
      const c = brut ? JSON.parse(brut) : null;
      if (typeof c?.x === "number" && typeof c?.y === "number") return { x: c.x, y: c.y };
    } catch { /* stockage indisponible : on garde 0/0 */ }
    return { x: 0, y: 0 };
  });
  const [panneauCal, setPanneauCal] = useState(false);
  const [zoom, setZoom] = useState(0.62);

  // Traite en cours d'impression : sert à tracer l'impression côté serveur.
  const impressionRef = useRef<number | null>(null);

  const flash = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 5000);
  }, []);

  const majCalibrage = (c: { x: number; y: number }) => {
    setCalibrage(c);
    try { localStorage.setItem(CLE_CALIBRAGE, JSON.stringify(c)); } catch { /* ignoré */ }
  };

  const charger = useCallback(() => {
    const p = new URLSearchParams({ vue: "liste", etat: filtre });
    if (recherche.trim()) p.set("q", recherche.trim());
    fetch(`/api/traites?${p}`)
      .then((r) => r.json())
      .then((d) => {
        setRows(d.rows ?? []);
        setEtats(d.etats ?? []);
      })
      .catch(() => flash("Chargement impossible", false))
      .finally(() => setLoad(false));
  }, [filtre, recherche, flash]);

  useEffect(charger, [charger]);

  // Référentiel tiers pour pré-remplir le tiré.
  useEffect(() => {
    fetch("/api/traites?vue=tiers")
      .then((r) => r.json())
      .then((d) => setTiers(d.rows ?? []))
      .catch(() => {});
  }, []);

  const set = (k: keyof Formulaire, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const montantNum = useMemo(() => {
    const n = Number(String(form.montant).replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }, [form.montant]);

  // Ce qui part réellement sur le papier — recalculé à chaque frappe.
  const valeursImpression = useMemo(() => ({
    numeroOrdre: form.numeroOrdre,
    echeance: fmtDate(form.echeance) === "—" ? "" : fmtDate(form.echeance),
    lieuCreation: form.lieuCreation,
    dateCreation: fmtDate(form.dateCreation) === "—" ? "" : fmtDate(form.dateCreation),
    ribBanque: form.ribBanque, ribAgence: form.ribAgence,
    ribCompte: form.ribCompte, ribCle: form.ribCle,
    montantChiffres: montantNum > 0 ? formatDT(montantNum) : "",
    beneficiaire: form.beneficiaire,
    montantLettres: montantNum > 0 ? montantEnLettres(montantNum) : "",
    nomCedant: form.nomCedant,
    valeurEn: form.valeurEn,
    tireNom: form.tireNom,
    tireAdresse: form.tireAdresse,
    domiciliation: form.domiciliation,
  }), [form, montantNum]);

  const reinit = () => { setForm(VIDE); setEditionId(null); };

  const charger_dans_form = (t: Traite) => {
    setEditionId(t.id);
    setForm({
      numeroOrdre: t.numeroOrdre ?? "", codeTiers: t.codeTiers ? String(t.codeTiers) : "",
      tireNom: t.tireNom, tireAdresse: t.tireAdresse ?? "",
      beneficiaire: t.beneficiaire === "—" ? "" : t.beneficiaire,
      ribBanque: t.ribBanque ?? "", ribAgence: t.ribAgence ?? "",
      ribCompte: t.ribCompte ?? "", ribCle: t.ribCle ?? "",
      domiciliation: t.domiciliation ?? "", valeurEn: t.valeurEn ?? "",
      nomCedant: t.nomCedant ?? "", montant: String(t.montant),
      lieuCreation: t.lieuCreation ?? "", dateCreation: pourInput(t.dateCreation),
      echeance: pourInput(t.echeance), notes: t.notes ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /** Enregistre (création ou modification) et renvoie la traite à jour. */
  const enregistrer = async (): Promise<Traite | null> => {
    if (!form.tireNom.trim()) { flash("Le nom du tiré est obligatoire", false); return null; }
    if (montantNum <= 0) { flash("Le montant doit être supérieur à 0", false); return null; }

    setEnvoi(true);
    const corps = {
      ...form,
      montant: montantNum,
      codeTiers: form.codeTiers || null,
      echeance: form.echeance || null,
      offsetX: calibrage.x, offsetY: calibrage.y,
      ...(editionId ? { id: editionId } : {}),
    };
    const res = await fetch("/api/traites", {
      method: editionId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corps),
    });
    const d = await res.json().catch(() => ({}));
    setEnvoi(false);

    if (!res.ok) { flash(d.error ?? "Échec de l'enregistrement", false); return null; }
    flash(d.message ?? "Enregistré");
    charger();
    if (d.row) setEditionId(d.row.id);
    return d.row ?? null;
  };

  /**
   * Imprime : on enregistre d'abord (la traite imprimée doit exister en base),
   * puis on lance le dialogue d'impression et on trace le tirage.
   */
  const imprimer = async () => {
    const t = await enregistrer();
    if (!t) return;
    impressionRef.current = t.id;
    // Laisse React peindre l'aperçu à jour avant d'ouvrir le dialogue.
    requestAnimationFrame(() => {
      document.body.classList.add("impression-traite");
      window.print();
    });
  };

  /** Réimpression depuis l'historique, avec le calibrage courant. */
  const reimprimer = (t: Traite) => {
    charger_dans_form(t);
    impressionRef.current = t.id;
    requestAnimationFrame(() => {
      document.body.classList.add("impression-traite");
      window.print();
    });
  };

  // `afterprint` retire la classe d'impression et trace le tirage côté serveur.
  useEffect(() => {
    const apres = () => {
      document.body.classList.remove("impression-traite");
      const id = impressionRef.current;
      impressionRef.current = null;
      if (!id) return;
      fetch("/api/traites", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "impression", offsetX: calibrage.x, offsetY: calibrage.y }),
      }).then(() => charger()).catch(() => {});
    };
    window.addEventListener("afterprint", apres);
    return () => {
      window.removeEventListener("afterprint", apres);
      document.body.classList.remove("impression-traite");
    };
  }, [calibrage, charger]);

  const majEtat = async (t: Traite, etat: string) => {
    const res = await fetch("/api/traites", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: t.id, etat }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return flash(d.error ?? "Échec", false);
    flash(d.message ?? "Mis à jour");
    charger();
  };

  const supprimer = async (t: Traite) => {
    if (!confirm(`Supprimer la traite ${t.reference} (${formatDT(t.montant)}) ?`)) return;
    const res = await fetch(`/api/traites?id=${t.id}`, { method: "DELETE" });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return flash(d.error ?? "Échec", false);
    flash(d.message ?? "Supprimée");
    if (editionId === t.id) reinit();
    charger();
  };

  return (
    <div className="space-y-4">
      {/* En-tête */}
      <div className="flex items-center justify-between flex-wrap gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">KEMBYELTY — Traites bancaires</h1>
          <p className="text-slate-500 text-sm">
            Gestion et impression des lettres de change · {rows.length} traite(s)
          </p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={recherche} onChange={(e) => setRecherche(e.target.value)}
              placeholder="Référence, tiré…"
              className="pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-sm w-52" />
          </div>
          <select value={filtre} onChange={(e) => setFiltre(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm">
            <option value="Tous">Tous les états</option>
            {etats.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
          {editionId && (
            <button onClick={reinit}
              className="px-3 py-2 rounded-xl text-sm font-semibold text-slate-600 border border-slate-200 flex items-center gap-1.5">
              <Plus size={15} /> Nouvelle traite
            </button>
          )}
        </div>
      </div>

      {toast && (
        <div className={`px-4 py-2 rounded-xl text-sm font-medium flex items-start gap-2 print:hidden ${
          toast.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
        }`}>
          {toast.ok ? <Check size={15} className="mt-0.5 shrink-0" /> : <AlertTriangle size={15} className="mt-0.5 shrink-0" />}
          <span className="whitespace-pre-line">{toast.msg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* ── Formulaire de saisie ── */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4 print:hidden">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <FileText size={17} className="text-blue-600" />
            <h2 className="font-bold text-slate-800">
              {editionId ? "Modifier la traite" : "Nouvelle traite"}
            </h2>
            {editionId && (
              <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">
                Édition
              </span>
            )}
          </div>

          {/* Tiré */}
          <Section titre="Tiré (celui qui doit payer)">
            <Champ libelle="Client du référentiel" pleine>
              <select value={form.codeTiers}
                onChange={(e) => {
                  const id = e.target.value;
                  set("codeTiers", id);
                  // Pré-remplit nom et adresse depuis la fiche tiers.
                  const t = tiers.find((x) => String(x.id) === id);
                  if (t) {
                    set("tireNom", t.raisonSocial ?? "");
                    set("tireAdresse", [t.adresse, t.ville].filter(Boolean).join(", "));
                  }
                }}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm">
                <option value="">— Saisie libre —</option>
                {tiers.map((t) => (
                  <option key={t.id} value={t.id}>{t.raisonSocial ?? `Tiers ${t.id}`}</option>
                ))}
              </select>
            </Champ>
            <Champ libelle="Nom du tiré *" pleine>
              <Input value={form.tireNom} onChange={(v) => set("tireNom", v)} placeholder="SOCIÉTÉ B" />
            </Champ>
            <Champ libelle="Adresse du tiré" pleine>
              <Input value={form.tireAdresse} onChange={(v) => set("tireAdresse", v)}
                placeholder="30 rue Bizerte, Mégrine 2033" />
            </Champ>
          </Section>

          {/* Montant et dates */}
          <Section titre="Montant et échéance">
            <Champ libelle="Montant (DT) *">
              <Input value={form.montant} onChange={(v) => set("montant", v)}
                placeholder="3650.550" type="text" inputMode="decimal" />
            </Champ>
            <Champ libelle="N° ordre de paiement">
              <Input value={form.numeroOrdre} onChange={(v) => set("numeroOrdre", v)} placeholder="018375618648" />
            </Champ>
            <Champ libelle="Date de création">
              <Input value={form.dateCreation} onChange={(v) => set("dateCreation", v)} type="date" />
            </Champ>
            <Champ libelle="Échéance">
              <Input value={form.echeance} onChange={(v) => set("echeance", v)} type="date" />
            </Champ>
            <Champ libelle="Lieu de création">
              <Input value={form.lieuCreation} onChange={(v) => set("lieuCreation", v)} placeholder="TUNIS" />
            </Champ>
            <Champ libelle="Valeur en">
              <Input value={form.valeurEn} onChange={(v) => set("valeurEn", v)} placeholder="Marchandises" />
            </Champ>

            {/* Le montant en lettres est calculé, jamais saisi : c'est la case
                la plus source d'erreurs sur une traite manuscrite. */}
            {montantNum > 0 && (
              <div className="col-span-2 px-3 py-2 rounded-xl bg-amber-50 text-amber-800 text-xs">
                <span className="font-bold uppercase tracking-wide text-[10px]">Montant en lettres</span>
                <div className="mt-0.5 font-medium">{montantEnLettres(montantNum)}</div>
              </div>
            )}
          </Section>

          {/* RIB */}
          <Section titre="RIB du tiré (20 chiffres)">
            <Champ libelle="Banque (2)">
              <Input value={form.ribBanque} onChange={(v) => set("ribBanque", v.replace(/\D/g, "").slice(0, 2))} mono placeholder="12" />
            </Champ>
            <Champ libelle="Agence (3)">
              <Input value={form.ribAgence} onChange={(v) => set("ribAgence", v.replace(/\D/g, "").slice(0, 3))} mono placeholder="234" />
            </Champ>
            <Champ libelle="N° de compte (13)">
              <Input value={form.ribCompte} onChange={(v) => set("ribCompte", v.replace(/\D/g, "").slice(0, 13))} mono placeholder="6789012345678" />
            </Champ>
            <Champ libelle="Clé (2)">
              <Input value={form.ribCle} onChange={(v) => set("ribCle", v.replace(/\D/g, "").slice(0, 2))} mono placeholder="90" />
            </Champ>
            <Champ libelle="Domiciliation" pleine>
              <Input value={form.domiciliation} onChange={(v) => set("domiciliation", v)} placeholder="ATTIJARI BANK, TUNIS" />
            </Champ>
          </Section>

          {/* Bénéficiaire */}
          <Section titre="Bénéficiaire">
            <Champ libelle="Payer à l'ordre de" pleine>
              <Input value={form.beneficiaire} onChange={(v) => set("beneficiaire", v)} placeholder="SOCIÉTÉ A" />
            </Champ>
            <Champ libelle="Nom du cédant">
              <Input value={form.nomCedant} onChange={(v) => set("nomCedant", v)} />
            </Champ>
            <Champ libelle="Notes internes">
              <Input value={form.notes} onChange={(v) => set("notes", v)} placeholder="Non imprimé" />
            </Champ>
          </Section>

          <div className="flex gap-2 pt-2 flex-wrap">
            <button onClick={enregistrer} disabled={envoi}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 border border-slate-200 flex items-center gap-2 disabled:opacity-50">
              {envoi ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
              Enregistrer
            </button>
            <button onClick={imprimer} disabled={envoi}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 flex items-center gap-2 disabled:opacity-50">
              <Printer size={15} /> Imprimer la traite
            </button>
            <button onClick={reinit}
              className="px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-500 flex items-center gap-1.5">
              <RotateCcw size={14} /> Vider
            </button>
          </div>
        </div>

        {/* ── Aperçu au millimètre ── */}
        <div className="space-y-3">
          <div className="bg-white rounded-2xl border border-slate-100 p-4 print:hidden">
            <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
              <div className="flex items-center gap-2">
                <Eye size={16} className="text-slate-400" />
                <h2 className="font-bold text-slate-800 text-sm">Aperçu — formulaire pré-imprimé</h2>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setReperes(!reperes)}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 border border-slate-200 flex items-center gap-1.5">
                  {reperes ? <EyeOff size={13} /> : <Eye size={13} />}
                  {reperes ? "Masquer repères" : "Voir repères"}
                </button>
                <button onClick={() => setPanneauCal(!panneauCal)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1.5 ${
                    panneauCal ? "bg-blue-600 text-white border-blue-600" : "text-slate-600 border-slate-200"
                  }`}>
                  <Settings2 size={13} /> Calibrage
                </button>
              </div>
            </div>

            {/* Calibrage : rattrape les marges propres à chaque imprimante. */}
            {panneauCal && (
              <div className="mb-3 p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <p className="text-xs text-slate-500 leading-relaxed">
                  Imprimez une traite sur une feuille blanche, superposez-la au formulaire
                  pré-imprimé à contre-jour, mesurez l&apos;écart et reportez-le ici.
                  Le réglage est mémorisé sur ce poste.
                </p>
                <Curseur libelle="Décalage horizontal (X)" valeur={calibrage.x}
                  onChange={(x) => majCalibrage({ ...calibrage, x })} />
                <Curseur libelle="Décalage vertical (Y)" valeur={calibrage.y}
                  onChange={(y) => majCalibrage({ ...calibrage, y })} />
                <div className="flex items-center gap-2">
                  <button onClick={() => majCalibrage({ x: 0, y: 0 })}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 border border-slate-200">
                    Remettre à zéro
                  </button>
                  <span className="text-xs text-slate-400">
                    X {calibrage.x.toFixed(1)} mm · Y {calibrage.y.toFixed(1)} mm
                  </span>
                </div>
                <div className="flex items-center gap-2 pt-1 border-t border-slate-200">
                  <span className="text-xs text-slate-500">Zoom aperçu</span>
                  <input type="range" min={0.35} max={1} step={0.01} value={zoom}
                    onChange={(e) => setZoom(Number(e.target.value))} className="flex-1" />
                  <span className="text-xs font-mono text-slate-400">{Math.round(zoom * 100)}%</span>
                </div>
              </div>
            )}

            {/* Cadre de défilement : la feuille fait 297 mm de large. */}
            <div className="overflow-auto border border-slate-200 rounded-xl bg-slate-50 p-2">
              <div style={{ width: `${297 * zoom}mm`, height: `${210 * zoom}mm` }}>
                <TraitePrint valeurs={valeursImpression} offsetX={calibrage.x} offsetY={calibrage.y}
                  reperes={reperes} zoom={zoom} />
              </div>
            </div>

            <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
              À l&apos;impression, seules les valeurs sortent (A4 paysage, sans marge) :
              cadres bleus, libellés et grille ne sont que des repères d&apos;écran.
              Pensez à désactiver « ajuster à la page » dans le dialogue d&apos;impression.
            </p>
          </div>
        </div>
      </div>

      {/* ── Historique ── */}
      <div className="print:hidden">
        <h2 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
          <Banknote size={17} className="text-slate-400" /> Historique des traites
        </h2>

        {load ? (
          <div className="py-16 text-center text-slate-400"><Loader2 className="animate-spin inline" size={22} /></div>
        ) : rows.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center">
            <FileText size={32} className="mx-auto mb-3 text-slate-200" />
            <div className="text-sm text-slate-500">Aucune traite enregistrée.</div>
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((t) => {
              const cfg = ETAT_CFG[t.etat] ?? ETAT_CFG["Brouillon"];
              // Une échéance dépassée non dénouée doit sauter aux yeux.
              const enRetard = t.echeance && new Date(t.echeance) < new Date()
                && ["Imprimée", "Remise", "Impayée"].includes(t.etat);
              return (
                <div key={t.id} className="bg-white rounded-2xl border border-slate-100 p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-slate-400">{t.reference}</span>
                        <span className="font-semibold text-slate-800">{t.tireNom}</span>
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg ${cfg.bg} ${cfg.text}`}>
                          {t.etat}
                        </span>
                        {enRetard && (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg bg-red-50 text-red-600 flex items-center gap-1">
                            <Clock size={10} /> Échue
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 mt-1 flex items-center gap-3 flex-wrap">
                        <span className="font-bold text-slate-700">{formatDT(t.montant)}</span>
                        <span>Échéance {fmtDate(t.echeance)}</span>
                        <span>Créée {fmtDate(t.dateCreation)}</span>
                        {t.nbImpressions > 0 && (
                          <span className="text-slate-400">
                            {t.nbImpressions} impression(s) · {fmtDate(t.derniereImpr)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <select value={t.etat} onChange={(e) => majEtat(t, e.target.value)}
                        className="px-2 py-1.5 rounded-lg border border-slate-200 text-xs">
                        {etats.map((e) => <option key={e} value={e}>{e}</option>)}
                      </select>
                      <button onClick={() => reimprimer(t)} title="Réimprimer"
                        className="p-2 rounded-lg text-blue-600 hover:bg-blue-50">
                        <Printer size={15} />
                      </button>
                      <button onClick={() => charger_dans_form(t)} title="Modifier"
                        className="p-2 rounded-lg text-slate-500 hover:bg-slate-100">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => supprimer(t)} title="Supprimer"
                        className="p-2 rounded-lg text-red-500 hover:bg-red-50">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Petits blocs de formulaire, au style des autres écrans ── */

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">{titre}</div>
      <div className="grid grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

function Champ({ libelle, pleine, children }: { libelle: string; pleine?: boolean; children: React.ReactNode }) {
  return (
    <div className={pleine ? "col-span-2" : ""}>
      <label className="block text-xs font-semibold text-slate-500 mb-1">{libelle}</label>
      {children}
    </div>
  );
}

function Input({
  value, onChange, placeholder, type = "text", mono, inputMode,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string;
  type?: string; mono?: boolean; inputMode?: "decimal" | "numeric" | "text";
}) {
  return (
    <input
      value={value} onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder} type={type} inputMode={inputMode}
      className={`w-full px-3 py-2 rounded-xl border border-slate-200 text-sm ${mono ? "font-mono tracking-widest" : ""}`}
    />
  );
}

/** Réglage fin en mm : curseur + saisie directe, pas à 0,5 mm. */
function Curseur({ libelle, valeur, onChange }: { libelle: string; valeur: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 mb-1">{libelle}</label>
      <div className="flex items-center gap-2">
        <button onClick={() => onChange(Math.round((valeur - 0.5) * 10) / 10)}
          className="w-7 h-7 rounded-lg border border-slate-200 text-slate-600 font-bold">−</button>
        <input type="range" min={-20} max={20} step={0.5} value={valeur}
          onChange={(e) => onChange(Number(e.target.value))} className="flex-1" />
        <button onClick={() => onChange(Math.round((valeur + 0.5) * 10) / 10)}
          className="w-7 h-7 rounded-lg border border-slate-200 text-slate-600 font-bold">+</button>
        <input type="number" step={0.5} value={valeur}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          className="w-16 px-2 py-1 rounded-lg border border-slate-200 text-xs font-mono text-center" />
        <span className="text-xs text-slate-400">mm</span>
      </div>
    </div>
  );
}
