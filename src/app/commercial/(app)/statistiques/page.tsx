"use client";
import { motion } from "framer-motion";
import {
  Users, MapPin, ShoppingBag, TrendingUp, AlertTriangle, ChevronRight,
  CreditCard, Loader2, Package, FileText, MessageCircle,
} from "lucide-react";
import { useDashboard, fmtMoney, fmtCompact, fmtInt } from "@/lib/use-dashboard";
import { useClientActif } from "@/lib/client-actif";

export default function CommercialStatistiquesPage() {
  const { data, loading, error } = useDashboard("commercial");
  const { client: clientActif } = useClientActif();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";

  const k = data?.kpis;
  // Objectif indicatif tant que les objectifs commerciaux ne sont pas en base.
  const objectifCA = 5000;
  const caMoisCourant = data?.serie?.length ? data.serie[data.serie.length - 1].ca : 0;
  const pctObjectif = objectifCA > 0 ? Math.min(100, Math.round((caMoisCourant / objectifCA) * 100)) : 0;

  const stats = [
    { label: "CA (12 mois)", value: `${fmtCompact(k?.ca)} TND`, sub: `${fmtInt(k?.nbDocs)} documents`, pct: 100, icon: TrendingUp, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "CA du mois", value: `${fmtCompact(caMoisCourant)} TND`, sub: `Objectif : ${fmtInt(objectifCA)} TND`, pct: pctObjectif, icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Créances clients", value: `${fmtCompact(k?.creances)} TND`, sub: `${fmtInt(data?.aRisque?.length)} clients à risque`, pct: 60, icon: CreditCard, color: "text-purple-600", bg: "bg-purple-50" },
    { label: "Panier moyen", value: `${fmtMoney(k?.panierMoyen)} TND`, sub: `${fmtInt(k?.nbClients)} clients actifs`, pct: 75, icon: ShoppingBag, color: "text-amber-600", bg: "bg-amber-50" },
  ];

  if (loading) {
    return <div className="py-24 text-center text-[var(--text-secondary)]"><Loader2 className="animate-spin mx-auto mb-3" size={26} /> Chargement des données…</div>;
  }
  if (error) {
    return <div className="p-6 rounded-2xl bg-red-500/10 text-red-600 text-sm">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <motion.div className="bg-gradient-to-r from-emerald-700 to-emerald-600 rounded-2xl p-6 text-white"
        initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="text-emerald-200 text-sm mb-1">{greeting},</div>
            <h1 className="text-2xl font-bold">Espace commercial</h1>
            <div className="text-emerald-200 text-sm mt-1 flex items-center gap-2">
              <MapPin size={13} /> {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Raccourci vers la sélection du client quand aucune visite n'est
                en cours : c'est le premier geste de la tournée. */}
            {!clientActif && (
              <a href="/commercial/clients"
                className="bg-white text-emerald-700 rounded-2xl px-4 py-3 font-bold text-sm hover:bg-emerald-50 transition flex items-center gap-2">
                <Users size={16} /> Choisir un client
              </a>
            )}
            <div className="bg-white/10 rounded-2xl p-4">
              <div className="text-emerald-200 text-xs mb-1 font-semibold uppercase tracking-wide">Chiffre d&apos;affaires</div>
              <div className="font-bold text-xl">{fmtMoney(k?.ca)} TND</div>
              <div className="text-emerald-200 text-xs mt-1">{fmtInt(k?.nbDocs)} documents · 12 derniers mois</div>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <motion.div key={s.label} className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-primary)] shadow-sm p-5"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
            <div className={`w-10 h-10 ${s.bg} rounded-xl flex items-center justify-center mb-3`}>
              <s.icon size={18} className={s.color} />
            </div>
            <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-[var(--text-secondary)] text-sm mt-1">{s.label}</div>
            <div className="text-[var(--text-secondary)] opacity-70 text-xs mt-0.5 mb-2">{s.sub}</div>
            <div className="h-1.5 bg-[var(--bg-primary)] rounded-full overflow-hidden">
              <motion.div className={`h-full rounded-full ${s.pct >= 80 ? "bg-emerald-500" : s.pct >= 60 ? "bg-amber-500" : "bg-red-400"}`}
                initial={{ width: 0 }} animate={{ width: `${s.pct}%` }} transition={{ duration: 0.8, delay: 0.3 + i * 0.07 }} />
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {/* Clients à risque — relance WhatsApp directe */}
          <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-primary)] shadow-sm overflow-hidden">
            <div className="p-5 border-b border-[var(--border-primary)] flex items-center justify-between">
              <h2 className="font-bold text-[var(--text-primary)] flex items-center gap-2">
                <AlertTriangle size={16} className="text-red-500" /> Clients à risque de perte
              </h2>
              <a href="/commercial/recouvrement" className="text-blue-600 text-sm hover:text-blue-500 flex items-center gap-1">
                Recouvrement <ChevronRight size={14} />
              </a>
            </div>
            <div className="divide-y divide-[var(--border-primary)]/60">
              {(data?.aRisque ?? []).length === 0 && (
                <div className="px-5 py-8 text-center text-sm text-[var(--text-secondary)]">Aucun client en situation de risque.</div>
              )}
              {(data?.aRisque ?? []).slice(0, 6).map((c, i) => {
                const msg = encodeURIComponent(
                  `Bonjour ${c.raisonSocial},\nNous revenons vers vous concernant votre créance de ${fmtMoney(c.soldeFin)} TND.\nCordialement.`
                );
                const tel = (c.tel ?? "").replace(/[^0-9]/g, "");
                return (
                  <motion.div key={c.id} className="flex items-center gap-4 px-5 py-4 hover:bg-[var(--accent-light)] transition"
                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.06 }}>
                    <div className="w-9 h-9 bg-red-50 dark:bg-red-500/10 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold text-red-600">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-[var(--text-primary)] text-sm truncate">{c.raisonSocial}</div>
                      <div className="text-[var(--text-secondary)] text-xs flex items-center gap-1.5">
                        <MapPin size={10} /> {c.ville || c.gouvernorat || "—"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs font-semibold text-red-600">{fmtMoney(c.soldeFin)} TND</span>
                      {tel ? (
                        <a href={`https://wa.me/${tel.startsWith("216") ? tel : `216${tel}`}?text=${msg}`}
                          target="_blank" rel="noopener noreferrer" title="Relancer par WhatsApp"
                          className="w-8 h-8 flex items-center justify-center text-[var(--text-secondary)] hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition">
                          <MessageCircle size={14} />
                        </a>
                      ) : (
                        <span className="w-8 h-8 flex items-center justify-center text-[var(--text-secondary)] opacity-30" title="Aucun téléphone"><MessageCircle size={14} /></span>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Top clients */}
          <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-primary)] shadow-sm overflow-hidden">
            <div className="p-5 border-b border-[var(--border-primary)]">
              <h2 className="font-bold text-[var(--text-primary)] flex items-center gap-2">
                <Users size={16} className="text-emerald-500" /> Meilleurs clients
                <span className="ml-auto text-xs bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full font-semibold">
                  {data?.topClients?.length ?? 0}
                </span>
              </h2>
            </div>
            <div className="divide-y divide-[var(--border-primary)]/60">
              {(data?.topClients ?? []).slice(0, 6).map((c) => (
                <div key={String(c.codeCli ?? c.nom)} className="flex items-center gap-4 px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-[var(--text-primary)] text-sm truncate">{c.nom}</div>
                    <div className="text-[var(--text-secondary)] text-xs">{c.docs} document(s)</div>
                  </div>
                  <span className="font-bold text-[var(--text-primary)] text-sm tabular-nums">{fmtMoney(c.ca)} TND</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="font-bold text-[var(--text-secondary)] text-sm px-1">Actions rapides</h3>
          {[
            { label: "Mes clients", desc: "Fiche client + commande", href: "/commercial/clients", icon: Users, primary: true },
            { label: "Carte GPS", desc: "Position et tournée", href: "/commercial/map", icon: MapPin },
            { label: "Catalogue", desc: "Passer une commande", href: "/commercial/catalogue", icon: ShoppingBag },
            { label: "Recouvrement", desc: "Encaissements", href: "/commercial/recouvrement", icon: CreditCard },
          ].map((a) => (
            <a key={a.label} href={a.href}
              className={`${a.primary ? "bg-emerald-600 text-white" : "bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-primary)]"} rounded-2xl p-4 hover:opacity-90 transition flex items-center gap-3 group`}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${a.primary ? "bg-white/20" : "bg-[var(--bg-primary)]"}`}>
                <a.icon size={17} className={a.primary ? "text-white" : "text-[var(--text-secondary)]"} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">{a.label}</div>
                <div className={`text-xs mt-0.5 ${a.primary ? "opacity-70" : "text-[var(--text-secondary)]"}`}>{a.desc}</div>
              </div>
              <ChevronRight size={15} className="opacity-40 group-hover:opacity-80 transition" />
            </a>
          ))}

          <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-primary)] shadow-sm p-4 mt-2">
            <h4 className="font-bold text-[var(--text-secondary)] text-sm mb-3 flex items-center gap-2">
              <Package size={14} className="text-emerald-500" /> État du stock
            </h4>
            {[
              ["Articles référencés", fmtInt(k?.nbArticles), "text-[var(--text-primary)]"],
              ["Ruptures de stock", fmtInt(k?.ruptures), "text-red-600"],
              ["Sous stock mini", fmtInt(k?.sousMini), "text-amber-600"],
              ["Taux de rupture", `${k?.tauxRupture ?? 0} %`, "text-red-600"],
              ["Valeur du stock", `${fmtCompact(k?.valeurStock)} TND`, "text-emerald-600"],
            ].map(([label, value, color]) => (
              <div key={label} className="flex justify-between py-2 border-b border-[var(--border-primary)]/60 last:border-0 text-sm">
                <span className="text-[var(--text-secondary)]">{label}</span>
                <span className={`font-bold ${color}`}>{value}</span>
              </div>
            ))}
          </div>

          <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-primary)] shadow-sm p-4">
            <h4 className="font-bold text-[var(--text-secondary)] text-sm mb-3 flex items-center gap-2">
              <FileText size={14} className="text-blue-500" /> Répartition documents
            </h4>
            {(data?.parType ?? []).slice(0, 5).map((t) => (
              <div key={t.type} className="flex justify-between py-2 border-b border-[var(--border-primary)]/60 last:border-0 text-sm">
                <span className="text-[var(--text-secondary)]">{t.type} <span className="opacity-60">({t.count})</span></span>
                <span className="font-bold text-[var(--text-primary)] tabular-nums">{fmtCompact(t.total)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
