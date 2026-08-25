"use client";
import { useState, useEffect, useCallback, useMemo, Fragment } from "react";
import { confirmer } from "@/lib/alertes";
import {
  Factory, Plus, Trash2, Search, X, Loader2, Check, AlertTriangle,
  Calculator, CalendarClock, Layers, Wrench, ChevronRight, ChevronDown,
  Download, Gauge, ListTree,
} from "lucide-react";

// GPAO — les 3 écrans qui affichaient « Module disponible » :
//   donnees-techniques : postes de charge, nomenclatures, gammes
//   cbn                : calcul des besoins nets
//   planification      : ordonnancement des OF + charge par poste

type Mode = "technique" | "cbn" | "planification";

type Poste = {
  id: number; code: string; libelle: string; centre: string | null;
  mainOeuvre: boolean; machine: boolean; sousTraitance: boolean;
  nbRessources: number; heureDebut: string; heureFin: string;
  pauseDebut: string; pauseFin: string; coutHoraire: number;
  nbOperations: number; nbPlans: number;
};
type NomRow = {
  refArt: string; desArt: string | null; qteBase: number;
  exploitation: boolean; elaboration: boolean; nbLignes: number;
};
type NomLigne = {
  id: number; refArt: string; desArt: string | null;
  typeComposant: string; qte: number; numSequence: number;
};
type Nomenclature = NomRow & { lignes: NomLigne[] };
type GammeRow = {
  id: number; gamme: string; desGamme: string | null; refArt: string | null;
  exploitation: boolean; nbOperations: number;
};
type OpGamme = {
  id: number; desOperation: string; numSequence: number;
  posteChargeId: number | null; posteCharge: { code: string; libelle: string } | null;
  tempsReg: number; tempsPreparation: number; tempsOperatoire: number;
  qteBase: number; coeffCharge: number; efficience: number;
};
type Article = { refArt: string; designation: string; kind: string; enStock: number; unite: string | null };
type LigneCbn = {
  refArt: string; desArt: string | null; typeComposant: string; unite: string | null;
  besoinBrut: number; stock: number; besoinNet: number;
  puAchat: number; valeurNet: number; fabrique: boolean; horsReferentiel: boolean;
};
type Composant = {
  refArt: string; desArt: string | null; typeComposant: string;
  qteUnitaire: number; qteTotale: number; niveau: number; parent: string; fabrique: boolean;
};
type OfRow = {
  refDoc: string; dateDoc: string; raisonSocial: string | null; etat: string | null;
  nbLignes: number; nbOperations: number; nbCreneaux: number;
};
type Plan = {
  id: number; refDoc: string; desOperation: string | null;
  dateDebut: string; dateFin: string; duree: number; typeDuree: string;
  posteCharge: { code: string; libelle: string } | null;
  posteMo: string | null; disponibilite: boolean;
};
type Charge = {
  code: string; poste: string; heures: number; creneaux: number;
  conflits: number; capaciteHeures: number; tauxCharge: number | null;
};

const fmt = (v: unknown) =>
  new Intl.NumberFormat("fr-TN", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(Number(v) || 0);
const fmtQ = (v: unknown) =>
  new Intl.NumberFormat("fr-TN", { maximumFractionDigits: 3 }).format(Number(v) || 0);
const fmtDate = (v: unknown) => (v ? new Date(String(v)).toLocaleDateString("fr-FR") : "—");
const fmtDT = (v: unknown) =>
  v ? new Date(String(v)).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

/** Minutes → "2h30" — plus lisible qu'un nombre de minutes brut. */
const duree = (min: number) => {
  const m = Math.round(Number(min) || 0);
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h > 0 ? `${h}h${String(r).padStart(2, "0")}` : `${r} min`;
};

const iso = (d: Date) => d.toISOString().slice(0, 10);

function csv(nom: string, entetes: string[], lignes: (string | number)[][]) {
  const esc = (v: string | number) => {
    const t = String(v ?? "");
    return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const contenu = [entetes.join(";"), ...lignes.map((l) => l.map(esc).join(";"))].join("\n");
  const url = URL.createObjectURL(new Blob([`﻿${contenu}`], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nom}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function GpaoView({ accent, mode }: { accent: string; mode: Mode }) {
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const flash = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 6000);
  }, []);

  const titres: Record<Mode, { t: string; s: string; icon: typeof Factory }> = {
    technique: { t: "Données techniques", s: "Postes de charge · nomenclatures · gammes", icon: ListTree },
    cbn: { t: "Calcul des besoins nets", s: "Éclatement de nomenclature et approvisionnements", icon: Calculator },
    planification: { t: "Planification", s: "Ordonnancement des ordres de fabrication", icon: CalendarClock },
  };
  const cfg = titres[mode];
  const Icon = cfg.icon;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ background: accent + "18", color: accent }}>
          <Icon size={17} />
        </div>
        <div>
          <div className="font-bold text-[var(--text-primary)] text-sm">{cfg.t}</div>
          <div className="text-xs text-[var(--text-secondary)]">{cfg.s}</div>
        </div>
      </div>

      {toast && (
        <div className={`px-4 py-2 rounded-xl text-sm font-medium flex items-start gap-2 ${
          toast.ok ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-red-500/10 text-red-600"
        }`}>
          {toast.ok ? <Check size={15} className="mt-0.5 shrink-0" /> : <AlertTriangle size={15} className="mt-0.5 shrink-0" />}
          <span className="whitespace-pre-line">{toast.msg}</span>
        </div>
      )}

      {mode === "technique" && <Technique accent={accent} onFlash={flash} />}
      {mode === "cbn" && <Cbn accent={accent} onFlash={flash} />}
      {mode === "planification" && <Planification accent={accent} onFlash={flash} />}
    </div>
  );
}

/* ============================ Données techniques ============================ */

