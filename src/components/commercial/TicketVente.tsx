"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Printer, X, Loader2 } from "lucide-react";

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

const fx3 = (v: unknown) => Number(v ?? 0).toFixed(3);

/** Date du ticket, au format exact de l'original : `dd-MM-yyyy 'T' hh:mm:ss`. */
const fmtDate = (v: unknown) => {
  if (!v) return "";
  const d = new Date(String(v));
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()} T ${p(d.getHours() % 12 || 12)}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

/** Libellé lisible d'un type de document de vente. */
function libelleType(type?: string | null) {
  const t = String(type ?? "").toUpperCase();
  return ({
    TIC: "Ticket caisse", BL: "Bon de livraison", FAC: "Facture", FC: "Facture",
    COM: "Bon de commande", DEV: "Devis", BR: "Bon de retour", AV: "Avoir",
  } as Record<string, string>)[t] || "Ticket caisse";
}

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

  // Taux affiché comme sur l'original (« Taux tva : 19% ») : le taux des
  // lignes quand il est uniforme, 19 sinon.
  const taux = (() => {
    const t = [...new Set(lignes.map((l) => l.tauxTva).filter((v) => v > 0))];
    return t.length === 1 ? t[0] : 19;
  })();

  /** PU TTC de la ligne, remise déduite — la colonne du ticket d'origine. */
  const puTtc = (l: Ligne) => {
    const brut = l.puHt * (1 + (l.tauxTva ?? 0) / 100);
    return brut - (brut * (l.remise ?? 0)) / 100;
  };

  const ligne12 = { height: 20, display: "flex", alignItems: "center", fontSize: 12 } as const;

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
            <div ref={impressionRef} style={{ width: "100%", color: "#000", background: "#fff", paddingTop: 8, paddingBottom: 8 }}>
              {/* En-tête société : le bloc HTML de la fiche société (logo). */}
              {societe.entete_page ? (
                <div style={{ display: "flex", width: "100%", alignItems: "center", fontSize: 12 }}>
                  <div style={{ width: "89%", marginLeft: 30 }}
                    dangerouslySetInnerHTML={{ __html: societe.entete_page }} />
                </div>
              ) : (
                <div style={{ textAlign: "center", fontSize: 12 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{societe.nom || ""}</div>
                  {societe.adresse && <div>{societe.adresse}</div>}
                  {societe.mf && <div>MF : {societe.mf}</div>}
                </div>
              )}

              {/* Commercial / N° ticket / Date — colonnes 20 % / 40 % de l'original. */}
              {[
                ["Commercial:", ticket.commercial ?? ticket.utilisateur ?? ""],
                ["N° ticket :", ticket.refDoc],
                ["Date :", fmtDate(ticket.dateDoc)],
              ].map(([lib, val]) => (
                <div key={lib} style={{ ...ligne12, width: "100%" }}>
                  <div style={{ ...ligne12, width: "20%", paddingLeft: 30 }}>{lib}</div>
                  <div style={{ ...ligne12, width: "40%" }}>
                    <div style={{ display: "flex", alignItems: "center", paddingLeft: 5, width: "100%" }}>{val}</div>
                  </div>
                </div>
              ))}

              {/* Libellé du document, centré. */}
              <div style={{ ...ligne12, marginTop: 5, justifyContent: "center", marginLeft: 20 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", paddingLeft: 10, paddingRight: 10 }}>
                  <b>{ticket.libDoc || libelleType(ticket.typeDoc)}</b>
                </div>
              </div>

              {/* Cadre client. */}
              <div style={{ border: "1px solid black", marginTop: 5, width: "90%", marginLeft: 25 }}>
                <div style={ligne12}>
                  <div style={{ ...ligne12, width: "20%", paddingLeft: 5 }}>Client :</div>
                  <div style={ligne12}><div style={{ display: "flex", alignItems: "center", width: "100%" }}>{ticket.raisonSocial ?? ""}</div></div>
                </div>
                <div style={{ display: "flex", fontSize: 12 }}>
                  <div style={{ display: "flex", width: "20%", paddingLeft: 5, fontSize: 12 }}>Adresse :</div>
                  <div style={{ display: "flex", fontSize: 12, width: "80%" }}>
                    <div style={{ display: "flex", alignItems: "center", width: "100%" }}>{ticket.adresse ?? ""}</div>
                  </div>
                </div>
                <div style={ligne12}>
                  <div style={{ ...ligne12, width: "20%", paddingLeft: 5 }}>MF:</div>
                  <div style={ligne12}><div style={{ display: "flex", alignItems: "center", width: "100%" }}>{ticket.matriculeF ?? ""}</div></div>
                </div>
                <div style={ligne12}>
                  <div style={{ ...ligne12, width: "20%", paddingLeft: 5 }}>RC:</div>
                  <div style={ligne12}><div style={{ display: "flex", alignItems: "center", width: "100%" }}>{ticket.registreComClient ?? ""}</div></div>
                </div>
              </div>

              {/* Articles. */}
              <div style={{ marginTop: 10, fontSize: 12 }}>
                <div style={{ ...ligne12, width: "100%" }}>
                  <div style={{ ...ligne12, width: "43%", paddingLeft: 30 }}><b>ARTICLE</b></div>
                  <div style={{ ...ligne12, width: "9%" }}><div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%" }}><b>Qté</b></div></div>
                  <div style={{ ...ligne12, width: "18%" }}><div style={{ textAlign: "center", width: "100%" }}><b>PU TTC</b></div></div>
                  <div style={{ ...ligne12, width: "18%" }}><div style={{ textAlign: "right", width: "100%" }}><b>MT TTC</b></div></div>
                </div>
                {lignes.map((l) => (
                  <div key={l.id}>
                    <div style={{ display: "flex", width: "100%", marginTop: 2, fontSize: 12 }}>
                      <div style={{ display: "flex", width: "43%", alignItems: "center", paddingLeft: 30, fontSize: 12 }}>{l.designation ?? l.refArt ?? ""}</div>
                      <div style={{ display: "flex", width: "9%", fontSize: 12 }}><div style={{ display: "flex", justifyContent: "center", width: "100%" }}>{l.qte}</div></div>
                      <div style={{ display: "flex", width: "18%", fontSize: 12 }}><div style={{ textAlign: "center", width: "100%" }}>{fx3(puTtc(l))}</div></div>
                      <div style={{ display: "flex", width: "18%", fontSize: 12 }}><div style={{ textAlign: "right", width: "100%" }}>{fx3(l.ttcNet)}</div></div>
                    </div>
                    {l.remise > 0 && (
                      <div style={{ ...ligne12, width: "100%" }}>
                        <div style={{ textAlign: "center", width: "52%", paddingLeft: 30 }} />
                        <div style={{ textAlign: "center", width: "18%" }}><b>REM :</b></div>
                        <div style={{ textAlign: "right", width: "18%" }}>{l.remise} %</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Filet puis totaux — colonnes 45 % / 25 % / 20 % de l'original. */}
              <div style={{ height: 20, display: "flex", width: "96%", alignItems: "center" }}>
                <div style={{ height: 1, display: "flex", borderTop: "1px solid black", alignItems: "center", marginLeft: 20, width: "100%" }} />
              </div>
              {[
                ["Montant HT :", fx3(ticket.thtNet)],
                ["Taux tva :", `${taux}%`],
                ["tva :", fx3(ticket.totTva)],
                ["Net à payer :", fx3(ticket.ttcNet)],
              ].map(([lib, val]) => (
                <div key={lib} style={{ ...ligne12, width: "100%" }}>
                  <div style={{ ...ligne12, paddingLeft: 10, width: "45%" }} />
                  <div style={{ ...ligne12, paddingLeft: 10, width: "25%" }}><div style={{ fontSize: 12, width: "100%" }}>{lib}</div></div>
                  <div style={{ ...ligne12, width: "20%" }}><div style={{ textAlign: "right", width: "100%" }}>{val}</div></div>
                </div>
              ))}

              {/* Règlements. */}
              {reglements.length > 0 && (
                <div style={{ ...ligne12, paddingLeft: 30 }}><b>Mode de paiement</b></div>
              )}
              {reglements.map((r) => (
                <div key={r.id} style={{ ...ligne12, width: "100%" }}>
                  <div style={{ ...ligne12, paddingLeft: 30, width: "25%" }}>{r.modePay}:</div>
                  <div style={{ ...ligne12, paddingLeft: 20, width: "17%" }}>
                    <div style={{ width: "100%", textAlign: "right" }}>{fx3(r.montant)}</div>
                  </div>
                </div>
              ))}

              {/* Signatures. */}
              <div style={{ marginTop: 5, width: "90%", marginLeft: 25, height: 80, display: "flex" }}>
                <div style={{ height: 80, width: "50%", border: "1px solid black", fontSize: 12 }}>
                  <div style={{ height: 20, display: "flex", width: "100%", alignItems: "center", justifyContent: "center", borderBottom: "1px solid black", fontSize: 12 }}>
                    Sig.Commercial
                  </div>
                  <div style={{ height: 40 }} />
                </div>
                <div style={{ height: 80, width: "50%", borderRight: "1px solid black", borderTop: "1px solid black", borderBottom: "1px solid black", fontSize: 12 }}>
                  <div style={{ height: 20, display: "flex", width: "100%", alignItems: "center", justifyContent: "center", borderBottom: "1px solid black", fontSize: 12 }}>
                    Décharge client
                  </div>
                  <div style={{ height: 60 }} />
                </div>
              </div>

              {/* Pied société éventuel. */}
              {societe.pied_page && <div dangerouslySetInnerHTML={{ __html: societe.pied_page }} />}

              {!ticket.valide && (
                <div style={{ marginTop: 8, fontSize: 11, fontWeight: 700, textAlign: "center" }}>
                  *** DOCUMENT EN BROUILLON — STOCK NON MOUVEMENTÉ ***
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
