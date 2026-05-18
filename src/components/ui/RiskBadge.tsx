export default function RiskBadge({ score }: { score: number }) {
  const config = score >= 61
    ? { label: "Risque élevé", cls: "bg-red-100 text-red-700 border-red-200" }
    : score >= 31
    ? { label: "Risque modéré", cls: "bg-amber-100 text-amber-700 border-amber-200" }
    : { label: "Risque faible", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" };

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${config.cls}`}>
      {config.label}
    </span>
  );
}
