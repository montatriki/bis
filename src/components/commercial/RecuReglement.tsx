"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Printer, X, Loader2 } from "lucide-react";

// Reçu de recouvrement — copie conforme du reçu de l'application mobile
// d'origine (`bis-dist/src/pages/stock/recouvrement.js`) : en-tête société
// (bloc HTML `entete_page` : le logo), Commercial / Date, « Recouvrement »
// centré, cadre client (Client, Adresse, MF, RC), « Montant : », lignes
// « Mode de paiement », cadres de signature « Sig.Commercial » /
// « Décharge client ». Impression en fenêtre dédiée à 302,3 px (rouleau 80 mm),
// comme l'original.

export type DonneesRecu = {
  codeCli: number;
  commercial: string;
  /** ISO — affichée au format de l'original. */
  datePay: string;
  montant: number;
  mode: string;
};

const fx3 = (v: unknown) => Number(v ?? 0).toFixed(3);
const fmtDate = (v: string) => {
  const d = new Date(v);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()} T ${p(d.getHours() % 12 || 12)}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

const sabonner = () => () => {};
const surClient = () => true;
const surServeur = () => false;

export default function RecuReglement(props: { donnees: DonneesRecu; onClose: () => void }) {
  const monte = useSyncExternalStore(sabonner, surClient, surServeur);
  if (!monte) return null;
  return createPortal(<Contenu {...props} />, document.body);
}

function Contenu({ donnees, onClose }: { donnees: DonneesRecu; onClose: () => void }) {
  const [client, setClient] = useState<{ raisonSocial: string | null; adresse: string | null; matriculeF: string | null; registreCom: string | null } | null>(null);
  const [societe, setSociete] = useState<Record<string, string>>({});
  const [charge, setCharge] = useState(true);
  const impressionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let annule = false;
    Promise.all([
      fetch(`/api/clients?codeCli=${donnees.codeCli}`).then((r) => r.json()).catch(() => ({})),
      fetch("/api/tickets?vue=societe").then((r) => r.json()).catch(() => ({})),
    ]).then(([c, s]) => {
      if (annule) return;
      setClient(c.client ?? null);
      setSociete(s.societe ?? {});
      setCharge(false);
    });
    return () => { annule = true; };
  }, [donnees.codeCli]);

  const imprimer = () => {
    if (!impressionRef.current) return;
    const fen = window.open("", "_blank");
    if (!fen) return;
    fen.document.write(
      "<html><head><style>@page {width: 302.3px;}body {width: 302.3px;height:400px; padding: 10px;}</style></head><body>",
    );
    fen.document.write(impressionRef.current.innerHTML);
    fen.document.write("</body></html>");
    fen.document.close();
    fen.print();
  };

  const ligne12 = { height: 20, display: "flex", alignItems: "center", fontSize: 12 } as const;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
      <div className="w-full max-w-md my-6">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="text-white font-bold text-sm">Reçu de recouvrement</div>
          <div className="flex items-center gap-2">
            <button onClick={imprimer} disabled={charge}
              className="px-3 py-2 rounded-xl bg-white text-slate-800 text-sm font-semibold flex items-center gap-1.5 disabled:opacity-50">
              <Printer size={15} /> Imprimer
            </button>
            <button onClick={onClose} aria-label="Fermer"
              className="p-2 rounded-xl bg-white/15 text-white hover:bg-white/25">
              <X size={16} />
            </button>
          </div>
        </div>

        {charge ? (
          <div className="bg-white rounded-2xl p-10 text-center text-slate-400">
            <Loader2 className="animate-spin inline" size={22} />
          </div>
        ) : (
          <div className="bg-white rounded-2xl overflow-hidden">
            <div ref={impressionRef} style={{ width: "100%", color: "#000", background: "#fff", paddingTop: 8, paddingBottom: 8 }}>
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

              {[
                ["Commercial:", donnees.commercial],
                ["Date :", fmtDate(donnees.datePay)],
              ].map(([lib, val]) => (
                <div key={lib} style={{ ...ligne12, width: "100%" }}>
                  <div style={{ ...ligne12, width: "20%", paddingLeft: 30 }}>{lib}</div>
                  <div style={{ ...ligne12, width: "40%" }}>
                    <div style={{ display: "flex", alignItems: "center", paddingLeft: 5, width: "100%" }}>{val}</div>
                  </div>
                </div>
              ))}

              <div style={{ ...ligne12, marginTop: 5, justifyContent: "center", marginLeft: 20 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", paddingLeft: 10, paddingRight: 10 }}>
                  <b>Recouvrement</b>
                </div>
              </div>

              <div style={{ border: "1px solid black", marginTop: 5, width: "90%", marginLeft: 25 }}>
                <div style={ligne12}>
                  <div style={{ ...ligne12, width: "20%", paddingLeft: 5 }}>Client :</div>
                  <div style={ligne12}><div style={{ display: "flex", alignItems: "center", width: "100%" }}>{client?.raisonSocial ?? ""}</div></div>
                </div>
                <div style={{ display: "flex", fontSize: 12 }}>
                  <div style={{ display: "flex", width: "20%", paddingLeft: 5, fontSize: 12 }}>Adresse :</div>
                  <div style={{ display: "flex", fontSize: 12, width: "80%" }}>
                    <div style={{ display: "flex", alignItems: "center", width: "100%" }}>{client?.adresse ?? ""}</div>
                  </div>
                </div>
                <div style={ligne12}>
                  <div style={{ ...ligne12, width: "20%", paddingLeft: 5 }}>MF:</div>
                  <div style={ligne12}><div style={{ display: "flex", alignItems: "center", width: "100%" }}>{client?.matriculeF ?? ""}</div></div>
                </div>
                <div style={ligne12}>
                  <div style={{ ...ligne12, width: "20%", paddingLeft: 5 }}>RC:</div>
                  <div style={ligne12}><div style={{ display: "flex", alignItems: "center", width: "100%" }}>{client?.registreCom ?? ""}</div></div>
                </div>
              </div>

              <div style={{ ...ligne12, width: "100%", marginTop: 5 }}>
                <div style={{ ...ligne12, paddingLeft: 10, width: "45%" }} />
                <div style={{ ...ligne12, paddingLeft: 10, width: "25%" }}><div style={{ fontSize: 12, width: "100%" }}>Montant :</div></div>
                <div style={{ ...ligne12, width: "20%" }}><div style={{ textAlign: "right", width: "100%" }}>{fx3(donnees.montant)}</div></div>
              </div>

              <div style={{ ...ligne12, paddingLeft: 30 }}><b>Mode de paiement</b></div>
              <div style={{ ...ligne12, width: "100%" }}>
                <div style={{ ...ligne12, paddingLeft: 30, width: "25%" }}>{donnees.mode}:</div>
                <div style={{ ...ligne12, paddingLeft: 20, width: "17%" }}>
                  <div style={{ width: "100%", textAlign: "right" }}>{fx3(donnees.montant)}</div>
                </div>
              </div>

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

              {societe.pied_page && <div dangerouslySetInnerHTML={{ __html: societe.pied_page }} />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
