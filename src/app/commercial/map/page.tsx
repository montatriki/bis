"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { Navigation, CheckCircle, Mic, X, Route } from "lucide-react";
import { DUMMY_CLIENTS } from "@/lib/dummy-data";

const TunisiaMap = dynamic(() => import("@/components/map/TunisiaMap"), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-slate-100 rounded-2xl animate-pulse flex items-center justify-center text-slate-400">Chargement de la carte...</div>,
});

export default function CommercialMapPage() {
  const [checkinClient, setCheckinClient] = useState<typeof DUMMY_CLIENTS[0] | null>(null);
  const [recording, setRecording] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);
  const [routeOptimized, setRouteOptimized] = useState(false);

  function handleCheckin() {
    setCheckedIn(true);
    setRecording(true);
    setTimeout(() => {
      setRecording(false);
      setCheckinClient(null);
      setCheckedIn(false);
    }, 4000);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Carte GPS</h1>
          <p className="text-slate-500 text-sm">Vos clients et votre position en temps réel</p>
        </div>
        <motion.button
          onClick={() => setRouteOptimized(true)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition ${routeOptimized ? "bg-emerald-500 text-white" : "bg-blue-600 text-white hover:bg-blue-500"}`}
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Route size={15} />
          {routeOptimized ? "Itinéraire optimisé ✓" : "Optimiser l'itinéraire"}
        </motion.button>
      </div>

      {routeOptimized && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-3">
          <CheckCircle size={18} className="text-emerald-600 flex-shrink-0" />
          <div className="text-sm text-emerald-800">
            <span className="font-semibold">Itinéraire TSP optimisé</span> — 17 clients • Distance estimée: 142 km • Temps: ~4h30
          </div>
        </motion.div>
      )}

      <div className="grid lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="h-[500px]">
            <TunisiaMap />
          </div>
        </div>

        <div className="space-y-3">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <h3 className="font-semibold text-slate-800 text-sm mb-3">Clients à visiter</h3>
            <div className="space-y-2 max-h-[440px] overflow-y-auto pr-1">
              {DUMMY_CLIENTS.slice(0, 8).map((c, i) => (
                <motion.button key={c.name}
                  onClick={() => setCheckinClient(c)}
                  className="w-full text-left p-3 rounded-xl bg-slate-50 hover:bg-blue-50 hover:border-blue-200 border border-transparent transition"
                  initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${i < 3 ? "bg-emerald-500" : "bg-slate-300"}`} />
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-slate-800 truncate">{c.name}</div>
                      <div className="text-xs text-slate-400">{c.city}</div>
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Check-in Modal */}
      <AnimatePresence>
        {checkinClient && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
              {!checkedIn ? (
                <>
                  <div className="bg-gradient-to-br from-blue-600 to-blue-700 text-white p-6 text-center">
                    <Navigation size={32} className="mx-auto mb-3 opacity-90" />
                    <div className="font-bold text-lg">{checkinClient.name}</div>
                    <div className="text-blue-200 text-sm">{checkinClient.city} — {checkinClient.governorate}</div>
                  </div>
                  <div className="p-6 text-center">
                    <p className="text-slate-600 text-sm mb-6">Confirmez votre présence chez ce client pour démarrer l'enregistrement vocal de la visite.</p>
                    <motion.button onClick={handleCheckin}
                      className="w-full bg-emerald-500 text-white py-4 rounded-2xl font-bold text-lg hover:bg-emerald-400 transition shadow-lg shadow-emerald-200"
                      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      OUI JE SUIS LÀ
                    </motion.button>
                    <button onClick={() => setCheckinClient(null)} className="mt-3 text-slate-400 text-sm hover:text-slate-600 transition">Annuler</button>
                  </div>
                </>
              ) : (
                <div className="p-8 text-center">
                  <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1 }}
                    className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Mic size={28} className="text-red-500" />
                  </motion.div>
                  <div className="font-bold text-slate-800 mb-1">Enregistrement en cours...</div>
                  <div className="text-slate-500 text-sm mb-4">Parlez de votre visite chez {checkinClient.name}</div>
                  <div className="flex gap-1 justify-center mb-4">
                    {[...Array(12)].map((_, i) => (
                      <motion.div key={i} className="w-1 bg-red-400 rounded-full"
                        animate={{ height: [8, Math.random() * 24 + 8, 8] }}
                        transition={{ repeat: Infinity, duration: 0.5, delay: i * 0.1 }} />
                    ))}
                  </div>
                  <div className="text-xs text-slate-400">L'enregistrement sera envoyé automatiquement au manager</div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
