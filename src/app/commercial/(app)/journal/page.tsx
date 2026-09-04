"use client";
import { useState, useEffect, useCallback } from "react";
import { dateLocaleIso } from "@/lib/date-locale";
import TicketVente from "@/components/commercial/TicketVente";
import { Banknote, TrendingUp, FileText, Clock, Loader2, Flag, AlertTriangle, Check, Printer } from "lucide-react";

// Journal de tournée — sur la base.
// Remplace une timeline entièrement inventée (horaires, montants, solde de
// caisse) par les documents et règlements réellement rattachés à la tournée.

type Doc = {
  refDoc: string; typeDoc: string | null; dateDoc: string | null;
  raisonSocial: string | null; ttcNet: number; totalRegle: number; soldeDoc: number; valide: boolean;
};
type Reg = {
  id: number; datePay: string | null; tiersNom: string | null;
  montant: number; modePay: string | null; etat: string | null;
};
type Frais = {
  id: number; libelle: string | null; montant: number; carburant: boolean;
};
type Recon = {
  mission: { id: number; commercial: string | null; vehicule: string | null; dateOrdre: string | null; etat: string | null; kmDepart: number; kmArrive: number; du?: string | null; au?: string | null };
  ventes: { nb: number; montant: number };
  retours: { nb: number; montant: number };
  chargements?: { nb: number; montant: number };
  caNet: number;
  encaissements: { nb: number; montant: number; parMode: { mode: string; nb: number; montant: number }[] };
  resteAEncaisser: number;
  especes: number;
  kmParcourus: number | null;
  reclamations: number;
  visites: { total: number; visitees: number; tauxRealisation: number };
  alertes: string[];
};

