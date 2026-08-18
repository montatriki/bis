"use client";
import { useCallback, useEffect, useState } from "react";

// Entretien du parc roulant : échéances à venir et plan d'entretien périodique.
//
// L'écran répond à deux questions : « qu'est-ce qui doit être fait ? » (le
// bandeau d'échéances) et « quand la prochaine vidange ? » (le plan par
// véhicule). Une opération se déclenche au premier des deux seuils atteint —
// kilomètres ou jours — comme dans l'ERP d'origine.

type Echeance = {
  vehicleId: string; plaque: string; nature: string; libelle: string;
  date: string | null; jours: number | null; kmRestants: number | null;
  gravite: "expire" | "urgent" | "proche";
};

type Operation = {
  id: number; vehicleId: string; plaque: string; libelle: string;
  intervalleKm: number | null; intervalleJours: number | null;
  dernierKm: number | null; derniereDate: string | null;
  prochaineDate: string | null; prochainKm: number | null;
  joursRestants: number | null; kmRestants: number | null;
  actif: boolean; notes: string | null;
};

type Vehicule = { id: string; plate: string; kilometrage: number | null };

const fmtDate = (v: string | null) => (v ? new Date(v).toLocaleDateString("fr-FR") : "—");

/** Opérations courantes d'un parc utilitaire, avec leur périodicité usuelle. */
const MODELES = [
  { libelle: "Vidange moteur", km: 10000, jours: 365 },
  { libelle: "Filtre à air", km: 20000, jours: 730 },
  { libelle: "Filtre à gasoil", km: 30000, jours: 730 },
  { libelle: "Courroie de distribution", km: 100000, jours: 1825 },
  { libelle: "Plaquettes de frein", km: 40000, jours: null },
  { libelle: "Pneumatiques", km: 50000, jours: null },
];

const COULEUR = {
  expire: "bg-red-50 border-red-200 text-red-700",
  urgent: "bg-amber-50 border-amber-200 text-amber-700",
  proche: "bg-slate-50 border-slate-200 text-slate-600",
} as const;

