"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Printer, X, Loader2 } from "lucide-react";
import { montantEnLettres } from "@/lib/traite-montant";

// Ticket de vente imprimable — reprend la structure du ticket de l'ERP d'origine
// (`impressions/vente/ticket/ticket.js`) :
//   en-tête société (raison sociale, adresse, tél, MF, registre de commerce),
//   références du document, tableau ARTICLE / Qté / PU TTC / MT TTC,
//   puis Montant HT, Taux TVA, Net à payer et le montant en toutes lettres.
//
// L'impression sort sur rouleau 80 mm (imprimante ticket) : c'est le format
// utilisé en tournée, et non l'A4 des factures.

type Ligne = {
  id: number; refArt: string | null; designation: string | null;
  unite: string | null; qte: number; puHt: number; tauxTva: number;
  remise: number; ttcNet: number;
};

type Ticket = {
  refDoc: string; typeDoc: string | null; libDoc: string | null;
  dateDoc: string | null; raisonSocial: string | null; codeCli: number | null;
  adresse: string | null; matriculeF: string | null;
  thtNet: number; totTva: number; ttcNet: number; timbre: number;
  totFodec: number; totalRegle: number; soldeDoc: number;
  modePayement: string | null; utilisateur: string | null; valide: boolean;
};

const fmt = (v: unknown) =>
  Number(v ?? 0).toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

/** Quantités : entier quand c'est rond, sinon 3 décimales comme l'ERP. */
const fmtQte = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isInteger(n) ? String(n) : n.toLocaleString("fr-FR", { maximumFractionDigits: 3 });
};

const fmtDate = (v: unknown) =>
  v
    ? new Date(String(v)).toLocaleString("fr-FR", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      })
    : "—";

/** `false` au rendu serveur, `true` une fois hydraté. */
const sabonner = () => () => {};
const surClient = () => true;
const surServeur = () => false;

export default function TicketVente(props: { refDoc: string; onClose: () => void }) {
  // Le ticket est greffé sur <body> : les règles d'impression masquent les
  // enfants directs de <body>, un calque imbriqué dans la page serait emporté.
  const monte = useSyncExternalStore(sabonner, surClient, surServeur);
  if (!monte) return null;
  return createPortal(<Contenu {...props} />, document.body);
}