const fmt = (v: unknown) =>
  new Intl.NumberFormat("fr-TN", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(Number(v) || 0);
const fmtDate = (v: unknown) => (v ? new Date(String(v)).toLocaleDateString("fr-FR") : "—");
const fmtHeure = (v: unknown) =>
  v ? new Date(String(v)).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "—";
const iso = (d: Date) => dateLocaleIso(d);
const fmtDateHeure = (v: string) =>
  new Date(v).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export default function JournalPage() {
  // Vide à l'ouverture : le serveur choisit la tournée du jour, ou à défaut
  // la tournée « En cours ». Une date n'est envoyée que si le commercial la
  // choisit — forcer la date UTC du navigateur faisait rater la tournée selon
  // l'heure et le fuseau.
  const [date, setDate] = useState("");
  /** Tournées du commercial, pour la sélection par code mission (OM-2872) :
   *  c'est le repère du terrain, plus sûr que de retrouver la bonne date. */
  const [tournees, setTournees] = useState<
    { id: number; code: string; dateOrdre: string | null; etat: string | null;
      nbVentes: number; nbReglements: number; nbVisites: number }[]
  >([]);
  /** Mission affichée : celle du jour choisi, ou celle sélectionnée par code. */
  const [missionId, setMissionId] = useState<number | null>(null);
  const [recon, setRecon] = useState<Recon | null>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [regs, setRegs] = useState<Reg[]>([]);
  const [frais, setFrais] = useState<Frais[]>([]);
  const [nouveauFrais, setNouveauFrais] = useState<{ libelle: string; montant: number; carburant: boolean } | null>(null);
  const [load, setLoad] = useState(true);
  const [busy, setBusy] = useState(false);
  const [kmArrive, setKmArrive] = useState(0);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  // Ticket ouvert depuis la liste des opérations : même rendu imprimable que
  // celui émis en fin de commande (articles, remises, totaux, rouleau 80 mm).
  const [ticketOuvert, setTicketOuvert] = useState<string | null>(null);

  const flash = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 6000);
  }, []);

  useEffect(() => {
    fetch("/api/missions?vue=mes-tournees")
      .then((r) => r.json())
      .then((d) => setTournees(d.rows ?? []))
      .catch(() => {});
  }, []);

  const charger = useCallback(() => {
    // Une mission choisie par son code prime sur la date : c'est une sélection
    // explicite du commercial.
    const source = missionId
      ? Promise.resolve({ mission: { id: missionId } })
      : fetch(`/api/missions?vue=jour${date ? `&date=${date}` : ""}`).then((r) => r.json());
    source
      .then(async (d) => {
        if (!d.mission) { setRecon(null); setDocs([]); setRegs([]); setFrais([]); return; }
        const det = await fetch(`/api/missions?vue=detail&id=${d.mission.id}`).then((x) => x.json());
        setRecon(det.reconciliation ?? null);
        setDocs(det.documents ?? []);
        setRegs(det.reglements ?? []);
        const f = await fetch(`/api/frais-mission?dayId=${d.mission.id}`).then((x) => x.json());
        setFrais(f.rows ?? []);
      })
      .catch(() => flash("Chargement impossible", false))
      .finally(() => setLoad(false));
  }, [date, missionId, flash]);

  useEffect(charger, [charger]);

  const cloturer = async (forcer = false) => {
    if (!recon) return;
    setBusy(true);
    try {
      const r = await fetch("/api/missions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vue: "cloturer", id: recon.mission.id, kmArrive, forcer }),
      });
      const d = await r.json();
      if (!r.ok) return flash(d.error ?? "Échec", false);
      flash(d.message ?? "Clôturée");
      charger();
    } finally { setBusy(false); }
  };

  const ajouterFrais = async () => {
    if (!recon || !nouveauFrais) return;
    const r = await fetch("/api/frais-mission", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dayId: recon.mission.id, ...nouveauFrais }),
    });
    const d = await r.json();
    if (!r.ok) return flash(d.error ?? "Échec", false);
    flash(d.message ?? "Frais enregistré");
    setNouveauFrais(null);
    charger();
  };

  const supprimerFrais = async (id: number) => {
    const r = await fetch(`/api/frais-mission?id=${id}`, { method: "DELETE" });
    const d = await r.json();
    if (!r.ok) return flash(d.error ?? "Échec", false);
    charger();
  };

  const totalFrais = frais.reduce((t, f) => t + f.montant, 0);
  const totalCarburant = frais.filter((f) => f.carburant).reduce((t, f) => t + f.montant, 0);

  // Nature d'une opération : elle fixe le libellé, la couleur et le signe.
  //   vente        → entre dans le CA (+)
  //   retour       → sort du CA (−)
  //   chargement   → commande / bon de chargement du camion : hors CA, neutre
  //   encaissement → argent réellement collecté (+)
  type Nature = "vente" | "retour" | "chargement" | "autre" | "encaissement";
  const natureDoc = (t?: string | null): Nature => {
    const x = String(t ?? "").toUpperCase();
    if (["TIC", "BL", "FC", "FAC"].includes(x)) return "vente";
    if (["BR", "AV", "BRE"].includes(x)) return "retour";
    if (["COM", "DEV"].includes(x)) return "chargement";
    return "autre";
  };
  const STYLE: Record<Nature, { chip: string; point: string; montant: string; libelle: string; signe: string }> = {
    vente:        { chip: "bg-blue-50 text-blue-700",     point: "bg-blue-500",    montant: "text-blue-700",    libelle: "Vente",       signe: "" },
    retour:       { chip: "bg-red-50 text-red-600",       point: "bg-red-500",     montant: "text-red-600",     libelle: "Retour",      signe: "−" },
    chargement:   { chip: "bg-slate-100 text-slate-600",  point: "bg-slate-400",   montant: "text-slate-500",   libelle: "Chargement",  signe: "" },
    autre:        { chip: "bg-amber-50 text-amber-700",   point: "bg-amber-400",   montant: "text-amber-700",   libelle: "Document",    signe: "" },
    encaissement: { chip: "bg-emerald-50 text-emerald-700", point: "bg-emerald-500", montant: "text-emerald-600", libelle: "Encaissement", signe: "+" },
  };

  // Chronologie unifiée : documents et encaissements dans l'ordre réel.
  const timeline = [
    ...docs.map((d) => {
      const nature = natureDoc(d.typeDoc);
      return {
        key: `d-${d.refDoc}`, refDoc: d.refDoc, heure: fmtHeure(d.dateDoc), nature,
        type: `${STYLE[nature].libelle} · ${d.typeDoc ?? ""}`,
        description: `${d.refDoc} — ${d.raisonSocial ?? "Client"}`,
        montant: d.ttcNet ?? 0, valide: d.valide,
        note: nature === "chargement" ? "hors CA" : nature === "autre" ? "non compté" : null,
        tri: d.dateDoc ? new Date(d.dateDoc).getTime() : 0,
      };
    }),
    ...regs.map((r) => ({
      key: `r-${r.id}`, refDoc: null as string | null, heure: fmtHeure(r.datePay), nature: "encaissement" as Nature,
      type: `Encaissement · ${r.modePay ?? ""}`,
      description: `${r.tiersNom ?? "Client"}`,
      montant: r.montant ?? 0, valide: true, note: null as string | null,
      tri: r.datePay ? new Date(r.datePay).getTime() : 0,
    })),
  ].sort((a, b) => a.tri - b.tri);
  // Une tournée de l'ERP d'origine couvre plusieurs jours : quand c'est le
  // cas, chaque opération est datée, sinon « 17:25 » puis « 09:03 » se lisent
  // comme un retour en arrière.
  const jours = new Set(timeline.filter((e) => e.tri).map((e) => new Date(e.tri).toDateString()));
  const avecJour = jours.size > 1;
  const heureAffichee = (e: { tri: number; heure: string }) =>
    avecJour && e.tri ? `${new Date(e.tri).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })} ${e.heure}` : e.heure;

  return (
    <div className="space-y-5">
      {ticketOuvert && <TicketVente refDoc={ticketOuvert} onClose={() => setTicketOuvert(null)} />}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Journal de tournée</h1>
          <p className="text-slate-500 text-sm">
            {recon
              ? `${fmtDate(recon.mission.dateOrdre)} — ${recon.mission.commercial ?? ""}${recon.mission.vehicule ? ` · ${recon.mission.vehicule}` : ""}${
                  recon.mission.du ? ` · du ${fmtDateHeure(recon.mission.du)}${recon.mission.au ? ` au ${fmtDateHeure(recon.mission.au)}` : ""}` : ""}`
              : "Aucune tournée pour cette date"}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Sélection par code mission : le commercial le lit sur ses pièces
              (OM-2872) et retrouve la tournée sans chercher la bonne date.
              Le nombre de ventes est affiché pour repérer les tournées actives. */}
          <select
            value={missionId ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              if (!v) { setMissionId(null); return; }
              const id = Number(v);
              setMissionId(id);
              // La date suit la mission choisie, pour rester cohérente à l'écran.
              const t = tournees.find((x) => x.id === id);
              if (t?.dateOrdre) setDate(iso(new Date(t.dateOrdre)));
            }}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white max-w-[15rem]"
            title="Choisir une tournée par son code mission">
            <option value="">Par date…</option>
            {tournees.map((t) => (
              <option key={t.id} value={t.id}>
                {t.code} · {t.dateOrdre ? fmtDate(t.dateOrdre) : "—"}
                {t.nbVentes > 0 ? ` · ${t.nbVentes} vente(s)` : ""}
              </option>
            ))}
          </select>
          {/* La date est neutralisée tant qu'une mission est choisie : les deux
              filtres se contrediraient, et le total affiché est celui de la
              mission. Revenir sur « Par date… » la réactive. */}
          <input type="date" value={date} disabled={missionId != null}
            onChange={(e) => { setMissionId(null); setDate(e.target.value); }}
            title={missionId != null ? "Filtre par mission actif — choisir « Par date… » pour l'utiliser" : undefined}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed" />
        </div>
      </div>

      {toast && (
        <div className={`px-4 py-2 rounded-xl text-sm font-medium flex items-start gap-2 ${
          toast.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
        }`}>
          {toast.ok ? <Check size={15} className="mt-0.5 shrink-0" /> : <AlertTriangle size={15} className="mt-0.5 shrink-0" />}
          <span className="whitespace-pre-line">{toast.msg}</span>
        </div>
      )}

      {load ? (
        <div className="py-16 text-center text-slate-400"><Loader2 className="animate-spin inline" size={22} /></div>
      ) : !recon ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center text-sm text-slate-500">
          Aucune tournée ce jour-là. Créez-la depuis l&apos;écran <b>Planning</b> — les ventes et
          encaissements y seront alors rattachés automatiquement.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Carte label="Total encaissé" value={`${fmt(recon.encaissements.montant)} TND`}
              icon={Banknote} color="text-emerald-600" bg="bg-emerald-50" border="border-emerald-200" />
            <Carte label={`CA net (${recon.ventes.nb} vente(s)${recon.chargements?.nb ? ` · ${recon.chargements.nb} chargement(s) hors CA` : ""})`} value={`${fmt(recon.caNet)} TND`}
              icon={FileText} color="text-blue-600" bg="bg-blue-50" border="border-blue-200" />
            <Carte label="Reste à encaisser" value={`${fmt(recon.resteAEncaisser)} TND`}
              icon={TrendingUp}
              color={recon.resteAEncaisser > 0 ? "text-red-500" : "text-slate-600"}
              bg={recon.resteAEncaisser > 0 ? "bg-red-50" : "bg-slate-50"}
              border={recon.resteAEncaisser > 0 ? "border-red-200" : "border-slate-200"} />
            <Carte label="Espèces à rendre" value={`${fmt(recon.especes)} TND`}
              icon={Clock} color="text-amber-600" bg="bg-amber-50" border="border-amber-200" />
          </div>

          {recon.alertes.length > 0 && (
            <div className="px-4 py-2 rounded-xl bg-amber-50 text-amber-700 text-xs space-y-1">
              {recon.alertes.map((a, i) => (
                <div key={i} className="flex items-start gap-2">
                  <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {a}
                </div>
              ))}
            </div>
          )}

          {recon.encaissements.parMode.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 p-4">
              <div className="text-sm font-semibold text-slate-700 mb-2">Encaissements par mode</div>
              <div className="flex flex-wrap gap-2">
                {recon.encaissements.parMode.map((m) => (
                  <span key={m.mode} className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                    <b className="text-slate-700">{m.mode}</b>
                    <span className="text-slate-500"> · {m.nb} · {fmt(m.montant)} TND</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-semibold text-slate-800">Opérations de la tournée</h2>
              <span className="text-xs text-slate-400">
                {recon.visites.visitees}/{recon.visites.total} visites · {recon.reclamations} réclamation(s)
              </span>
            </div>
            {timeline.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-400">
                Aucun document ni encaissement rattaché à cette tournée.
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {timeline.map((e) => {
                  const st = STYLE[e.nature];
                  return (
                    <div key={e.key}
                      onClick={() => e.refDoc && setTicketOuvert(e.refDoc)}
                      role={e.refDoc ? "button" : undefined}
                      title={e.refDoc ? "Ouvrir le ticket (articles, totaux, impression)" : undefined}
                      className={`flex items-center gap-4 px-5 py-3.5 transition ${e.refDoc ? "cursor-pointer hover:bg-blue-50/60" : "hover:bg-slate-50"}`}>
                      <div className={`text-slate-400 text-xs font-mono shrink-0 ${avecJour ? "w-24" : "w-12"}`}>{heureAffichee(e)}</div>
                      <div className={`w-2 h-2 rounded-full shrink-0 ${st.point}`} />
                      <div className="flex-1 min-w-0">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${st.chip}`}>{e.type}</span>
                        {e.note && (
                          <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">{e.note}</span>
                        )}
                        {!e.valide && (
                          <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600">brouillon</span>
                        )}
                        <div className="text-slate-600 text-sm mt-0.5 truncate">{e.description}</div>
                      </div>
                      <div className={`font-semibold text-sm shrink-0 ${st.montant}`}>
                        {st.signe}{fmt(e.montant)} TND
                      </div>
                      {e.refDoc && <Printer size={15} className="text-slate-300 shrink-0" aria-hidden />}
                    </div>
                  );
                })}
              </div>
            )}
            <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50">
              <span className="font-semibold text-slate-700">Espèces en caisse</span>
              <span className="font-bold text-emerald-600 text-lg">{fmt(recon.especes)} TND</span>
            </div>
          </div>

          {/* Frais de route — table `frais_mission` de l'ERP source. */}
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 className="font-semibold text-slate-800">Frais de route</h2>
                <p className="text-xs text-slate-500">
                  {fmt(totalFrais)} TND dont {fmt(totalCarburant)} de carburant
                </p>
              </div>
              {recon.mission.etat !== "Clôturée" && (
                <button onClick={() => setNouveauFrais({ libelle: "", montant: 0, carburant: false })}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 text-slate-600">
                  + Ajouter un frais
                </button>
              )}
            </div>

            {nouveauFrais && (
              <div className="p-4 border-b border-slate-100 flex flex-wrap gap-3 items-end bg-slate-50">
                <label className="block flex-1 min-w-40">
                  <span className="block text-xs text-slate-500 mb-1">Libellé</span>
                  <input value={nouveauFrais.libelle}
                    onChange={(e) => setNouveauFrais({ ...nouveauFrais, libelle: e.target.value })}
                    placeholder="Carburant, péage, repas…"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" />
                </label>
                <label className="block">
                  <span className="block text-xs text-slate-500 mb-1">Montant</span>
                  <input type="number" step="0.001" value={nouveauFrais.montant}
                    onChange={(e) => setNouveauFrais({ ...nouveauFrais, montant: Number(e.target.value) })}
                    className="w-32 px-3 py-2 rounded-xl border border-slate-200 text-sm" />
                </label>
                <label className="flex items-center gap-1.5 text-xs text-slate-600 pb-2">
                  <input type="checkbox" checked={nouveauFrais.carburant}
                    onChange={(e) => setNouveauFrais({ ...nouveauFrais, carburant: e.target.checked })} />
                  Carburant
                </label>
                <button onClick={ajouterFrais} disabled={nouveauFrais.montant <= 0}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-blue-600 disabled:opacity-40">
                  Enregistrer
                </button>
                <button onClick={() => setNouveauFrais(null)}
                  className="px-3 py-2 rounded-xl text-sm border border-slate-200 text-slate-600">
                  Annuler
                </button>
              </div>
            )}

            {frais.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                Aucun frais de route sur cette tournée.
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {frais.map((f) => (
                  <div key={f.id} className="flex items-center gap-3 px-5 py-2.5">
                    <span className={`w-2 h-2 rounded-full ${f.carburant ? "bg-amber-500" : "bg-slate-300"}`} />
                    <span className="flex-1 text-sm text-slate-700">
                      {f.libelle ?? "Frais"}
                      {f.carburant && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600">carburant</span>}
                    </span>
                    <span className="font-semibold text-sm text-red-500">−{fmt(f.montant)} TND</span>
                    {recon.mission.etat !== "Clôturée" && (
                      <button onClick={() => supprimerFrais(f.id)} className="text-red-400 text-xs px-1">✕</button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {recon.mission.etat !== "Clôturée" ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
              <div className="text-sm font-semibold text-slate-700">Clôture de la tournée</div>
              <div className="flex flex-wrap gap-3 items-end">
                <label className="block">
                  <span className="block text-xs text-slate-500 mb-1">
                    Km à l&apos;arrivée (départ : {recon.mission.kmDepart})
                  </span>
                  <input type="number" value={kmArrive} onChange={(e) => setKmArrive(Number(e.target.value))}
                    className="px-3 py-2 rounded-xl border border-slate-200 text-sm w-40" />
                </label>
                <button onClick={() => cloturer(false)} disabled={busy}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-blue-600 disabled:opacity-50 flex items-center gap-2">
                  {busy ? <Loader2 size={15} className="animate-spin" /> : <Flag size={15} />} Clôturer
                </button>
                <button onClick={() => cloturer(true)} disabled={busy}
                  className="px-4 py-2 rounded-xl text-sm font-semibold border border-slate-200 text-slate-600 disabled:opacity-50">
                  Forcer (reporte les visites restantes)
                </button>
              </div>
            </div>
          ) : (
            <div className="px-4 py-3 rounded-xl bg-slate-100 text-slate-600 text-sm flex items-center gap-2">
              <Flag size={15} /> Tournée clôturée
              {recon.kmParcourus != null && ` — ${recon.kmParcourus} km parcourus`}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Carte({ label, value, icon: Icon, color, bg, border }: {
  label: string; value: string; icon: React.ElementType; color: string; bg: string; border: string;
}) {
  return (
    <div className={`${bg} border ${border} rounded-2xl p-4`}>
      <div className={`${color} mb-2`}><Icon size={20} /></div>
      <div className={`text-xl font-bold ${color}`}>{value}</div>
      <div className="text-slate-500 text-xs mt-1">{label}</div>
    </div>
  );
}
