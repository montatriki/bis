"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  PackageSearch, Users, CalendarClock, ShoppingCart, HandCoins, PackageOpen,
  BookOpenCheck, Headset, ReceiptText, KeyRound, PackageCheck, BarChart3,
  ClipboardList, UserRound, Truck,
} from "lucide-react";

// Écran d'accueil du commercial — menu en grille de l'application BIS d'origine.
//
// C'est le premier écran après connexion : le commercial travaille sur tablette
// en tournée, il lui faut de grandes cibles tactiles plutôt qu'un tableau de
// bord. Les indicateurs (CA, créances, panier moyen) restent consultables sur
// /commercial/statistiques.
//
// La barre du bas rappelle le contexte de la tournée du jour (ordre de mission,
// véhicule, clients planifiés), comme sur l'application d'origine.

type Tuile = {
  href: string;
  label: string;
  icon: React.ElementType;
  /** Compteur relu d'une API : panier et réclamations en portent un. */
  badge?: "panier" | "reclamations";
};

// L'ordre reprend celui du menu d'origine.
const TUILES: Tuile[] = [
  { href: "/commercial/catalogue", label: "Catalogue produit", icon: PackageSearch },
  { href: "/commercial/clients", label: "Mes clients", icon: Users },
  { href: "/commercial/planning", label: "Planning du jour", icon: CalendarClock },
  { href: "/commercial/panier", label: "Panier de commande", icon: ShoppingCart, badge: "panier" },
  { href: "/commercial/recouvrement", label: "Recouvrement", icon: HandCoins },
  { href: "/commercial/retour-stock", label: "Retour de stock", icon: PackageOpen },
  { href: "/commercial/journal", label: "Journal de caisse", icon: BookOpenCheck },
  { href: "/commercial/reclamation", label: "Réclamation client", icon: Headset, badge: "reclamations" },
  { href: "/commercial/dernier-ticket", label: "Dernier ticket", icon: ReceiptText },
  { href: "/commercial/mot-de-passe", label: "Changer mot de passe", icon: KeyRound },
  { href: "/commercial/approvisionnement", label: "Bon d'approvisionnement", icon: PackageCheck },
  // Le tableau de bord d'origine reste accessible depuis le menu.
  { href: "/commercial/statistiques", label: "Statistiques", icon: BarChart3 },
];

type Tournee = {
  commercial?: string | null;
  mission?: { id: number; vehicule: string | null } | null;
  /** Véhicule attribué au commercial, indépendant de l'ordre de mission. */
  vehiculeAffecte?: string | null;
  stats?: { total: number } | null;
};

