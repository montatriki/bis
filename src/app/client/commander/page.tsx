"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Search, ShoppingCart, Plus, Minus, Package, CheckCircle, Loader2, AlertTriangle } from "lucide-react";

type Article = {
  refArt: string; codeBarre: string | null; designation: string;
  unite: string | null; enStock: number; stMin: number;
  tarif1Ht: number; tauxTva: number; prixTtc: number;
  /** L'article a une photo : elle est servie à part par `/api/articles/photo`. */
  aPhoto?: boolean;
};
type CartItem = { article: Article; qty: number };

const fmt = (v: unknown) =>
  new Intl.NumberFormat("fr-TN", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(Number(v) || 0);

export default function CommanderPage() {
  const [step, setStep] = useState<"catalogue" | "recap" | "confirm">("catalogue");
  const [search, setSearch] = useState("");
  const [dispo, setDispo] = useState("stock");
  const [articles, setArticles] = useState<Article[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refDoc, setRefDoc] = useState("");

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
          setLoading(false);
        })
        .catch(() => { if (!cancelled) setLoading(false); });
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [search, dispo]);

  function addToCart(a: Article) {
    setCart((prev) => {
      const ex = prev.find((i) => i.article.refArt === a.refArt);
      if (ex) return prev.map((i) => (i.article.refArt === a.refArt ? { ...i, qty: i.qty + 1 } : i));
      return [...prev, { article: a, qty: 1 }];
    });
  }
  function updateQty(ref: string, delta: number) {
    setCart((prev) =>
      prev.map((i) => (i.article.refArt === ref ? { ...i, qty: Math.max(0, i.qty + delta) } : i)).filter((i) => i.qty > 0)
    );
  }
  const getQty = (ref: string) => cart.find((i) => i.article.refArt === ref)?.qty ?? 0;

  const totalItems = cart.reduce((s, i) => s + i.qty, 0);
  const totalHT = cart.reduce((s, i) => s + i.qty * i.article.tarif1Ht, 0);
  const totalTVA = cart.reduce((s, i) => s + i.qty * i.article.tarif1Ht * (i.article.tauxTva / 100), 0);
  const totalTTC = totalHT + totalTVA;

  async function envoyer() {
    if (cart.length === 0) return;
    setSaving(true);
    setError(null);
    const r = await fetch("/api/commandes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // Le serveur rattache la commande au tiers de la session : le client
        // ne peut pas commander au nom d'un autre compte.
        pourMonCompte: true,
        typeDoc: "COM",
        commentaire: note,
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
    if (r.ok) { setRefDoc(r.refDoc); setStep("confirm"); }
    else setError(r.error ?? "Échec de l'envoi de la commande");
  }

  /* ----------------------------- Confirmation ----------------------------- */
  if (step === "confirm") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <motion.div className="text-center max-w-sm" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
          <motion.div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-500/15 rounded-full flex items-center justify-center mx-auto mb-6"
            animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 0.5 }}>
            <CheckCircle size={36} className="text-emerald-500" />
          </motion.div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Commande envoyée</h2>
          <p className="text-[var(--text-secondary)] mb-2">Votre commande a bien été enregistrée.</p>
          <p className="text-sm text-[var(--text-secondary)] mb-6">
            Référence : <strong className="text-[var(--text-primary)]">{refDoc}</strong>
          </p>
          <button onClick={() => { setCart([]); setStep("catalogue"); setNote(""); setRefDoc(""); }}
            className="text-white px-8 py-3 rounded-xl font-bold transition shadow-[0_10px_24px_-14px_var(--shadow-hover)]"
            style={{ background: "linear-gradient(135deg, var(--accent-primary), color-mix(in srgb, var(--accent-primary) 78%, #000))" }}>
            Nouvelle commande
          </button>
        </motion.div>
      </div>
    );
  }

  /* ------------------------------ Récapitulatif ---------------------------- */
  if (step === "recap") {
    return (
      <div className="space-y-4 max-w-lg mx-auto">
        <div className="flex items-center gap-3">
          <button onClick={() => setStep("catalogue")} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition text-xl">←</button>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Récapitulatif</h1>
        </div>

        {error && (
          <div className="px-4 py-3 rounded-xl bg-red-500/10 text-red-600 text-sm flex items-center gap-2">
            <AlertTriangle size={15} /> {error}
          </div>
        )}

        <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-primary)] shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-[var(--bg-primary)] border-b border-[var(--border-primary)]">
            <span className="text-sm font-semibold text-[var(--text-primary)]">
              {totalItems} article(s) · {cart.length} référence(s)
            </span>
          </div>
          <div className="divide-y divide-[var(--border-primary)]/60">
            {cart.map((item) => (
              <div key={item.article.refArt} className="flex items-center justify-between px-5 py-4 gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-[var(--text-primary)] text-sm truncate" title={item.article.designation}>
                    {item.article.designation}
                  </div>
                  <div className="text-[var(--text-secondary)] text-xs">{fmt(item.article.tarif1Ht)} TND × {item.qty}</div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => updateQty(item.article.refArt, -1)}
                      className="w-7 h-7 bg-[var(--bg-primary)] rounded-lg flex items-center justify-center hover:bg-red-50 text-sm font-bold">−</button>
                    <span className="w-6 text-center font-bold text-sm">{item.qty}</span>
                    <button onClick={() => updateQty(item.article.refArt, 1)}
                      className="w-7 h-7 bg-[var(--bg-primary)] rounded-lg flex items-center justify-center hover:bg-emerald-50 text-sm font-bold">+</button>
                  </div>
                  <span className="font-semibold text-[var(--text-primary)] w-24 text-right text-sm tabular-nums">
                    {fmt(item.article.tarif1Ht * item.qty)}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="p-4 bg-[var(--bg-primary)] space-y-1.5 border-t border-[var(--border-primary)]">
            <div className="flex justify-between text-sm"><span className="text-[var(--text-secondary)]">Montant HT</span><span className="font-medium tabular-nums">{fmt(totalHT)} TND</span></div>
            <div className="flex justify-between text-sm"><span className="text-[var(--text-secondary)]">TVA</span><span className="font-medium tabular-nums">{fmt(totalTVA)} TND</span></div>
            <div className="flex justify-between text-base font-bold pt-1.5 border-t border-[var(--border-primary)]">
              <span className="text-[var(--text-primary)]">Total TTC</span>
              <span className="text-[var(--accent-primary)] tabular-nums">{fmt(totalTTC)} TND</span>
            </div>
          </div>
        </div>

        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3}
          placeholder="Remarque pour votre commercial (facultatif)…"
          className="w-full px-4 py-3 text-sm bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl focus:outline-none resize-none" />

        <button onClick={envoyer} disabled={saving || cart.length === 0}
          className="w-full text-white py-3 rounded-xl font-bold transition disabled:opacity-50 flex items-center justify-center gap-2 shadow-[0_10px_24px_-14px_var(--shadow-hover)]"
          style={{ background: "linear-gradient(135deg, var(--accent-primary), color-mix(in srgb, var(--accent-primary) 78%, #000))" }}>
          {saving && <Loader2 className="animate-spin" size={16} />} Envoyer la commande
        </button>
      </div>
    );
  }

  /* -------------------------------- Catalogue ------------------------------ */
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Passer commande</h1>
          <p className="text-[var(--text-secondary)] text-sm">
            {loading ? "Chargement…" : `${articles.length} article(s) affichés sur ${total}`}
          </p>
        </div>
        <motion.button onClick={() => setStep("recap")} disabled={cart.length === 0}
          className="relative flex items-center gap-2 text-white px-4 py-2.5 rounded-xl font-bold transition text-sm disabled:opacity-40 shadow-[0_10px_24px_-14px_var(--shadow-hover)]"
          style={{ background: "linear-gradient(135deg, var(--accent-primary), color-mix(in srgb, var(--accent-primary) 78%, #000))" }}
          whileHover={{ scale: cart.length ? 1.02 : 1 }} whileTap={{ scale: 0.98 }}>
          <ShoppingCart size={16} /> Mon panier
          {totalItems > 0 && (
            <span className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full text-xs flex items-center justify-center font-bold">
              {totalItems}
            </span>
          )}
        </motion.button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setLoading(true); }}
            className="pl-9 pr-4 py-2.5 text-sm bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl w-full focus:outline-none"
            placeholder="Rechercher un article…" />
        </div>
        <select value={dispo} onChange={(e) => { setDispo(e.target.value); setLoading(true); }}
          className="py-2.5 px-3 text-sm bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl focus:outline-none">
          <option value="stock">Disponibles</option>
          <option value="toutes">Tout le catalogue</option>
        </select>
      </div>

      {loading && <div className="py-16 text-center text-[var(--text-secondary)]"><Loader2 className="animate-spin inline" size={22} /></div>}
      {!loading && articles.length === 0 && (
        <div className="py-16 text-center text-sm text-[var(--text-secondary)]">Aucun article disponible.</div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {!loading && articles.map((a, i) => {
          const qty = getQty(a.refArt);
          const rupture = a.enStock <= 0;
          return (
            <motion.div key={a.refArt} className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-primary)] shadow-sm p-4"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.02, 0.3) }}>
              {/* Visuel du produit : la photo n'était jamais affichée côté
                  client, alors que l'article en a une. `object-contain` montre
                  l'article entier, avec un double flouté pour combler les
                  côtés quand son format diffère du cadre. */}
              <div className="relative w-full h-32 rounded-xl overflow-hidden mb-3 flex items-center justify-center
                              bg-gradient-to-br from-[var(--bg-primary)] to-[var(--bg-card)]">
                {a.aPhoto ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/articles/photo?refArt=${encodeURIComponent(a.refArt)}`} alt=""
                      aria-hidden="true" loading="lazy"
                      className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-40" />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/articles/photo?refArt=${encodeURIComponent(a.refArt)}`} alt={a.designation}
                      loading="lazy"
                      className="relative w-full h-full object-contain" />
                  </>
                ) : (
                  <Package size={30} className="text-slate-300" />
                )}
              </div>
              <div className="font-semibold text-[var(--text-primary)] text-sm leading-tight mb-1 line-clamp-2" title={a.designation}>
                {a.designation}
              </div>
              <div className="text-[var(--text-secondary)] text-xs mb-2">Réf : {a.refArt}</div>
              <div className="flex items-center justify-between mb-3">
                <div className="font-bold text-[var(--text-primary)] tabular-nums">{fmt(a.prixTtc)} TND</div>
                <div className={`text-[10px] px-2 py-0.5 rounded-full ${
                  rupture ? "bg-red-50 dark:bg-red-500/10 text-red-600" : "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"}`}>
                  {rupture ? "Rupture" : `Stock : ${a.enStock}`}
                </div>
              </div>

              {qty === 0 ? (
                <button onClick={() => addToCart(a)} disabled={rupture}
                  className="w-full flex items-center justify-center gap-1.5 text-[13px] text-white py-2.5 rounded-xl transition font-bold disabled:opacity-40 shadow-[0_8px_20px_-12px_var(--shadow-hover)]"
                  style={{ background: rupture ? "var(--text-secondary)" : "linear-gradient(135deg, var(--accent-primary), color-mix(in srgb, var(--accent-primary) 78%, #000))" }}>
                  <Plus size={13} /> {rupture ? "Indisponible" : "Ajouter"}
                </button>
              ) : (
                <div className="flex items-center justify-between rounded-xl p-1 bg-[var(--accent-light)] border border-[var(--accent-primary)]/20">
                  <button onClick={() => updateQty(a.refArt, -1)} className="w-8 h-8 flex items-center justify-center bg-[var(--bg-card)] rounded-lg shadow-sm">
                    <Minus size={13} className="text-red-500" />
                  </button>
                  <span className="font-black tabular-nums text-[var(--accent-primary)]">{qty}</span>
                  <button onClick={() => updateQty(a.refArt, 1)} className="w-8 h-8 flex items-center justify-center bg-[var(--bg-card)] rounded-lg shadow-sm">
                    <Plus size={13} className="text-emerald-500" />
                  </button>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
