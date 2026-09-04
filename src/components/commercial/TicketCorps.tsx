"use client";
import { forwardRef } from "react";

// Corps du ticket de vente — copie conforme du ticket de l'application mobile
// d'origine. Partagé entre l'impression (TicketVente) et l'aperçu de l'écran
// « Dernier ticket », pour que ce que l'on voit soit ce que l'on imprime.

export type LigneTicket = {
  id: number; refArt: string | null; designation: string | null;
  unite: string | null; qte: number; puHt: number; tauxTva: number;
  remise: number; ttcNet: number;
};
export type ReglementTicket = { id: number; montant: number; modePay: string | null };
export type TicketData = {
  refDoc: string; typeDoc: string | null; libDoc?: string | null;
  dateDoc: string | null; raisonSocial: string | null;
  adresse?: string | null; matriculeF?: string | null; registreComClient?: string | null;
  commercial?: string | null; utilisateur?: string | null;
  thtNet: number; totTva: number; ttcNet: number; valide?: boolean;
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

const TicketCorps = forwardRef<HTMLDivElement, {
  ticket: TicketData; lignes: LigneTicket[]; reglements: ReglementTicket[]; societe: Record<string, string>;
  /** Aperçu à l'écran : colonnes de libellés élargies (le gabarit rouleau colle « Commercial: » au nom). L'impression reste au gabarit exact. */
  aere?: boolean;
}>(function TicketCorps({ ticket, lignes, reglements, societe, aere = false }, ref) {
  // Taux affiché comme sur l'original (« Taux tva : 19% ») : le taux des
  // lignes quand il est uniforme, 19 sinon.
  const taux = (() => {
    const t = [...new Set(lignes.map((l) => l.tauxTva).filter((v) => v > 0))];
    return t.length === 1 ? t[0] : 19;
  })();

  /** PU TTC de la ligne, remise déduite — la colonne du ticket d'origine. */
  const puTtc = (l: LigneTicket) => {
    const brut = l.puHt * (1 + (l.tauxTva ?? 0) / 100);
    return brut - (brut * (l.remise ?? 0)) / 100;
  };

  const ligne12 = { height: 20, display: "flex", alignItems: "center", fontSize: 12 } as const;

  return (
            <div ref={ref} style={{ width: "100%", color: "#000", background: "#fff", paddingTop: 8, paddingBottom: 8 }}>
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
                  <div style={{ ...ligne12, width: aere ? "32%" : "20%", minWidth: aere ? 92 : undefined, paddingLeft: aere ? 12 : 30, whiteSpace: "nowrap" }}>{lib}</div>
                  <div style={{ ...ligne12, width: aere ? "68%" : "40%" }}>
                    <div style={{ display: "flex", alignItems: "center", paddingLeft: 5, width: "100%", whiteSpace: "nowrap" }}>{val}</div>
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
  );
});

export default TicketCorps;
