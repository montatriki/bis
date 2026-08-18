"use client";
import { useCallback, useEffect, useState } from "react";
import { X, Loader2, ChevronRight, ArrowLeft, Users } from "lucide-react";

// Détail des créances clients — fenêtre ouverte depuis la carte
// « Créances clients » du tableau de bord.
//
// Quatre lectures : l'ancienneté (ce qui décide de l'action de recouvrement),
// le commercial, le client, et la trésorerie encaissée. Un clic sur une ligne
// descend aux documents qui la composent.

type Groupe = { cle: string; libelle: string; nb: number; montant: number; sens?: string };
type Doc = { refDoc: string; typeDoc: string | null; dateDoc: string | null; libelle: string; montant: number; jours: number | null };
type Mois = { libelle: string; encaisse: number; decaisse: number; montant: number };
type Reponse = {
  axe: string; niveau: "groupes" | "documents"; cible?: string;
  rows: (Groupe | Doc)[]; mois?: Mois[];
  totaux: { nb: number; montant: number; encaisse?: number; decaisse?: number };
};

const fmt = (v: unknown) => new Intl.NumberFormat("fr-TN", { maximumFractionDigits: 0 }).format(Number(v) || 0);
const fmtD = (v: unknown) => (v ? new Date(String(v)).toLocaleDateString("fr-FR") : "—");

const AXES = [
  { v: "anciennete", l: "Par ancienneté" },
  { v: "commercial", l: "Par commercial" },
  { v: "client", l: "Par client" },
  { v: "tresorerie", l: "Trésorerie" },
] as const;

const MOIS = ["janv.","févr.","mars","avr.","mai","juin","juil.","août","sept.","oct.","nov.","déc."];
const libMois = (s: string) => {
  const m = /^(\d{4})-(\d{2})$/.exec(s);
  return m ? `${MOIS[Number(m[2]) - 1]} ${m[1].slice(2)}` : s;
};

/** Couleur d'une tranche d'ancienneté : plus c'est vieux, plus c'est rouge. */
const TON: Record<string, string> = {
  "0-30": "bg-emerald-500",
  "31-60": "bg-lime-500",
  "61-90": "bg-amber-500",
  "91-180": "bg-orange-500",
  "180+": "bg-red-600",
};