export default function EntretienVehicules({ accent = "#db2777" }: { accent?: string }) {
  const [echeances, setEcheances] = useState<Echeance[]>([]);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [vehicules, setVehicules] = useState<Vehicule[]>([]);
  const [load, setLoad] = useState(true);
  const [reload, setReload] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [formOp, setFormOp] = useState(false);
  const [executer, setExecuter] = useState<Operation | null>(null);
  const [sync, setSync] = useState(false);
  const [manquants, setManquants] = useState<{ plaque: string; missions: number }[]>([]);

  const flash = useCallback((m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(() => {
    let annule = false;
    Promise.all([
      fetch("/api/vehicules?vue=echeances").then((r) => r.json()),
      fetch("/api/vehicules?vue=operations").then((r) => r.json()),
      fetch("/api/erp?resource=vehicules").then((r) => r.json()),
      // Matricules sans fiche véhicule : simple lecture, aucun effet de bord.
      fetch("/api/missions?vue=vehicules-manquants").then((r) => r.json()).catch(() => ({})),
    ])
      .then(([e, o, v, k]) => {
        if (annule) return;
        setEcheances(e.rows ?? []);
        setOperations(o.rows ?? []);
        setVehicules(v.rows ?? []);
        setManquants(k.rows ?? []);
        setLoad(false);
      })
      .catch(() => { if (!annule) setLoad(false); });
    return () => { annule = true; };
  }, [reload]);

  async function synchroniser() {
    setSync(true);
    const r = await fetch("/api/missions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vue: "synchroniser-km" }),
    }).then((x) => x.json()).catch(() => ({ error: "réseau" }));
    setSync(false);
    flash(r.ok ? (r.message ?? "Compteurs recalculés") : `Erreur : ${r.error ?? "échec"}`);
    setReload((k) => k + 1);
  }

  const expirees = echeances.filter((e) => e.gravite === "expire");
  const urgentes = echeances.filter((e) => e.gravite === "urgent");

  if (load) return <div className="py-16 text-center text-slate-400 text-sm">Chargement…</div>;

  return (
    <div className="space-y-5">
      {toast && (
        <div className="fixed top-20 right-6 z-50 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold shadow-xl">
          {toast}
        </div>
      )}

      {/* Bandeau d'échéances : ce qu'il faut traiter, du plus grave au moins. */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Tuile titre="Échéances dépassées" valeur={expirees.length} ton="danger" />
        <Tuile titre="Sous 7 jours" valeur={urgentes.length} ton="alerte" />
        <Tuile titre="Opérations suivies" valeur={operations.filter((o) => o.actif).length} ton="neutre" />
      </div>

      {/* Compteurs : alimentés par les relevés des ordres de mission. Le bouton
          sert aux reprises — l'ajout et la clôture d'une tournée les tiennent
          déjà à jour au fil de l'eau. */}
      <section className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <header className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
          <div className="font-bold text-sm">
            Compteurs kilométriques
            <span className="ml-2 font-medium text-slate-400">
              relevés depuis les ordres de mission
            </span>
          </div>
          <button onClick={synchroniser} disabled={sync}
            className="px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-200 text-slate-600 hover:bg-slate-50 transition disabled:opacity-50">
            {sync ? "…" : "Recalculer depuis les tournées"}
          </button>
        </header>
        <div className="px-5 py-3 flex flex-wrap gap-x-8 gap-y-2">
          {vehicules.map((v) => (
            <div key={v.id} className="text-sm">
              <span className="font-semibold text-slate-800">{v.plate}</span>
              <span className="ml-2 tabular-nums text-slate-600">
                {v.kilometrage != null ? `${v.kilometrage.toLocaleString("fr-TN")} km` : "compteur inconnu"}
              </span>
            </div>
          ))}
        </div>
        {manquants.length > 0 && (
          <div className="px-5 py-3 border-t border-slate-100 bg-amber-50 text-xs text-amber-800">
            <b>{manquants.length} matricule(s)</b>{" "}
            roulent sans fiche véhicule et échappent au suivi d&apos;entretien :{" "}
            {manquants.map((m) => `${m.plaque} (${m.missions} tournées)`).join(", ")}.
            Créez-les dans « Gestion des véhicules » pour suivre leurs échéances.
          </div>
        )}
      </section>

      {echeances.length > 0 ? (
        <section className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <header className="px-5 py-3.5 border-b border-slate-100 font-bold text-sm">
            À traiter
            <span className="ml-2 font-medium text-slate-400">
              assurance, visite, vignette et entretiens dus sous 30 jours
            </span>
          </header>
          <ul className="divide-y divide-slate-50">
            {echeances.map((e, i) => (
              <li key={`${e.vehicleId}-${e.nature}-${e.libelle}-${i}`}
                  className="px-5 py-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-semibold text-slate-800 text-sm">
                    {e.plaque} <span className="text-slate-400 font-normal">·</span> {e.libelle}
                  </div>
                  <div className="text-xs text-slate-500">
                    {e.date ? `Échéance : ${fmtDate(e.date)}` : "Échéance kilométrique"}
                    {e.kmRestants != null && (
                      <> · {e.kmRestants < 0
                        ? `dépassement de ${-e.kmRestants} km`
                        : `${e.kmRestants} km restants`}</>
                    )}
                  </div>
                </div>
                <span className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-lg border ${COULEUR[e.gravite]}`}>
                  {e.jours == null ? "km"
                    : e.jours < 0 ? `+${-e.jours} j de retard`
                    : e.jours === 0 ? "aujourd'hui"
                    : `dans ${e.jours} j`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-2xl px-5 py-4 text-sm font-medium">
          Aucune échéance dans les 30 prochains jours.
        </div>
      )}

      {/* Plan d'entretien : la périodicité configurée, véhicule par véhicule. */}
      <section className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <header className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between gap-3">
          <div className="font-bold text-sm">
            Plan d&apos;entretien
            <span className="ml-2 font-medium text-slate-400">vidange, filtres, courroie…</span>
          </div>
          <button onClick={() => setFormOp(true)}
            className="px-3.5 py-2 rounded-xl text-xs font-bold text-white transition hover:opacity-90"
            style={{ background: accent }}>
            + Ajouter une opération
          </button>
        </header>

        {operations.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-500">
            Aucune opération programmée. Ajoutez une vidange ou un contrôle périodique
            pour être prévenu automatiquement, en kilomètres comme en jours.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 text-left font-bold">Véhicule</th>
                  <th className="px-4 py-2.5 text-left font-bold">Opération</th>
                  <th className="px-4 py-2.5 text-left font-bold">Périodicité</th>
                  <th className="px-4 py-2.5 text-left font-bold">Dernière</th>
                  <th className="px-4 py-2.5 text-left font-bold">Prochaine</th>
                  <th className="px-4 py-2.5 text-right font-bold">Reste</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {operations.map((o) => {
                  const enRetard =
                    (o.joursRestants != null && o.joursRestants < 0) ||
                    (o.kmRestants != null && o.kmRestants < 0);
                  return (
                    <tr key={o.id} className={o.actif ? "" : "opacity-45"}>
                      <td className="px-4 py-2.5 font-semibold">{o.plaque}</td>
                      <td className="px-4 py-2.5">{o.libelle}</td>
                      <td className="px-4 py-2.5 text-slate-500 text-xs">
                        {[o.intervalleKm ? `${o.intervalleKm} km` : null,
                          o.intervalleJours ? `${o.intervalleJours} j` : null]
                          .filter(Boolean).join(" ou ")}
                      </td>
                      <td className="px-4 py-2.5 text-slate-500 text-xs">
                        {fmtDate(o.derniereDate)}
                        {o.dernierKm != null && <span className="text-slate-400"> · {o.dernierKm} km</span>}
                      </td>
                      <td className="px-4 py-2.5 text-xs">
                        {fmtDate(o.prochaineDate)}
                        {o.prochainKm != null && <span className="text-slate-400"> · {o.prochainKm} km</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={`text-xs font-bold ${enRetard ? "text-red-600" : "text-slate-600"}`}>
                          {o.joursRestants != null && `${o.joursRestants} j`}
                          {o.joursRestants != null && o.kmRestants != null && " · "}
                          {o.kmRestants != null && `${o.kmRestants} km`}
                          {o.joursRestants == null && o.kmRestants == null && "—"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        <button onClick={() => setExecuter(o)}
                          className="text-xs font-bold px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition">
                          Marquer faite
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {formOp && (
        <FormOperation
          vehicules={vehicules} accent={accent}
          onClose={() => setFormOp(false)}
          onCree={(m) => { setFormOp(false); flash(m); setReload((k) => k + 1); }}
        />
      )}
      {executer && (
        <DialogExecution
          operation={executer} accent={accent}
          onClose={() => setExecuter(null)}
          onFait={(m) => { setExecuter(null); flash(m); setReload((k) => k + 1); }}
        />
      )}
    </div>
  );
}

function Tuile({ titre, valeur, ton }: { titre: string; valeur: number; ton: "danger" | "alerte" | "neutre" }) {
  const style =
    ton === "danger" && valeur > 0 ? "bg-red-50 border-red-100 text-red-700"
    : ton === "alerte" && valeur > 0 ? "bg-amber-50 border-amber-100 text-amber-700"
    : "bg-white border-slate-100 text-slate-700";
  return (
    <div className={`rounded-2xl border px-4 py-3 ${style}`}>
      <div className="text-[10px] font-black uppercase tracking-wider opacity-70">{titre}</div>
      <div className="text-2xl font-extrabold tabular-nums">{valeur}</div>
    </div>
  );
}

function FormOperation({
  vehicules, accent, onClose, onCree,
}: {
  vehicules: Vehicule[]; accent: string;
  onClose: () => void; onCree: (m: string) => void;
}) {
  const [vehicleId, setVehicleId] = useState("");
  const [libelle, setLibelle] = useState("");
  const [intervalleKm, setKm] = useState("");
  const [intervalleJours, setJours] = useState("");
  const [derniereDate, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [dernierKm, setDernierKm] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // Choisir un modèle pré-remplit la périodicité usuelle, modifiable ensuite.
  function appliquerModele(m: (typeof MODELES)[number]) {
    setLibelle(m.libelle);
    setKm(m.km ? String(m.km) : "");
    setJours(m.jours ? String(m.jours) : "");
  }

  async function valider() {
    setErreur(null);
    setEnvoi(true);
    const r = await fetch("/api/vehicules?vue=operations", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vehicleId, libelle, intervalleKm, intervalleJours, derniereDate, dernierKm }),
    }).then((x) => x.json()).catch(() => ({ error: "réseau" }));
    setEnvoi(false);
    if (r.ok) onCree(`${libelle} programmée`); else setErreur(r.error ?? "Échec");
  }

  return (
    <Modale titre="Nouvelle opération d'entretien" onClose={onClose}
      actions={<Actions onClose={onClose} onValider={valider} envoi={envoi} accent={accent} libelle="Programmer" />}>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {MODELES.map((m) => (
            <button key={m.libelle} onClick={() => appliquerModele(m)}
              className="text-xs px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition">
              {m.libelle}
            </button>
          ))}
        </div>

        <Champ label="Véhicule">
          <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} className={inputCls}>
            <option value="">— Choisir —</option>
            {vehicules.map((v) => (
              <option key={v.id} value={v.id}>
                {v.plate}{v.kilometrage != null ? ` (${v.kilometrage} km)` : ""}
              </option>
            ))}
          </select>
        </Champ>

        <Champ label="Opération">
          <input value={libelle} onChange={(e) => setLibelle(e.target.value)}
            className={inputCls} placeholder="Vidange moteur" />
        </Champ>

        <div className="grid grid-cols-2 gap-3">
          <Champ label="Tous les … km">
            <input value={intervalleKm} onChange={(e) => setKm(e.target.value)}
              inputMode="numeric" className={inputCls} placeholder="10000" />
          </Champ>
          <Champ label="… ou tous les … jours">
            <input value={intervalleJours} onChange={(e) => setJours(e.target.value)}
              inputMode="numeric" className={inputCls} placeholder="365" />
          </Champ>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Champ label="Dernière exécution">
            <input type="date" value={derniereDate} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          </Champ>
          <Champ label="Compteur à cette date">
            <input value={dernierKm} onChange={(e) => setDernierKm(e.target.value)}
              inputMode="numeric" className={inputCls} placeholder="km" />
          </Champ>
        </div>

        <p className="text-xs text-slate-500">
          L&apos;alerte se déclenche au premier seuil atteint — kilomètres ou jours —
          et apparaît dans les notifications.
        </p>

        {erreur && <Erreur>{erreur}</Erreur>}
      </div>
    </Modale>
  );
}

function DialogExecution({
  operation, accent, onClose, onFait,
}: {
  operation: Operation; accent: string;
  onClose: () => void; onFait: (m: string) => void;
}) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [kilometrage, setKm] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function valider() {
    setErreur(null);
    setEnvoi(true);
    const r = await fetch("/api/vehicules?vue=execution", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: operation.id, date, kilometrage }),
    }).then((x) => x.json()).catch(() => ({ error: "réseau" }));
    setEnvoi(false);
    if (r.ok) onFait(r.message ?? "Enregistré"); else setErreur(r.error ?? "Échec");
  }

  return (
    <Modale titre={`${operation.libelle} — ${operation.plaque}`} onClose={onClose}
      actions={<Actions onClose={onClose} onValider={valider} envoi={envoi} accent={accent} libelle="Enregistrer" />}>
      <div className="space-y-3">
        <Champ label="Date de l'intervention">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
        </Champ>
        <Champ label="Kilométrage relevé">
          <input value={kilometrage} onChange={(e) => setKm(e.target.value)}
            inputMode="numeric" className={inputCls} placeholder="km au compteur" />
        </Champ>
        <p className="text-xs text-slate-500">
          La prochaine échéance est recalculée à partir de cette intervention, et le
          compteur du véhicule est mis à jour.
        </p>
        {erreur && <Erreur>{erreur}</Erreur>}
      </div>
    </Modale>
  );
}

const inputCls = "w-full px-3 py-2 rounded-xl border border-slate-200 text-sm";

function Champ({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-slate-500 mb-1">{label}</span>
      {children}
    </label>
  );
}

function Erreur({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{children}</div>
  );
}

function Modale({
  titre, onClose, children, actions,
}: {
  titre: string; onClose: () => void; children: React.ReactNode; actions: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
         onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-100 font-bold text-sm">{titre}</div>
        <div className="p-5">{children}</div>
        {actions}
      </div>
    </div>
  );
}

function Actions({
  onClose, onValider, envoi, accent, libelle,
}: {
  onClose: () => void; onValider: () => void; envoi: boolean; accent: string; libelle: string;
}) {
  return (
    <div className="flex gap-3 px-5 py-4 border-t border-slate-100">
      <button onClick={onClose}
        className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-slate-200 text-slate-600">
        Annuler
      </button>
      <button onClick={onValider} disabled={envoi}
        className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
        style={{ background: accent }}>
        {envoi ? "…" : libelle}
      </button>
    </div>
  );
}
