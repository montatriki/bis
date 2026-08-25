"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ShoppingCart, Trash2, Loader2, Check, AlertTriangle, Search, Send, Plus, Minus } from "lucide-react";
import { confirmer } from "@/lib/alertes";

// Panier de commande — tuile « PANIER DE COMMANDE » de l'app commerciale.
// Le panier est persistant : il survit au changement d'écran et alimente le
// badge du menu, ce que l'état React ne permettait pas.

type Ligne = {
  id: number; refArt: string; designation: string | null; unite: string | null;
  qte: number; puHt: number; tauxTva: number; totalHT: number; totalTTC: number;
  /** Remise de ligne en %, et FODEC : nécessaires pour afficher le prix net. */
  remise?: number; tauxFodec?: number;
};
type ClientRef = { id: number; raisonSocial: string | null; ville: string | null; soldeFin: number };

const fmt = (v: unknown) =>
  new Intl.NumberFormat("fr-TN", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(Number(v) || 0);

export default function PanierPage() {
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [client, setClient] = useState<{ codeCli: number | null; clientNom: string | null }>({ codeCli: null, clientNom: null });
  const [tot, setTot] = useState({ totalHT: 0, totalTVA: 0, totalTTC: 0, totalRemise: 0 });
  const [load, setLoad] = useState(true);
  const [busy, setBusy] = useState(false);
  const [clients, setClients] = useState<ClientRef[]>([]);
  const [q, setQ] = useState("");
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const flash = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 6000);
  }, []);

  const charger = useCallback(() => {
    fetch("/api/panier?vue=courant")
      .then((r) => r.json())
      .then((d) => {
        setLignes(d.lignes ?? []);
        setClient({ codeCli: d.panier?.codeCli ?? null, clientNom: d.panier?.clientNom ?? null });
        setTot({
          totalHT: d.totalHT ?? 0, totalTVA: d.totalTVA ?? 0,
          totalTTC: d.totalTTC ?? 0, totalRemise: d.totalRemise ?? 0,
        });
      })
      .catch(() => flash("Chargement impossible", false))
      .finally(() => setLoad(false));
  }, [flash]);

  useEffect(charger, [charger]);

  useEffect(() => {
    const t = setTimeout(() => {
      fetch(`/api/missions?vue=clients${q ? `&q=${encodeURIComponent(q)}` : ""}`)
        .then((r) => r.json())
        .then((d) => setClients(d.rows ?? []))
        .catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const majQte = async (refArt: string, qte: number) => {
    const r = await fetch("/api/panier", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refArt, qte }),
    });
    const d = await r.json();
    if (!r.ok) return flash(d.error ?? "Échec", false);
    charger();
  };

  const choisirClient = async (codeCli: number | null) => {
    const r = await fetch("/api/panier", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codeCli }),
    });
    const d = await r.json();
    if (!r.ok) return flash(d.error ?? "Échec", false);
    charger();
  };

  const vider = async () => {
    const ok = await confirmer("Le panier sera entièrement vidé.", {
      titre: "Vider le panier", intitule: "Vider le panier", danger: true,
    });
    if (!ok) return;
    const r = await fetch("/api/panier", { method: "DELETE" });
    const d = await r.json();
    flash(d.message ?? "Vidé", r.ok);
    charger();
  };

  const valider = async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/panier", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vue: "valider" }),
      });
      const d = await r.json();
      if (!r.ok) return flash(d.error ?? "Échec", false);
      flash(`${d.message} — ${fmt(d.ttcNet)} TND`);
      charger();
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Panier de commande</h1>
          <p className="text-slate-500 text-sm">
            {lignes.length} article(s) · {fmt(tot.totalTTC)} TND TTC
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/commercial/catalogue"
            className="px-3 py-2 rounded-xl text-sm font-semibold border border-slate-200 text-slate-600 flex items-center gap-1.5">
            <Plus size={15} /> Ajouter des articles
          </Link>
          {lignes.length > 0 && (
            <button onClick={vider}
              className="px-3 py-2 rounded-xl text-sm font-semibold border border-red-200 text-red-600 flex items-center gap-1.5">
              <Trash2 size={15} /> Vider
            </button>
          )}
        </div>
      </div>

      {toast && (
        <div className={`px-4 py-2 rounded-xl text-sm font-medium flex items-start gap-2 ${
          toast.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
        }`}>
          {toast.ok ? <Check size={15} className="mt-0.5 shrink-0" /> : <AlertTriangle size={15} className="mt-0.5 shrink-0" />}
          <span className="whitespace-pre-line">{toast.msg}</span>
        </div>
      )}

      {load ? (
        <div className="py-16 text-center text-slate-400"><Loader2 className="animate-spin inline" size={22} /></div>
      ) : lignes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center">
          <ShoppingCart size={32} className="mx-auto mb-3 text-slate-200" />
          <div className="text-sm text-slate-500">Votre panier est vide.</div>
          <Link href="/commercial/catalogue"
            className="inline-block mt-3 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-blue-600">
            Parcourir le catalogue
          </Link>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-2">
            <div className="text-sm font-semibold text-slate-700">Client destinataire</div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="relative">
                <Search size={13} className="absolute left-3 top-3 text-slate-400" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un client…"
                  className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-sm" />
              </div>
              <select value={client.codeCli ?? ""}
                onChange={(e) => choisirClient(e.target.value ? Number(e.target.value) : null)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm">
                <option value="">— Sélectionner —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.raisonSocial ?? `Client ${c.id}`}{c.ville ? ` — ${c.ville}` : ""}
                    {c.soldeFin > 0 ? ` (solde ${fmt(c.soldeFin)})` : ""}
                  </option>
                ))}
              </select>
            </div>
            {client.clientNom && (
              <div className="text-xs text-emerald-600">Commande pour : <b>{client.clientNom}</b></div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr className="text-[11px] uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3 text-left font-semibold">Article</th>
                    <th className="px-4 py-3 text-right font-semibold">PU HT</th>
                    <th className="px-4 py-3 text-right font-semibold">Remise</th>
                    <th className="px-4 py-3 text-center font-semibold">Quantité</th>
                    <th className="px-4 py-3 text-right font-semibold">Total TTC</th>
                    <th className="w-12" />
                  </tr>
                </thead>
                <tbody>
                  {lignes.map((l) => (
                    <tr key={l.id} className="border-b border-slate-50">
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-slate-800">{l.designation ?? l.refArt}</div>
                        <div className="text-xs text-slate-400 font-mono">{l.refArt}{l.unite ? ` · ${l.unite}` : ""}</div>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {(l.remise ?? 0) > 0 ? (
                          <div>
                            <div className="line-through text-slate-400 text-xs">{fmt(l.puHt)}</div>
                            <div>{fmt(l.puHt * (1 - (l.remise ?? 0) / 100))}</div>
                          </div>
                        ) : (
                          fmt(l.puHt)
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {(l.remise ?? 0) > 0 ? (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-semibold text-xs">
                            −{l.remise} %
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-center gap-1.5">
                          <button onClick={() => majQte(l.refArt, l.qte - 1)}
                            className="w-7 h-7 rounded-lg border border-slate-200 text-slate-600 flex items-center justify-center">
                            <Minus size={13} />
                          </button>
                          <input type="number" step="0.001" value={l.qte}
                            onChange={(e) => majQte(l.refArt, Number(e.target.value))}
                            className="w-20 px-2 py-1 rounded-lg border border-slate-200 text-sm text-center" />
                          <button onClick={() => majQte(l.refArt, l.qte + 1)}
                            className="w-7 h-7 rounded-lg border border-slate-200 text-slate-600 flex items-center justify-center">
                            <Plus size={13} />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold">{fmt(l.totalTTC)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <button onClick={() => majQte(l.refArt, 0)} className="text-red-500 p-1">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50 space-y-1">
              <div className="flex justify-between text-sm text-slate-600">
                <span>Total HT</span><span>{fmt(tot.totalHT)} TND</span>
              </div>
              {/* `tot_remise` de l'ERP d'origine : le cumul des remises accordées. */}
              {tot.totalRemise > 0 && (
                <div className="flex justify-between text-sm text-emerald-600">
                  <span>Remise</span><span>− {fmt(tot.totalRemise)} TND</span>
                </div>
              )}
              <div className="flex justify-between text-sm text-slate-600">
                <span>TVA</span><span>{fmt(tot.totalTVA)} TND</span>
              </div>
              <div className="flex justify-between font-bold text-slate-800 pt-1 border-t border-slate-200">
                <span>Total TTC</span><span className="text-blue-600">{fmt(tot.totalTTC)} TND</span>
              </div>
            </div>
          </div>

          <button onClick={valider} disabled={busy || client.codeCli == null}
            className="w-full px-4 py-3 rounded-xl text-sm font-semibold text-white bg-blue-600 disabled:opacity-40 flex items-center justify-center gap-2">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {client.codeCli == null ? "Sélectionnez un client pour valider" : "Valider la commande"}
          </button>
          <p className="text-xs text-slate-400 text-center">
            La commande est créée en brouillon : le stock ne bougera qu&apos;à sa validation.
          </p>
        </>
      )}
    </div>
  );
}
