"use client";
import { useState, useEffect, useCallback } from "react";
import TicketVente from "@/components/commercial/TicketVente";
import { Receipt, Printer, Loader2, ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";

// Dernier ticket — tuile « DERNIER TICKET » de l'app commerciale.
// Retrouve et réimprime le dernier ticket édité par le commercial, typiquement
// quand l'impression a échoué ou que le client en redemande un.

type Ticket = {
  refDoc: string; typeDoc: string; dateDoc: string | null; raisonSocial: string | null;
  adrCli: string | null; mf: string | null;
  thtNet: number; totTva: number; timbre: number; totFodec: number; ttcNet: number;
  totalRegle: number; soldeDoc: number; valide: boolean; utilisateur: string | null;
  modePayement: string | null;
};
type Ligne = {
  id: number; refArt: string; designation: string; unite: string | null;
  qte: number; puHt: number; remise: number; tauxTva: number; ttcNet: number;
};
type Liste = { refDoc: string; typeDoc: string; dateDoc: string | null; raisonSocial: string | null; ttcNet: number };

const fmt = (v: unknown) =>
  new Intl.NumberFormat("fr-TN", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(Number(v) || 0);
const fmtQ = (v: unknown) => new Intl.NumberFormat("fr-TN", { maximumFractionDigits: 3 }).format(Number(v) || 0);
const fmtDT = (v: unknown) =>
  v ? new Date(String(v)).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

export default function DernierTicketPage() {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [societe, setSociete] = useState<Record<string, string>>({});
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(1);
  /** Nombre total de tickets, toutes pages confondues. */
  const [total, setTotal] = useState(0);
  const [historique, setHistorique] = useState<Liste[]>([]);
  const [idx, setIdx] = useState(0);
  // Filtre client : 0 = tous. La navigation reste bornée au client choisi.
  const [codeCli, setCodeCli] = useState(0);
  const [clientsTicket, setClientsTicket] = useState<{ codeCli: number; raisonSocial: string; nb: number }[]>([]);
  const [load, setLoad] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  // Référence dont le ticket rouleau est ouvert (null = aucun).
  const [impression, setImpression] = useState<string | null>(null);

  const charger = useCallback((refDoc?: string, cli?: number) => {
    fetch(`/api/tickets?vue=dernier${refDoc ? `&refDoc=${encodeURIComponent(refDoc)}` : ""}${cli ? `&codeCli=${cli}` : ""}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setErreur(d.error); return; }
        setTicket(d.ticket);
        setLignes(d.lignes ?? []);
        setSociete(d.societe ?? {});
      })
      .catch(() => setErreur("Chargement impossible"))
      .finally(() => setLoad(false));
  }, []);

  /** Changement de filtre client : repart du dernier ticket de ce client. */
  const changerClient = (v: number) => {
    setCodeCli(v); setIdx(0); setPage(0); setHistorique([]); setLoad(true);
  };

  useEffect(() => {
    charger(undefined, codeCli);
    const qs = codeCli ? `&codeCli=${codeCli}` : "";
    fetch(`/api/tickets?vue=liste${qs}`)
      .then((r) => r.json())
      .then((d) => { setHistorique(d.rows ?? []); setPages(d.pages ?? 1); setTotal(d.total ?? 0); })
      .catch(() => {});
  }, [charger, codeCli]);

  // Les clients du commercial ayant des tickets, pour le filtre.
  useEffect(() => {
    fetch("/api/tickets?vue=clients")
      .then((r) => r.json())
      .then((d) => setClientsTicket(d.rows ?? []))
      .catch(() => {});
  }, []);

  // L'historique se charge par pages de 100 : un commercial en cumule plus de
  // 1 500, et la navigation s'arrêtait au centième ticket.
  const naviguer = async (delta: number) => {
    const suivant = idx + delta;
    if (suivant < 0) return;

    let liste = historique;
    // Fin de la page courante : on va chercher la suivante avant d'avancer.
    if (suivant >= liste.length) {
      const suivante = page + 1;
      if (suivante >= pages) return;
      const d = await fetch(`/api/tickets?vue=liste&page=${suivante}${codeCli ? `&codeCli=${codeCli}` : ""}`)
        .then((r) => r.json())
        .catch(() => null);
      if (!d?.rows?.length) return;
      liste = [...liste, ...d.rows];
      setHistorique(liste);
      setPage(suivante);
    }

    const cible = liste[suivant];
    if (!cible) return;
    setIdx(suivant);
    charger(cible.refDoc, codeCli);
  };

  if (load) {
    return <div className="py-16 text-center text-slate-400"><Loader2 className="animate-spin inline" size={22} /></div>;
  }

  if (erreur || !ticket) {
    return (
      <div className="space-y-4">
        {clientsTicket.length > 0 && (
          <select value={codeCli}
            onChange={(e) => changerClient(Number(e.target.value))}
            className="py-2 px-3 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none max-w-56">
            <option value={0}>Tous les clients</option>
            {clientsTicket.map((c) => (
              <option key={c.codeCli} value={c.codeCli}>{c.raisonSocial} · {c.nb} ticket{c.nb > 1 ? "s" : ""}</option>
            ))}
          </select>
        )}
        <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center">
          <Receipt size={32} className="mx-auto mb-3 text-slate-200" />
          <div className="text-sm text-slate-500">{erreur ?? "Aucun ticket émis pour le moment."}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dernier ticket</h1>
          <p className="text-slate-500 text-sm">
            {historique.length > 0 && `Ticket ${idx + 1} sur ${total || historique.length}`}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          {/* Filtre client : voir le dernier ticket d'un client précis. */}
          <select value={codeCli}
            onChange={(e) => changerClient(Number(e.target.value))}
            className="py-2 px-3 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none max-w-56">
            <option value={0}>Tous les clients</option>
            {clientsTicket.map((c) => (
              <option key={c.codeCli} value={c.codeCli}>{c.raisonSocial} · {c.nb} ticket{c.nb > 1 ? "s" : ""}</option>
            ))}
          </select>
          <button onClick={() => naviguer(1)} disabled={idx + 1 >= (total || historique.length)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-slate-600 disabled:opacity-40 flex items-center gap-1">
            <ChevronLeft size={15} /> Précédent
          </button>
          <button onClick={() => naviguer(-1)} disabled={idx === 0}
            className="px-3 py-2 rounded-xl border border-slate-200 text-slate-600 disabled:opacity-40 flex items-center gap-1">
            Suivant <ChevronRight size={15} />
          </button>
          {/* Ouvre le ticket au format rouleau, identique à celui émis en
              fin de commande depuis le catalogue. */}
          <button onClick={() => setImpression(ticket.refDoc)}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-blue-600 flex items-center gap-2">
            <Printer size={15} /> Imprimer
          </button>
        </div>
      </div>

      {!ticket.valide && (
        <div className="px-4 py-2 rounded-xl bg-amber-50 text-amber-700 text-sm flex items-center gap-2 print:hidden">
          <AlertTriangle size={15} /> Ce document est en brouillon : le stock n&apos;a pas encore été mouvementé.
        </div>
      )}

      {/* Ticket au format impression */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 max-w-md mx-auto text-sm">
        <div className="text-center border-b border-dashed border-slate-300 pb-3 mb-3">
          <div className="font-bold text-base text-slate-800">{societe.nom || "—"}</div>
          {societe.adresse && <div className="text-xs text-slate-500">{societe.adresse}</div>}
          {societe.tel && <div className="text-xs text-slate-500">Tél. {societe.tel}</div>}
          {societe.mf && <div className="text-xs text-slate-500">MF {societe.mf}</div>}
        </div>

        <div className="flex justify-between text-xs mb-1">
          <span className="text-slate-500">Ticket</span>
          <span className="font-mono font-bold">{ticket.refDoc}</span>
        </div>
        <div className="flex justify-between text-xs mb-1">
          <span className="text-slate-500">Date</span>
          <span>{fmtDT(ticket.dateDoc)}</span>
        </div>
        <div className="flex justify-between text-xs mb-1">
          <span className="text-slate-500">Client</span>
          <span className="text-right">{ticket.raisonSocial ?? "—"}</span>
        </div>
        {ticket.utilisateur && (
          <div className="flex justify-between text-xs mb-3">
            <span className="text-slate-500">Vendeur</span><span>{ticket.utilisateur}</span>
          </div>
        )}

        <div className="border-t border-dashed border-slate-300 pt-3">
          {lignes.length === 0 ? (
            <div className="text-xs text-slate-400 text-center py-3">
              Aucune ligne enregistrée sur ce document.
            </div>
          ) : (
            lignes.map((l) => (
              <div key={l.id} className="mb-2">
                <div className="text-xs font-medium text-slate-700">{l.designation}</div>
                <div className="flex justify-between text-xs text-slate-500">
                  <span>{fmtQ(l.qte)}{l.unite ? ` ${l.unite}` : ""} × {fmt(l.puHt)}
                    {l.remise > 0 && ` −${fmtQ(l.remise)}%`}</span>
                  <span className="font-medium text-slate-700">{fmt(l.ttcNet)}</span>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-dashed border-slate-300 pt-3 mt-3 space-y-1">
          <Ligne label="Total HT" val={ticket.thtNet} />
          <Ligne label="TVA" val={ticket.totTva} />
          {ticket.totFodec > 0 && <Ligne label="FODEC" val={ticket.totFodec} />}
          {ticket.timbre > 0 && <Ligne label="Timbre" val={ticket.timbre} />}
          <div className="flex justify-between font-bold text-base pt-1 border-t border-slate-300">
            <span>TOTAL TTC</span><span>{fmt(ticket.ttcNet)}</span>
          </div>
          {ticket.totalRegle > 0 && <Ligne label="Réglé" val={ticket.totalRegle} />}
          {ticket.soldeDoc > 0 && (
            <div className="flex justify-between text-xs font-semibold text-red-600">
              <span>Reste dû</span><span>{fmt(ticket.soldeDoc)}</span>
            </div>
          )}
          {ticket.modePayement && (
            <div className="flex justify-between text-xs text-slate-500">
              <span>Mode</span><span>{ticket.modePayement}</span>
            </div>
          )}
        </div>

        <div className="text-center text-xs text-slate-400 mt-4 pt-3 border-t border-dashed border-slate-300">
          Merci de votre confiance
        </div>
      </div>

      {/* Ticket au format rouleau : même sortie que depuis le catalogue. */}
      {impression && (
        <TicketVente refDoc={impression} onClose={() => setImpression(null)} />
      )}
    </div>
  );
}

function Ligne({ label, val }: { label: string; val: number }) {
  return (
    <div className="flex justify-between text-xs text-slate-600">
      <span>{label}</span><span>{fmt(val)}</span>
    </div>
  );
}
