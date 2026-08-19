"use client";
import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { BookOpen, Scale, FileSpreadsheet, Landmark, Search, TrendingUp, TrendingDown } from "lucide-react";
import IntegrationCompta from "@/components/compta/IntegrationCompta";

const SUB_TABS = ["Intégration", "Plan comptable", "Écritures", "Balance", "État de résultat", "Bilan"];
const ACCENT = "#6366f1"; // indigo accent for the compta module

// Formes servies par `/api/comptabilite`, le module comptable réel (plan,
// écritures, balance, résultat, bilan de l'ERP). L'écran interrogeait
// auparavant `/api/compta`, une ébauche branchée sur des tables de
// démonstration : il affichait 12 comptes et 2 écritures là où l'exercice en
// compte 10 et 145.
type Account = { id: number; numCompte: string; intitule: string; classe: number };
type Ecriture = {
  id: number; codeJournal: string; numPiece: string; numCompte: string;
  libelleCompte: string | null; libelleEcriture: string | null;
  dateEcriture: string; refDoc: string | null; debit: number; credit: number;
};
type BalanceRow = {
  numCompte: string; libelleCompte: string; classe: number;
  debit: number; credit: number; soldeDebiteur: number; soldeCrediteur: number; nbEcritures: number;
};

const fmt = (n: number) => new Intl.NumberFormat("fr-TN", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(n ?? 0);
const fmt0 = (n: number) => new Intl.NumberFormat("fr-TN", { maximumFractionDigits: 0 }).format(n ?? 0);
const CLASS_LABEL: Record<string, string> = {
  CLASSE_1: "1 · Capitaux", CLASSE_2: "2 · Immobilisations", CLASSE_3: "3 · Stocks",
  CLASSE_4: "4 · Tiers", CLASSE_5: "5 · Financiers", CLASSE_6: "6 · Charges", CLASSE_7: "7 · Produits",
};
const CLASS_COLOR: Record<string, string> = {
  CLASSE_1: "#8b5cf6", CLASSE_2: "#3b82f6", CLASSE_3: "#f59e0b", CLASSE_4: "#ec4899",
  CLASSE_5: "#10b981", CLASSE_6: "#ef4444", CLASSE_7: "#22c55e",
};

export default function ComptaPage() {
  const [tab, setTab] = useState("Intégration");
  const [search, setSearch] = useState("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [ecritures, setEcritures] = useState<Ecriture[]>([]);
  const [balance, setBalance] = useState<BalanceRow[]>([]);
  const [resultat, setResultat] = useState<{ produits: number; charges: number; resultat: number } | null>(null);
  const [bilan, setBilan] = useState<{ actif: number; passif: number; resultat: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/comptabilite?vue=plan").then((r) => r.json()),
      fetch("/api/comptabilite?vue=ecritures").then((r) => r.json()),
      fetch("/api/comptabilite?vue=balance").then((r) => r.json()),
      fetch("/api/comptabilite?vue=resultat").then((r) => r.json()),
      fetch("/api/comptabilite?vue=bilan").then((r) => r.json()),
    ]).then(([p, e, b, r, bi]) => {
      if (cancelled) return;
      setAccounts(p.rows ?? []);
      setEcritures(e.rows ?? []);
      setBalance(b.rows ?? []);
      setResultat(r);
      // Le bilan est servi par rubriques : l'écran n'en affiche que les totaux.
      setBilan({ actif: bi.totalActif ?? 0, passif: bi.totalPassif ?? 0, resultat: r?.resultat ?? 0 });
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  // L'API sert les écritures à plat (une ligne par compte mouvementé) ; l'écran
  // les présente par pièce, comme un journal comptable.
  const pieces = useMemo(() => {
    const parPiece = new Map<string, {
      numPiece: string; codeJournal: string; dateEcriture: string; libelle: string;
      lignes: Ecriture[]; totalDebit: number; totalCredit: number;
    }>();
    for (const e of ecritures) {
      const cle = `${e.codeJournal}/${e.numPiece}`;
      const cur = parPiece.get(cle) ?? {
        numPiece: e.numPiece, codeJournal: e.codeJournal, dateEcriture: e.dateEcriture,
        libelle: e.libelleEcriture ?? e.refDoc ?? e.numPiece,
        lignes: [], totalDebit: 0, totalCredit: 0,
      };
      cur.lignes.push(e);
      cur.totalDebit += e.debit;
      cur.totalCredit += e.credit;
      parPiece.set(cle, cur);
    }
    return [...parPiece.values()].sort(
      (a, b) => new Date(b.dateEcriture).getTime() - new Date(a.dateEcriture).getTime(),
    );
  }, [ecritures]);

  const filteredAccounts = accounts.filter(
    (a) => a.numCompte.includes(search) || (a.intitule ?? "").toLowerCase().includes(search.toLowerCase()),
  );
  const totalDebit = balance.reduce((s, b) => s + b.debit, 0);
  const totalCredit = balance.reduce((s, b) => s + b.credit, 0);

  return (
    <div className="space-y-5 text-[var(--text-primary)] animate-fade-in">
      {/* Header — matches dashboard/synthese style */}
      <div className="flex items-center justify-between flex-wrap gap-3 border-b border-[var(--border-primary)] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: ACCENT }} />
            <h1 className="text-2xl font-extrabold tracking-tight">Comptabilité</h1>
            <span className="text-[10px] font-extrabold bg-[var(--accent-light)] text-[var(--accent-primary)] px-2.5 py-0.5 rounded-full border border-[var(--border-primary)] uppercase tracking-wider">
              Exercice 2026
            </span>
          </div>
          <p className="text-[var(--text-secondary)] opacity-80 text-xs mt-1">
            {loading ? "Chargement…" : `${accounts.length} comptes · ${pieces.length} écritures (${ecritures.length} lignes) · ${balance.length} comptes mouvementés`}
          </p>
        </div>
        {resultat && (
          <div className={`flex items-center gap-2.5 rounded-xl px-4 py-2 border ${resultat.resultat >= 0 ? "border-emerald-500/30 bg-emerald-500/10" : "border-red-500/30 bg-red-500/10"}`}>
            {resultat.resultat >= 0 ? <TrendingUp size={18} className="text-emerald-500" /> : <TrendingDown size={18} className="text-red-500" />}
            <div>
              <div className={`text-lg font-extrabold leading-none ${resultat.resultat >= 0 ? "text-emerald-600" : "text-red-600"}`}>{fmt0(resultat.resultat)} TND</div>
              <div className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wide mt-0.5">Résultat de l&apos;exercice</div>
            </div>
          </div>
        )}
      </div>

      {/* KPI tiles */}
      {resultat && bilan && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Produits (Cl. 7)", value: resultat.produits, icon: FileSpreadsheet, color: "#22c55e" },
            { label: "Charges (Cl. 6)", value: resultat.charges, icon: Scale, color: "#ef4444" },
            { label: "Total Actif", value: bilan.actif, icon: Landmark, color: "#3b82f6" },
            { label: "Total Passif", value: bilan.passif + bilan.resultat, icon: Landmark, color: ACCENT },
          ].map((k, i) => (
            <motion.div key={k.label} className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-primary)] shadow-sm p-5"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: k.color + "1a", color: k.color }}>
                <k.icon size={19} />
              </div>
              <div className="text-2xl font-extrabold tracking-tight">{fmt0(k.value)} <span className="text-sm font-bold text-[var(--text-secondary)]">TND</span></div>
              <div className="text-[var(--text-secondary)] font-bold text-xs mt-1">{k.label}</div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Tabs + content card */}
      <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-primary)] shadow-sm overflow-hidden">
        <div className="flex gap-1.5 p-2 border-b border-[var(--border-primary)] overflow-x-auto scrollbar-none bg-[var(--bg-primary)]/40">
          {SUB_TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition ${tab === t ? "text-white shadow-sm" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-light)]"}`}
              style={tab === t ? { background: ACCENT } : undefined}>
              {t}
            </button>
          ))}
        </div>

        {/* Plan comptable */}
        {/* Intégration comptable : documents → écritures, balance, grand livre */}
        {tab === "Intégration" && <IntegrationCompta accent={ACCENT} />}

        {tab === "Plan comptable" && (
          <div className="p-4 space-y-4">
            <div className="relative max-w-md">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="N° de compte, libellé…"
                className="pl-9 pr-4 py-2 text-sm bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl w-full focus:outline-none" />
            </div>
            <div className="overflow-x-auto rounded-xl border border-[var(--border-primary)]">
              <table className="w-full text-sm">
                <thead className="bg-[var(--bg-primary)] border-b border-[var(--border-primary)]">
                  <tr>{["N° Compte", "Libellé", "Classe"].map((h) => <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-primary)]">
                  {filteredAccounts.map((a, i) => (
                    <motion.tr key={a.id} className="hover:bg-[var(--accent-light)] transition" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.02, 0.3) }}>
                      <td className="px-4 py-3 font-mono text-sm font-bold" style={{ color: ACCENT }}>{a.numCompte}</td>
                      <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{a.intitule}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold" style={{ background: (CLASS_COLOR[String(a.classe)] ?? "#64748b") + "1a", color: CLASS_COLOR[String(a.classe)] ?? "#64748b" }}>
                          {CLASS_LABEL[String(a.classe)] ?? a.classe}
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                  {!loading && filteredAccounts.length === 0 && <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-400 text-sm">Aucun compte</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Écritures */}
        {tab === "Écritures" && (
          <div className="p-4 space-y-3">
            {pieces.map((e, idx) => (
              <motion.div key={`${e.codeJournal}/${e.numPiece}`} className="rounded-xl border border-[var(--border-primary)] overflow-hidden"
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }}>
                <div className="flex items-center justify-between px-4 py-2.5 bg-[var(--bg-primary)] border-b border-[var(--border-primary)]">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: ACCENT + "1a", color: ACCENT }}>{e.codeJournal}</span>
                    <span className="font-mono text-xs text-[var(--text-secondary)]">{e.numPiece}</span>
                    <span className="font-medium text-[var(--text-primary)] text-sm truncate">{e.libelle}</span>
                  </div>
                  <span className="text-xs text-[var(--text-secondary)] flex-shrink-0">{new Date(e.dateEcriture).toLocaleDateString("fr-FR")}</span>
                </div>
                <table className="w-full text-sm">
                  <thead className="border-b border-[var(--border-primary)]">
                    <tr>{["Compte", "Libellé", "Débit", "Crédit"].map((h) => <th key={h} className={`px-4 py-1.5 text-[10px] font-semibold text-[var(--text-secondary)] uppercase ${h === "Débit" || h === "Crédit" ? "text-right" : "text-left"}`}>{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-primary)]">
                    {e.lignes.map((l) => (
                      <tr key={l.id}>
                        <td className="px-4 py-2 font-mono text-xs font-bold" style={{ color: ACCENT }}>{l.numCompte}</td>
                        <td className="px-4 py-2 text-[var(--text-secondary)] text-xs">{l.libelleEcriture ?? l.libelleCompte}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-[var(--text-primary)]">{l.debit ? fmt(l.debit) : ""}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-[var(--text-primary)]">{l.credit ? fmt(l.credit) : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-[var(--bg-primary)] border-t border-[var(--border-primary)]">
                    <tr><td colSpan={2} className="px-4 py-2 text-xs font-bold text-[var(--text-secondary)]">Totaux</td><td className="px-4 py-2 text-right font-bold tabular-nums">{fmt(e.totalDebit)}</td><td className="px-4 py-2 text-right font-bold tabular-nums">{fmt(e.totalCredit)}</td></tr>
                  </tfoot>
                </table>
              </motion.div>
            ))}
            {!loading && pieces.length === 0 && <p className="text-slate-400 text-sm text-center py-8">Aucune écriture</p>}
          </div>
        )}

        {/* Balance */}
        {tab === "Balance" && (
          <div className="p-4 overflow-x-auto">
            <table className="w-full text-sm rounded-xl border border-[var(--border-primary)] overflow-hidden">
              <thead className="bg-[var(--bg-primary)] border-b border-[var(--border-primary)]">
                <tr>{["Compte", "Libellé", "Débit", "Crédit", "Solde débiteur", "Solde créditeur"].map((h) => <th key={h} className={`px-4 py-2.5 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide whitespace-nowrap ${["Compte", "Libellé"].includes(h) ? "text-left" : "text-right"}`}>{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-primary)]">
                {balance.map((b) => (
                  <tr key={b.numCompte} className="hover:bg-[var(--accent-light)] transition">
                    <td className="px-4 py-3 font-mono text-xs font-bold" style={{ color: ACCENT }}>{b.numCompte}</td>
                    <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{b.libelleCompte}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-[var(--text-secondary)]">{fmt(b.debit)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-[var(--text-secondary)]">{fmt(b.credit)}</td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums text-blue-600">{b.soldeDebiteur ? fmt(b.soldeDebiteur) : ""}</td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums text-emerald-600">{b.soldeCrediteur ? fmt(b.soldeCrediteur) : ""}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-[var(--bg-primary)] border-t-2 border-[var(--border-primary)]">
                <tr><td colSpan={2} className="px-4 py-2.5 font-bold text-[var(--text-primary)]">Totaux</td><td className="px-4 py-2.5 text-right font-black tabular-nums">{fmt(totalDebit)}</td><td className="px-4 py-2.5 text-right font-black tabular-nums">{fmt(totalCredit)}</td><td colSpan={2} /></tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* État de résultat */}
        {tab === "État de résultat" && resultat && (
          <div className="p-5 space-y-4">
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="rounded-2xl p-5 border border-[var(--border-primary)] bg-emerald-500/5">
                <FileSpreadsheet size={22} className="text-emerald-500 mb-3" />
                <div className="text-2xl font-black text-emerald-600">{fmt(resultat.produits)}</div>
                <div className="text-[var(--text-secondary)] text-sm mt-1">Produits (classe 7)</div>
              </div>
              <div className="rounded-2xl p-5 border border-[var(--border-primary)] bg-red-500/5">
                <Scale size={22} className="text-red-500 mb-3" />
                <div className="text-2xl font-black text-red-600">{fmt(resultat.charges)}</div>
                <div className="text-[var(--text-secondary)] text-sm mt-1">Charges (classe 6)</div>
              </div>
              <div className={`rounded-2xl p-5 border border-[var(--border-primary)] ${resultat.resultat >= 0 ? "bg-blue-500/5" : "bg-amber-500/5"}`}>
                <BookOpen size={22} className={resultat.resultat >= 0 ? "text-blue-500 mb-3" : "text-amber-500 mb-3"} />
                <div className={`text-2xl font-black ${resultat.resultat >= 0 ? "text-blue-600" : "text-amber-600"}`}>{fmt(resultat.resultat)}</div>
                <div className="text-[var(--text-secondary)] text-sm mt-1">Résultat {resultat.resultat >= 0 ? "(bénéfice)" : "(perte)"}</div>
              </div>
            </div>
            {/* simple bar */}
            <div className="bg-[var(--bg-primary)] rounded-2xl border border-[var(--border-primary)] p-5">
              <div className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wide mb-3">Produits vs Charges</div>
              {[["Produits", resultat.produits, "#22c55e"], ["Charges", resultat.charges, "#ef4444"]].map(([label, val, color]) => {
                const max = Math.max(1, resultat.produits, resultat.charges);
                return (
                  <div key={String(label)} className="mb-3 last:mb-0">
                    <div className="flex justify-between text-xs mb-1"><span className="font-semibold">{label}</span><span className="font-mono">{fmt0(Number(val))} TND</span></div>
                    <div className="h-2.5 rounded-full bg-[var(--border-primary)] overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(Number(val) / max) * 100}%`, background: String(color) }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Bilan */}
        {tab === "Bilan" && bilan && (
          <div className="p-5 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="rounded-2xl p-6 border border-[var(--border-primary)] bg-blue-500/5">
                <Landmark size={24} className="text-blue-500 mb-3" />
                <div className="text-3xl font-black text-blue-600">{fmt0(bilan.actif)} TND</div>
                <div className="text-[var(--text-secondary)] text-sm mt-1">Total Actif</div>
              </div>
              <div className="rounded-2xl p-6 border border-[var(--border-primary)]" style={{ background: ACCENT + "0d" }}>
                <Landmark size={24} style={{ color: ACCENT }} className="mb-3" />
                <div className="text-3xl font-black" style={{ color: ACCENT }}>{fmt0(bilan.passif + bilan.resultat)} TND</div>
                <div className="text-[var(--text-secondary)] text-sm mt-1">Total Passif (avec résultat)</div>
              </div>
            </div>
            <div className={`rounded-xl px-4 py-3 text-sm font-medium border ${Math.abs(bilan.actif - (bilan.passif + bilan.resultat)) < 1 ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700" : "border-amber-500/30 bg-amber-500/10 text-amber-700"}`}>
              {Math.abs(bilan.actif - (bilan.passif + bilan.resultat)) < 1 ? "✓ Bilan équilibré" : "⚠ Écart Actif / Passif : " + fmt(Math.abs(bilan.actif - (bilan.passif + bilan.resultat))) + " TND"}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