export default function DetailCreances({ accent, onClose }: { accent: string; onClose: () => void }) {
  const [axe, setAxe] = useState<string>("anciennete");
  const [cible, setCible] = useState<string | null>(null);
  const [data, setData] = useState<Reponse | null>(null);
  const [load, setLoad] = useState(true);

  const charger = useCallback((a: string, c: string | null) => {
    const qs = new URLSearchParams({ axe: a });
    if (c) qs.set("cible", c);
    fetch(`/api/creances?${qs}`)
      .then((r) => r.json())
      .then((d) => { setData(d.error ? null : d); setLoad(false); })
      .catch(() => setLoad(false));
  }, []);

  useEffect(() => { charger(axe, cible); }, [axe, cible, charger]);

  const rows = data?.rows ?? [];
  const enDocs = data?.niveau === "documents";
  const totalPeriode = data?.totaux.montant ?? 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm flex items-center justify-center p-4"
         onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[88vh] flex flex-col"
           onClick={(e) => e.stopPropagation()}>

        <header className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
          {enDocs && (
            <button onClick={() => setCible(null)}
              className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition">
              <ArrowLeft size={15} />
            </button>
          )}
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0"
               style={{ background: accent }}>
            <Users size={17} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-extrabold text-sm text-slate-800 truncate">
              {enDocs ? `Détail — ${data?.cible}` : "Créances clients"}
            </div>
            <div className="text-xs text-slate-500">
              {axe === "tresorerie"
                ? "Encaissements et décaissements enregistrés"
                : "Documents de vente non soldés"}
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 transition">
            <X size={15} />
          </button>
        </header>

        {!enDocs && (
          <div className="px-5 py-3 border-b border-slate-100 flex gap-1.5 flex-wrap">
            {AXES.map((a) => (
              <button key={a.v} onClick={() => { setLoad(true); setAxe(a.v); setCible(null); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  axe === a.v ? "text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
                style={axe === a.v ? { background: accent } : undefined}>
                {a.l}
              </button>
            ))}
          </div>
        )}

        {/* Totaux : le chiffre que porte la carte, décomposé. */}
        <div className="px-5 py-3 border-b border-slate-100 flex gap-6 flex-wrap">
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              {axe === "tresorerie" ? "Solde" : "Total dû"}
            </div>
            <div className={`text-lg font-extrabold tabular-nums ${totalPeriode < 0 ? "text-red-600" : "text-slate-800"}`}>
              {fmt(totalPeriode)} TND
            </div>
          </div>
          {axe === "tresorerie" ? (
            <>
              <div>
                <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Encaissé</div>
                <div className="text-lg font-extrabold tabular-nums text-emerald-600">
                  {fmt(data?.totaux.encaisse)} TND
                </div>
              </div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Décaissé</div>
                <div className="text-lg font-extrabold tabular-nums text-red-600">
                  {fmt(data?.totaux.decaisse)} TND
                </div>
              </div>
            </>
          ) : (
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Pièces</div>
              <div className="text-lg font-extrabold tabular-nums text-slate-800">{fmt(data?.totaux.nb)}</div>
            </div>
          )}
        </div>

        <div className="overflow-auto flex-1">
          {load ? (
            <div className="py-16 flex justify-center"><Loader2 className="animate-spin text-slate-300" /></div>
          ) : rows.length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-500">Aucune donnée</div>
          ) : enDocs ? (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 sticky top-0">
                <tr>
                  <th className="px-4 py-2.5 text-left font-bold">Document</th>
                  <th className="px-4 py-2.5 text-left font-bold">Client</th>
                  <th className="px-4 py-2.5 text-left font-bold">Date</th>
                  <th className="px-4 py-2.5 text-right font-bold">Retard</th>
                  <th className="px-4 py-2.5 text-right font-bold">Solde dû</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(rows as Doc[]).map((d) => (
                  <tr key={d.refDoc}>
                    <td className="px-4 py-2.5 font-semibold text-slate-700">
                      {d.refDoc}
                      <span className="ml-1.5 text-[10px] text-slate-400">{d.typeDoc}</span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 truncate max-w-[220px]">{d.libelle}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">{fmtD(d.dateDoc)}</td>
                    <td className="px-4 py-2.5 text-right text-xs font-bold text-slate-600">
                      {d.jours != null ? `${d.jours} j` : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold tabular-nums text-red-600">{fmt(d.montant)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <ul className="divide-y divide-slate-50">
              {(rows as Groupe[]).map((g) => {
                const part = totalPeriode > 0 ? (g.montant / totalPeriode) * 100 : 0;
                return (
                  <li key={g.cle ?? g.libelle}>
                    <button
                      onClick={() => { if (axe !== "tresorerie") { setLoad(true); setCible(g.cle); } }}
                      disabled={axe === "tresorerie"}
                      className={`w-full px-5 py-3 flex items-center gap-3 text-left transition ${
                        axe === "tresorerie" ? "cursor-default" : "hover:bg-slate-50"
                      }`}>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm text-slate-800 truncate">{g.libelle}</div>
                        <div className="text-xs text-slate-500">{g.nb} pièce(s)</div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1.5 max-w-xs">
                          <div className={`h-full rounded-full ${TON[g.cle] ?? ""}`}
                               style={{ width: `${Math.min(100, Math.abs(part))}%`,
                                        background: TON[g.cle] ? undefined : accent }} />
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-bold tabular-nums text-sm text-slate-800">{fmt(g.montant)} TND</div>
                        <div className="text-[10px] text-slate-400">{part.toFixed(1)} %</div>
                      </div>
                      {axe !== "tresorerie" && <ChevronRight size={15} className="text-slate-300 shrink-0" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Trésorerie : l'évolution mensuelle dit si la tendance se dégrade. */}
          {!load && axe === "tresorerie" && (data?.mois?.length ?? 0) > 0 && (
            <div className="px-5 py-4 border-t border-slate-100">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">
                Évolution mensuelle
              </div>
              <div className="space-y-1">
                {data!.mois!.map((m) => {
                  const max = Math.max(...data!.mois!.map((x) => Math.max(x.encaisse, x.decaisse))) || 1;
                  return (
                    <div key={m.libelle} className="flex items-center gap-2 text-xs">
                      <span className="w-16 shrink-0 text-slate-500">{libMois(m.libelle)}</span>
                      <div className="flex-1 flex items-center gap-1">
                        <div className="flex-1 flex justify-end">
                          <div className="h-3 bg-emerald-500 rounded-l"
                               style={{ width: `${(m.encaisse / max) * 100}%` }} />
                        </div>
                        <div className="flex-1">
                          <div className="h-3 bg-red-500 rounded-r"
                               style={{ width: `${(m.decaisse / max) * 100}%` }} />
                        </div>
                      </div>
                      <span className={`w-24 text-right tabular-nums font-semibold ${
                        m.montant < 0 ? "text-red-600" : "text-emerald-600"}`}>
                        {fmt(m.montant)}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 flex gap-4 text-[10px] text-slate-400">
                <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-sm bg-emerald-500 inline-block" /> encaissé</span>
                <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-sm bg-red-500 inline-block" /> décaissé</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