function Technique({ accent, onFlash }: { accent: string; onFlash: (m: string, ok?: boolean) => void }) {
  const [onglet, setOnglet] = useState<"postes" | "nomenclatures" | "gammes">("nomenclatures");
  const tabs = [
    ["nomenclatures", "Nomenclatures"],
    ["gammes", "Gammes"],
    ["postes", "Postes de charge"],
  ] as const;

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 flex-wrap">
        {tabs.map(([k, l]) => (
          <button key={k} onClick={() => setOnglet(k)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
              onglet === k ? "text-white border-transparent shadow-sm"
                : "bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border-primary)]"
            }`}
            style={onglet === k ? { background: accent } : undefined}>
            {l}
          </button>
        ))}
      </div>

      {onglet === "postes" && <Postes accent={accent} onFlash={onFlash} />}
      {onglet === "nomenclatures" && <Nomenclatures accent={accent} onFlash={onFlash} />}
      {onglet === "gammes" && <Gammes accent={accent} onFlash={onFlash} />}
    </div>
  );
}

/* --------------------------------- Postes ---------------------------------- */

const POSTE_VIDE = {
  code: "", libelle: "", centre: "", machine: true, mainOeuvre: false, sousTraitance: false,
  nbRessources: 1, heureDebut: "08:00", heureFin: "17:00", pauseDebut: "12:00", pauseFin: "13:00",
  coutHoraire: 0,
};

function Postes({ accent, onFlash }: { accent: string; onFlash: (m: string, ok?: boolean) => void }) {
  const [rows, setRows] = useState<Poste[]>([]);
  const [load, setLoad] = useState(true);
  const [form, setForm] = useState<typeof POSTE_VIDE & { id?: number } | null>(null);
  const [busy, setBusy] = useState(false);

  const charger = useCallback(() => {
    fetch("/api/gpao?vue=postes")
      .then((r) => r.json())
      .then((d) => setRows(d.rows ?? []))
      .catch(() => onFlash("Chargement des postes impossible", false))
      .finally(() => setLoad(false));
  }, [onFlash]);

  useEffect(charger, [charger]);

  const enregistrer = async () => {
    if (!form) return;
    if (!form.code.trim() || !form.libelle.trim()) return onFlash("Code et libellé requis", false);
    setBusy(true);
    try {
      const r = await fetch("/api/gpao", {
        method: form.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vue: "poste", ...form }),
      });
      const d = await r.json();
      if (!r.ok) return onFlash(d.error ?? "Échec", false);
      onFlash(d.message ?? "Enregistré");
      setForm(null);
      charger();
    } finally { setBusy(false); }
  };

  const supprimer = async (p: Poste) => {
    if (!(await confirmer(`Supprimer le poste ${p.code} ?`, { danger: true }))) return;
    const r = await fetch(`/api/gpao?vue=poste&id=${p.id}`, { method: "DELETE" });
    const d = await r.json();
    if (!r.ok) return onFlash(d.error ?? "Échec", false);
    onFlash(d.message ?? "Supprimé");
    charger();
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div className="text-xs text-[var(--text-secondary)]">{rows.length} poste(s) de charge</div>
        <button onClick={() => setForm({ ...POSTE_VIDE })}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5"
          style={{ background: accent }}>
          <Plus size={13} /> Nouveau poste
        </button>
      </div>

      {form && (
        <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Champ label="Code *"><input value={form.code} disabled={Boolean(form.id)}
              onChange={(e) => setForm({ ...form, code: e.target.value })} className={inputCls} /></Champ>
            <Champ label="Libellé *"><input value={form.libelle}
              onChange={(e) => setForm({ ...form, libelle: e.target.value })} className={inputCls} /></Champ>
            <Champ label="Centre"><input value={form.centre ?? ""}
              onChange={(e) => setForm({ ...form, centre: e.target.value })} className={inputCls} /></Champ>
            <Champ label="Nb ressources"><input type="number" min={1} value={form.nbRessources}
              onChange={(e) => setForm({ ...form, nbRessources: Number(e.target.value) })} className={inputCls} /></Champ>
            <Champ label="Début"><input type="time" value={form.heureDebut}
              onChange={(e) => setForm({ ...form, heureDebut: e.target.value })} className={inputCls} /></Champ>
            <Champ label="Fin"><input type="time" value={form.heureFin}
              onChange={(e) => setForm({ ...form, heureFin: e.target.value })} className={inputCls} /></Champ>
            <Champ label="Pause de"><input type="time" value={form.pauseDebut}
              onChange={(e) => setForm({ ...form, pauseDebut: e.target.value })} className={inputCls} /></Champ>
            <Champ label="Pause à"><input type="time" value={form.pauseFin}
              onChange={(e) => setForm({ ...form, pauseFin: e.target.value })} className={inputCls} /></Champ>
            <Champ label="Coût horaire"><input type="number" step="0.001" value={form.coutHoraire}
              onChange={(e) => setForm({ ...form, coutHoraire: Number(e.target.value) })} className={inputCls} /></Champ>
          </div>
          <div className="flex gap-4 text-xs text-[var(--text-secondary)]">
            {([["machine", "Machine"], ["mainOeuvre", "Main d'œuvre"], ["sousTraitance", "Sous-traitance"]] as const).map(([k, l]) => (
              <label key={k} className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={Boolean(form[k])}
                  onChange={(e) => setForm({ ...form, [k]: e.target.checked })} />
                {l}
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={enregistrer} disabled={busy}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 disabled:opacity-50"
              style={{ background: accent }}>
              {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Enregistrer
            </button>
            <button onClick={() => setForm(null)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--border-primary)] text-[var(--text-secondary)]">
              Annuler
            </button>
          </div>
        </div>
      )}

      <Tableau load={load} vide="Aucun poste de charge — créez-en un pour affecter les opérations de gamme."
        entetes={["Code", "Libellé", "Nature", "Ressources", "Horaire", "Coût/h", "Gammes", ""]}>
        {rows.map((p) => (
          <tr key={p.id} className="border-b border-[var(--border-primary)]/60 hover:bg-[var(--accent-light)]">
            <td className="px-3 py-2 font-mono text-xs">{p.code}</td>
            <td className="px-3 py-2">{p.libelle}</td>
            <td className="px-3 py-2 text-xs">
              {[p.machine && "Machine", p.mainOeuvre && "M.O.", p.sousTraitance && "S.T."].filter(Boolean).join(" · ") || "—"}
            </td>
            <td className="px-3 py-2 text-right">{fmtQ(p.nbRessources)}</td>
            <td className="px-3 py-2 text-xs">{p.heureDebut}–{p.pauseDebut} · {p.pauseFin}–{p.heureFin}</td>
            <td className="px-3 py-2 text-right">{fmt(p.coutHoraire)}</td>
            <td className="px-3 py-2 text-right text-xs">{p.nbOperations}</td>
            <td className="px-3 py-2 text-right whitespace-nowrap">
              <button onClick={() => setForm({ ...POSTE_VIDE, ...p, centre: p.centre ?? "" })}
                className="text-xs px-2 py-1 rounded border border-[var(--border-primary)] mr-1">Modifier</button>
              <button onClick={() => supprimer(p)} className="text-red-500 p-1" title="Supprimer">
                <Trash2 size={13} />
              </button>
            </td>
          </tr>
        ))}
      </Tableau>
    </div>
  );
}

/* ------------------------------ Nomenclatures ------------------------------ */

function Nomenclatures({ accent, onFlash }: { accent: string; onFlash: (m: string, ok?: boolean) => void }) {
  const [rows, setRows] = useState<NomRow[]>([]);
  const [load, setLoad] = useState(true);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const [creer, setCreer] = useState(false);

  const charger = useCallback(() => {
    fetch(`/api/gpao?vue=nomenclatures${q ? `&q=${encodeURIComponent(q)}` : ""}`)
      .then((r) => r.json())
      .then((d) => setRows(d.rows ?? []))
      .catch(() => onFlash("Chargement impossible", false))
      .finally(() => setLoad(false));
  }, [q, onFlash]);

  useEffect(() => {
    const t = setTimeout(charger, 250);
    return () => clearTimeout(t);
  }, [charger]);

  if (sel) {
    return <NomenclatureDetail refArt={sel} accent={accent} onFlash={onFlash}
      onClose={() => { setSel(null); charger(); }} />;
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un article…"
            className="pl-8 pr-3 py-1.5 rounded-lg text-xs bg-[var(--bg-card)] border border-[var(--border-primary)] w-56" />
        </div>
        <button onClick={() => setCreer(true)}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5"
          style={{ background: accent }}>
          <Plus size={13} /> Nouvelle nomenclature
        </button>
      </div>

      {creer && <CreerNomenclature accent={accent} onFlash={onFlash}
        onClose={(ref) => { setCreer(false); if (ref) { charger(); setSel(ref); } }} />}

      <Tableau load={load}
        vide="Aucune nomenclature. Une nomenclature décrit les composants d'un article fabriqué — c'est ce que le CBN éclate."
        entetes={["Article", "Désignation", "Qté base", "Composants", "État", ""]}>
        {rows.map((n) => (
          <tr key={n.refArt} className="border-b border-[var(--border-primary)]/60 hover:bg-[var(--accent-light)] cursor-pointer"
            onClick={() => setSel(n.refArt)}>
            <td className="px-3 py-2 font-mono text-xs">{n.refArt}</td>
            <td className="px-3 py-2">{n.desArt ?? "—"}</td>
            <td className="px-3 py-2 text-right">{fmtQ(n.qteBase)}</td>
            <td className="px-3 py-2 text-right">{n.nbLignes}</td>
            <td className="px-3 py-2">
              <Badge ok={n.exploitation}>{n.exploitation ? "Exploitation" : "Élaboration"}</Badge>
            </td>
            <td className="px-3 py-2 text-right"><ChevronRight size={14} className="inline text-[var(--text-secondary)]" /></td>
          </tr>
        ))}
      </Tableau>
    </div>
  );
}

function CreerNomenclature({ accent, onFlash, onClose }: {
  accent: string; onFlash: (m: string, ok?: boolean) => void; onClose: (ref?: string) => void;
}) {
  const [refArt, setRefArt] = useState("");
  const [qteBase, setQteBase] = useState(1);
  const [busy, setBusy] = useState(false);

  const creer = async () => {
    if (!refArt) return onFlash("Sélectionnez un article", false);
    setBusy(true);
    try {
      const r = await fetch("/api/gpao", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vue: "nomenclature", refArt, qteBase }),
      });
      const d = await r.json();
      if (!r.ok) return onFlash(d.error ?? "Échec", false);
      onFlash(d.message ?? "Créée");
      onClose(refArt);
    } finally { setBusy(false); }
  };

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl p-4 space-y-3">
      <div className="grid md:grid-cols-3 gap-3 items-end">
        <div className="md:col-span-2">
          <Champ label="Article fabriqué *">
            <PickerArticle value={refArt} onChange={setRefArt} accent={accent} />
          </Champ>
        </div>
        <Champ label="Quantité de base">
          <input type="number" step="0.001" min={0.001} value={qteBase}
            onChange={(e) => setQteBase(Number(e.target.value))} className={inputCls} />
        </Champ>
      </div>
      <p className="text-xs text-[var(--text-secondary)]">
        La quantité de base est le nombre d&apos;unités que produisent les composants saisis.
        Une nomenclature de base 10 dont une ligne vaut 5 kg consomme 0,5 kg par unité.
      </p>
      <div className="flex gap-2">
        <button onClick={creer} disabled={busy}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 disabled:opacity-50"
          style={{ background: accent }}>
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Créer
        </button>
        <button onClick={() => onClose()}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--border-primary)] text-[var(--text-secondary)]">
          Annuler
        </button>
      </div>
    </div>
  );
}

function NomenclatureDetail({ refArt, accent, onFlash, onClose }: {
  refArt: string; accent: string; onFlash: (m: string, ok?: boolean) => void; onClose: () => void;
}) {
  const [nom, setNom] = useState<Nomenclature | null>(null);
  const [load, setLoad] = useState(true);
  const [ajout, setAjout] = useState<{ refArt: string; qte: number }>({ refArt: "", qte: 1 });
  const [busy, setBusy] = useState(false);
  const [eclat, setEclat] = useState<Composant[] | null>(null);

  const charger = useCallback(() => {
    fetch(`/api/gpao?vue=nomenclature&refArt=${encodeURIComponent(refArt)}`)
      .then((r) => r.json())
      .then((d) => setNom(d.row ?? null))
      .finally(() => setLoad(false));
  }, [refArt]);

  useEffect(charger, [charger]);

  const ajouter = async () => {
    if (!ajout.refArt) return onFlash("Sélectionnez un composant", false);
    if (ajout.qte <= 0) return onFlash("Quantité invalide", false);
    setBusy(true);
    try {
      const r = await fetch("/api/gpao", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vue: "nomenclature-ligne", refNom: refArt, refArt: ajout.refArt, qte: ajout.qte }),
      });
      const d = await r.json();
      if (!r.ok) return onFlash(d.error ?? "Échec", false);
      onFlash(d.message ?? "Ajouté");
      setAjout({ refArt: "", qte: 1 });
      charger();
    } finally { setBusy(false); }
  };

  const retirer = async (id: number) => {
    const r = await fetch(`/api/gpao?vue=nomenclature-ligne&id=${id}`, { method: "DELETE" });
    const d = await r.json();
    if (!r.ok) return onFlash(d.error ?? "Échec", false);
    charger();
  };

  const basculer = async () => {
    if (!nom) return;
    const r = await fetch("/api/gpao", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vue: "nomenclature", refArt, exploitation: !nom.exploitation, elaboration: nom.exploitation }),
    });
    const d = await r.json();
    if (!r.ok) return onFlash(d.error ?? "Échec", false);
    onFlash(nom.exploitation ? "Repassée en élaboration" : "Passée en exploitation");
    charger();
  };

  const voirEclatement = async () => {
    const r = await fetch(`/api/gpao?vue=eclatement&refArt=${encodeURIComponent(refArt)}&quantite=1`);
    const d = await r.json();
    setEclat(d.composants ?? []);
    if (d.alertes?.length) onFlash(d.alertes.join("\n"), false);
  };

  if (load) return <Chargement />;
  if (!nom) return <div className="text-sm text-[var(--text-secondary)]">Nomenclature introuvable.</div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <button onClick={onClose} className="text-xs text-[var(--text-secondary)] mb-1 flex items-center gap-1">
            <X size={12} /> Retour à la liste
          </button>
          <div className="font-bold text-sm text-[var(--text-primary)]">
            {nom.refArt} — {nom.desArt ?? ""}
          </div>
          <div className="text-xs text-[var(--text-secondary)]">
            Quantité de base : {fmtQ(nom.qteBase)} · {nom.lignes.length} composant(s)
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={voirEclatement}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--border-primary)] flex items-center gap-1.5">
            <Layers size={13} /> Éclatement multi-niveaux
          </button>
          <button onClick={basculer}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
            style={{ background: nom.exploitation ? "#64748b" : accent }}>
            {nom.exploitation ? "Repasser en élaboration" : "Passer en exploitation"}
          </button>
        </div>
      </div>

      {!nom.exploitation && (
        <div className="px-3 py-2 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs flex items-start gap-2">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          En élaboration : cette nomenclature n&apos;est pas utilisée par le calcul des besoins nets.
        </div>
      )}

      <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl p-3 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-56">
          <Champ label="Composant"><PickerArticle value={ajout.refArt}
            onChange={(v) => setAjout({ ...ajout, refArt: v })} accent={accent} /></Champ>
        </div>
        <Champ label="Quantité">
          <input type="number" step="0.001" value={ajout.qte}
            onChange={(e) => setAjout({ ...ajout, qte: Number(e.target.value) })} className={`${inputCls} w-28`} />
        </Champ>
        <button onClick={ajouter} disabled={busy}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 disabled:opacity-50"
          style={{ background: accent }}>
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Ajouter
        </button>
      </div>

      <Tableau load={false} vide="Aucun composant. Ajoutez les matières et sous-ensembles nécessaires."
        entetes={["Séq.", "Composant", "Désignation", "Type", "Qté", "Qté / unité", ""]}>
        {nom.lignes.map((l) => (
          <tr key={l.id} className="border-b border-[var(--border-primary)]/60">
            <td className="px-3 py-2 text-xs">{l.numSequence || "—"}</td>
            <td className="px-3 py-2 font-mono text-xs">{l.refArt}</td>
            <td className="px-3 py-2">{l.desArt ?? "—"}</td>
            <td className="px-3 py-2 text-xs">{l.typeComposant}</td>
            <td className="px-3 py-2 text-right">{fmtQ(l.qte)}</td>
            <td className="px-3 py-2 text-right text-xs text-[var(--text-secondary)]">
              {fmtQ(l.qte / (nom.qteBase || 1))}
            </td>
            <td className="px-3 py-2 text-right">
              <button onClick={() => retirer(l.id)} className="text-red-500 p-1"><Trash2 size={13} /></button>
            </td>
          </tr>
        ))}
      </Tableau>

      {eclat && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-[var(--text-primary)]">
              Éclatement pour 1 unité — {eclat.length} composant(s), tous niveaux
            </div>
            <button onClick={() => setEclat(null)} className="text-xs text-[var(--text-secondary)]">Masquer</button>
          </div>
          <Tableau load={false} vide="Aucun composant." entetes={["Niveau", "Composant", "Désignation", "Père", "Qté / unité", "Nature"]}>
            {eclat.map((c, i) => (
              <tr key={`${c.parent}-${c.refArt}-${i}`} className="border-b border-[var(--border-primary)]/60">
                <td className="px-3 py-2 text-xs" style={{ paddingLeft: 12 + (c.niveau - 1) * 14 }}>
                  {"·".repeat(c.niveau)} {c.niveau}
                </td>
                <td className="px-3 py-2 font-mono text-xs">{c.refArt}</td>
                <td className="px-3 py-2">{c.desArt ?? "—"}</td>
                <td className="px-3 py-2 font-mono text-xs text-[var(--text-secondary)]">{c.parent}</td>
                <td className="px-3 py-2 text-right">{fmtQ(c.qteUnitaire)}</td>
                <td className="px-3 py-2 text-xs">{c.fabrique ? "Fabriqué" : "Acheté"}</td>
              </tr>
            ))}
          </Tableau>
        </div>
      )}
    </div>
  );
}

/* --------------------------------- Gammes ---------------------------------- */

function Gammes({ accent, onFlash }: { accent: string; onFlash: (m: string, ok?: boolean) => void }) {
  const [rows, setRows] = useState<GammeRow[]>([]);
  const [load, setLoad] = useState(true);
  const [sel, setSel] = useState<number | null>(null);
  const [form, setForm] = useState<{ gamme: string; desGamme: string; refArt: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const charger = useCallback(() => {
    fetch("/api/gpao?vue=gammes")
      .then((r) => r.json())
      .then((d) => setRows(d.rows ?? []))
      .finally(() => setLoad(false));
  }, []);

  useEffect(charger, [charger]);

  const creer = async () => {
    if (!form?.gamme.trim()) return onFlash("Code gamme requis", false);
    setBusy(true);
    try {
      const r = await fetch("/api/gpao", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vue: "gamme", ...form }),
      });
      const d = await r.json();
      if (!r.ok) return onFlash(d.error ?? "Échec", false);
      onFlash(d.message ?? "Créée");
      setForm(null);
      charger();
      if (d.row?.id) setSel(d.row.id);
    } finally { setBusy(false); }
  };

  const supprimer = async (g: GammeRow) => {
    if (!(await confirmer(`Supprimer la gamme ${g.gamme} et ses opérations ?`, { danger: true }))) return;
    const r = await fetch(`/api/gpao?vue=gamme&id=${g.id}`, { method: "DELETE" });
    const d = await r.json();
    if (!r.ok) return onFlash(d.error ?? "Échec", false);
    onFlash(d.message ?? "Supprimée");
    charger();
  };

  if (sel != null) {
    return <GammeDetail id={sel} accent={accent} onFlash={onFlash}
      onClose={() => { setSel(null); charger(); }} />;
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div className="text-xs text-[var(--text-secondary)]">{rows.length} gamme(s) de fabrication</div>
        <button onClick={() => setForm({ gamme: "", desGamme: "", refArt: "" })}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5"
          style={{ background: accent }}>
          <Plus size={13} /> Nouvelle gamme
        </button>
      </div>

      {form && (
        <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl p-4 space-y-3">
          <div className="grid md:grid-cols-3 gap-3">
            <Champ label="Code gamme *"><input value={form.gamme}
              onChange={(e) => setForm({ ...form, gamme: e.target.value })} className={inputCls} /></Champ>
            <Champ label="Désignation"><input value={form.desGamme}
              onChange={(e) => setForm({ ...form, desGamme: e.target.value })} className={inputCls} /></Champ>
            <Champ label="Article fabriqué">
              <PickerArticle value={form.refArt} onChange={(v) => setForm({ ...form, refArt: v })} accent={accent} />
            </Champ>
          </div>
          <div className="flex gap-2">
            <button onClick={creer} disabled={busy}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 disabled:opacity-50"
              style={{ background: accent }}>
              {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Créer
            </button>
            <button onClick={() => setForm(null)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--border-primary)] text-[var(--text-secondary)]">
              Annuler
            </button>
          </div>
        </div>
      )}

      <Tableau load={load}
        vide="Aucune gamme. Une gamme décrit les opérations et leurs temps — c'est ce que la planification ordonnance."
        entetes={["Gamme", "Désignation", "Article", "Opérations", "État", ""]}>
        {rows.map((g) => (
          <tr key={g.id} className="border-b border-[var(--border-primary)]/60 hover:bg-[var(--accent-light)] cursor-pointer"
            onClick={() => setSel(g.id)}>
            <td className="px-3 py-2 font-mono text-xs">{g.gamme}</td>
            <td className="px-3 py-2">{g.desGamme ?? "—"}</td>
            <td className="px-3 py-2 font-mono text-xs">{g.refArt ?? "—"}</td>
            <td className="px-3 py-2 text-right">{g.nbOperations}</td>
            <td className="px-3 py-2"><Badge ok={g.exploitation}>{g.exploitation ? "Exploitation" : "Élaboration"}</Badge></td>
            <td className="px-3 py-2 text-right">
              <button onClick={(e) => { e.stopPropagation(); supprimer(g); }} className="text-red-500 p-1">
                <Trash2 size={13} />
              </button>
            </td>
          </tr>
        ))}
      </Tableau>
    </div>
  );
}

const OP_VIDE = {
  desOperation: "", posteChargeId: "", tempsReg: 0, tempsPreparation: 0,
  tempsOperatoire: 0, qteBase: 1, coeffCharge: 1, efficience: 100,
};

function GammeDetail({ id, accent, onFlash, onClose }: {
  id: number; accent: string; onFlash: (m: string, ok?: boolean) => void; onClose: () => void;
}) {
  const [row, setRow] = useState<(GammeRow & { operations: OpGamme[] }) | null>(null);
  const [total, setTotal] = useState(0);
  const [postes, setPostes] = useState<Poste[]>([]);
  const [load, setLoad] = useState(true);
  const [form, setForm] = useState<typeof OP_VIDE | null>(null);
  const [busy, setBusy] = useState(false);

  const charger = useCallback(() => {
    Promise.all([
      fetch(`/api/gpao?vue=gamme&id=${id}`).then((r) => r.json()),
      fetch("/api/gpao?vue=postes").then((r) => r.json()),
    ])
      .then(([g, p]) => {
        setRow(g.row ?? null);
        setTotal(g.tempsTotalMinutes ?? 0);
        setPostes(p.rows ?? []);
      })
      .finally(() => setLoad(false));
  }, [id]);

  useEffect(charger, [charger]);

  const ajouter = async () => {
    if (!form?.desOperation.trim()) return onFlash("Désignation de l'opération requise", false);
    setBusy(true);
    try {
      const r = await fetch("/api/gpao", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vue: "operation-gamme", gammeId: id, ...form,
          posteChargeId: form.posteChargeId ? Number(form.posteChargeId) : null,
        }),
      });
      const d = await r.json();
      if (!r.ok) return onFlash(d.error ?? "Échec", false);
      onFlash(d.message ?? "Ajoutée");
      setForm(null);
      charger();
    } finally { setBusy(false); }
  };

  const retirer = async (opId: number) => {
    const r = await fetch(`/api/gpao?vue=operation-gamme&id=${opId}`, { method: "DELETE" });
    if (!r.ok) return onFlash("Échec de la suppression", false);
    charger();
  };

  const basculer = async () => {
    if (!row) return;
    const r = await fetch("/api/gpao", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vue: "gamme", id, exploitation: !row.exploitation, elaboration: row.exploitation }),
    });
    const d = await r.json();
    if (!r.ok) return onFlash(d.error ?? "Échec", false);
    onFlash(row.exploitation ? "Repassée en élaboration" : "Passée en exploitation");
    charger();
  };

  if (load) return <Chargement />;
  if (!row) return <div className="text-sm text-[var(--text-secondary)]">Gamme introuvable.</div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <button onClick={onClose} className="text-xs text-[var(--text-secondary)] mb-1 flex items-center gap-1">
            <X size={12} /> Retour aux gammes
          </button>
          <div className="font-bold text-sm text-[var(--text-primary)]">
            {row.gamme} — {row.desGamme ?? ""}
          </div>
          <div className="text-xs text-[var(--text-secondary)]">
            Article {row.refArt ?? "non défini"} · {row.operations.length} opération(s) · temps total {duree(total)}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setForm({ ...OP_VIDE })}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--border-primary)] flex items-center gap-1.5">
            <Plus size={13} /> Opération
          </button>
          <button onClick={basculer} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
            style={{ background: row.exploitation ? "#64748b" : accent }}>
            {row.exploitation ? "Repasser en élaboration" : "Passer en exploitation"}
          </button>
        </div>
      </div>

      {!row.exploitation && (
        <div className="px-3 py-2 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs flex items-start gap-2">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          En élaboration : la génération des opérations d&apos;un OF n&apos;utilise que les gammes en exploitation.
        </div>
      )}

      {form && (
        <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Champ label="Opération *"><input value={form.desOperation}
              onChange={(e) => setForm({ ...form, desOperation: e.target.value })} className={inputCls} /></Champ>
            <Champ label="Poste de charge">
              <select value={form.posteChargeId}
                onChange={(e) => setForm({ ...form, posteChargeId: e.target.value })} className={inputCls}>
                <option value="">—</option>
                {postes.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.libelle}</option>)}
              </select>
            </Champ>
            <Champ label="Temps réglage (min)"><input type="number" step="0.01" value={form.tempsReg}
              onChange={(e) => setForm({ ...form, tempsReg: Number(e.target.value) })} className={inputCls} /></Champ>
            <Champ label="Temps préparation (min)"><input type="number" step="0.01" value={form.tempsPreparation}
              onChange={(e) => setForm({ ...form, tempsPreparation: Number(e.target.value) })} className={inputCls} /></Champ>
            <Champ label="Temps opératoire (min)"><input type="number" step="0.01" value={form.tempsOperatoire}
              onChange={(e) => setForm({ ...form, tempsOperatoire: Number(e.target.value) })} className={inputCls} /></Champ>
            <Champ label="Pour N unités"><input type="number" step="0.001" min={0.001} value={form.qteBase}
              onChange={(e) => setForm({ ...form, qteBase: Number(e.target.value) })} className={inputCls} /></Champ>
            <Champ label="Coeff. charge"><input type="number" step="0.01" value={form.coeffCharge}
              onChange={(e) => setForm({ ...form, coeffCharge: Number(e.target.value) })} className={inputCls} /></Champ>
            <Champ label="Efficience %"><input type="number" step="1" min={1} max={200} value={form.efficience}
              onChange={(e) => setForm({ ...form, efficience: Number(e.target.value) })} className={inputCls} /></Champ>
          </div>
          <p className="text-xs text-[var(--text-secondary)]">
            Réglage et préparation ne dépendent pas de la quantité. Le temps opératoire est
            proportionnel : saisi pour « N unités », il est mis à l&apos;échelle de la quantité de l&apos;OF,
            puis divisé par l&apos;efficience réelle du poste.
          </p>
          <div className="flex gap-2">
            <button onClick={ajouter} disabled={busy}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 disabled:opacity-50"
              style={{ background: accent }}>
              {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Ajouter
            </button>
            <button onClick={() => setForm(null)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--border-primary)] text-[var(--text-secondary)]">
              Annuler
            </button>
          </div>
        </div>
      )}

      <Tableau load={false} vide="Aucune opération. Ajoutez les étapes de fabrication dans l'ordre."
        entetes={["Séq.", "Opération", "Poste", "Réglage", "Prépa.", "Opératoire", "Pour N", "Effic.", ""]}>
        {row.operations.map((o) => (
          <tr key={o.id} className="border-b border-[var(--border-primary)]/60">
            <td className="px-3 py-2 text-xs">{o.numSequence}</td>
            <td className="px-3 py-2">{o.desOperation}</td>
            <td className="px-3 py-2 text-xs">{o.posteCharge ? `${o.posteCharge.code} — ${o.posteCharge.libelle}` : "—"}</td>
            <td className="px-3 py-2 text-right text-xs">{duree(o.tempsReg)}</td>
            <td className="px-3 py-2 text-right text-xs">{duree(o.tempsPreparation)}</td>
            <td className="px-3 py-2 text-right text-xs">{duree(o.tempsOperatoire)}</td>
            <td className="px-3 py-2 text-right text-xs">{fmtQ(o.qteBase)}</td>
            <td className="px-3 py-2 text-right text-xs">{fmtQ(o.efficience)} %</td>
            <td className="px-3 py-2 text-right">
              <button onClick={() => retirer(o.id)} className="text-red-500 p-1"><Trash2 size={13} /></button>
            </td>
          </tr>
        ))}
      </Tableau>
    </div>
  );
}

/* ------------------------------------ CBN ---------------------------------- */

function Cbn({ accent, onFlash }: { accent: string; onFlash: (m: string, ok?: boolean) => void }) {
  const [source, setSource] = useState<"article" | "of">("article");
  const [refArt, setRefArt] = useState("");
  const [quantite, setQuantite] = useState(1);
  const [ofs, setOfs] = useState<OfRow[]>([]);
  const [selOfs, setSelOfs] = useState<string[]>([]);
  const [deduire, setDeduire] = useState(true);
  const [res, setRes] = useState<{ lignes: LigneCbn[]; totaux: { besoinBrut: number; besoinNet: number; valeurNet: number }; alertes: string[] } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (source !== "of") return;
    fetch("/api/gpao?vue=ofs").then((r) => r.json()).then((d) => setOfs(d.rows ?? [])).catch(() => {});
  }, [source]);

  const calculer = async () => {
    setBusy(true);
    setRes(null);
    try {
      const body = source === "article"
        ? { vue: "cbn", demandes: [{ refArt, quantite }], deduireStock: deduire }
        : { vue: "cbn", refDocs: selOfs, deduireStock: deduire };
      if (source === "article" && !refArt) return onFlash("Sélectionnez un article", false);
      if (source === "of" && selOfs.length === 0) return onFlash("Sélectionnez au moins un OF", false);

      const r = await fetch("/api/gpao", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) return onFlash(d.error ?? "Échec du calcul", false);
      setRes(d);
      if (d.lignes?.length === 0) {
        onFlash("Aucun besoin : l'article n'a pas de nomenclature en exploitation.", false);
      }
    } finally { setBusy(false); }
  };

  const exporter = () => {
    if (!res) return;
    csv("besoins-nets",
      ["Composant", "Désignation", "Type", "Unité", "Besoin brut", "Stock", "Besoin net", "PU", "Valeur nette"],
      res.lignes.map((l) => [l.refArt, l.desArt ?? "", l.typeComposant, l.unite ?? "",
        l.besoinBrut, l.stock, l.besoinNet, l.puAchat, l.valeurNet]));
  };

  const aApprovisionner = useMemo(() => res?.lignes.filter((l) => l.besoinNet > 0) ?? [], [res]);

  return (
    <div className="space-y-4">
      <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl p-4 space-y-3">
        <div className="flex gap-1.5">
          {([["article", "Depuis un article"], ["of", "Depuis des ordres de fabrication"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => { setSource(k); setRes(null); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                source === k ? "text-white border-transparent" : "bg-[var(--bg-primary)] text-[var(--text-secondary)] border-[var(--border-primary)]"
              }`}
              style={source === k ? { background: accent } : undefined}>
              {l}
            </button>
          ))}
        </div>

        {source === "article" ? (
          <div className="grid md:grid-cols-3 gap-3 items-end">
            <div className="md:col-span-2">
              <Champ label="Article à fabriquer">
                <PickerArticle value={refArt} onChange={setRefArt} accent={accent} />
              </Champ>
            </div>
            <Champ label="Quantité">
              <input type="number" step="0.001" min={0.001} value={quantite}
                onChange={(e) => setQuantite(Number(e.target.value))} className={inputCls} />
            </Champ>
          </div>
        ) : (
          <div className="max-h-56 overflow-auto border border-[var(--border-primary)] rounded-lg">
            {ofs.length === 0 ? (
              <div className="p-3 text-xs text-[var(--text-secondary)]">
                Aucun ordre de fabrication (document de type OF) en base.
              </div>
            ) : ofs.map((o) => (
              <label key={o.refDoc}
                className="flex items-center gap-2 px-3 py-1.5 text-xs border-b border-[var(--border-primary)]/50 cursor-pointer hover:bg-[var(--accent-light)]">
                <input type="checkbox" checked={selOfs.includes(o.refDoc)}
                  onChange={(e) => setSelOfs(e.target.checked
                    ? [...selOfs, o.refDoc]
                    : selOfs.filter((x) => x !== o.refDoc))} />
                <span className="font-mono">{o.refDoc}</span>
                <span className="text-[var(--text-secondary)]">{fmtDate(o.dateDoc)}</span>
                <span className="ml-auto text-[var(--text-secondary)]">{o.nbLignes} ligne(s)</span>
              </label>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between flex-wrap gap-2">
          <label className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] cursor-pointer">
            <input type="checkbox" checked={deduire} onChange={(e) => setDeduire(e.target.checked)} />
            Déduire le stock disponible (sinon besoin brut seul)
          </label>
          <button onClick={calculer} disabled={busy}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 disabled:opacity-50"
            style={{ background: accent }}>
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Calculator size={13} />} Calculer les besoins
          </button>
        </div>
      </div>

      {res && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi label="Composants" val={String(res.lignes.length)} accent={accent} />
            <Kpi label="Besoin brut" val={fmtQ(res.totaux.besoinBrut)} accent={accent} />
            <Kpi label="Besoin net" val={fmtQ(res.totaux.besoinNet)} accent="#dc2626" />
            <Kpi label="Valeur à approvisionner" val={`${fmt(res.totaux.valeurNet)} TND`} accent="#dc2626" />
          </div>

          {res.alertes.length > 0 && (
            <div className="px-3 py-2 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs space-y-1">
              {res.alertes.map((a, i) => (
                <div key={i} className="flex items-start gap-2">
                  <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {a}
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="text-xs text-[var(--text-secondary)]">
              {aApprovisionner.length} composant(s) à approvisionner sur {res.lignes.length}
            </div>
            <button onClick={exporter}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--border-primary)] flex items-center gap-1.5">
              <Download size={13} /> Export CSV
            </button>
          </div>

          <Tableau load={false} vide="Aucun besoin calculé."
            entetes={["Composant", "Désignation", "Type", "Unité", "Besoin brut", "Stock", "Besoin net", "PU", "Valeur"]}>
            {res.lignes.map((l) => (
              <tr key={l.refArt}
                className={`border-b border-[var(--border-primary)]/60 ${l.besoinNet > 0 ? "bg-red-500/5" : ""}`}>
                <td className="px-3 py-2 font-mono text-xs">
                  {l.refArt}
                  {l.horsReferentiel && <span className="ml-1 text-amber-600" title="Absent du référentiel articles">⚠</span>}
                </td>
                <td className="px-3 py-2">{l.desArt ?? "—"}</td>
                <td className="px-3 py-2 text-xs">{l.fabrique ? "Fabriqué" : l.typeComposant}</td>
                <td className="px-3 py-2 text-xs">{l.unite ?? "—"}</td>
                <td className="px-3 py-2 text-right">{fmtQ(l.besoinBrut)}</td>
                <td className="px-3 py-2 text-right text-[var(--text-secondary)]">{fmtQ(l.stock)}</td>
                <td className="px-3 py-2 text-right font-semibold" style={{ color: l.besoinNet > 0 ? "#dc2626" : undefined }}>
                  {fmtQ(l.besoinNet)}
                </td>
                <td className="px-3 py-2 text-right text-xs">{fmt(l.puAchat)}</td>
                <td className="px-3 py-2 text-right">{fmt(l.valeurNet)}</td>
              </tr>
            ))}
          </Tableau>
        </>
      )}
    </div>
  );
}

/* ------------------------------- Planification ----------------------------- */

function Planification({ accent, onFlash }: { accent: string; onFlash: (m: string, ok?: boolean) => void }) {
  const [onglet, setOnglet] = useState<"ofs" | "creneaux" | "charge">("ofs");
  const [reload, setReload] = useState(0);

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 flex-wrap">
        {([["ofs", "Ordres de fabrication"], ["creneaux", "Créneaux planifiés"], ["charge", "Charge par poste"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setOnglet(k)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
              onglet === k ? "text-white border-transparent shadow-sm"
                : "bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border-primary)]"
            }`}
            style={onglet === k ? { background: accent } : undefined}>
            {l}
          </button>
        ))}
      </div>

      {onglet === "ofs" && <PlanifOfs accent={accent} onFlash={onFlash} onDone={() => setReload((k) => k + 1)} />}
      {onglet === "creneaux" && <Creneaux accent={accent} onFlash={onFlash} reload={reload} />}
      {onglet === "charge" && <ChargePostes accent={accent} reload={reload} />}
    </div>
  );
}

function PlanifOfs({ accent, onFlash, onDone }: {
  accent: string; onFlash: (m: string, ok?: boolean) => void; onDone: () => void;
}) {
  const [rows, setRows] = useState<OfRow[]>([]);
  const [load, setLoad] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [dateDebut, setDateDebut] = useState(`${iso(new Date())}T08:00`);
  const [dateLimite, setDateLimite] = useState("");
  const [lignes, setLignes] = useState<Record<string, { refArt: string; designation: string; qte: number }[]>>({});

  const charger = useCallback(() => {
    fetch("/api/gpao?vue=ofs")
      .then((r) => r.json())
      .then((d) => setRows(d.rows ?? []))
      .finally(() => setLoad(false));
  }, []);

  useEffect(charger, [charger]);

  const ouvrir = async (refDoc: string) => {
    if (ouvert === refDoc) return setOuvert(null);
    setOuvert(refDoc);
    if (lignes[refDoc]) return;
    const r = await fetch(`/api/erp/document-lines?refDoc=${encodeURIComponent(refDoc)}`);
    const d = await r.json().catch(() => ({}));
    setLignes((prev) => ({ ...prev, [refDoc]: d.rows ?? d.lignes ?? [] }));
  };

  const generer = async (refDoc: string, refArt: string, qte: number) => {
    setBusy(refDoc);
    try {
      const r = await fetch("/api/gpao", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vue: "generer-operations", refDoc, refArt, quantite: qte }),
      });
      const d = await r.json();
      onFlash(d.message ?? d.error ?? "Terminé", r.ok);
      if (r.ok) charger();
    } finally { setBusy(null); }
  };

  const planifier = async (refDoc: string) => {
    setBusy(refDoc);
    try {
      const r = await fetch("/api/gpao", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vue: "planifier", refDoc,
          dateDebut: new Date(dateDebut).toISOString(),
          dateLimite: dateLimite ? new Date(dateLimite).toISOString() : null,
        }),
      });
      const d = await r.json();
      const msg = [d.message ?? d.error, ...(d.alertes ?? [])].filter(Boolean).join("\n");
      onFlash(msg || "Terminé", r.ok && !d.conflits && !d.horsDelai);
      if (r.ok) { charger(); onDone(); }
    } finally { setBusy(null); }
  };

  const deplanifier = async (refDoc: string) => {
    const r = await fetch(`/api/gpao?vue=plans&refDoc=${encodeURIComponent(refDoc)}`, { method: "DELETE" });
    const d = await r.json();
    onFlash(d.message ?? d.error ?? "Terminé", r.ok);
    if (r.ok) { charger(); onDone(); }
  };

  return (
    <div className="space-y-3">
      <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl p-3 flex flex-wrap gap-3 items-end">
        <Champ label="Début de fabrication">
          <input type="datetime-local" value={dateDebut}
            onChange={(e) => setDateDebut(e.target.value)} className={inputCls} />
        </Champ>
        <Champ label="Date limite (optionnelle)">
          <input type="datetime-local" value={dateLimite}
            onChange={(e) => setDateLimite(e.target.value)} className={inputCls} />
        </Champ>
        <div className="text-xs text-[var(--text-secondary)] flex-1 min-w-48">
          Les créneaux sont posés sur les plages ouvrables du poste de charge,
          week-ends et pauses exclus.
        </div>
      </div>

      <Tableau load={load}
        vide="Aucun ordre de fabrication. Créez un document de type OF depuis le module GPAO."
        entetes={["", "Référence", "Date", "Lignes", "Opérations", "Créneaux", "Actions"]}>
        {rows.map((o) => (
          // La clé va sur le fragment : c'est lui l'élément répété, pas les
          // lignes qu'il contient.
          <Fragment key={o.refDoc}>
            <tr className="border-b border-[var(--border-primary)]/60">
              <td className="px-2 py-2">
                <button onClick={() => ouvrir(o.refDoc)} className="text-[var(--text-secondary)]">
                  {ouvert === o.refDoc ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
              </td>
              <td className="px-3 py-2 font-mono text-xs">{o.refDoc}</td>
              <td className="px-3 py-2 text-xs">{fmtDate(o.dateDoc)}</td>
              <td className="px-3 py-2 text-right text-xs">{o.nbLignes}</td>
              <td className="px-3 py-2 text-right text-xs">{o.nbOperations}</td>
              <td className="px-3 py-2 text-right text-xs">{o.nbCreneaux}</td>
              <td className="px-3 py-2 text-right whitespace-nowrap">
                <button onClick={() => planifier(o.refDoc)} disabled={busy === o.refDoc || o.nbOperations === 0}
                  title={o.nbOperations === 0 ? "Générez d'abord les opérations depuis la gamme" : "Planifier"}
                  className="text-xs px-2 py-1 rounded text-white mr-1 disabled:opacity-40"
                  style={{ background: accent }}>
                  {busy === o.refDoc ? "…" : "Planifier"}
                </button>
                {o.nbCreneaux > 0 && (
                  <button onClick={() => deplanifier(o.refDoc)}
                    className="text-xs px-2 py-1 rounded border border-[var(--border-primary)]">
                    Dé-planifier
                  </button>
                )}
              </td>
            </tr>
            {ouvert === o.refDoc && (
              <tr key={`${o.refDoc}-d`} className="bg-[var(--bg-primary)]/40">
                <td colSpan={7} className="px-6 py-2">
                  {(lignes[o.refDoc] ?? []).length === 0 ? (
                    <div className="text-xs text-[var(--text-secondary)]">
                      Aucune ligne : cet OF ne dit pas quoi fabriquer.
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {(lignes[o.refDoc] ?? []).map((l, i) => (
                        <div key={i} className="flex items-center gap-3 text-xs">
                          <span className="font-mono">{l.refArt}</span>
                          <span className="text-[var(--text-secondary)]">{l.designation}</span>
                          <span>× {fmtQ(l.qte)}</span>
                          <button onClick={() => generer(o.refDoc, l.refArt, l.qte)}
                            className="ml-auto px-2 py-1 rounded border border-[var(--border-primary)] flex items-center gap-1">
                            <Wrench size={11} /> Générer les opérations depuis la gamme
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </td>
              </tr>
            )}
          </Fragment>
        ))}
      </Tableau>
    </div>
  );
}

function Creneaux({ accent, onFlash, reload }: {
  accent: string; onFlash: (m: string, ok?: boolean) => void; reload: number;
}) {
  const [rows, setRows] = useState<Plan[]>([]);
  const [load, setLoad] = useState(true);
  const [du, setDu] = useState(iso(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [au, setAu] = useState(iso(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)));
  const [stats, setStats] = useState({ conflits: 0, heures: 0 });

  useEffect(() => {
    fetch(`/api/gpao?vue=plans&du=${du}&au=${au}T23:59:59`)
      .then((r) => r.json())
      .then((d) => {
        setRows(d.rows ?? []);
        setStats({ conflits: d.conflits ?? 0, heures: d.heuresTotales ?? 0 });
      })
      .catch(() => onFlash("Chargement impossible", false))
      .finally(() => setLoad(false));
  }, [du, au, reload, onFlash]);

  const exporter = () =>
    csv("planification", ["OF", "Opération", "Type", "Début", "Fin", "Durée (min)", "Poste", "Disponible"],
      rows.map((p) => [p.refDoc, p.desOperation ?? "", p.typeDuree, p.dateDebut, p.dateFin,
        p.duree, p.posteCharge?.libelle ?? p.posteMo ?? "", p.disponibilite ? "Oui" : "Non"]));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3 items-end justify-between">
        <div className="flex gap-3 items-end">
          <Champ label="Du"><input type="date" value={du} onChange={(e) => setDu(e.target.value)} className={inputCls} /></Champ>
          <Champ label="Au"><input type="date" value={au} onChange={(e) => setAu(e.target.value)} className={inputCls} /></Champ>
        </div>
        <button onClick={exporter} disabled={rows.length === 0}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--border-primary)] flex items-center gap-1.5 disabled:opacity-40">
          <Download size={13} /> Export CSV
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Kpi label="Créneaux" val={String(rows.length)} accent={accent} />
        <Kpi label="Heures planifiées" val={fmtQ(stats.heures)} accent={accent} />
        <Kpi label="Conflits de ressource" val={String(stats.conflits)} accent={stats.conflits > 0 ? "#dc2626" : "#16a34a"} />
      </div>

      <Tableau load={load} vide="Aucun créneau sur la période. Planifiez un ordre de fabrication."
        entetes={["OF", "Opération", "Phase", "Début", "Fin", "Durée", "Ressource", "État"]}>
        {rows.map((p) => (
          <tr key={p.id} className={`border-b border-[var(--border-primary)]/60 ${!p.disponibilite ? "bg-red-500/5" : ""}`}>
            <td className="px-3 py-2 font-mono text-xs">{p.refDoc}</td>
            <td className="px-3 py-2">{p.desOperation ?? "—"}</td>
            <td className="px-3 py-2 text-xs">{p.typeDuree}</td>
            <td className="px-3 py-2 text-xs">{fmtDT(p.dateDebut)}</td>
            <td className="px-3 py-2 text-xs">{fmtDT(p.dateFin)}</td>
            <td className="px-3 py-2 text-right text-xs">{duree(p.duree)}</td>
            <td className="px-3 py-2 text-xs">{p.posteCharge?.libelle ?? p.posteMo ?? "—"}</td>
            <td className="px-3 py-2">
              {p.disponibilite
                ? <Badge ok>Planifié</Badge>
                : <span className="px-1.5 py-0.5 rounded text-xs font-semibold bg-red-500/15 text-red-600">Conflit</span>}
            </td>
          </tr>
        ))}
      </Tableau>
    </div>
  );
}

function ChargePostes({ accent, reload }: { accent: string; reload: number }) {
  const [rows, setRows] = useState<Charge[]>([]);
  const [load, setLoad] = useState(true);
  const [du, setDu] = useState(iso(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [au, setAu] = useState(iso(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)));

  useEffect(() => {
    fetch(`/api/gpao?vue=charge&du=${du}&au=${au}T23:59:59`)
      .then((r) => r.json())
      .then((d) => setRows(d.rows ?? []))
      .finally(() => setLoad(false));
  }, [du, au, reload]);

  return (
    <div className="space-y-3">
      <div className="flex gap-3 items-end">
        <Champ label="Du"><input type="date" value={du} onChange={(e) => setDu(e.target.value)} className={inputCls} /></Champ>
        <Champ label="Au"><input type="date" value={au} onChange={(e) => setAu(e.target.value)} className={inputCls} /></Champ>
      </div>

      <Tableau load={load} vide="Aucune charge sur la période."
        entetes={["Poste", "Heures planifiées", "Capacité", "Taux de charge", "Créneaux", "Conflits"]}>
        {rows.map((c) => (
          <tr key={c.code} className="border-b border-[var(--border-primary)]/60">
            <td className="px-3 py-2">{c.poste}</td>
            <td className="px-3 py-2 text-right">{fmtQ(c.heures)}</td>
            <td className="px-3 py-2 text-right text-[var(--text-secondary)]">{fmtQ(c.capaciteHeures)}</td>
            <td className="px-3 py-2">
              {c.tauxCharge == null ? "—" : (
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-[var(--border-primary)] overflow-hidden min-w-16">
                    <div className="h-full rounded-full" style={{
                      width: `${Math.min(100, c.tauxCharge)}%`,
                      background: c.tauxCharge > 100 ? "#dc2626" : c.tauxCharge > 85 ? "#f59e0b" : accent,
                    }} />
                  </div>
                  <span className="text-xs font-semibold" style={{ color: c.tauxCharge > 100 ? "#dc2626" : undefined }}>
                    {fmtQ(c.tauxCharge)} %
                  </span>
                </div>
              )}
            </td>
            <td className="px-3 py-2 text-right text-xs">{c.creneaux}</td>
            <td className="px-3 py-2 text-right text-xs" style={{ color: c.conflits > 0 ? "#dc2626" : undefined }}>
              {c.conflits}
            </td>
          </tr>
        ))}
      </Tableau>

      {rows.some((r) => (r.tauxCharge ?? 0) > 100) && (
        <div className="px-3 py-2 rounded-lg bg-red-500/10 text-red-600 text-xs flex items-start gap-2">
          <Gauge size={13} className="mt-0.5 shrink-0" />
          Un ou plusieurs postes sont chargés au-delà de leur capacité ouvrable :
          la date de fin annoncée ne sera pas tenue sans renfort ou heures supplémentaires.
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Éléments communs --------------------------- */

const inputCls =
  "w-full px-2.5 py-1.5 rounded-lg text-xs bg-[var(--bg-primary)] border border-[var(--border-primary)] text-[var(--text-primary)]";

function Champ({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-wide text-[var(--text-secondary)] mb-1">{label}</span>
      {children}
    </label>
  );
}

function Badge({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${
      ok ? "bg-emerald-500/15 text-emerald-600" : "bg-amber-500/15 text-amber-600"
    }`}>{children}</span>
  );
}

function Kpi({ label, val, accent }: { label: string; val: string; accent: string }) {
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl p-3">
      <div className="text-[10px] uppercase tracking-wide text-[var(--text-secondary)]">{label}</div>
      <div className="text-lg font-bold mt-0.5" style={{ color: accent }}>{val}</div>
    </div>
  );
}

function Chargement() {
  return (
    <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)] py-8 justify-center">
      <Loader2 size={16} className="animate-spin" /> Chargement…
    </div>
  );
}

function Tableau({ load, vide, entetes, children }: {
  load: boolean; vide: string; entetes: string[]; children: React.ReactNode;
}) {
  const rows = Array.isArray(children) ? children.flat().filter(Boolean) : children;
  const estVide = Array.isArray(rows) ? rows.length === 0 : !rows;

  if (load) return <Chargement />;

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--bg-primary)]/60 border-b border-[var(--border-primary)]">
              {entetes.map((h, i) => (
                <th key={i} className="px-3 py-2 text-left text-[10px] uppercase tracking-wide text-[var(--text-secondary)] font-semibold whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-[var(--text-primary)]">{rows}</tbody>
        </table>
      </div>
      {estVide && <div className="px-4 py-6 text-center text-xs text-[var(--text-secondary)]">{vide}</div>}
    </div>
  );
}

/** Sélecteur d'article avec recherche — le référentiel compte des centaines de lignes. */
function PickerArticle({ value, onChange, accent }: {
  value: string; onChange: (v: string) => void; accent: string;
}) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Article[]>([]);
  const [open, setOpen] = useState(false);
  const [libelle, setLibelle] = useState("");

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      fetch(`/api/gpao?vue=articles${q ? `&q=${encodeURIComponent(q)}` : ""}`)
        .then((r) => r.json())
        .then((d) => setRows(d.rows ?? []))
        .catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [q, open]);

  return (
    <div className="relative">
      <div className="flex gap-1.5">
        <input readOnly value={value ? `${value}${libelle ? ` — ${libelle}` : ""}` : ""}
          placeholder="Aucun article sélectionné" onClick={() => setOpen(true)} className={`${inputCls} cursor-pointer`} />
        {value && (
          <button onClick={() => { onChange(""); setLibelle(""); }}
            className="px-2 rounded-lg border border-[var(--border-primary)] text-[var(--text-secondary)]">
            <X size={12} />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute z-30 mt-1 w-full bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl shadow-lg overflow-hidden">
          <div className="p-2 border-b border-[var(--border-primary)] flex items-center gap-2">
            <Search size={13} className="text-[var(--text-secondary)]" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Référence ou désignation…"
              className="flex-1 bg-transparent text-xs outline-none text-[var(--text-primary)]" />
            <button onClick={() => setOpen(false)} className="text-[var(--text-secondary)]"><X size={13} /></button>
          </div>
          <div className="max-h-56 overflow-auto">
            {rows.length === 0 ? (
              <div className="px-3 py-3 text-xs text-[var(--text-secondary)]">Aucun article.</div>
            ) : rows.map((a) => (
              <button key={a.refArt}
                onClick={() => { onChange(a.refArt); setLibelle(a.designation); setOpen(false); setQ(""); }}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--accent-light)] flex items-center gap-2">
                <span className="font-mono" style={{ color: accent }}>{a.refArt}</span>
                <span className="flex-1 truncate">{a.designation}</span>
                <span className="text-[var(--text-secondary)]">{fmtQ(a.enStock)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
