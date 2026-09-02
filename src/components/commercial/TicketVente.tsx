"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Printer, X, Loader2 } from "lucide-react";
import TicketCorps from "./TicketCorps";

// Ticket de vente imprimable — copie conforme du ticket de l'application
// mobile d'origine (`bis-dist/src/components/dernier-ticket/dernierTicketPopup.js`) :
//   en-tête société (bloc HTML `entete_page` : le logo),
//   Commercial / N° ticket / Date, libellé du document centré,
//   cadre client (Client, Adresse, MF, RC),
//   tableau ARTICLE 43 % · Qté 9 % · PU TTC 18 % · MT TTC 18 %,
//   ligne « REM : x % » sous chaque article remisé,
//   Montant HT, Taux tva, tva, Net à payer, mode(s) de paiement,
//   cadres de signature « Sig.Commercial » / « Décharge client ».
// L'impression ouvre une fenêtre dédiée avec la même feuille de style que
// l'original : @page et body à 302,3 px (rouleau 80 mm).

type Ligne = {
  id: number; refArt: string | null; designation: string | null;
  unite: string | null; qte: number; puHt: number; tauxTva: number;
  remise: number; ttcNet: number;
};

type Reglement = { id: number; montant: number; modePay: string | null };

type Ticket = {
  refDoc: string; typeDoc: string | null; libDoc: string | null;
  dateDoc: string | null; raisonSocial: string | null; codeCli: number | null;
  adresse: string | null; matriculeF: string | null; registreComClient: string | null;
  commercial: string | null;
  thtNet: number; totTva: number; ttcNet: number; timbre: number;
  totFodec: number; totalRegle: number; soldeDoc: number;
  modePayement: string | null; utilisateur: string | null; valide: boolean;
};

/** `false` au rendu serveur, `true` une fois hydraté. */
const sabonner = () => () => {};
const surClient = () => true;
const surServeur = () => false;

export default function TicketVente(props: { refDoc: string; onClose: () => void }) {
  const monte = useSyncExternalStore(sabonner, surClient, surServeur);
  if (!monte) return null;
  return createPortal(<Contenu {...props} />, document.body);
}

function Contenu({ refDoc, onClose }: { refDoc: string; onClose: () => void }) {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [reglements, setReglements] = useState<Reglement[]>([]);
  const [societe, setSociete] = useState<Record<string, string>>({});
  const [charge, setCharge] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const impressionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let annule = false;
    fetch(`/api/tickets?vue=detail&refDoc=${encodeURIComponent(refDoc)}`)
      .then((r) => r.json())
      .then((d) => {
        if (annule) return;
        if (!d.ticket) { setErreur(d.message ?? d.error ?? "Ticket introuvable"); return; }
        setTicket(d.ticket);
        setLignes(d.lignes ?? []);
        setReglements(d.reglements ?? []);
        setSociete(d.societe ?? {});
      })
      .catch(() => { if (!annule) setErreur("Chargement impossible"); })
      .finally(() => { if (!annule) setCharge(false); });
    return () => { annule = true; };
  }, [refDoc]);

  // Impression : fenêtre dédiée, mêmes règles que l'original.
  const imprimer = () => {
    if (!impressionRef.current) return;
    const contenu = impressionRef.current.innerHTML;
    const fen = window.open("", "_blank");
    if (!fen) return;
    fen.document.write(
      "<html><head><style>@page {width: 302.3px;}body {width: 302.3px;height:400px; padding: 10px;}</style></head><body>",
    );
    fen.document.write(contenu);
    fen.document.write("</body></html>");
    fen.document.close();
    fen.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
      <div className="w-full max-w-md my-6">
        {/* Barre d'actions — jamais imprimée */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="text-white font-bold text-sm">Ticket {refDoc}</div>
          <div className="flex items-center gap-2">
            <button onClick={imprimer} disabled={!ticket}
              className="px-3 py-2 rounded-xl bg-white text-slate-800 text-sm font-semibold flex items-center gap-1.5 disabled:opacity-50">
              <Printer size={15} /> Imprimer
            </button>
            <button onClick={onClose} aria-label="Fermer"
              className="p-2 rounded-xl bg-white/15 text-white hover:bg-white/25">
              <X size={16} />
            </button>
          </div>
        </div>

        {charge && (
          <div className="bg-white rounded-2xl p-10 text-center text-slate-400">
            <Loader2 className="animate-spin inline" size={22} />
          </div>
        )}

        {erreur && !charge && (
          <div className="bg-white rounded-2xl p-6 text-center text-sm text-red-600">{erreur}</div>
        )}

        {ticket && (
          <div className="bg-white rounded-2xl overflow-hidden">
            <TicketCorps ref={impressionRef} ticket={ticket} lignes={lignes} reglements={reglements} societe={societe} />
          </div>
        )}
      </div>
    </div>
  );
}
