"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  Search, X, FileText, AlertTriangle, MapPin, Loader2, MessageCircle, Building2,
  Crosshair, Check, UserPlus,
} from "lucide-react";
import RiskBadge from "@/components/ui/RiskBadge";
import { useClientActif } from "@/lib/client-actif";
import { formatDistance } from "@/lib/geo";
import NouveauClientModal from "@/components/commercial/NouveauClientModal";

type Client = {
  id: number; raisonSocial: string; ville: string | null; gouvernorat: string | null;
  tel: string | null; email: string | null; adresse: string | null;
  famille: string | null; sousFamille: string | null;
  soldeFin: number; debit: number; credit: number; plafond: number | null;
  matriculeF: string | null;
  latitude: number | null; longitude: number | null;
};
type Doc = {
  refDoc: string; typeDoc: string; dateDoc: string | null;
  ttcNet: number; soldeDoc: number; etat: string | null;
};

const fmt = (v: unknown) =>
  new Intl.NumberFormat("fr-TN", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(Number(v) || 0);

/** Quelques tiers importés n'ont pas de raison sociale : on retombe sur le code. */
const nomClient = (c: Client) => (c.raisonSocial || "").trim() || `Client ${c.id}`;

/** Plafond par défaut quand le tiers n'en a pas de renseigné. */
const PLAFOND_DEFAUT = 5000;

/**
 * Score de risque dérivé du taux d'utilisation du plafond de crédit.
 * (A calcule le risque au niveau du recouvrement ; ici on le rend visible côté fiche.)
 */
function riskScore(c: Client): number {
  const plafond = c.plafond && c.plafond > 0 ? c.plafond : PLAFOND_DEFAUT;
  if (c.soldeFin <= 0) return 5;
  return Math.max(5, Math.min(100, Math.round((c.soldeFin / plafond) * 100)));
}

export default function ClientsPage() {
  const router = useRouter();
  const { client: clientActif, choisir, verifierPosition, position } = useClientActif();
  const [search, setSearch] = useState("");
  const [gov, setGov] = useState("Tous");
  const [nouveau, setNouveau] = useState(false);
  // Client dont la position ne correspond pas à celle du commercial : on
  // demande confirmation avant de démarrer la visite.
  const [aConfirmer, setAConfirmer] = useState<{ client: Client; distance: number | null; motif: string } | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [gouvernorats, setGouvernorats] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [totalCreances, setTotalCreances] = useState(0);
  const [loading, setLoading] = useState(true);

  const [detail, setDetail] = useState<Client | null>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      const qs = new URLSearchParams({ limit: "200" });
      if (search) qs.set("search", search);
      if (gov !== "Tous") qs.set("gouvernorat", gov);
      fetch(`/api/clients?${qs}`)
        .then((r) => r.json())
        .then((d) => {
          if (cancelled) return;
          setClients(d.rows ?? []);
          setTotal(d.total ?? 0);
          setTotalCreances(d.totalCreances ?? 0);
          if (d.gouvernorats?.length) setGouvernorats(d.gouvernorats);
          setLoading(false);
        })
        .catch(() => { if (!cancelled) setLoading(false); });
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [search, gov]);

  useEffect(() => {
    if (!detail) return;
    let cancelled = false;
    fetch(`/api/clients?codeCli=${detail.id}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) { setDocs(d.docs ?? []); setDocsLoading(false); } })
      .catch(() => { if (!cancelled) setDocsLoading(false); });
    return () => { cancelled = true; };
  }, [detail]);

  const openDetail = (c: Client | null) => {
    setDetail(c);
    setDocs([]);
    setDocsLoading(Boolean(c));
  };

  /** Démarre la visite d'un client, en le mémorisant comme client actif. */
  const demarrerVisite = (c: Client, distance: number | null) => {
    choisir({
      id: c.id, raisonSocial: nomClient(c), ville: c.ville, gouvernorat: c.gouvernorat,
      adresse: c.adresse, tel: c.tel, soldeFin: c.soldeFin, plafond: c.plafond,
      famille: c.famille, latitude: c.latitude, longitude: c.longitude, distance,
    }, distance != null && distance <= 120 ? "gps" : "manuel");
    setAConfirmer(null);
    setDetail(null);
  };

  /**
   * Sélection d'un client : on confronte sa position enregistrée à celle du
   * commercial. Si elles divergent, on le signale plutôt que de démarrer une
   * visite au mauvais endroit — sans jamais bloquer (un client peut avoir été
   * géocodé approximativement).
   */
  const selectionner = (c: Client) => {
    const v = verifierPosition({ latitude: c.latitude, longitude: c.longitude });
    if (v.statut === "inconnu") {
      setAConfirmer({ client: c, distance: null, motif: v.motif });
      return;
    }
    if (v.statut === "sur-place" || v.statut === "proche") {
      demarrerVisite(c, v.distance);
      return;
    }
    setAConfirmer({
      client: c,
      distance: v.distance,
      motif: `Vous êtes à ${formatDistance(v.distance)} de l'adresse enregistrée de ce client.`,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Mes clients</h1>
          <p className="text-[var(--text-secondary)] text-sm">
            {loading ? "Chargement…" : `${clients.length} affichés sur ${total} clients`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setNouveau(true)}
            className="flex items-center gap-1.5 text-sm font-semibold bg-emerald-600 text-white px-4 py-2.5 rounded-xl hover:bg-emerald-500 transition">
            <UserPlus size={15} /> Nouveau client
          </button>
          <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/25 rounded-xl px-4 py-2 text-center">
            <div className="text-lg font-bold text-blue-700 dark:text-blue-400">{fmt(totalCreances)} TND</div>
            <div className="text-blue-500 text-xs">Créances totales</div>
          </div>
        </div>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setLoading(true); }}
            className="pl-9 pr-4 py-2.5 text-sm bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl w-full focus:outline-none"
            placeholder="Rechercher un client (nom, ville)…" />
        </div>
        <select value={gov} onChange={(e) => { setGov(e.target.value); setLoading(true); }}
          className="py-2.5 px-3 text-sm bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl focus:outline-none">
          <option>Tous</option>
          {gouvernorats.map((g) => <option key={g}>{g}</option>)}
        </select>
      </div>

      {loading && <div className="py-16 text-center text-[var(--text-secondary)]"><Loader2 className="animate-spin inline" size={22} /></div>}
      {!loading && clients.length === 0 && (
        <div className="py-16 text-center text-sm text-[var(--text-secondary)]">Aucun client trouvé.</div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {!loading && clients.map((c, i) => {
          const plafond = c.plafond && c.plafond > 0 ? c.plafond : PLAFOND_DEFAUT;
          const proche = c.soldeFin > plafond * 0.8;
          const tel = (c.tel ?? "").replace(/[^0-9]/g, "");
          const msg = encodeURIComponent(`Bonjour ${nomClient(c)},`);
          const estActif = clientActif?.id === c.id;
          // Distance temps réel : n'a de sens que si les deux positions existent.
          const v = position ? verifierPosition({ latitude: c.latitude, longitude: c.longitude }) : null;
          const dist = v && v.statut !== "inconnu" ? v.distance : null;
          return (
            <motion.div key={c.id}
              className={`bg-[var(--bg-card)] rounded-2xl border shadow-sm p-4 hover:shadow-md transition ${estActif ? "border-emerald-500 ring-1 ring-emerald-500/30" : "border-[var(--border-primary)]"}`}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.02, 0.3) }}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400 font-bold text-sm flex items-center justify-center flex-shrink-0">
                    {nomClient(c).charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-[var(--text-primary)] text-sm truncate" title={nomClient(c)}>{nomClient(c)}</div>
                    <div className="text-[var(--text-secondary)] text-xs flex items-center gap-1 truncate">
                      <MapPin size={10} className="shrink-0" />{c.ville || "—"}{c.gouvernorat ? ` — ${c.gouvernorat}` : ""}
                    </div>
                  </div>
                </div>
                <RiskBadge score={riskScore(c)} />
              </div>

              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="bg-[var(--bg-primary)] rounded-xl p-2 text-center">
                  <div className="text-xs text-[var(--text-secondary)]">Solde</div>
                  <div className={`font-bold text-sm tabular-nums ${c.soldeFin > 0 ? "text-red-600" : "text-emerald-600"}`}>
                    {fmt(c.soldeFin)}
                  </div>
                </div>
                <div className="bg-[var(--bg-primary)] rounded-xl p-2 text-center">
                  <div className="text-xs text-[var(--text-secondary)]">Famille</div>
                  <div className="font-medium text-[var(--text-primary)] text-xs truncate" title={c.famille ?? ""}>{c.famille || "—"}</div>
                </div>
              </div>

              {proche && (
                <div className="mb-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/25 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
                  <AlertTriangle size={11} className="text-red-500 flex-shrink-0" />
                  <span className="text-xs text-red-600 font-medium">Solde proche du plafond ({fmt(plafond)} TND)</span>
                </div>
              )}

              <div className="flex gap-2 mb-2">
                {estActif ? (
                  <span className="flex-1 flex items-center justify-center gap-1.5 text-xs bg-emerald-600 text-white py-2 rounded-xl font-semibold">
                    <Check size={12} /> Visite en cours
                  </span>
                ) : (
                  <button onClick={() => selectionner(c)}
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/25 py-2 rounded-xl hover:bg-emerald-100 transition font-medium"
                    title="Démarrer la visite de ce client">
                    <Crosshair size={12} />
                    {dist != null ? `Visite · ${formatDistance(dist)}` : "Démarrer la visite"}
                  </button>
                )}
              </div>

              <div className="flex gap-2">
                <button onClick={() => openDetail(c)}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/25 py-2 rounded-xl hover:bg-blue-100 transition font-medium">
                  <FileText size={12} /> Fiche
                </button>
                {tel ? (
                  <a href={`https://wa.me/${tel.startsWith("216") ? tel : `216${tel}`}?text=${msg}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/25 py-2 rounded-xl hover:bg-emerald-100 transition font-medium">
                    <MessageCircle size={12} /> Contact
                  </a>
                ) : (
                  <span className="flex-1 flex items-center justify-center gap-1.5 text-xs border border-[var(--border-primary)] text-[var(--text-secondary)] py-2 rounded-xl opacity-50">
                    <MessageCircle size={12} /> Sans tél.
                  </span>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Fiche client */}
      <AnimatePresence>
        {detail && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => openDetail(null)}>
            <motion.div className="bg-[var(--bg-card)] rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
              <div className="bg-slate-800 text-white p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-bold text-lg truncate">{nomClient(detail)}</div>
                    <div className="text-slate-400 text-xs mt-0.5">
                      Code {detail.id}{detail.matriculeF ? ` · MF ${detail.matriculeF}` : ""}
                    </div>
                  </div>
                  <button onClick={() => openDetail(null)} className="p-2 hover:bg-white/10 rounded-xl transition shrink-0"><X size={18} /></button>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-700 text-sm text-slate-300 space-y-0.5">
                  <div className="flex items-center gap-1.5"><MapPin size={11} /> {detail.adresse || detail.ville || "—"}{detail.gouvernorat ? ` — ${detail.gouvernorat}` : ""}</div>
                  {detail.tel && <div>Tél : {detail.tel}</div>}
                  {detail.famille && <div className="flex items-center gap-1.5"><Building2 size={11} /> {detail.famille}{detail.sousFamille ? ` / ${detail.sousFamille}` : ""}</div>}
                </div>
              </div>

              <div className="p-5 overflow-auto flex-1">
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <Stat label="Débit" value={fmt(detail.debit)} />
                  <Stat label="Crédit" value={fmt(detail.credit)} />
                  <Stat label="Solde" value={fmt(detail.soldeFin)} strong={detail.soldeFin > 0} />
                </div>

                <div className="text-sm font-semibold text-[var(--text-secondary)] mb-2">Derniers documents</div>
                <div className="space-y-2">
                  {docsLoading && <div className="py-6 text-center text-[var(--text-secondary)]"><Loader2 className="animate-spin inline" size={16} /></div>}
                  {!docsLoading && docs.length === 0 && (
                    <div className="py-6 text-center text-sm text-[var(--text-secondary)]">Aucun document pour ce client.</div>
                  )}
                  {docs.slice(0, 15).map((d) => (
                    <div key={d.refDoc} className="flex items-center justify-between p-3 bg-[var(--bg-primary)] rounded-xl text-sm">
                      <div className="min-w-0">
                        <div className="font-medium text-[var(--text-primary)] truncate">{d.refDoc}</div>
                        <div className="text-[var(--text-secondary)] text-xs">
                          {d.typeDoc}{d.dateDoc ? ` · ${new Date(d.dateDoc).toLocaleDateString("fr-FR")}` : ""}
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <div className="font-semibold tabular-nums text-[var(--text-primary)]">{fmt(d.ttcNet)}</div>
                        {d.soldeDoc > 0 && <div className="text-[10px] text-red-600">reste {fmt(d.soldeDoc)}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 p-5 border-t border-[var(--border-primary)]">
                <button onClick={() => { selectionner(detail); router.push("/commercial/catalogue"); }}
                  className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl font-medium hover:bg-blue-500 transition text-sm text-center">
                  Passer commande
                </button>
                <button onClick={() => openDetail(null)}
                  className="flex-1 border border-[var(--border-primary)] text-[var(--text-secondary)] py-2.5 rounded-xl font-medium hover:bg-[var(--bg-primary)] transition text-sm">
                  Fermer
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation quand la position ne concorde pas avec la fiche client */}
      <AnimatePresence>
        {aConfirmer && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setAConfirmer(null)}>
            <motion.div className="bg-[var(--bg-card)] rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
              <div className="p-5">
                <div className="w-11 h-11 rounded-2xl bg-amber-500/15 text-amber-600 flex items-center justify-center mb-3">
                  <AlertTriangle size={20} />
                </div>
                <div className="font-bold text-[var(--text-primary)]">Position à vérifier</div>
                <p className="text-sm text-[var(--text-secondary)] mt-1.5 leading-relaxed">{aConfirmer.motif}</p>
                <div className="mt-3 p-3 bg-[var(--bg-primary)] rounded-xl">
                  <div className="text-[10px] uppercase font-bold text-[var(--text-secondary)] tracking-wide">Client</div>
                  <div className="font-semibold text-sm text-[var(--text-primary)] truncate">
                    {nomClient(aConfirmer.client)}
                  </div>
                  <div className="text-xs text-[var(--text-secondary)] truncate">
                    {aConfirmer.client.ville || aConfirmer.client.adresse || "—"}
                  </div>
                </div>
                <p className="text-[11px] text-[var(--text-secondary)] mt-3">
                  Vous pouvez démarrer la visite malgré tout : les coordonnées enregistrées
                  peuvent être imprécises.
                </p>
              </div>
              <div className="flex gap-2 p-4 border-t border-[var(--border-primary)]">
                <button onClick={() => setAConfirmer(null)}
                  className="flex-1 border border-[var(--border-primary)] text-[var(--text-secondary)] py-2.5 rounded-xl font-medium hover:bg-[var(--bg-primary)] transition text-sm">
                  Annuler
                </button>
                <button onClick={() => demarrerVisite(aConfirmer.client, aConfirmer.distance)}
                  className="flex-1 bg-emerald-600 text-white py-2.5 rounded-xl font-medium hover:bg-emerald-500 transition text-sm">
                  Démarrer quand même
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Création d'un nouveau point de vente */}
      <NouveauClientModal
        ouvert={nouveau}
        onFermer={() => setNouveau(false)}
        onCree={(c) => {
          setNouveau(false);
          setSearch(c.raisonSocial);
          choisir({
            id: c.id, raisonSocial: c.raisonSocial, ville: c.ville, adresse: c.adresse,
            tel: c.tel, latitude: c.latitude, longitude: c.longitude, soldeFin: 0, distance: 0,
          }, "gps");
        }}
      />
    </div>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="bg-[var(--bg-primary)] rounded-xl p-2.5 text-center">
      <div className="text-[10px] uppercase tracking-wide text-[var(--text-secondary)] font-semibold">{label}</div>
      <div className={`font-bold text-sm tabular-nums ${strong ? "text-red-600" : "text-[var(--text-primary)]"}`}>{value}</div>
    </div>
  );
}
