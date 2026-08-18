"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { Search, X, ShoppingCart, Plus, Minus, Package, Loader2, Check, MapPin, AlertTriangle, Trash2 } from "lucide-react";
import { useClientActif } from "@/lib/client-actif";
import TicketVente from "@/components/commercial/TicketVente";

type Article = {
  refArt: string; codeBarre: string | null; designation: string; catalogue: string | null;
  unite: string | null; enStock: number; stMin: number;
  /** Quantité chargée dans le camion, panier compris (borne du sélecteur). */
  stockCamion?: number;
  tarif1Ht: number; tauxTva: number; prixTtc: number;
};
type CartItem = { article: Article; qty: number };

const fmt = (v: unknown) =>
  new Intl.NumberFormat("fr-TN", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(Number(v) || 0);

export default function CataloguePage() {
  const [search, setSearch] = useState("");
  const [dispo, setDispo] = useState("toutes");
  const [articles, setArticles] = useState<Article[]>([]);
  const [nbEnStock, setNbEnStock] = useState(0);
  // Camion du commercial : le stock affiché est celui qu'il a à bord.
  const [emplacement, setEmplacement] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  // Référence du document dont le ticket est affiché (null = aucun).
  const [ticketRef, setTicketRef] = useState<string | null>(null);

  // La commande porte sur le client en cours de visite, choisi une fois pour
  // toutes dans le bandeau : plus de sélection enfouie au moment de valider.
  const { client: clientActif } = useClientActif();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      const qs = new URLSearchParams({ limit: "120", dispo });
      if (search) qs.set("search", search);
      fetch(`/api/catalogue?${qs}`)
        .then((r) => r.json())
        .then((d) => {
          if (cancelled) return;
          setArticles(d.rows ?? []);
          setTotal(d.total ?? 0);
          setNbEnStock(d.nbEnStock ?? 0);
          setEmplacement(d.emplacement ?? null);
          setLoading(false);
        })
        .catch(() => { if (!cancelled) setLoading(false); });
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [search, dispo]);

  // Le panier vit côté serveur : on le relit à l'ouverture de l'écran, sinon la
  // pastille « À bord » ignorerait des articles déjà réservés (et le compteur
  // du sélecteur repartirait de zéro après un simple rafraîchissement).
  useEffect(() => {
    let annule = false;
    fetch("/api/panier?vue=courant")
      .then((r) => r.json())
      .then((d) => {
        if (annule || !Array.isArray(d.lignes)) return;
        setCart(
          d.lignes.map((l: { refArt: string; designation: string; unite: string | null; qte: number; puHt: number; tauxTva: number }) => ({
            article: {
              refArt: l.refArt, designation: l.designation, unite: l.unite,
              codeBarre: null, catalogue: null, enStock: 0, stMin: 0,
              tarif1Ht: l.puHt, tauxTva: l.tauxTva,
              prixTtc: Math.round((l.puHt * (1 + l.tauxTva / 100) + Number.EPSILON) * 1000) / 1000,
            },
            qty: l.qte,
          })),
        );
      })
      .catch(() => {});
    return () => { annule = true; };
  }, []);

  // Le panier est persisté côté serveur : il survit au changement d'écran et
  // alimente le badge du menu. L'état local reste mis à jour immédiatement
  // pour que l'interface ne clignote pas en attendant la réponse.
  function addToCart(a: Article) {
    setCart((prev) => {
      const ex = prev.find((i) => i.article.refArt === a.refArt);
      if (ex) return prev.map((i) => (i.article.refArt === a.refArt ? { ...i, qty: i.qty + 1 } : i));
      return [...prev, { article: a, qty: 1 }];
    });
    fetch("/api/panier", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vue: "ligne", refArt: a.refArt, qte: 1 }),
    }).catch(() => {});
  }
  function updateQty(ref: string, delta: number) {
    const actuelle = cart.find((i) => i.article.refArt === ref)?.qty ?? 0;
    const suivante = Math.max(0, actuelle + delta);
    setCart((prev) =>
      prev.map((i) => (i.article.refArt === ref ? { ...i, qty: suivante } : i)).filter((i) => i.qty > 0)
    );
    fetch("/api/panier", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refArt: ref, qte: suivante }),
    }).catch(() => {});
  }
  const getQty = (ref: string) => cart.find((i) => i.article.refArt === ref)?.qty ?? 0;

  /**
   * Quantité encore disponible à la vente : ce que porte le camion moins ce qui
   * est déjà réservé dans le panier. Calculé côté client pour que le compteur
   * réagisse au clic, sans attendre un aller-retour serveur.
   */
  const dispoRestant = (a: Article) => {
    const charge = a.stockCamion ?? a.enStock;
    return Math.round((charge - getQty(a.refArt)) * 1000) / 1000;
  };

  const totalItems = cart.reduce((s, i) => s + i.qty, 0);
  const totalHT = cart.reduce((s, i) => s + i.qty * i.article.tarif1Ht, 0);
  // TVA calculée ligne par ligne : chaque article a son propre taux.
  const totalTVA = cart.reduce((s, i) => s + i.qty * i.article.tarif1Ht * (i.article.tauxTva / 100), 0);
  const totalTTC = totalHT + totalTVA;

  /**
   * Distance au-delà de laquelle on doute que le commercial soit réellement
   * chez le client. On avertit sans bloquer : un GPS imprécis en intérieur ne
   * doit pas empêcher une vente légitime.
   */
  const RAYON_PRESENCE_M = 300;

  async function validerPanier() {
    if (cart.length === 0) return;
    if (!clientActif) { flash("Sélectionnez d'abord le client en haut de l'écran"); return; }

    // Contrôle de présence : le ticket atteste d'une livraison sur place.
    const loin = clientActif.distance != null && clientActif.distance > RAYON_PRESENCE_M;
    if (loin) {
      const km = clientActif.distance! >= 1000
        ? `${(clientActif.distance! / 1000).toFixed(1)} km`
        : `${Math.round(clientActif.distance!)} m`;
      if (!confirm(
        `Vous semblez être à ${km} de « ${clientActif.raisonSocial} ».\n\n` +
        `Le ticket atteste d'une livraison sur place. Confirmer quand même ?`,
      )) return;
    }

    setSaving(true);
    const r = await fetch("/api/commandes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        codeCli: clientActif.id,
        raisonSocial: clientActif.raisonSocial,
        // Vente en tournée : le client est livré sur place, on émet donc un
        // ticket ferme (sortie de stock + débit du compte client), et non une
        // commande en attente qui ne mouvementerait rien.
        typeDoc: "TIC",
        valider: true,
        lignes: cart.map((i) => ({
          refArt: i.article.refArt,
          designation: i.article.designation,
          unite: i.article.unite,
          qte: i.qty,
          puHt: i.article.tarif1Ht,
          tauxTva: i.article.tauxTva,
        })),
      }),
    }).then((x) => x.json()).catch(() => ({ error: "réseau" }));
    setSaving(false);
    if (r.ok) {
      setCart([]);
      setShowCart(false);
      flash(`Ticket ${r.refDoc} émis (${fmt(r.ttcNet)} TND) — stock mis à jour`);
      // Le ticket s'ouvre aussitôt : en tournée, le client repart avec.
      setTicketRef(r.refDoc ?? null);
    } else {
      flash(r.error ?? "Échec de la création");
    }
  }

  /** Vide le panier, côté écran et côté serveur. */
  async function viderPanier() {
    if (cart.length === 0) return;
    if (!confirm(`Vider le panier (${totalItems} article(s)) ?`)) return;
    // L'écran se met à jour tout de suite : les quantités réservées sont
    // relâchées, donc les pastilles « À bord » remontent immédiatement.
    setCart([]);
    setShowCart(false);
    const r = await fetch("/api/panier", { method: "DELETE" })
      .then((x) => x.json())
      .catch(() => ({ error: "réseau" }));
    flash(r.ok ? "Panier vidé" : (r.error ?? "Échec du vidage"));
  }

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 4000); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Catalogue produits</h1>
          <p className="text-[var(--text-secondary)] text-sm">
            {loading ? "Chargement…" : `${articles.length} affichés sur ${total} articles`}
          </p>
          {emplacement && (
            <p className="text-[var(--text-secondary)] text-xs mt-0.5">
              Stock du véhicule <span className="font-semibold">{emplacement}</span>
            </p>
          )}
        </div>
        <motion.button onClick={() => setShowCart(true)}
          className="relative flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl font-medium hover:bg-blue-500 transition text-sm"
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <ShoppingCart size={16} /> Panier
          {totalItems > 0 && (
            <span className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full text-xs flex items-center justify-center font-bold">
              {totalItems}
            </span>
          )}
        </motion.button>
      </div>

      {toast && (
        <div className="px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-sm font-medium flex items-center gap-2">
          <Check size={15} /> {toast}
        </div>
      )}

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setLoading(true); }}
            className="pl-9 pr-4 py-2.5 text-sm bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl w-full focus:outline-none"
            placeholder="Rechercher par désignation, référence ou code-barres…" />
        </div>
        <select value={dispo} onChange={(e) => { setDispo(e.target.value); setLoading(true); }}
          className="py-2.5 px-3 text-sm bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl focus:outline-none">
          <option value="toutes">Tous les articles</option>
          <option value="stock">En stock ({nbEnStock})</option>
          <option value="rupture">En rupture</option>
        </select>
      </div>

      {loading && <div className="py-16 text-center text-[var(--text-secondary)]"><Loader2 className="animate-spin inline" size={22} /></div>}
      {!loading && articles.length === 0 && (
        <div className="py-16 text-center text-sm text-[var(--text-secondary)]">Aucun article trouvé.</div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {!loading && articles.map((a, i) => {
          const qty = getQty(a.refArt);
          // Ce qu'il reste réellement à vendre après déduction du panier :
          // chaque « + » fait donc baisser le compteur affiché.
          const restant = dispoRestant(a);
          const rupture = restant <= 0;
          const bas = !rupture && restant <= (a.stMin || 0);
          return (
            <motion.div key={a.refArt} className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-primary)] shadow-sm p-4 hover:shadow-md transition"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.02, 0.3) }}>
              <div className="w-full h-24 bg-gradient-to-br from-[var(--bg-primary)] to-[var(--bg-card)] rounded-xl flex items-center justify-center mb-3">
                <Package size={30} className="text-slate-300" />
              </div>
              <div className="font-semibold text-[var(--text-primary)] text-sm leading-tight mb-1 line-clamp-2" title={a.designation}>
                {a.designation}
              </div>
              <div className="text-[var(--text-secondary)] text-xs mb-0.5">Réf : {a.refArt}</div>
              <div className="text-[var(--text-secondary)] text-xs mb-3 truncate">
                {a.codeBarre ? `CB : ${a.codeBarre}` : a.catalogue || "—"}
              </div>
              <div className="flex items-center justify-between mb-1">
                <div className="font-bold text-[var(--text-primary)] tabular-nums">{fmt(a.tarif1Ht)} TND</div>
                <div className={`text-xs px-2 py-0.5 rounded-full ${
                  rupture ? "bg-red-50 dark:bg-red-500/10 text-red-600"
                  : bas ? "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400"
                  : "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"}`}>
                  {emplacement ? "À bord" : "Stock"} : {restant}
                </div>
              </div>
              <div className="text-[10px] text-[var(--text-secondary)] mb-3">
                TTC {fmt(a.prixTtc)} · TVA {a.tauxTva}%
              </div>

              {qty === 0 ? (
                <motion.button onClick={() => addToCart(a)} disabled={rupture}
                  className="w-full flex items-center justify-center gap-1.5 text-xs bg-blue-600 text-white py-2.5 rounded-xl hover:bg-blue-500 transition font-medium disabled:opacity-40"
                  whileHover={{ scale: rupture ? 1 : 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Plus size={13} /> {rupture ? "Rupture" : "Ajouter"}
                </motion.button>
              ) : (
                <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-500/10 rounded-xl p-1">
                  <button onClick={() => updateQty(a.refArt, -1)} className="w-8 h-8 flex items-center justify-center bg-[var(--bg-card)] rounded-lg shadow-sm hover:bg-red-50 transition">
                    <Minus size={13} className="text-red-500" />
                  </button>
                  <span className="font-bold text-blue-700 dark:text-blue-400">{qty}</span>
                  <button onClick={() => updateQty(a.refArt, 1)} disabled={restant <= 0}
                    title={restant <= 0 ? "Plus rien à bord pour cet article" : undefined}
                    className="w-8 h-8 flex items-center justify-center bg-[var(--bg-card)] rounded-lg shadow-sm hover:bg-emerald-50 transition disabled:opacity-40 disabled:cursor-not-allowed">
                    <Plus size={13} className="text-emerald-500" />
                  </button>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      <AnimatePresence>
        {showCart && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowCart(false)}>
            <motion.div className="bg-[var(--bg-card)] rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
              <div className="bg-slate-800 text-white p-5 flex items-center justify-between">
                <div>
                  <div className="font-bold text-lg">Panier en cours</div>
                  <div className="text-slate-400 text-xs">{totalItems} article(s)</div>
                </div>
                <button onClick={() => setShowCart(false)} className="p-2 hover:bg-white/10 rounded-lg transition"><X size={18} /></button>
              </div>

              <div className="p-5 overflow-auto flex-1">
                {cart.length === 0 ? (
                  <div className="text-center py-10 text-[var(--text-secondary)]">
                    <ShoppingCart size={32} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Panier vide</p>
                  </div>
                ) : (
                  <>
                    {/* Le client vient du bandeau de tournée, pas d'une liste à
                        re-parcourir : la commande suit toujours la visite. */}
                    {clientActif ? (
                      <div className="mb-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3">
                        <div className="text-[10px] font-black uppercase tracking-wider text-emerald-600">
                          Commande pour
                        </div>
                        <div className="font-bold text-sm text-[var(--text-primary)] truncate mt-0.5">
                          {clientActif.raisonSocial}
                        </div>
                        <div className="text-xs text-[var(--text-secondary)] flex items-center gap-1.5 truncate">
                          <MapPin size={10} className="shrink-0" />
                          {clientActif.ville || clientActif.adresse || "—"}
                          {clientActif.soldeFin != null && clientActif.soldeFin > 0 && (
                            <span className="text-red-600 font-semibold">
                              · solde {fmt(clientActif.soldeFin)} TND
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="mb-4 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-center gap-2.5">
                        <AlertTriangle size={16} className="text-amber-600 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-xs text-[var(--text-primary)]">Aucun client sélectionné</div>
                          <div className="text-[11px] text-[var(--text-secondary)]">
                            Choisissez le client avant de valider la commande.
                          </div>
                        </div>
                        <button onClick={() => router.push("/commercial/clients")}
                          className="text-[11px] font-bold bg-amber-500 text-white px-2.5 py-1.5 rounded-lg hover:bg-amber-400 transition shrink-0">
                          Choisir
                        </button>
                      </div>
                    )}

                    <div className="space-y-2 mb-4">
                      {cart.map((item) => (
                        <div key={item.article.refArt} className="flex items-center justify-between p-3 bg-[var(--bg-primary)] rounded-xl text-sm">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-[var(--text-primary)] truncate">{item.article.designation}</div>
                            <div className="text-[var(--text-secondary)] text-xs">{fmt(item.article.tarif1Ht)} × {item.qty}</div>
                          </div>
                          <div className="font-semibold text-[var(--text-primary)] ml-3 tabular-nums">
                            {fmt(item.article.tarif1Ht * item.qty)}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="border-t border-[var(--border-primary)] pt-3">
                      <Row label="Total HT" value={fmt(totalHT)} />
                      <Row label="TVA" value={fmt(totalTVA)} muted />
                      <Row label="Net à payer" value={fmt(totalTTC)} strong />
                    </div>
                  </>
                )}
              </div>

              {cart.length > 0 && (
                <div className="p-5 border-t border-[var(--border-primary)]">
                  <button onClick={validerPanier} disabled={saving || !clientActif}
                    className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-500 transition text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                    {saving && <Loader2 className="animate-spin" size={16} />}
                    Valider le panier → Ticket
                  </button>
                  <button onClick={viderPanier} disabled={saving}
                    className="w-full mt-2 py-2.5 rounded-xl font-medium text-sm border border-[var(--border-primary)]
                               text-[#b84a39] hover:bg-[#b84a39]/8 transition disabled:opacity-50
                               flex items-center justify-center gap-2">
                    <Trash2 size={15} /> Vider le panier
                  </button>
                  <p className="text-[11px] text-[var(--text-secondary)] mt-2 text-center">
                    Le ticket est émis immédiatement : le stock sort et le compte client est débité.
                  </p>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Ticket imprimable de la commande qui vient d'être créée. */}
      {ticketRef && (
        <TicketVente refDoc={ticketRef} onClose={() => setTicketRef(null)} />
      )}
    </div>
  );
}

function Row({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? "text-sm font-bold mt-2 text-blue-700 dark:text-blue-400" : muted ? "text-xs text-[var(--text-secondary)] mt-1" : "text-sm font-bold"}`}>
      <span className={strong || muted ? "" : "text-[var(--text-secondary)]"}>{label}</span>
      <span className="tabular-nums">{value} TND</span>
    </div>
  );
}
