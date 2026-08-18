"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Truck, Package, CheckCircle, Clock, MapPin, Loader2, FileText, User } from "lucide-react";

// Suivi des livraisons — documents réels du client connecté.
//
// Cette page affichait une commande entièrement inventée (« BC-2026-0042 »,
// articles et téléphone fictifs) sans jamais interroger la base. Elle lit
// désormais `/api/espace-client?vue=suivi`, limité au tiers de la session.

type Etape = { label: string; date: string; fait: boolean };
type Ligne = { refArt: string; designation: string; qte: number; puHt: number; ttcNet: number };
type Commande = {
  refDoc: string; typeDoc: string; dateDoc: string | null;
  ttcNet: number; soldeDoc: number; totalRegle: number; valide: boolean;
  commercial: string | null; vehicule: string | null;
  etapes: Etape[]; lignes: Ligne[];
};
type Suivi = {
  client: { raisonSocial: string; adresse: string | null; ville: string | null; tel: string | null };
  commandes: Commande[]; total: number;
};

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(n ?? 0);
const fmtDate = (v: string | null) => (v ? new Date(v).toLocaleDateString("fr-FR") : "—");

/** Libellé lisible du type de document. */
const TYPE_LABEL: Record<string, string> = {
  COM: "Bon de commande", BL: "Bon de livraison", TIC: "Bon de livraison",
  FC: "Facture", FAC: "Facture",
};

export default function SuiviPage() {
  const [data, setData] = useState<Suivi | null>(null);
  const [loading, setLoading] = useState(true);
  const [ouvert, setOuvert] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/espace-client?vue=suivi")
      .then((r) => r.json())
      .then((d) => setData(d.error ? null : d))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="py-24 text-center text-slate-400">
        <Loader2 className="animate-spin mx-auto mb-3" size={26} /> Chargement de vos livraisons…
      </div>
    );
  }

  if (!data || data.commandes.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Suivi des livraisons</h1>
          <p className="text-slate-500 text-sm">Vos commandes et livraisons en cours</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center text-slate-400">
          <Package size={34} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Aucune commande en cours.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Suivi des livraisons</h1>
          <p className="text-slate-500 text-sm">
            {data.total} commande(s) — {data.client.raisonSocial}
          </p>
        </div>
        {(data.client.adresse || data.client.ville) && (
          <div className="bg-white border border-slate-100 rounded-xl px-4 py-2 text-sm text-slate-600 flex items-center gap-2">
            <MapPin size={13} className="text-slate-400" />
            {[data.client.adresse, data.client.ville].filter(Boolean).join(", ")}
          </div>
        )}
      </div>

      <div className="space-y-4">
        {data.commandes.map((c, i) => {
          const faites = c.etapes.filter((e) => e.fait).length;
          const progression = (faites / c.etapes.length) * 100;
          const estOuvert = ouvert === c.refDoc;
          const solde = c.soldeDoc > 0;

          return (
            <motion.div key={c.refDoc}
              className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.05, 0.3) }}>

              <button onClick={() => setOuvert(estOuvert ? null : c.refDoc)}
                className="w-full text-left p-5 hover:bg-slate-50/60 transition">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-800">{c.refDoc}</span>
                      <span className="text-[10px] font-bold uppercase bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                        {TYPE_LABEL[c.typeDoc] ?? c.typeDoc}
                      </span>
                      {solde ? (
                        <span className="text-[10px] font-bold uppercase bg-amber-100 text-amber-700 px-2 py-0.5 rounded">
                          Reste {fmt(c.soldeDoc)} TND
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold uppercase bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">
                          Soldée
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-1 flex items-center gap-3 flex-wrap">
                      <span className="flex items-center gap-1"><Clock size={11} /> {fmtDate(c.dateDoc)}</span>
                      {c.commercial && <span className="flex items-center gap-1"><User size={11} /> {c.commercial}</span>}
                      {c.vehicule && <span className="flex items-center gap-1"><Truck size={11} /> {c.vehicule}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-bold text-slate-800">{fmt(c.ttcNet)} TND</div>
                    <div className="text-xs text-slate-400">{faites}/{c.etapes.length} étapes</div>
                  </div>
                </div>

                <div className="mt-3 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div className="h-full bg-emerald-500 rounded-full"
                    initial={{ width: 0 }} animate={{ width: `${progression}%` }}
                    transition={{ duration: 0.7 }} />
                </div>
              </button>

              {estOuvert && (
                <div className="px-5 pb-5 border-t border-slate-100 pt-4 space-y-4">
                  {/* Jalons de la commande */}
                  <div className="space-y-2.5">
                    {c.etapes.map((e) => (
                      <div key={e.label} className="flex items-center gap-3">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                          e.fait ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-300"}`}>
                          {e.fait ? <CheckCircle size={13} /> : <Clock size={12} />}
                        </div>
                        <span className={`text-sm flex-1 ${e.fait ? "text-slate-800 font-medium" : "text-slate-400"}`}>
                          {e.label}
                        </span>
                        <span className="text-xs text-slate-400">{e.date}</span>
                      </div>
                    ))}
                  </div>

                  {/* Détail des articles, quand les lignes sont disponibles */}
                  {c.lignes.length > 0 ? (
                    <div className="bg-slate-50 rounded-xl p-3">
                      <div className="text-[10px] font-bold uppercase text-slate-500 mb-2">Articles</div>
                      <div className="space-y-1.5">
                        {c.lignes.map((l) => (
                          <div key={l.refArt} className="flex items-center justify-between text-xs">
                            <span className="text-slate-700 truncate">{l.designation || l.refArt}</span>
                            <span className="text-slate-500 shrink-0 ml-3">
                              × {l.qte} · {fmt(l.ttcNet)} TND
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 flex items-center gap-1.5">
                      <FileText size={12} /> Détail des articles non disponible pour ce document.
                    </div>
                  )}

                  <div className="flex justify-between text-sm pt-2 border-t border-slate-100">
                    <span className="text-slate-500">Déjà réglé</span>
                    <span className="font-semibold text-slate-800">{fmt(c.totalRegle)} TND</span>
                  </div>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
