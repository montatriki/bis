"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import TicketVente from "@/components/commercial/TicketVente";
import { useClientActif } from "@/lib/client-actif";
import TicketCorps, { type LigneTicket, type ReglementTicket, type TicketData } from "@/components/commercial/TicketCorps";
import { Receipt, Printer, Loader2, ChevronLeft, ChevronRight, AlertTriangle, Search, X } from "lucide-react";

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
  // Client en cours (bandeau) : proposé en tête de la recherche, même s'il n'a
  // pas encore de ticket — c'est le cas le plus fréquent en tournée.
  const { client: clientActif } = useClientActif();
  const router = useRouter();
  const enCours = clientActif ? { codeCli: clientActif.id, raisonSocial: clientActif.raisonSocial, nb: clientsTicket.find((c) => c.codeCli === clientActif.id)?.nb ?? 0 } : null;
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

  const nbTotal = total || historique.length;
  const clientChoisi = enCours && enCours.codeCli === codeCli ? enCours : clientsTicket.find((c) => c.codeCli === codeCli) ?? null;

  // En-tête : titre + compteur, recherche client pleine largeur sur mobile,
  // puis Précédent / Suivant / Imprimer sur une même ligne.
  const entete = (
    <div className="space-y-3 print:hidden">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-800">Dernier ticket</h1>
          <p className="text-slate-500 text-sm truncate">
            {ticket && nbTotal > 0 ? `Ticket ${idx + 1} sur ${nbTotal}` : "Aucun ticket"}
            {clientChoisi ? ` · ${clientChoisi.raisonSocial}` : " · tous les clients"}
          </p>
        </div>
        <FiltreClient clients={clientsTicket} enCours={enCours} valeur={codeCli} onChange={changerClient} />
      </div>
      <div className="grid grid-cols-3 gap-2 sm:flex sm:justify-end">
        <button onClick={() => naviguer(1)} disabled={!ticket || idx + 1 >= nbTotal}
          className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 text-sm disabled:opacity-40 flex items-center justify-center gap-1">
          <ChevronLeft size={15} /> Précédent
        </button>
        <button onClick={() => naviguer(-1)} disabled={!ticket || idx === 0}
          className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 text-sm disabled:opacity-40 flex items-center justify-center gap-1">
          Suivant <ChevronRight size={15} />
        </button>
        {/* Ouvre le ticket au format rouleau, identique à celui émis en
            fin de commande depuis le catalogue. */}
        <button onClick={() => ticket && setImpression(ticket.refDoc)} disabled={!ticket}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 disabled:opacity-40 flex items-center justify-center gap-2">
          <Printer size={15} /> Imprimer
        </button>
      </div>
    </div>
  );

  if (erreur || !ticket) {
    return (
      <div className="space-y-4">
        {entete}
        <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center">
          <Receipt size={32} className="mx-auto mb-3 text-slate-200" />
          <div className="text-sm text-slate-500">
            {erreur ?? (clientChoisi ? `Aucun ticket pour ${clientChoisi.raisonSocial}.` : "Aucun ticket émis pour le moment.")}
          </div>
          {!erreur && clientChoisi && (
            <p className="text-xs text-slate-400 mt-1">Ce client n&apos;a encore aucune vente enregistrée, ni ici ni sur l&apos;ancienne plateforme.</p>
          )}
          {!erreur && clientChoisi && (
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button onClick={() => changerClient(0)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 transition">
                Voir tous les tickets
              </button>
              {enCours && clientChoisi.codeCli === enCours.codeCli && (
                <button onClick={() => router.push("/commercial/catalogue")}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 transition">
                  Commander pour ce client
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {entete}

      {!ticket.valide && (
        <div className="px-4 py-2 rounded-xl bg-amber-50 text-amber-700 text-sm flex items-center gap-2 print:hidden">
          <AlertTriangle size={15} /> Ce document est en brouillon : le stock n&apos;a pas encore été mouvementé.
        </div>
      )}

      {/* Aperçu = le ticket tel qu'il s'imprime (même corps que l'impression). */}
      <div className="bg-white rounded-2xl border border-slate-200 max-w-md mx-auto overflow-x-auto">
        <div className="min-w-[340px]">
          <TicketCorps ticket={ticket} lignes={lignes} reglements={reglements} societe={societe} aere />
        </div>
      </div>

      {/* Ticket au format rouleau : même sortie que depuis le catalogue. */}
      {impression && (
        <TicketVente refDoc={impression} onClose={() => setImpression(null)} />
      )}
    </div>
  );
}

/**
 * Recherche de client : un champ qui filtre au fil de la frappe (nom ou code)
 * et propose les correspondances avec leur nombre de tickets. Un commercial
 * en a plus de 600 : une liste déroulante ne se parcourt pas.
 */
function FiltreClient({ clients, enCours, valeur, onChange }: {
  clients: { codeCli: number; raisonSocial: string; nb: number }[];
  /** Client en cours du bandeau : proposé en tête, même sans ticket. */
  enCours: { codeCli: number; raisonSocial: string; nb: number } | null;
  valeur: number;
  onChange: (codeCli: number) => void;
}) {
  const [texte, setTexte] = useState("");
  const [ouvert, setOuvert] = useState(false);
  const boite = useRef<HTMLDivElement>(null);
  const choisi = (enCours && enCours.codeCli === valeur ? enCours : null) ?? clients.find((c) => c.codeCli === valeur) ?? null;

  useEffect(() => {
    const fermer = (e: MouseEvent) => { if (boite.current && !boite.current.contains(e.target as Node)) setOuvert(false); };
    document.addEventListener("mousedown", fermer);
    return () => document.removeEventListener("mousedown", fermer);
  }, []);

  const norm = (v: string) => v.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const q = norm(texte.trim());
  const autres = clients.filter((c) => c.codeCli !== enCours?.codeCli);
  const resultats = q
    ? autres.filter((c) => norm(c.raisonSocial).includes(q) || String(c.codeCli).includes(q)).slice(0, 30)
    : autres.slice(0, 30);

  const choisirEnCours = () => { if (enCours) { onChange(enCours.codeCli); setTexte(""); setOuvert(false); } };

  return (
    <div ref={boite} className="relative w-full sm:w-80">
      <div className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-xl focus-within:border-blue-400">
        <Search size={14} className="text-slate-400 shrink-0" />
        <input
          value={ouvert ? texte : (choisi ? choisi.raisonSocial : texte)}
          onChange={(e) => { setTexte(e.target.value); setOuvert(true); }}
          onFocus={() => { setTexte(""); setOuvert(true); }}
          placeholder="Rechercher un client (nom, code)…"
          aria-label="Rechercher un client"
          className="flex-1 min-w-0 text-sm bg-transparent outline-none placeholder:text-slate-400" />
        {choisi && (
          <button onClick={() => { onChange(0); setTexte(""); setOuvert(false); }} title="Tous les clients" aria-label="Retirer le filtre client"
            className="p-0.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50"><X size={14} /></button>
        )}
      </div>
      {ouvert && (
        <div className="absolute z-30 mt-1 w-full max-h-72 overflow-auto bg-white border border-slate-200 rounded-xl shadow-xl">
          <button onClick={() => { onChange(0); setTexte(""); setOuvert(false); }}
            className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 ${valeur === 0 ? "font-bold text-blue-700" : "text-slate-700"}`}>
            Tous les clients
          </button>
          {enCours && (
            <button onClick={choisirEnCours}
              className={`w-full flex items-center justify-between gap-2 text-left px-3 py-2 text-sm border-y border-emerald-100 bg-emerald-50/60 hover:bg-emerald-50 ${valeur === enCours.codeCli ? "font-bold text-emerald-800" : "text-emerald-700"}`}>
              <span className="truncate"><span className="text-[10px] font-black uppercase tracking-wider mr-1.5">Client en cours</span>{enCours.raisonSocial}</span>
              <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 shrink-0">{enCours.nb} ticket{enCours.nb > 1 ? "s" : ""}</span>
            </button>
          )}
          {resultats.length === 0 && <div className="px-3 py-3 text-xs text-slate-400">Aucun autre client ne correspond.</div>}
          {resultats.map((c) => (
            <button key={c.codeCli} onClick={() => { onChange(c.codeCli); setTexte(""); setOuvert(false); }}
              className={`w-full flex items-center justify-between gap-2 text-left px-3 py-2 text-sm hover:bg-blue-50 ${c.codeCli === valeur ? "bg-blue-50 font-semibold text-blue-700" : "text-slate-700"}`}>
              <span className="truncate">{c.raisonSocial} <span className="text-[10px] text-slate-400 font-mono">{c.codeCli}</span></span>
              <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 shrink-0">{c.nb} ticket{c.nb > 1 ? "s" : ""}</span>
            </button>
          ))}
          {q && autres.filter((c) => norm(c.raisonSocial).includes(q) || String(c.codeCli).includes(q)).length > 30 && (
            <div className="px-3 py-2 text-[11px] text-slate-400">Affinez la recherche pour voir les autres résultats.</div>
          )}
        </div>
      )}
    </div>
  );
}