function Contenu({ refDoc, onClose }: { refDoc: string; onClose: () => void }) {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [societe, setSociete] = useState<Record<string, string>>({});
  const [charge, setCharge] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const imprimeRef = useRef(false);

  useEffect(() => {
    let annule = false;
    fetch(`/api/tickets?vue=detail&refDoc=${encodeURIComponent(refDoc)}`)
      .then((r) => r.json())
      .then((d) => {
        if (annule) return;
        if (!d.ticket) { setErreur(d.message ?? d.error ?? "Ticket introuvable"); return; }
        setTicket(d.ticket);
        setLignes(d.lignes ?? []);
        setSociete(d.societe ?? {});
      })
      .catch(() => { if (!annule) setErreur("Chargement impossible"); })
      .finally(() => { if (!annule) setCharge(false); });
    return () => { annule = true; };
  }, [refDoc]);

  // Nettoie la classe d'impression si la fenêtre est fermée pendant le dialogue.
  useEffect(() => {
    const apres = () => document.body.classList.remove("impression-ticket");
    window.addEventListener("afterprint", apres);
    return () => { window.removeEventListener("afterprint", apres); apres(); };
  }, []);

  const imprimer = () => {
    if (imprimeRef.current) return;
    imprimeRef.current = true;
    document.body.classList.add("impression-ticket");
    // Laisse le navigateur peindre avant d'ouvrir le dialogue d'impression.
    requestAnimationFrame(() => {
      window.print();
      imprimeRef.current = false;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 print:bg-white print:p-0">
      <div className="w-full max-w-sm my-6 print:my-0 print:max-w-none">
        {/* Barre d'actions — jamais imprimée */}
        <div className="flex items-center justify-between gap-2 mb-3 print:hidden">
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
          <div className="bg-white rounded-2xl p-6 text-center text-sm text-red-600 print:hidden">{erreur}</div>
        )}

        {ticket && (
          <div id="ticket-impression"
            className="bg-white rounded-2xl p-5 text-[13px] text-slate-900 print:rounded-none print:p-2"
            style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>

            {/* En-tête société */}
            <div className="text-center pb-2 mb-2 border-b border-dashed border-slate-400">
              <div className="font-bold text-[15px] uppercase">{societe.nom || "—"}</div>
              {societe.adresse && <div className="text-[11px]">{societe.adresse}</div>}
              {societe.tel && <div className="text-[11px]">Tél. {societe.tel}</div>}
              {societe.mf && <div className="text-[11px]">MF : {societe.mf}</div>}
              {societe.registreCom && <div className="text-[11px]">RC : {societe.registreCom}</div>}
            </div>

            {/* Références du document */}
            <div className="text-[11px] mb-2 space-y-0.5">
              <Info label={ticket.libDoc || libelleType(ticket.typeDoc)} valeur={ticket.refDoc} gras />
              <Info label="Date" valeur={fmtDate(ticket.dateDoc)} />
              <Info label="Client" valeur={ticket.raisonSocial ?? "—"} />
              {ticket.matriculeF && <Info label="MF client" valeur={ticket.matriculeF} />}
              {ticket.utilisateur && <Info label="Vendeur" valeur={ticket.utilisateur} />}
            </div>

            {/* Tableau des articles : colonnes de l'ERP d'origine. */}
            <table className="w-full border-t border-b border-slate-400 my-2 text-[11px]">
              <thead>
                <tr className="border-b border-slate-400">
                  <th className="text-left font-bold py-1 w-[43%]">ARTICLE</th>
                  <th className="text-center font-bold py-1 w-[13%]">Qté</th>
                  <th className="text-right font-bold py-1 w-[22%]">PU TTC</th>
                  <th className="text-right font-bold py-1 w-[22%]">MT TTC</th>
                </tr>
              </thead>
              <tbody>
                {lignes.length === 0 && (
                  <tr><td colSpan={4} className="py-3 text-center text-slate-400">
                    Aucune ligne sur ce document.
                  </td></tr>
                )}
                {lignes.map((l) => {
                  // Le ticket raisonne en TTC : l'ERP affiche le prix payé,
                  // TVA comprise, pas le HT du tarif.
                  const puTtc = l.puHt * (1 + (l.tauxTva ?? 0) / 100);
                  return (
                    <tr key={l.id} className="align-top">
                      <td className="py-0.5 pr-1">
                        {l.designation ?? l.refArt ?? "—"}
                        {l.remise > 0 && (
                          <span className="block text-[10px] text-slate-500">Remise {fmtQte(l.remise)} %</span>
                        )}
                      </td>
                      <td className="py-0.5 text-center">{fmtQte(l.qte)}</td>
                      <td className="py-0.5 text-right">{fmt(puTtc)}</td>
                      <td className="py-0.5 text-right font-semibold">{fmt(l.ttcNet)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Totaux, dans l'ordre du ticket d'origine. */}
            <div className="space-y-0.5 text-[12px]">
              <Total label="Montant HT" valeur={ticket.thtNet} />
              <Total label="Taux tva" valeur={ticket.totTva} />
              {ticket.totFodec > 0 && <Total label="Fodec" valeur={ticket.totFodec} />}
              {ticket.timbre > 0 && <Total label="Timbre" valeur={ticket.timbre} />}
              <div className="flex justify-between font-bold text-[14px] pt-1 mt-1 border-t border-slate-400">
                <span>Net à payer :</span><span>{fmt(ticket.ttcNet)}</span>
              </div>
              {ticket.totalRegle > 0 && <Total label="Réglé" valeur={ticket.totalRegle} />}
              {ticket.soldeDoc > 0 && (
                <div className="flex justify-between font-semibold">
                  <span>Reste dû</span><span>{fmt(ticket.soldeDoc)}</span>
                </div>
              )}
              {ticket.modePayement && (
                <div className="flex justify-between text-[11px]">
                  <span>Mode de paiement</span><span>{ticket.modePayement}</span>
                </div>
              )}
            </div>

            {/* Montant en toutes lettres — « arrêté le présent ticket ». */}
            <div className="mt-2 pt-2 border-t border-dashed border-slate-400 text-[11px] italic">
              Arrêté le présent {libelleType(ticket.typeDoc).toLowerCase()} à la somme de :{" "}
              <span className="font-semibold not-italic">{montantEnLettres(ticket.ttcNet)}</span>.
            </div>

            {!ticket.valide && (
              <div className="mt-2 text-[11px] font-bold text-center">
                *** DOCUMENT EN BROUILLON — STOCK NON MOUVEMENTÉ ***
              </div>
            )}

            <div className="mt-3 pt-2 border-t border-dashed border-slate-400 text-center text-[11px]">
              Merci de votre confiance
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Libellé lisible d'un type de document de vente. */
function libelleType(type?: string | null) {
  const t = String(type ?? "").toUpperCase();
  return ({
    TIC: "Ticket", BL: "Bon de livraison", FAC: "Facture", FC: "Facture",
    COM: "Bon de commande", DEV: "Devis", BR: "Bon de retour", AV: "Avoir",
  } as Record<string, string>)[t] || "Ticket";
}

function Info({ label, valeur, gras }: { label: string; valeur: string; gras?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-slate-600">{label}</span>
      <span className={`text-right ${gras ? "font-bold font-mono" : ""}`}>{valeur}</span>
    </div>
  );
}

function Total({ label, valeur }: { label: string; valeur: number }) {
  return (
    <div className="flex justify-between">
      <span>{label} :</span><span>{fmt(valeur)}</span>
    </div>
  );
}
