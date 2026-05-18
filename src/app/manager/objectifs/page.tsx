import { COMMERCIAL_PERFORMANCE } from "@/lib/dummy-data";

export default function ObjectifsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Objectifs & Performance</h1>
        <p className="text-slate-500 text-sm">Suivi mensuel — Mai 2026</p>
      </div>

      <div className="grid gap-4">
        {COMMERCIAL_PERFORMANCE.map((c, i) => {
          const pct = Math.round((c.ca / c.objectif) * 100);
          const color = pct >= 100 ? "#10b981" : pct >= 80 ? "#1d4ed8" : "#f59e0b";
          return (
            <div key={c.name} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-sm">
                    {c.name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-800">{c.name}</div>
                    <div className="text-slate-400 text-xs">{c.clients} clients • {c.visites} visites</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold" style={{ color }}>{pct}%</div>
                  <div className="text-slate-400 text-xs">de l'objectif</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="bg-slate-50 rounded-xl p-3 text-center">
                  <div className="text-xs text-slate-400 mb-1">CA Réalisé</div>
                  <div className="font-bold text-slate-800">{c.ca.toLocaleString()} TND</div>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 text-center">
                  <div className="text-xs text-slate-400 mb-1">Objectif</div>
                  <div className="font-bold text-slate-800">{c.objectif.toLocaleString()} TND</div>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 text-center">
                  <div className="text-xs text-slate-400 mb-1">Visites</div>
                  <div className="font-bold text-slate-800">{c.visites}</div>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Progression</span><span>{c.ca.toLocaleString()} / {c.objectif.toLocaleString()} TND</span>
                </div>
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
                </div>
              </div>
              {pct >= 100 && (
                <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 text-center">
                  <span className="text-emerald-700 text-sm font-medium">🏆 Objectif dépassé ! Commission: {Math.round(c.ca * 0.02).toLocaleString()} TND (2%)</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
