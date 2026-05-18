"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Lock, User, ArrowRight, Shield, TrendingUp, MapPin, ShoppingBag } from "lucide-react";

const DEMO_ACCOUNTS = [
  { role: "ADMIN", login: "admin", password: "admin123", label: "Administrateur", desc: "Accès total — tableau de bord IA, carte GPS, gestion utilisateurs", icon: Shield, gradient: "from-slate-700 to-slate-900", bg: "bg-slate-50", border: "border-slate-300", textColor: "text-slate-700" },
  { role: "MANAGER", login: "manager", password: "manager123", label: "Manager", desc: "Supervision terrain, validation documents, objectifs", icon: TrendingUp, gradient: "from-blue-600 to-blue-800", bg: "bg-blue-50", border: "border-blue-300", textColor: "text-blue-700" },
  { role: "COMMERCIAL", login: "mokhtar", password: "007", label: "Commercial", desc: "Application terrain — GPS, clients, catalogue, caisse", icon: MapPin, gradient: "from-emerald-600 to-emerald-800", bg: "bg-emerald-50", border: "border-emerald-300", textColor: "text-emerald-700" },
  { role: "CLIENT", login: "client", password: "client123", label: "Client", desc: "Portail B2B — catalogue, commandes, suivi livraison", icon: ShoppingBag, gradient: "from-amber-500 to-amber-700", bg: "bg-amber-50", border: "border-amber-300", textColor: "text-amber-700" },
];

const ROLE_REDIRECTS: Record<string, string> = {
  ADMIN: "/admin/dashboard",
  MANAGER: "/manager/dashboard",
  COMMERCIAL: "/commercial/dashboard",
  CLIENT: "/client/dashboard",
};

export default function LoginPage() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeCard, setActiveCard] = useState<number | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ login, password }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Identifiants incorrects"); return; }
      router.push(ROLE_REDIRECTS[data.user?.role] || "/login");
    } catch { setError("Erreur de connexion au serveur"); }
    finally { setLoading(false); }
  }

  function quickLogin(acc: typeof DEMO_ACCOUNTS[0], i: number) {
    setLogin(acc.login); setPassword(acc.password); setError(""); setActiveCard(i);
  }

  return (
    <div className="min-h-screen flex bg-slate-950 overflow-hidden">
      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-[44%] relative flex-col items-center justify-center p-12">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-950 via-slate-900 to-slate-950" />
        <div className="absolute top-0 left-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-emerald-600/10 rounded-full blur-3xl" />
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
        <div className="relative z-10 text-center max-w-md">
          <motion.div className="flex items-center justify-center mb-8" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.5 }}>
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-2xl shadow-blue-500/30">
              <span className="text-white font-black text-3xl">B</span>
            </div>
          </motion.div>
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
            <h1 className="text-4xl font-black text-white mb-2 tracking-tight">B.I.S</h1>
            <div className="text-blue-400 font-semibold text-lg mb-1">Système Intelligent de Distribution</div>
            <div className="text-slate-500 text-sm mb-10">STE SKY EDITION ET DISTRIBUTION</div>
          </motion.div>
          <motion.div className="space-y-3 text-left" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }}>
            {[["🗺️","Supervision GPS temps réel","Suivi véhicules sur carte Tunisie interactive"],["🤖","Intelligence artificielle","Prédictions, recommandations, anomalies"],["📊","Analytics & performances","Dashboards, objectifs, commissions auto"],["📱","Application terrain mobile","Check-in GPS, enregistrement vocal, offline"]].map(([icon,title,desc],i) => (
              <motion.div key={title} className="flex items-start gap-3 bg-white/5 rounded-2xl p-3.5 border border-white/8"
                initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.5 + i * 0.1 }}>
                <span className="text-xl flex-shrink-0 mt-0.5">{icon}</span>
                <div><div className="text-white font-semibold text-sm">{title}</div><div className="text-slate-400 text-xs mt-0.5">{desc}</div></div>
              </motion.div>
            ))}
          </motion.div>
          <div className="mt-8 text-slate-600 text-xs">Version 2.0 — Édition Intelligence Artificielle</div>
        </div>
      </div>

      {/* Right login panel */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 lg:p-12 bg-slate-50 overflow-y-auto">
        <div className="w-full max-w-lg">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg">
              <span className="text-white font-black text-xl">B</span>
            </div>
            <div><div className="font-black text-slate-800 text-xl">B.I.S Demo</div><div className="text-slate-500 text-xs">Système Intelligent de Distribution</div></div>
          </div>

          <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.35 }}>
            <h2 className="text-2xl font-bold text-slate-800 mb-1">Connexion</h2>
            <p className="text-slate-500 text-sm mb-7">Choisissez un accès démo ou entrez vos identifiants</p>

            {/* Quick login cards */}
            <div className="mb-7">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Accès rapide démo</div>
              <div className="grid grid-cols-2 gap-2.5">
                {DEMO_ACCOUNTS.map((acc, i) => {
                  const Icon = acc.icon;
                  const isActive = activeCard === i;
                  return (
                    <motion.button key={acc.role} onClick={() => quickLogin(acc, i)} type="button"
                      className={`text-left p-4 rounded-2xl border-2 transition-all cursor-pointer ${isActive ? `${acc.bg} ${acc.border} shadow-sm` : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-md"}`}
                      whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.98 }}>
                      <div className="flex items-center gap-2.5 mb-2">
                        <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${acc.gradient} flex items-center justify-center shadow-sm`}>
                          <Icon size={14} className="text-white" />
                        </div>
                        <span className={`text-sm font-bold ${isActive ? acc.textColor : "text-slate-700"}`}>{acc.label}</span>
                      </div>
                      <div className="text-xs text-slate-500 leading-relaxed">{acc.desc}</div>
                      <div className="mt-2.5 text-xs font-mono bg-slate-100 rounded-lg px-2.5 py-1.5 text-slate-500">{acc.login} / {acc.password}</div>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-3 mb-6">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-xs text-slate-400 font-medium">ou saisir manuellement</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1.5 block uppercase tracking-wider">Identifiant</label>
                <div className="relative">
                  <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input value={login} onChange={e => setLogin(e.target.value)} required
                    className="w-full pl-10 pr-4 py-3 bg-white border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 transition font-medium text-slate-800 placeholder:text-slate-300"
                    placeholder="admin, mokhtar, client..." />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1.5 block uppercase tracking-wider">Mot de passe</label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input value={password} onChange={e => setPassword(e.target.value)} required type={showPwd ? "text" : "password"}
                    className="w-full pl-10 pr-11 py-3 bg-white border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 transition font-medium text-slate-800 placeholder:text-slate-300"
                    placeholder="••••••••" />
                  <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition">
                    {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm font-medium"
                    initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                    ⚠️ {error}
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.button type="submit" disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3.5 rounded-xl font-bold text-sm hover:from-blue-500 hover:to-blue-600 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 disabled:opacity-60 mt-2"
                whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
                {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <> Se connecter <ArrowRight size={15} /> </>}
              </motion.button>
            </form>

            <p className="mt-6 text-center text-xs text-slate-400">Application de démonstration — données fictives</p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
