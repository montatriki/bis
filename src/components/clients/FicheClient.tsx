"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, MapPin, Phone, Navigation, ShoppingCart, Receipt, ClipboardList, FileText,
  Undo2, Wallet, Footprints, ChevronDown, ChevronUp, Loader2, Building2, BookOpen, AlertTriangle,
} from "lucide-react";
import { MOIS_LONGS } from "@/lib/vente-stats";

// Fiche client partagée : tout ce qui s'est passé avec ce client sur un mois
// — tickets, commandes, factures, retours, encaissements, visites — avec le
// détail des lignes de chaque document. Le commercial l'utilise avec « Passer
// commande » (`onCommander`) ; l'admin la consulte sans (lecture métier).

type Ligne = { refDoc: string; refArt: string; designation: string; qte: number; puHt: number; remise: number; thtNet: number; ttcNet: number };
type Doc = {
  refDoc: string; typeDoc: string; dateDoc: string | null; etat: string | null; thtNet: number; totTva: number;
  totRemise: number; ttcNet: number; soldeDoc: number; totalRegle: number; modePayement: string | null;
  transformeEn: string | null; docSource: string | null; lignes: Ligne[];
};
type Reglement = { id: number; datePay: string | null; montant: number; modePay: string | null; numPiece: string | null; numDoc: string | null; etat: string | null; banque: string | null };
type Visite = { id: number; dateVisite: string | null; etat: string; heurePrevue: string | null; motif: string | null; commentaire: string | null; dayId: number };
type Fiche = {
  client: {
    id: number; raisonSocial: string | null; ville: string | null; gouvernorat: string | null; adresse: string | null;
    tel: string | null; email: string | null; famille: string | null; sousFamille: string | null; matriculeF: string | null;
    plafond: number | null; soldeFin: number; debit: number; credit: number; latitude: number | null; longitude: number | null;
  };
  periode: { mois: number; annee: number; annees: number[]; auto: boolean; derniereActivite: string | null };
  compte: { soldeIni: number; debit: number; credit: number; solde: number; soldeOuverture: number; soldeFinMois: number; soldeStocke: number; ecart: number };
  extrait: { date: string | null; ref: string; libelle: string; debit: number; credit: number; solde: number }[];
  totaux: {
    ca: number; nbTickets: number; commandes: number; nbCommandes: number; factures: number; nbFactures: number;
    encaisse: number; nbReglements: number; nbVisites: number; nbVisitesFaites: number;
  };
  tickets: Doc[]; commandes: Doc[]; factures: Doc[]; retours: Doc[]; reglements: Reglement[]; visites: Visite[];
};

