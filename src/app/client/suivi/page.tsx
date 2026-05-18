"use client";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { Truck, Package, CheckCircle, Clock, MapPin, Phone } from "lucide-react";

const TunisiaMap = dynamic(() => import("@/components/map/TunisiaMap"), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-slate-100 rounded-2xl animate-pulse flex items-center justify-center"><span className="text-slate-400 text-sm">Chargement carte...</span></div>,
});

const DELIVERY = {
  id: "BC-2026-0042",
  commercial: "Mokhtar Trabelsi",
  phone: "+216 98 000 000",
  vehicle: "Peugeot 206 — 206TU7140",
  date: "17/05/2026",
  expectedDate: "19/05/2026",
  status: "processing",
  currentLat: 36.7257,
  currentLng: 9.1817,
  steps: [
    { label: "Commande reçue", date: "17/05 08:30", done: true },
    { label: "Validation manager", date: "17/05 09:45", done: true },
    { label: "Préparation dépôt", date: "17/05 11:00", done: true },
    { label: "En cours de livraison", date: "En attente", done: false },
    { label: "Livré", date: `Prévu 19/05`, done: false },
  ],
  items: [
    { name: "Coffret Échecs 2025", qty: 3, price: 12.5 },
    { name: "Jeux de bois 4 en 1", qty: 2, price: 16.0 },
    { name: "Surprise DouDou 12 pcs", qty: 1, price: 22.0 },
    { name: "Mini Puzzle 2 en 1", qty: 2, price: 9.0 },
    { name: "Domino Bois 28pcs", qty: 2, price: 11.0 },
    { name: "Mini Box 9pcs", qty: 1, price: 7.5 },
  ],
};

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  processing: { label: "En préparation", color: "text-amber-700", bg: "bg-amber-100" },
  shipped: { label: "En livraison", color: "text-blue-700", bg: "bg-blue-100" },
  delivered: { label: "Livré", color: "text-emerald-700", bg: "bg-emerald-100" },
};

export default function SuiviPage() {
  const s = STATUS_LABELS[DELIVERY.status];
  const completedSteps = DELIVERY.steps.filter(st => st.done).length;
  const progress = (completedSteps / DELIVERY.steps.length) * 100;
  const totalHT = DELIVERY.items.reduce((sum, i) => sum + i.qty * i.price, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Suivi des livraisons</h1>
        <p className="text-slate-500 text-sm">1 commande en cours — Mise à jour en temps réel</p>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Left: tracking card */}
        <div className="lg:col-span-3 space-y-5">
          <motion.div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-5">
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                  <div className="font-bold text-xl">{DELIVERY.id}</div>
                  <div className="text-blue-200 text-sm mt-1 flex items-center gap-2">
                    <Truck size={13} />
                    {DELIVERY.commercial} — {DELIVERY.vehicle}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`text-xs px-3 py-1.5 rounded-full font-semibold ${s.bg} ${s.color}`}>{s.label}</span>
                  <a href={`tel:${DELIVERY.phone}`} className="flex items-center gap-1.5 bg-white/20 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-white/30 transition">
                    <Phone size={12} /> Appeler
                  </a>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-4 text-sm text-blue-200">
                <span className="flex items-center gap-1.5"><Clock size={13} /> Commandé le {DELIVERY.date}</span>
                <span className="flex items-center gap-1.5"><Truck size={13} /> Livraison prévue {DELIVERY.expectedDate}</span>
              </div>
            </div>

            <div className="p-5 space-y-6">
              {/* Progress */}
              <div>
                <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                  <span className="font-semibold">Progression</span>
                  <span>{completedSteps}/{DELIVERY.steps.length} étapes complétées</span>
                </div>
                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full"
                    initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 1, ease: "easeOut" }} />
                </div>
              </div>

              {/* Steps */}
              <div className="space-y-3">
                {DELIVERY.steps.map((step, si) => (
                  <div key={si} className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${step.done ? "bg-emerald-500" : "bg-slate-100"}`}>
                      {step.done ? <CheckCircle size={15} className="text-white" /> : <div className="w-2 h-2 rounded-full bg-slate-300" />}
                    </div>
                    <div className="flex-1 flex items-center justify-between">
                      <span className={`text-sm ${step.done ? "text-slate-800 font-semibold" : "text-slate-400"}`}>{step.label}</span>
                      <span className="text-xs text-slate-400">{step.date}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Articles */}
              <div className="border-t border-slate-100 pt-5">
                <h3 className="font-bold text-slate-700 text-sm mb-3">{DELIVERY.items.length} articles commandés</h3>
                <div className="space-y-2">
                  {DELIVERY.items.map((item, ii) => (
                    <div key={ii} className="flex items-center justify-between text-sm bg-slate-50 rounded-xl px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <Package size={13} className="text-slate-400" />
                        <span className="text-slate-700 font-medium">{item.name}</span>
                        <span className="text-slate-400 text-xs">×{item.qty}</span>
                      </div>
                      <span className="font-semibold text-slate-800">{(item.price * item.qty).toFixed(3)} TND</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between font-bold text-sm mt-3 pt-3 border-t border-slate-100">
                  <span className="text-slate-700">Total HT</span>
                  <span className="text-blue-700">{totalHT.toFixed(3)} TND</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Right: map */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
              <MapPin size={15} className="text-blue-500" />
              <div>
                <div className="font-bold text-slate-800 text-sm">Position du livreur</div>
                <div className="text-slate-400 text-xs">Actualisée il y a 2 min</div>
              </div>
              <div className="ml-auto flex items-center gap-1.5 text-xs text-emerald-600 font-semibold">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                En route
              </div>
            </div>
            <div className="h-[300px]"><TunisiaMap /></div>
          </div>

          {/* Estimated arrival */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <div className="font-bold text-slate-800 mb-3">Estimation d'arrivée</div>
            <div className="space-y-3">
              {[
                { label: "Date prévue", value: DELIVERY.expectedDate, color: "text-blue-700" },
                { label: "Délai estimé", value: "2 jours ouvrables", color: "text-slate-700" },
                { label: "Distance restante", value: "142 km", color: "text-slate-700" },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex justify-between items-center py-2 border-b border-slate-50 last:border-0">
                  <span className="text-slate-500 text-sm">{label}</span>
                  <span className={`font-bold text-sm ${color}`}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
