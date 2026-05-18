"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ShoppingCart, Plus, Minus, X, Package } from "lucide-react";
import { DUMMY_PRODUCTS } from "@/lib/dummy-data";

type CartItem = { product: typeof DUMMY_PRODUCTS[0]; qty: number };

export default function CataloguePage() {
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);

  const filtered = DUMMY_PRODUCTS.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.reference.toLowerCase().includes(search.toLowerCase())
  );

  function addToCart(product: typeof DUMMY_PRODUCTS[0]) {
    setCart(prev => {
      const existing = prev.find(i => i.product.reference === product.reference);
      if (existing) return prev.map(i => i.product.reference === product.reference ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { product, qty: 1 }];
    });
  }

  function updateQty(ref: string, delta: number) {
    setCart(prev => prev.map(i => i.product.reference === ref ? { ...i, qty: Math.max(0, i.qty + delta) } : i).filter(i => i.qty > 0));
  }

  function getQty(ref: string) {
    return cart.find(i => i.product.reference === ref)?.qty ?? 0;
  }

  const totalItems = cart.reduce((s, i) => s + i.qty, 0);
  const totalAmount = cart.reduce((s, i) => s + i.qty * i.product.price, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Catalogue produits</h1>
          <p className="text-slate-500 text-sm">{DUMMY_PRODUCTS.length} produits disponibles</p>
        </div>
        <motion.button onClick={() => setShowCart(true)} className="relative flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl font-medium hover:bg-blue-500 transition text-sm"
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <ShoppingCart size={16} />
          Panier
          {totalItems > 0 && (
            <span className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full text-xs flex items-center justify-center font-bold">
              {totalItems}
            </span>
          )}
        </motion.button>
      </div>

      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          className="pl-9 pr-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl w-full focus:outline-none focus:border-blue-300"
          placeholder="Rechercher par nom ou référence..." />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((p, i) => {
          const qty = getQty(p.reference);
          return (
            <motion.div key={p.reference} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 hover:shadow-md transition"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <div className="w-full h-28 bg-gradient-to-br from-slate-100 to-slate-50 rounded-xl flex items-center justify-center mb-3">
                <Package size={32} className="text-slate-300" />
              </div>
              <div className="font-semibold text-slate-800 text-sm leading-tight mb-1">{p.name}</div>
              <div className="text-slate-400 text-xs mb-1">Réf: {p.reference}</div>
              <div className="text-slate-400 text-xs mb-3">Code-barres: {p.barcode}</div>
              <div className="flex items-center justify-between mb-3">
                <div className="font-bold text-slate-800">{p.price.toFixed(3)} TND</div>
                <div className={`text-xs px-2 py-0.5 rounded-full ${p.stock > 20 ? "bg-emerald-50 text-emerald-700" : p.stock > 5 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-600"}`}>
                  Stock: {p.stock}
                </div>
              </div>

              {qty === 0 ? (
                <motion.button onClick={() => addToCart(p)} disabled={p.stock === 0}
                  className="w-full flex items-center justify-center gap-1.5 text-xs bg-blue-600 text-white py-2.5 rounded-xl hover:bg-blue-500 transition font-medium disabled:opacity-40"
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Plus size={13} /> Ajouter
                </motion.button>
              ) : (
                <div className="flex items-center justify-between bg-blue-50 rounded-xl p-1">
                  <button onClick={() => updateQty(p.reference, -1)} className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm hover:bg-red-50 transition">
                    <Minus size={13} className="text-red-500" />
                  </button>
                  <span className="font-bold text-blue-700">{qty}</span>
                  <button onClick={() => updateQty(p.reference, 1)} className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm hover:bg-emerald-50 transition">
                    <Plus size={13} className="text-emerald-500" />
                  </button>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Cart Modal */}
      <AnimatePresence>
        {showCart && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
              <div className="bg-slate-800 text-white p-5 flex items-center justify-between">
                <div>
                  <div className="font-bold text-lg">Panier en cours</div>
                  <div className="text-slate-400 text-xs">{totalItems} articles</div>
                </div>
                <button onClick={() => setShowCart(false)} className="p-2 hover:bg-white/10 rounded-lg transition"><X size={18} /></button>
              </div>
              <div className="p-5">
                {cart.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <ShoppingCart size={32} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Panier vide</p>
                  </div>
                ) : (
                  <div className="space-y-2 mb-4">
                    {cart.map(item => (
                      <div key={item.product.reference} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl text-sm">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-slate-800 truncate">{item.product.name}</div>
                          <div className="text-slate-400 text-xs">{item.product.price.toFixed(3)} TND × {item.qty}</div>
                        </div>
                        <div className="font-semibold text-slate-800 ml-3">{(item.product.price * item.qty).toFixed(3)}</div>
                      </div>
                    ))}
                  </div>
                )}
                {cart.length > 0 && (
                  <>
                    <div className="border-t border-slate-100 pt-3 mb-4">
                      <div className="flex justify-between text-sm font-bold">
                        <span className="text-slate-700">Total HT</span>
                        <span className="text-slate-800">{totalAmount.toFixed(3)} TND</span>
                      </div>
                      <div className="flex justify-between text-xs text-slate-400 mt-1">
                        <span>TVA 19%</span>
                        <span>{(totalAmount * 0.19).toFixed(3)} TND</span>
                      </div>
                      <div className="flex justify-between text-sm font-bold mt-2 text-blue-700">
                        <span>Net à payer</span>
                        <span>{(totalAmount * 1.19).toFixed(3)} TND</span>
                      </div>
                    </div>
                    <button className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-500 transition text-sm">
                      Valider le panier → BL
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
