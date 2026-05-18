"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingCart, Plus, Minus, CheckCircle, Package, Calendar, Search, Tag } from "lucide-react";
import { DUMMY_PRODUCTS } from "@/lib/dummy-data";

type CartItem = { product: typeof DUMMY_PRODUCTS[0]; qty: number };

const FAMILIES = ["Tous", "Jeux", "Jouets", "Livres", "Sports"];

export default function CommanderPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [step, setStep] = useState<"catalogue" | "recap" | "confirm">("catalogue");
  const [note, setNote] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [search, setSearch] = useState("");
  const [family, setFamily] = useState("Tous");

  function addToCart(product: typeof DUMMY_PRODUCTS[0]) {
    setCart(prev => {
      const ex = prev.find(i => i.product.reference === product.reference);
      if (ex) return prev.map(i => i.product.reference === product.reference ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { product, qty: 1 }];
    });
  }

  function updateQty(ref: string, delta: number) {
    setCart(prev => prev.map(i => i.product.reference === ref ? { ...i, qty: Math.max(0, i.qty + delta) } : i).filter(i => i.qty > 0));
  }

  function getQty(ref: string) { return cart.find(i => i.product.reference === ref)?.qty ?? 0; }

  const filtered = DUMMY_PRODUCTS.filter(p =>
    (family === "Tous" || p.family === family) &&
    (p.name.toLowerCase().includes(search.toLowerCase()) || p.reference.toLowerCase().includes(search.toLowerCase()))
  );

  const totalHT = cart.reduce((s, i) => s + i.qty * i.product.price, 0);
  const totalTTC = totalHT * 1.19;
  const totalItems = cart.reduce((s, i) => s + i.qty, 0);
  const orderRef = `BC-2026-0${Math.floor(Math.random() * 900 + 100)}`;

  if (step === "confirm") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <motion.div className="text-center max-w-sm" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
          <motion.div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6"
            animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 0.5 }}>
            <CheckCircle size={36} className="text-emerald-500" />
          </motion.div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Commande envoyée !</h2>
          <p className="text-slate-500 mb-2">Votre commande a été transmise à Mokhtar Trabelsi.</p>
          <p className="text-sm text-slate-400 mb-1">Référence : <strong className="text-slate-700">{orderRef}</strong></p>
          {deliveryDate && <p className="text-sm text-slate-400 mb-8">Livraison souhaitée : <strong className="text-slate-700">{deliveryDate}</strong></p>}
          <button onClick={() => { setCart([]); setStep("catalogue"); setNote(""); setDeliveryDate(""); }}
            className="bg-blue-600 text-white px-8 py-3 rounded-xl font-medium hover:bg-blue-500 transition">
            Nouvelle commande
          </button>
        </motion.div>
      </div>
    );
  }

  if (step === "recap") {
    return (
      <div className="space-y-4 max-w-lg mx-auto">
        <div className="flex items-center gap-3">
          <button onClick={() => setStep("catalogue")} className="text-slate-400 hover:text-slate-600 transition text-xl">←</button>
          <h1 className="text-2xl font-bold text-slate-800">Récapitulatif commande</h1>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
            <span className="text-sm font-semibold text-slate-700">{totalItems} articles · {cart.length} références</span>
          </div>
          <div className="divide-y divide-slate-50">
            {cart.map(item => (
              <div key={item.product.reference} className="flex items-center justify-between px-5 py-4">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-800 text-sm truncate">{item.product.name}</div>
                  <div className="text-slate-400 text-xs">{item.product.price.toFixed(3)} TND × {item.qty}</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => updateQty(item.product.reference, -1)} className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center hover:bg-red-50 text-sm font-bold">−</button>
                    <span className="w-6 text-center font-bold text-sm">{item.qty}</span>
                    <button onClick={() => updateQty(item.product.reference, 1)} className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center hover:bg-emerald-50 text-sm font-bold">+</button>
                  </div>
                  <span className="font-semibold text-slate-800 w-20 text-right text-sm">{(item.product.price * item.qty).toFixed(3)} TND</span>
                </div>
              </div>
            ))}
          </div>
          <div className="p-4 bg-slate-50 space-y-1.5 border-t border-slate-100">
            <div className="flex justify-between text-sm"><span className="text-slate-500">Montant HT</span><span className="font-medium">{totalHT.toFixed(3)} TND</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-500">TVA 19%</span><span className="font-medium">{(totalHT * 0.19).toFixed(3)} TND</span></div>
            <div className="flex justify-between text-sm font-bold pt-1.5 border-t border-slate-200">
              <span className="text-slate-800">Net à payer TTC</span>
              <span className="text-blue-700 text-base">{totalTTC.toFixed(3)} TND</span>
            </div>
          </div>
        </div>

        {/* Delivery date */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
          <div>
            <label className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-2">
              <Calendar size={15} className="text-blue-500" /> Date de livraison souhaitée
            </label>
            <input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-300" />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-2">Note pour le commercial</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={3}
              placeholder="Livraison urgente, instructions spéciales, horaires de réception..."
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-300 resize-none" />
          </div>
        </div>

        <button onClick={() => setStep("confirm")} className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-500 transition text-base">
          Confirmer la commande — {totalTTC.toFixed(2)} TND TTC
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Commander</h1>
          <p className="text-slate-500 text-sm">Catalogue disponible — {DUMMY_PRODUCTS.length} références</p>
        </div>
        {totalItems > 0 && (
          <motion.button onClick={() => setStep("recap")}
            className="relative flex items-center gap-2 bg-blue-600 text-white px-5 py-3 rounded-xl font-semibold hover:bg-blue-500 transition"
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            initial={{ scale: 0 }} animate={{ scale: 1 }}>
            <ShoppingCart size={17} />
            Mon panier ({totalItems}) — {totalTTC.toFixed(2)} TND TTC
          </motion.button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl w-full focus:outline-none focus:border-blue-300"
            placeholder="Rechercher un article..." />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {FAMILIES.map(f => (
            <button key={f} onClick={() => setFamily(f)}
              className={`flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-medium transition ${family === f ? "bg-slate-800 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
              {f !== "Tous" && <Tag size={11} />} {f}
            </button>
          ))}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <AnimatePresence>
          {filtered.map((p, i) => {
            const qty = getQty(p.reference);
            const lowStock = p.stock > 0 && p.stock < 5;
            return (
              <motion.div key={p.reference} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 hover:shadow-md transition flex flex-col"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: i * 0.03 }}>
                <div className="w-full h-24 bg-gradient-to-br from-slate-100 to-slate-50 rounded-xl flex items-center justify-center mb-3">
                  <Package size={28} className="text-slate-300" />
                </div>
                <div className="flex items-start justify-between mb-1">
                  <div className="font-semibold text-slate-800 text-sm leading-tight flex-1">{p.name}</div>
                </div>
                <div className="text-slate-400 text-xs mb-1">Réf: {p.reference} · {p.family}</div>
                <div className="flex items-center justify-between mt-auto pt-3">
                  <div>
                    <div className="font-bold text-blue-700">{p.price.toFixed(3)} TND</div>
                    <div className={`text-xs mt-0.5 ${p.stock === 0 ? "text-red-500" : lowStock ? "text-amber-500" : "text-emerald-600"}`}>
                      {p.stock === 0 ? "Rupture" : lowStock ? `⚠ Stock: ${p.stock}` : `Dispo (${p.stock})`}
                    </div>
                  </div>
                </div>
                <div className="mt-3">
                  {qty === 0 ? (
                    <button onClick={() => p.stock > 0 && addToCart(p)} disabled={p.stock === 0}
                      className="w-full flex items-center justify-center gap-1.5 text-xs bg-blue-600 text-white py-2.5 rounded-xl hover:bg-blue-500 transition font-semibold disabled:opacity-40">
                      <Plus size={13} /> Ajouter au panier
                    </button>
                  ) : (
                    <div className="flex items-center justify-between bg-blue-50 rounded-xl p-1">
                      <button onClick={() => updateQty(p.reference, -1)} className="w-9 h-9 flex items-center justify-center bg-white rounded-lg shadow-sm hover:bg-red-50 transition font-bold text-red-500">−</button>
                      <span className="font-bold text-blue-700 text-sm">{qty}</span>
                      <button onClick={() => updateQty(p.reference, 1)} className="w-9 h-9 flex items-center justify-center bg-white rounded-lg shadow-sm hover:bg-emerald-50 transition font-bold text-emerald-500">+</button>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
      {filtered.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <Package size={40} className="mx-auto mb-3 opacity-20" />
          <div className="font-medium">Aucun article trouvé</div>
        </div>
      )}
    </div>
  );
}