const fmt = (v: unknown) => new Intl.NumberFormat("fr-TN", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(Number(v) || 0);
const date = (v: string | null) => (v ? new Date(v).toLocaleDateString("fr-FR") : "—");

type Onglet = "tickets" | "commandes" | "factures" | "retours" | "reglements" | "visites" | "extrait";
const ONGLETS: { cle: Onglet; label: string; icone: React.ReactNode }[] = [
  { cle: "tickets", label: "Tickets", icone: <Receipt size={14} /> },
  { cle: "commandes", label: "Commandes", icone: <ClipboardList size={14} /> },
  { cle: "factures", label: "Factures", icone: <FileText size={14} /> },
  { cle: "retours", label: "Retours / avoirs", icone: <Undo2 size={14} /> },
  { cle: "reglements", label: "Encaissements", icone: <Wallet size={14} /> },
  { cle: "visites", label: "Visites", icone: <Footprints size={14} /> },
  { cle: "extrait", label: "Extrait de compte", icone: <BookOpen size={14} /> },
];

const COULEUR_ETAT: Record<string, string> = {
  "Visité": "bg-emerald-100 text-emerald-700", "À visiter": "bg-blue-100 text-blue-700",
  "Reporté": "bg-amber-100 text-amber-700", "Absent": "bg-red-100 text-red-700",
};

export type ClientFiche = Fiche["client"];

export default function FicheClient({
  id, retourHref, retourLabel, onCommander,
}: {
  id: number;
  /** Retour vers la liste d'origine : « Mes clients » ou le module Vente. */
  retourHref: string;
  retourLabel: string;
  /** Absent (admin) : pas de bouton « Passer commande ». */
  onCommander?: (c: ClientFiche) => void;
}) {
  const router = useRouter();
  const [fiche, setFiche] = useState<Fiche | null>(null);
  const maintenant = new Date();
  // Période nulle = laisser l'API choisir (mois courant, ou dernier mois actif
  // du client s'il n'a rien ce mois-ci). Un choix explicite prend le dessus.
  const [periode, setPeriode] = useState<{ mois: number; annee: number } | null>(null);
  const mois = periode?.mois ?? fiche?.periode.mois ?? maintenant.getMonth() + 1;
  const annee = periode?.annee ?? fiche?.periode.annee ?? maintenant.getFullYear();
  const [erreur, setErreur] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [onglet, setOnglet] = useState<Onglet>("tickets");
  const [ouvert, setOuvert] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const qs = periode ? `&mois=${periode.mois}&annee=${periode.annee}` : "";
    fetch(`/api/clients/fiche?codeCli=${id}${qs}`)
      .then(async (r) => ({ ok: r.ok, d: await r.json() }))
      .then(({ ok, d }) => {
        if (cancelled) return;
        if (!ok) { setErreur(d.error ?? "Erreur"); setFiche(null); }
        else { setErreur(null); setFiche(d); }
        setLoading(false);
      })
      .catch(() => { if (!cancelled) { setErreur("Impossible de charger la fiche"); setLoading(false); } });
    return () => { cancelled = true; };
  }, [id, periode]);

  const c = fiche?.client;
  const nom = c ? (c.raisonSocial || "").trim() || `Client ${c.id}` : "";
  const tel = (c?.tel ?? "").replace(/[^0-9+]/g, "");
  const geo = c && c.latitude != null && c.longitude != null && !(c.latitude === 0 && c.longitude === 0);


  // Années proposées par l'API : de la première transaction du client à aujourd'hui.
  const annees = fiche?.periode.annees?.length ? fiche.periode.annees : [maintenant.getFullYear()];
  const docsOnglet: Doc[] = fiche ? ({ tickets: fiche.tickets, commandes: fiche.commandes, factures: fiche.factures, retours: fiche.retours }[onglet as "tickets"] ?? []) : [];

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-5xl mx-auto">
      <button onClick={() => router.push(retourHref)}
        className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
        <ArrowLeft size={15} /> {retourLabel}
      </button>

      {loading && !fiche && <div className="py-16 text-center text-[var(--text-secondary)]"><Loader2 className="animate-spin inline" size={22} /></div>}
      {erreur && <div className="p-4 rounded-xl bg-red-50 text-red-700 text-sm">{erreur}</div>}

      {c && fiche && (
        <>
          {/* En-tête */}
          <div className="bg-slate-800 text-white rounded-2xl p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <h1 className="text-2xl font-bold truncate">{nom}</h1>
                <div className="text-slate-400 text-xs mt-0.5">Code {c.id}{c.matriculeF ? ` · MF ${c.matriculeF}` : ""}</div>
                <div className="mt-3 text-sm text-slate-300 space-y-1">
                  <div className="flex items-center gap-1.5"><MapPin size={12} /> {c.adresse || c.ville || "—"}{c.gouvernorat ? ` — ${c.gouvernorat}` : ""}</div>
                  {c.tel && <div className="flex items-center gap-1.5"><Phone size={12} /> {c.tel}</div>}
                  {c.famille && <div className="flex items-center gap-1.5"><Building2 size={12} /> {c.famille}{c.sousFamille ? ` / ${c.sousFamille}` : ""}</div>}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {geo && (
                  <a href={`https://www.google.com/maps/dir/?api=1&destination=${c.latitude},${c.longitude}`} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1.5 text-sm font-semibold bg-white/10 hover:bg-white/20 px-3.5 py-2 rounded-xl transition">
                    <Navigation size={14} /> Itinéraire
                  </a>
                )}
                {tel && (
                  <a href={`tel:${tel}`} className="flex items-center gap-1.5 text-sm font-semibold bg-white/10 hover:bg-white/20 px-3.5 py-2 rounded-xl transition">
                    <Phone size={14} /> Appeler
                  </a>
                )}
                {onCommander && (
                  <button onClick={() => onCommander(c)} className="flex items-center gap-1.5 text-sm font-semibold bg-blue-600 hover:bg-blue-500 px-3.5 py-2 rounded-xl transition">
                    <ShoppingCart size={14} /> Passer commande
                  </button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-4">
              <Stat label="Débit" value={fmt(fiche.compte.debit)} />
              <Stat label="Crédit" value={fmt(fiche.compte.credit)} />
              <Stat label="Solde dû" value={fmt(fiche.compte.solde)} alerte={fiche.compte.solde > 0} />
            </div>
            <div className="mt-2 text-[11px] text-slate-400">
              Calculé à l&apos;instant depuis les documents et règlements (solde initial {fmt(fiche.compte.soldeIni)}).
              {Math.abs(fiche.compte.ecart) >= 0.01 && (
                <span className="ml-1 inline-flex items-center gap-1 text-amber-300">
                  <AlertTriangle size={11} /> Le compteur enregistré en base indique {fmt(fiche.compte.soldeStocke)} (écart {fmt(fiche.compte.ecart)}) — dérive héritée de l&apos;ancien système.
                </span>
              )}
            </div>
          </div>

          {/* Période */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-[var(--text-secondary)]">Activité de</span>
            <select value={mois} onChange={(e) => { setPeriode({ mois: Number(e.target.value), annee }); setLoading(true); }}
              className="py-2 px-3 text-sm bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl focus:outline-none">
              {MOIS_LONGS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            <select value={annee} onChange={(e) => { setPeriode({ mois, annee: Number(e.target.value) }); setLoading(true); }}
              className="py-2 px-3 text-sm bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl focus:outline-none">
              {annees.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            {loading && <Loader2 className="animate-spin text-[var(--text-secondary)]" size={16} />}
          </div>

          {fiche.periode.auto && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-800 dark:text-blue-300 text-sm">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />
              <span>
                Rien ce mois-ci pour ce client : la fiche s&apos;est ouverte sur son <b>dernier mois d&apos;activité</b>
                {fiche.periode.derniereActivite ? ` (dernière opération le ${date(fiche.periode.derniereActivite)})` : ""}.
                Changez de mois ci-dessus pour voir une autre période.
              </span>
            </div>
          )}
          {!fiche.periode.derniereActivite && (
            <div className="p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-primary)] text-sm text-[var(--text-secondary)]">
              Aucune opération enregistrée avec ce client, toutes périodes confondues.
            </div>
          )}

          {/* Chiffres du mois */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Kpi label="Chiffre d'affaires" value={`${fmt(fiche.totaux.ca)} TND`} sous={`${fiche.totaux.nbTickets} ticket${fiche.totaux.nbTickets > 1 ? "s" : ""}`} couleur="text-blue-700" />
            <Kpi label="Commandes" value={`${fmt(fiche.totaux.commandes)} TND`} sous={`${fiche.totaux.nbCommandes} commande${fiche.totaux.nbCommandes > 1 ? "s" : ""}`} couleur="text-violet-700" />
            <Kpi label="Encaissé" value={`${fmt(fiche.totaux.encaisse)} TND`} sous={`${fiche.totaux.nbReglements} règlement${fiche.totaux.nbReglements > 1 ? "s" : ""}`} couleur="text-emerald-700" />
            <Kpi label="Visites" value={`${fiche.totaux.nbVisitesFaites} / ${fiche.totaux.nbVisites}`} sous="effectuées / planifiées" couleur="text-amber-700" />
          </div>

          {/* Onglets */}
          <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-primary)] overflow-hidden">
            <div className="flex overflow-x-auto border-b border-[var(--border-primary)]">
              {ONGLETS.map((o) => {
                const n = o.cle === "reglements" ? fiche.reglements.length : o.cle === "visites" ? fiche.visites.length : o.cle === "extrait" ? fiche.extrait.length : (fiche[o.cle] as Doc[]).length;
                return (
                  <button key={o.cle} onClick={() => { setOnglet(o.cle); setOuvert(null); }}
                    className={`flex items-center gap-1.5 px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition ${
                      onglet === o.cle ? "border-blue-600 text-blue-700" : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}>
                    {o.icone} {o.label}
                    <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${onglet === o.cle ? "bg-blue-100 text-blue-700" : "bg-[var(--bg-primary)]"}`}>{n}</span>
                  </button>
                );
              })}
            </div>

            <div className="divide-y divide-[var(--border-primary)]">
              {onglet === "reglements" && (fiche.reglements.length === 0
                ? <Vide texte="Aucun encaissement ce mois-ci." />
                : fiche.reglements.map((r) => (
                  <div key={r.id} className="flex items-center justify-between px-5 py-3 text-sm">
                    <div>
                      <div className="font-medium text-[var(--text-primary)]">{r.modePay || "Règlement"}{r.numPiece ? ` · n° ${r.numPiece}` : ""}</div>
                      <div className="text-xs text-[var(--text-secondary)]">{date(r.datePay)}{r.numDoc ? ` · ${r.numDoc}` : ""}{r.banque ? ` · ${r.banque}` : ""}{r.etat ? ` · ${r.etat}` : ""}</div>
                    </div>
                    <div className="font-semibold tabular-nums text-emerald-700">{fmt(r.montant)}</div>
                  </div>
                )))}

              {onglet === "visites" && (fiche.visites.length === 0
                ? <Vide texte="Aucune visite planifiée ce mois-ci." />
                : fiche.visites.map((v) => (
                  <div key={v.id} className="flex items-center justify-between px-5 py-3 text-sm gap-3">
                    <div className="min-w-0">
                      <div className="font-medium text-[var(--text-primary)]">{date(v.dateVisite)}{v.heurePrevue ? ` · ${v.heurePrevue}` : ""} · tournée OM-{v.dayId}</div>
                      {(v.motif || v.commentaire) && <div className="text-xs text-[var(--text-secondary)] truncate">{v.motif}{v.motif && v.commentaire ? " — " : ""}{v.commentaire}</div>}
                    </div>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full shrink-0 ${COULEUR_ETAT[v.etat] ?? "bg-slate-100 text-slate-600"}`}>{v.etat}</span>
                  </div>
                )))}

              {onglet === "extrait" && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-[var(--bg-primary)] text-[var(--text-secondary)] text-xs">
                      <tr>
                        <th className="text-left px-4 py-2 font-semibold">Date</th>
                        <th className="text-left px-4 py-2 font-semibold">Pièce</th>
                        <th className="text-right px-4 py-2 font-semibold">Débit</th>
                        <th className="text-right px-4 py-2 font-semibold">Crédit</th>
                        <th className="text-right px-4 py-2 font-semibold">Solde</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-primary)]">
                      <tr className="text-[var(--text-secondary)] italic">
                        <td className="px-4 py-2" colSpan={4}>Solde d&apos;ouverture au 1er du mois</td>
                        <td className="px-4 py-2 text-right tabular-nums font-semibold">{fmt(fiche.compte.soldeOuverture)}</td>
                      </tr>
                      {fiche.extrait.map((m, i) => (
                        <tr key={i}>
                          <td className="px-4 py-2 whitespace-nowrap">{date(m.date)}</td>
                          <td className="px-4 py-2"><div className="font-medium text-[var(--text-primary)]">{m.ref}</div><div className="text-[11px] text-[var(--text-secondary)]">{m.libelle}</div></td>
                          <td className="px-4 py-2 text-right tabular-nums">{m.debit ? fmt(m.debit) : ""}</td>
                          <td className="px-4 py-2 text-right tabular-nums text-emerald-700">{m.credit ? fmt(m.credit) : ""}</td>
                          <td className={`px-4 py-2 text-right tabular-nums font-semibold ${m.solde > 0 ? "text-red-600" : "text-[var(--text-primary)]"}`}>{fmt(m.solde)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-[var(--bg-primary)] font-semibold">
                      <tr>
                        <td className="px-4 py-2" colSpan={2}>Solde en fin de mois</td>
                        <td className="px-4 py-2 text-right tabular-nums">{fmt(fiche.extrait.reduce((s, m) => s + m.debit, 0))}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-emerald-700">{fmt(fiche.extrait.reduce((s, m) => s + m.credit, 0))}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{fmt(fiche.compte.soldeFinMois)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {onglet !== "reglements" && onglet !== "visites" && onglet !== "extrait" && (docsOnglet.length === 0
                ? <Vide texte="Aucun document de ce type ce mois-ci." />
                : docsOnglet.map((d) => {
                  const estOuvert = ouvert === d.refDoc;
                  return (
                    <div key={d.refDoc}>
                      <button onClick={() => setOuvert(estOuvert ? null : d.refDoc)}
                        className="w-full flex items-center justify-between px-5 py-3 text-sm text-left hover:bg-[var(--bg-primary)] transition">
                        <div className="min-w-0">
                          <div className="font-medium text-[var(--text-primary)]">{d.refDoc}
                            <span className="ml-2 text-[11px] font-semibold px-1.5 py-0.5 rounded bg-[var(--bg-primary)] text-[var(--text-secondary)]">{d.typeDoc}</span>
                            {d.etat && <span className="ml-1.5 text-[11px] text-[var(--text-secondary)]">{d.etat}</span>}
                          </div>
                          <div className="text-xs text-[var(--text-secondary)]">
                            {date(d.dateDoc)} · {d.lignes.length} article{d.lignes.length > 1 ? "s" : ""}
                            {d.modePayement ? ` · ${d.modePayement}` : ""}
                            {d.transformeEn ? ` · transformé en ${d.transformeEn}` : ""}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 ml-2">
                          <div className="text-right">
                            <div className="font-semibold tabular-nums text-[var(--text-primary)]">{fmt(d.ttcNet)}</div>
                            {d.soldeDoc > 0 && <div className="text-[10px] text-red-600">reste {fmt(d.soldeDoc)}</div>}
                          </div>
                          {estOuvert ? <ChevronUp size={16} className="text-[var(--text-secondary)]" /> : <ChevronDown size={16} className="text-[var(--text-secondary)]" />}
                        </div>
                      </button>
                      {estOuvert && (
                        <div className="px-5 pb-4">
                          {d.lignes.length === 0
                            ? <div className="text-xs text-[var(--text-secondary)]">Aucune ligne enregistrée.</div>
                            : (
                              <div className="overflow-x-auto rounded-xl border border-[var(--border-primary)]">
                                <table className="w-full text-xs">
                                  <thead className="bg-[var(--bg-primary)] text-[var(--text-secondary)]">
                                    <tr>
                                      <th className="text-left px-3 py-2 font-semibold">Article</th>
                                      <th className="text-right px-3 py-2 font-semibold">Qté</th>
                                      <th className="text-right px-3 py-2 font-semibold">PU HT</th>
                                      <th className="text-right px-3 py-2 font-semibold">Remise</th>
                                      <th className="text-right px-3 py-2 font-semibold">Total TTC</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-[var(--border-primary)]">
                                    {d.lignes.map((l, i) => (
                                      <tr key={i}>
                                        <td className="px-3 py-2 text-[var(--text-primary)]"><div className="font-medium">{l.designation}</div><div className="text-[10px] text-[var(--text-secondary)]">{l.refArt}</div></td>
                                        <td className="px-3 py-2 text-right tabular-nums">{l.qte}</td>
                                        <td className="px-3 py-2 text-right tabular-nums">{fmt(l.puHt)}</td>
                                        <td className="px-3 py-2 text-right tabular-nums">{l.remise ? `${l.remise} %` : "—"}</td>
                                        <td className="px-3 py-2 text-right tabular-nums font-semibold">{fmt(l.ttcNet)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                  <tfoot className="bg-[var(--bg-primary)] font-semibold">
                                    <tr>
                                      <td className="px-3 py-2" colSpan={4}>HT {fmt(d.thtNet)}{d.totRemise ? ` · remise ${fmt(d.totRemise)}` : ""} · TVA {fmt(d.totTva)}</td>
                                      <td className="px-3 py-2 text-right tabular-nums">{fmt(d.ttcNet)}</td>
                                    </tr>
                                  </tfoot>
                                </table>
                              </div>
                            )}
                        </div>
                      )}
                    </div>
                  );
                }))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, alerte }: { label: string; value: string; alerte?: boolean }) {
  return (
    <div className="bg-white/10 rounded-xl px-3 py-2 text-center">
      <div className="text-[10px] uppercase tracking-wide text-slate-400 font-bold">{label}</div>
      <div className={`font-bold tabular-nums ${alerte ? "text-red-300" : ""}`}>{value}</div>
    </div>
  );
}

function Kpi({ label, value, sous, couleur }: { label: string; value: string; sous: string; couleur: string }) {
  return (
    <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-primary)] p-4">
      <div className="text-xs text-[var(--text-secondary)]">{label}</div>
      <div className={`text-lg font-bold tabular-nums mt-0.5 ${couleur}`}>{value}</div>
      <div className="text-[11px] text-[var(--text-secondary)]">{sous}</div>
    </div>
  );
}

function Vide({ texte }: { texte: string }) {
  return <div className="py-10 text-center text-sm text-[var(--text-secondary)]">{texte}</div>;
}