export default function CommercialMenuPage() {
  const [panier, setPanier] = useState(0);
  const [reclam, setReclam] = useState(0);
  const [tournee, setTournee] = useState<Tournee | null>(null);

  // Compteurs et contexte de tournée : trois appels indépendants, chacun
  // silencieux en cas d'échec — le menu doit rester utilisable même si une
  // API ne répond pas (connexion instable en tournée).
  useEffect(() => {
    let annule = false;

    fetch("/api/panier?vue=badge")
      .then((r) => r.json())
      .then((d) => { if (!annule) setPanier(d.articles ?? 0); })
      .catch(() => {});

    fetch("/api/reclamations?vue=stats")
      .then((r) => r.json())
      .then((d) => { if (!annule) setReclam(d.ouvertes ?? 0); })
      .catch(() => {});

    fetch("/api/tournee")
      .then((r) => r.json())
      .then((d) => { if (!annule) setTournee(d); })
      .catch(() => {});

    return () => { annule = true; };
  }, []);

  const compteur = (t: Tuile) =>
    t.badge === "panier" ? panier : t.badge === "reclamations" ? reclam : 0;

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-primary)]">
      {/* En-tête : identité S.K.Y, dans le style de l'écran de connexion. */}
      <header className="px-4 pt-6 pb-5">
        <div className="mx-auto max-w-5xl flex items-center justify-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0"
            style={{
              background: "linear-gradient(135deg, var(--accent-primary), var(--color-primary-dark, #8c4d15))",
              boxShadow: "0 10px 24px var(--shadow-hover)",
            }}>
            <span className="text-white font-black text-2xl tracking-tight">S</span>
          </div>
          <div className="min-w-0">
            <div className="font-black text-[var(--text-primary)] text-2xl leading-none tracking-tight">S.K.Y</div>
            <div className="text-[var(--text-secondary)] text-[11px] font-semibold uppercase tracking-[0.18em] mt-1">
              Espace commercial
            </div>
          </div>
        </div>
      </header>

      {/* Grille du menu : 2 colonnes sur mobile et tablette — de grandes cibles
          tactiles en tournée. On n'élargit qu'à partir du grand écran. */}
      <nav className="px-3 pb-3">
        <div className="mx-auto max-w-5xl grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
          {TUILES.map((t) => {
            const Icon = t.icon;
            const n = compteur(t);
            return (
              <Link key={t.href} href={t.href}
                className="group relative flex flex-col items-center justify-center text-center gap-2.5 px-3 py-4
                           rounded-3xl bg-[var(--bg-card)] border border-[var(--border-primary)]
                           shadow-sm transition-all duration-200
                           hover:-translate-y-0.5 hover:border-[var(--accent-primary)]/35 hover:shadow-md
                           active:translate-y-0 active:scale-[0.98]
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]">
                {/* Pastille : dégradé bronze de la charte, halo au survol. */}
                <span className="relative flex items-center justify-center">
                  <span className="absolute -inset-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    style={{ background: "var(--accent-light)" }} />
                  <span className="relative w-[54px] h-[54px] rounded-2xl flex items-center justify-center
                                   transition-transform duration-200 group-hover:scale-105"
                    style={{
                      background: "linear-gradient(135deg, var(--accent-primary), var(--color-primary-dark, #8c4d15))",
                      boxShadow: "0 6px 16px var(--shadow-hover)",
                    }}>
                    <Icon size={27} className="text-white" strokeWidth={1.7} />
                  </span>

                  {/* Compteur masqué à zéro : ne pas alerter sans raison. */}
                  {n > 0 && (
                    <span className="absolute -top-1.5 -right-2 min-w-[23px] h-[23px] px-1.5 rounded-full bg-[#b84a39]
                                     text-white text-[11px] font-black flex items-center justify-center
                                     ring-2 ring-[var(--bg-card)] shadow-sm">
                      {n > 99 ? "99+" : n}
                    </span>
                  )}
                </span>

                <span className="text-[12px] md:text-[13px] font-bold uppercase tracking-wide
                                 text-[var(--text-primary)] leading-snug text-balance">
                  {t.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Contexte de la tournée du jour — collé au bas de l'écran. */}
      <footer className="mt-auto px-3 pb-4">
        <div className="mx-auto max-w-5xl rounded-3xl bg-[var(--bg-card)] border border-[var(--border-primary)]
                        shadow-sm px-4 py-3.5">
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-5 gap-y-3">
            <Ligne icon={ClipboardList} libelle="Code mission"
              valeur={tournee?.mission?.id ? `OM-${tournee.mission.id}` : null} />
            <Ligne icon={UserRound} libelle="Commercial" valeur={tournee?.commercial ?? null} />
            {/* Les jours sans ordre de mission, le camion attribué reste
                l'information utile : c'est lui que le commercial conduit. */}
            <Ligne icon={Truck} libelle="Véhicule"
              valeur={tournee?.mission?.vehicule || tournee?.vehiculeAffecte || null} />
            <Ligne icon={Users} libelle="Clients planifiés" valeur={String(tournee?.stats?.total ?? 0)} />
          </dl>
        </div>
      </footer>
    </div>
  );
}

/** Repère « libellé / valeur » de la barre de tournée. */
function Ligne({
  icon: Icon, libelle, valeur,
}: {
  icon: React.ElementType; libelle: string; valeur: string | null;
}) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <span className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: "var(--accent-light)" }}>
        <Icon size={15} style={{ color: "var(--accent-primary)" }} />
      </span>
      <div className="min-w-0">
        <dt className="text-[9px] font-black uppercase tracking-wider text-[var(--text-secondary)] opacity-75 leading-none">
          {libelle}
        </dt>
        <dd className="text-[13px] font-bold text-[var(--text-primary)] truncate mt-1 leading-none">
          {valeur || "—"}
        </dd>
      </div>
    </div>
  );
}
