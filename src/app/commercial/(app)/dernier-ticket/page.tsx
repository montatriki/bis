"use client";
import { useState, useEffect, useCallback } from "react";
import TicketVente from "@/components/commercial/TicketVente";
import TicketCorps, { type LigneTicket, type ReglementTicket, type TicketData } from "@/components/commercial/TicketCorps";
import { Receipt, Printer, Loader2, ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";

// Dernier ticket — tuile « DERNIER TICKET » de l'app commerciale.
// Retrouve et réimprime le dernier ticket édité par le commercial, typiquement
// quand l'impression a échoué ou que le client en redemande un.

type Ticket = TicketData;
type Ligne = LigneTicket;
type Liste = { refDoc: string; typeDoc: string; dateDoc: string | null; raisonSocial: string | null; ttcNet: number };


export default function DernierTicketPage() {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [reglements, setReglements] = useState<ReglementTicket[]>([]);
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
        setReglements(d.reglements ?? []);
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

      {/* Aperçu = le ticket tel qu'il s'imprime (même corps que l'impression). */}
      <div className="bg-white rounded-2xl border border-slate-200 max-w-md mx-auto overflow-hidden">
        <TicketCorps ticket={ticket} lignes={lignes} reglements={reglements} societe={societe} />
      </div>

      {/* Ticket au format rouleau : même sortie que depuis le catalogue. */}
      {impression && (
        <TicketVente refDoc={impression} onClose={() => setImpression(null)} />
      )}
    </div>
  );
}

