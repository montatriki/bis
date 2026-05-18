"use client";
import { motion } from "framer-motion";

interface StatCardProps {
  title: string;
  value: string | number;
  sub?: string;
  icon: string;
  color?: string;
  trend?: number;
  delay?: number;
}

export default function StatCard({ title, value, sub, icon, color = "#1e40af", trend, delay = 0 }: StatCardProps) {
  return (
    <motion.div
      className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-slate-500 text-sm mb-1">{title}</p>
          <p className="text-2xl font-bold text-slate-800 truncate">{value}</p>
          {sub && <p className="text-slate-400 text-xs mt-1">{sub}</p>}
          {trend !== undefined && (
            <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${trend >= 0 ? "text-emerald-600" : "text-red-500"}`}>
              <span>{trend >= 0 ? "↑" : "↓"} {Math.abs(trend)}%</span>
              <span className="text-slate-400 font-normal">vs mois dernier</span>
            </div>
          )}
        </div>
        <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ml-3"
          style={{ background: color + "15" }}>
          {icon}
        </div>
      </div>
      <div className="mt-4 h-1 rounded-full bg-slate-100">
        <motion.div className="h-full rounded-full" style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: "60%" }}
          transition={{ delay: delay + 0.3, duration: 0.6 }} />
      </div>
    </motion.div>
  );
}
