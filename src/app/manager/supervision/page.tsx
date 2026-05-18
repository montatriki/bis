"use client";
import dynamic from "next/dynamic";

const TunisiaMap = dynamic(() => import("@/components/map/TunisiaMap"), { ssr: false, loading: () => <div className="w-full h-full bg-slate-100 rounded-2xl animate-pulse" /> });

const AGENTS = [
  { name: "Mokhtar Trabelsi", plate: "206TU7140", status: "active", lat: "36.7257", lng: "9.1817", speed: 0, visited: 14, total: 17, ca: 3506, lastAction: "Visite AGIL BEJA SUD" },
  { name: "HICHEM", plate: "238TU1019", status: "offline", lat: "—", lng: "—", speed: 0, visited: 8, total: 14, ca: 2100, lastAction: "Hors ligne depuis 2h" },
  { name: "FOUED", plate: "243TU3251", status: "moving", lat: "35.8254", lng: "10.636", speed: 62, visited: 11, total: 15, ca: 4200, lastAction: "En déplacement vers Monastir" },
  { name: "Anis", plate: "TN07649", status: "stopped", lat: "35.5047", lng: "11.062", speed: 0, visited: 6, total: 12, ca: 1800, lastAction: "Pause — arrêté depuis 18 min" },
];

const STATUS = {
  active: { label: "En mission", dot: "bg-emerald-500", bg: "bg-emerald-50", text: "text-emerald-700" },
  moving: { label: "En déplacement", dot: "bg-blue-500", bg: "bg-blue-50", text: "text-blue-700" },
  stopped: { label: "Arrêté", dot: "bg-amber-500", bg: "bg-amber-50", text: "text-amber-700" },
  offline: { label: "Hors ligne", dot: "bg-slate-400", bg: "bg-slate-50", text: "text-slate-600" },
};

export default function SupervisionPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Supervision terrain</h1>
        <p className="text-slate-500 text-sm">Positions GPS en temps réel</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800">Carte Tunisie — Vue Manager</h2>
          </div>
          <div className="h-[500px]">
            <TunisiaMap />
          </div>
        </div>

        <div className="space-y-3">
          {AGENTS.map((a) => {
            const s = STATUS[a.status as keyof typeof STATUS];
            return (
              <div key={a.name} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-semibold text-slate-800 text-sm">{a.name}</div>
                    <div className="text-slate-400 text-xs">{a.plate}</div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${s.bg} ${s.text} flex items-center gap-1`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                    {s.label}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="bg-slate-50 rounded-lg p-2 text-center">
                    <div className="text-xs text-slate-400">Visites</div>
                    <div className="font-bold text-sm text-slate-800">{a.visited}/{a.total}</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-2 text-center">
                    <div className="text-xs text-slate-400">CA</div>
                    <div className="font-bold text-sm text-slate-800">{a.ca.toLocaleString()}</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-2 text-center">
                    <div className="text-xs text-slate-400">Vitesse</div>
                    <div className="font-bold text-sm text-slate-800">{a.speed} km/h</div>
                  </div>
                </div>
                <div className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-1.5">{a.lastAction}</div>
                <div className="flex gap-2 mt-3">
                  <button className="flex-1 text-xs text-blue-600 border border-blue-200 bg-blue-50 py-1.5 rounded-lg hover:bg-blue-100 transition">📞 Appeler</button>
                  <button className="flex-1 text-xs text-slate-600 border border-slate-200 bg-slate-50 py-1.5 rounded-lg hover:bg-slate-100 transition">📋 Journal</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
