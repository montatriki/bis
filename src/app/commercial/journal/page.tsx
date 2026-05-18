import { Banknote, TrendingUp, FileText, Clock } from "lucide-react";

const ENTRIES = [
  { time: "08:15", type: "Ouverture", description: "Début de mission — Départ dépôt Tunis", amount: 0, balance: 500, color: "text-slate-500", bg: "bg-slate-50" },
  { time: "09:30", type: "Encaissement", description: "Recouvrement — AGIL BEJA SUD", amount: 1240, balance: 1740, color: "text-emerald-600", bg: "bg-emerald-50" },
  { time: "10:45", type: "Encaissement", description: "Recouvrement — Librairie El Wafa", amount: 680, balance: 2420, color: "text-emerald-600", bg: "bg-emerald-50" },
  { time: "11:22", type: "BL émis", description: "Bon livraison — STE SKY EDITION TIC252816", amount: -2150, balance: 2420, color: "text-blue-600", bg: "bg-blue-50" },
  { time: "12:00", type: "Frais", description: "Carburant — Station Naftal", amount: -85, balance: 2335, color: "text-red-500", bg: "bg-red-50" },
  { time: "13:30", type: "Encaissement", description: "Recouvrement — Papeterie Centrale", amount: 920, balance: 3255, color: "text-emerald-600", bg: "bg-emerald-50" },
  { time: "15:10", type: "BL émis", description: "Bon livraison — Grossiste El Amal", amount: -3200, balance: 3255, color: "text-blue-600", bg: "bg-blue-50" },
  { time: "16:45", type: "Encaissement", description: "Recouvrement — Librairie Saphir", amount: 440, balance: 3695, color: "text-emerald-600", bg: "bg-emerald-50" },
  { time: "17:30", type: "Clôture", description: "Fin de mission — Retour dépôt", amount: 0, balance: 3695, color: "text-slate-500", bg: "bg-slate-50" },
];

export default function JournalPage() {
  const totalEncaisse = ENTRIES.filter(e => e.amount > 0).reduce((s, e) => s + e.amount, 0);
  const totalBL = Math.abs(ENTRIES.filter(e => e.type === "BL émis").reduce((s, e) => s + e.amount, 0));
  const totalFrais = Math.abs(ENTRIES.filter(e => e.type === "Frais").reduce((s, e) => s + e.amount, 0));
  const nbBL = ENTRIES.filter(e => e.type === "BL émis").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Journal de caisse</h1>
        <p className="text-slate-500 text-sm">17/05/2026 — Mokhtar Trabelsi</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total encaissé", value: `${totalEncaisse.toLocaleString()} TND`, icon: Banknote, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200" },
          { label: "Total BL émis", value: `${totalBL.toLocaleString()} TND`, icon: FileText, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200" },
          { label: "Frais de route", value: `${totalFrais.toLocaleString()} TND`, icon: TrendingUp, color: "text-red-500", bg: "bg-red-50", border: "border-red-200" },
          { label: "Bon de livraison", value: `${nbBL} BL`, icon: Clock, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
        ].map(({ label, value, icon: Icon, color, bg, border }) => (
          <div key={label} className={`${bg} border ${border} rounded-2xl p-4`}>
            <div className={`${color} mb-2`}><Icon size={20} /></div>
            <div className={`text-xl font-bold ${color}`}>{value}</div>
            <div className="text-slate-500 text-xs mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Historique des opérations</h2>
        </div>
        <div className="divide-y divide-slate-50">
          {ENTRIES.map((e, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition">
              <div className="text-slate-400 text-xs font-mono w-12 flex-shrink-0">{e.time}</div>
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${e.amount > 0 ? "bg-emerald-500" : e.amount < 0 ? e.type === "BL émis" ? "bg-blue-500" : "bg-red-500" : "bg-slate-300"}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${e.bg} ${e.color}`}>{e.type}</span>
                </div>
                <div className="text-slate-600 text-sm mt-0.5 truncate">{e.description}</div>
              </div>
              <div className="text-right flex-shrink-0">
                {e.amount !== 0 && (
                  <div className={`font-semibold text-sm ${e.amount > 0 ? "text-emerald-600" : "text-red-500"}`}>
                    {e.amount > 0 ? "+" : ""}{e.amount.toLocaleString()} TND
                  </div>
                )}
                <div className="text-slate-400 text-xs">{e.balance.toLocaleString()} TND</div>
              </div>
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50">
          <span className="font-semibold text-slate-700">Solde final de caisse</span>
          <span className="font-bold text-emerald-600 text-lg">{ENTRIES[ENTRIES.length - 1].balance.toLocaleString()} TND</span>
        </div>
      </div>
    </div>
  );
}
