"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { Search, X, ShoppingCart, Plus, Minus, Package, Loader2, Check, MapPin, AlertTriangle, Trash2 } from "lucide-react";
import { useClientSeul } from "@/lib/client-actif";
import TicketVente from "@/components/commercial/TicketVente";
import { confirmer } from "@/lib/alertes";

type Article = {
  refArt: string; codeBarre: string | null; designation: string; catalogue: string | null;
  unite: string | null; enStock: number; stMin: number;
  /** Quantité chargée dans le camion, panier compris (borne du sélecteur). */
  stockCamion?: number;
  /** Stock global de l'article, tous emplacements — ce que la production
   *  affiche en seconde pastille (`en_stock_prinsipal`). */
  stockGlobal?: number;
  tarif1Ht: number; tauxTva: number; tauxFodec?: number; prixTtc: number;
  /** Remise maximale autorisee sur l'article, en % (0 = pas de plafond). */
  remiseMax?: number;
  aPhoto?: boolean;
};
type CartItem = { article: Article; qty: number; remise?: number };

/** Modes de règlement de l'ERP d'origine (`Panier-component.js`). */
// « Crédit » n'est pas un encaissement : le ticket est émis, la marchandise
// sort, et la totalité reste au débit du client (à recouvrer plus tard).
const MODES_PAIEMENT = ["Espèce", "Chèque", "Traite", "Retenu", "Crédit"] as const;
type ModePaiement = (typeof MODES_PAIEMENT)[number];

/** Valeur numérique brute, utilisable dans un `<input type="number">`. */
const fmtNombre = (v: unknown) => (Number(v) || 0).toFixed(3);

const fmt = (v: unknown) =>
  new Intl.NumberFormat("fr-TN", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(Number(v) || 0);

export default function CataloguePage() {
  const [search, setSearch] = useState("");
  const [dispo, setDispo] = useState("toutes");
  const [articles, setArticles] = useState<Article[]>([]);
  const [nbEnStock, setNbEnStock] = useState(0);
  // Camion du commercial : le stock affiché est celui qu'il a à bord.
  const [emplacement, setEmplacement] = useState<string | null>(null);
  /** Plaque du véhicule affecté : les libellés d'emplacement de la production
   *  portent d'anciens noms de conducteur et induisent en erreur. */
  const [plaque, setPlaque] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [cart, setCart] = useState<CartItem[]>([]);
  // Remise en cours de saisie, par article. Comme dans l'ERP d'origine, le
  // commercial peut entrer soit le pourcentage, soit le prix net : les deux
  // champs restent lies.
  const [remises, setRemises] = useState<Record<string, { pct: string; net: string; champ?: "pct" | "net" }>>({});
  // Étape de règlement, entre le panier et l'émission du ticket : c'est la
  // séquence de l'application d'origine — on choisit le mode, on saisit le
  // montant encaissé, puis le ticket est émis et imprimé.
  const [paiement, setPaiement] = useState(false);
  const [modePay, setModePay] = useState<ModePaiement>("Espèce");
  /** Bascule de mode : le crédit n'encaisse rien, les autres proposent le total. */
  const changerMode = (m: ModePaiement) => {
    setModePay(m);
    setMontantRegle(m === "Crédit" ? "0" : fmtNombre(totalTTC));
    if (m !== "Chèque" && m !== "Traite") { setNumPiece(""); setEcheance(""); }
  };
  const [montantRegle, setMontantRegle] = useState("");
  const [numPiece, setNumPiece] = useState("");
  const [echeance, setEcheance] = useState("");
  const [showCart, setShowCart] = useState(false);
  // Référence du document dont le ticket est affiché (null = aucun).
  const [ticketRef, setTicketRef] = useState<string | null>(null);

  // La commande porte sur le client en cours de visite, choisi une fois pour
  // toutes dans le bandeau : plus de sélection enfouie au moment de valider.
  const { client: clientActif } = useClientSeul();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      const qs = new URLSearchParams({ limit: "120", dispo });
      if (search) qs.set("search", search);
      fetch(`/api/catalogue?${qs}`)
        .then((r) => r.json())
        .then((d) => {
          if (cancelled) return;
          setArticles(d.rows ?? []);
          setTotal(d.total ?? 0);
          setNbEnStock(d.nbEnStock ?? 0);
          setEmplacement(d.emplacement ?? null);
          setPlaque(d.plaque ?? null);
          setLoading(false);
        })
        .catch(() => { if (!cancelled) setLoading(false); });
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [search, dispo]);

  // Le panier vit côté serveur : on le relit à l'ouverture de l'écran, sinon la
  // pastille « À bord » ignorerait des articles déjà réservés (et le compteur
  // du sélecteur repartirait de zéro après un simple rafraîchissement).
  useEffect(() => {
    let annule = false;
    fetch("/api/panier?vue=courant")
      .then((r) => r.json())
      .then((d) => {
        if (annule || !Array.isArray(d.lignes)) return;
        setCart(
          // La remise et le FODEC de chaque ligne doivent être repris : sans eux
          // le panier se recalculait au prix catalogue et affichait 61,000 TND
          // là où le serveur émettait le ticket à 54,900.
          d.lignes.map((l: {
            refArt: string; designation: string; unite: string | null;
            qte: number; puHt: number; tauxTva: number; tauxFodec?: number; remise?: number;
          }) => ({
            article: {
              refArt: l.refArt, designation: l.designation, unite: l.unite,
              codeBarre: null, catalogue: null, enStock: 0, stMin: 0,
              tarif1Ht: l.puHt, tauxTva: l.tauxTva, tauxFodec: l.tauxFodec ?? 0,
              prixTtc:
                Math.round(
                  (l.puHt * (1 + (l.tauxFodec ?? 0) / 100) * (1 + l.tauxTva / 100) + Number.EPSILON) * 1000,
                ) / 1000,
            },
            qty: l.qte,
            remise: l.remise ?? 0,
          })),
        );
      })
      .catch(() => {});
    return () => { annule = true; };
  }, []);

  // Le panier est persisté côté serveur : il survit au changement d'écran et
  // alimente le badge du menu. L'état local reste mis à jour immédiatement
  // pour que l'interface ne clignote pas en attendant la réponse.
  function addToCart(a: Article) {
    // La remise saisie doit suivre l'article dans le panier local, sinon le
    // total affiché repart du prix catalogue.
    const saisie = remises[a.refArt];
    const remise = saisie?.champ === "net" && saisie.net && a.prixTtc
      ? 100 - (Number(saisie.net) * 100) / a.prixTtc
      : Number(saisie?.pct) || 0;
    setCart((prev) => {
      const ex = prev.find((i) => i.article.refArt === a.refArt);
      if (ex) {
        return prev.map((i) =>
          i.article.refArt === a.refArt ? { ...i, qty: i.qty + 1, remise } : i);
      }
      return [...prev, { article: a, qty: 1, remise }];
    });
    fetch("/api/panier", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vue: "ligne", refArt: a.refArt, qte: 1,
        // Remise éventuellement saisie avant l'ajout — par prix net si c'est
        // le prix qui a été tapé, pour qu'il reste exact.
        ...(remises[a.refArt]?.champ === "net" && remises[a.refArt]?.net
          ? { net: Number(remises[a.refArt]!.net) }
          : { remise: Number(remises[a.refArt]?.pct) || 0 }),
      }),
    })
      .then((r) => r.json())
      // Le ticket est émis depuis le panier serveur : la quantité affichée
      // doit être la sienne, pas une estimation locale qui pourrait dériver.
      .then((d) => { if (d?.row?.qte != null) recalerQty(a.refArt, Number(d.row.qte)); })
      .catch(() => {});
  }
  /** Aligne la quantité locale d'une ligne sur celle confirmée par le serveur. */
  function recalerQty(ref: string, qte: number) {
    setCart((prev) =>
      prev.map((i) => (i.article.refArt === ref ? { ...i, qty: qte } : i)).filter((i) => i.qty > 0),
    );
  }
  function updateQty(ref: string, delta: number) {
    const actuelle = cart.find((i) => i.article.refArt === ref)?.qty ?? 0;
    const suivante = Math.max(0, actuelle + delta);
    setCart((prev) =>
      prev.map((i) => (i.article.refArt === ref ? { ...i, qty: suivante } : i)).filter((i) => i.qty > 0)
    );
    fetch("/api/panier", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refArt: ref, qte: suivante }),
    })
      .then((r) => r.json())
      .then((d) => { if (d?.row?.qte != null) recalerQty(ref, Number(d.row.qte)); })
      .catch(() => {});
  }
  const getQty = (ref: string) => cart.find((i) => i.article.refArt === ref)?.qty ?? 0;

  /**
   * Remise de ligne : les deux champs sont liés, comme au catalogue de l'ERP
   * d'origine — saisir un taux met à jour le prix net, saisir un prix net
   * recalcule le taux (`remise = 100 − net × 100 / prix TTC`).
   *
   * Le plafond `remiseMax` de l'article est appliqué à la saisie ; le serveur
   * le revérifie, un contrôle d'interface ne protégeant rien à lui seul.
   */
  function majRemise(a: Article, champ: "pct" | "net", brut: string) {
    // Pendant la frappe, on ne fait que relier les deux champs. La validation
    // (plafond, prix au-dessus du tarif) attend la sortie du champ : valider à
    // chaque touche vidait la saisie sur une valeur intermédiaire — taper « 5 »
    // pour écrire « 50.000 » donnait 90 % de remise, refusée, champ effacé.
    const valeur = brut.replace(",", ".");
    const ttc = a.prixTtc || 0;
    let pct = "", net = "";
    if (champ === "pct") {
      pct = valeur;
      const p = Number(valeur);
      net = valeur === "" || !Number.isFinite(p) ? "" : (ttc * (1 - p / 100)).toFixed(3);
    } else {
      net = valeur;
      const n = Number(valeur);
      pct = valeur === "" || !Number.isFinite(n) || ttc <= 0
        ? ""
        : (100 - (n * 100) / ttc).toFixed(2);
    }
    setRemises((r) => ({ ...r, [a.refArt]: { pct, net, champ } }));
  }

  /**
   * Validation de la remise, à la sortie du champ (ou sur Entrée) : plafond de
   * l'article, prix jamais au-dessus du tarif ; puis report sur le panier.
   * Le serveur revérifie, un contrôle d'interface ne protégeant rien à lui seul.
   */
  function validerRemise(a: Article) {
    const saisie = remises[a.refArt];
    const pct = saisie?.pct ?? "";
    const taux = Number(pct);
    // Retour au prix catalogue : la clé est retirée, les champs réaffichent
    // le tarif (et non un vide qui faisait tomber le total de ligne à 0,000).
    const remettre = (msg: string) => {
      setToast(msg);
      setTimeout(() => setToast(null), 3500);
      setRemises((r) => { const n = { ...r }; delete n[a.refArt]; return n; });
      setCart((prev) => prev.map((i) => (i.article.refArt === a.refArt ? { ...i, remise: 0 } : i)));
      if (getQty(a.refArt) > 0) {
        fetch("/api/panier", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vue: "ligne", refArt: a.refArt, qte: 0, remise: 0 }),
        }).catch(() => {});
      }
    };
    if (pct === "" || !Number.isFinite(taux)) {
      // Champ vidé ou illisible : retour au prix catalogue, sans remise.
      if (saisie) remettre(`Prix catalogue rétabli : ${fmt(a.prixTtc)} TND`);
      return;
    }
    if (taux < 0) return remettre(`Prix au-dessus du tarif catalogue — remis à ${fmt(a.prixTtc)} TND`);
    if (a.remiseMax && a.remiseMax > 0 && taux > a.remiseMax) {
      return remettre(`Remise maximale de ${a.remiseMax} % pour ${a.designation} — prix remis à ${fmt(a.prixTtc)} TND`);
    }
    // Le champ saisi fait foi. Un prix tapé (30) reste 30,000 : la remise
    // s'en déduit avec toute sa précision (44,444…%) et le serveur reçoit le
    // prix net. Recalculer le prix depuis la remise arrondie donnait 30,002.
    const ttc = a.prixTtc || 0;
    const parPrix = saisie?.champ === "net";
    const net = parPrix ? Number(Number(saisie!.net).toFixed(3)) : Number((ttc * (1 - Number(taux.toFixed(2)) / 100)).toFixed(3));
    const precis = parPrix && ttc > 0 ? 100 - (net * 100) / ttc : Number(taux.toFixed(2));
    setRemises((r) => ({ ...r, [a.refArt]: { pct: precis.toFixed(2), net: net.toFixed(3), champ: saisie?.champ } }));
    setCart((prev) =>
      prev.map((i) => (i.article.refArt === a.refArt ? { ...i, remise: precis } : i)),
    );
    // La remise n'est envoyée que si la ligne est déjà au panier : sinon elle
    // sera transmise à l'ajout.
    if (getQty(a.refArt) > 0) {
      fetch("/api/panier", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vue: "ligne", refArt: a.refArt, qte: 0, ...(parPrix ? { net } : { remise: precis }) }),
      }).catch(() => {});
    }
  }

  /**
   * Quantité encore disponible à la vente : ce que porte le camion moins ce qui
   * est déjà réservé dans le panier. Calculé côté client pour que le compteur
   * réagisse au clic, sans attendre un aller-retour serveur.
   */
  const dispoRestant = (a: Article) => {
    const charge = a.stockCamion ?? a.enStock;
    return Math.round((charge - getQty(a.refArt)) * 1000) / 1000;
  };

  const totalItems = cart.reduce((s, i) => s + i.qty, 0);
  // Totaux du panier, calculés comme le document : remise de ligne, puis FODEC
  // dans la base de TVA. Les ignorer affichait 38,614 TND au commercial pour un
  // ticket émis à 39,000 — le prix TTC de la production.
  const totalHT = cart.reduce(
    (s, i) => s + i.qty * i.article.tarif1Ht * (1 - (i.remise ?? 0) / 100),
    0,
  );
  const totalTTC = cart.reduce((s, i) => {
    const htNet = i.qty * i.article.tarif1Ht * (1 - (i.remise ?? 0) / 100);
    const fodec = htNet * ((i.article.tauxFodec ?? 0) / 100);
    return s + htNet + fodec + (htNet + fodec) * (i.article.tauxTva / 100);
  }, 0);
  // La TVA affichée est le solde TTC − HT : elle absorbe le FODEC, comme sur
  // la ligne de vente de l'ERP d'origine.
  const totalTVA = totalTTC - totalHT;
  // `tot_remise` de l'ERP d'origine est une remise **HT** : vérifié sur les
  // 440 tickets de production émis depuis juin 2026, où `tht_net = tht_brut −
  // tot_remise` sans exception. La mesurer sur le TTC gonflait le montant
  // affiché (6,100 au lieu de 5,094 sur un panier à 10 %).
  const totalRemise = cart.reduce(
    (s, i) => s + i.qty * i.article.tarif1Ht * ((i.remise ?? 0) / 100),
    0,
  );

  /**
   * Distance au-delà de laquelle on doute que le commercial soit réellement
   * chez le client. On avertit sans bloquer : un GPS imprécis en intérieur ne
   * doit pas empêcher une vente légitime.
   */
  const RAYON_PRESENCE_M = 300;

  async function validerPanier() {
    if (cart.length === 0) return;
    if (!clientActif) { flash("Sélectionnez d'abord le client en haut de l'écran"); return; }

    // Contrôle de présence : le ticket atteste d'une livraison sur place.
    const loin = clientActif.distance != null && clientActif.distance > RAYON_PRESENCE_M;
    if (loin) {
      const km = clientActif.distance! >= 1000
        ? `${(clientActif.distance! / 1000).toFixed(1)} km`
        : `${Math.round(clientActif.distance!)} m`;
      const ok = await confirmer("", {
        titre: "Client éloigné",
        html:
          `Vous semblez être à <b>${km}</b> de « ${clientActif.raisonSocial} ».` +
          `<br><br>Le ticket atteste d'une livraison sur place.`,
        intitule: "Émettre quand même",
        danger: true,
      });
      if (!ok) return;
    }

    // Le règlement se saisit avant l'émission, comme dans l'application
    // d'origine : on passe à l'étape « paiement » plutôt que d'émettre
    // directement.
    setPaiement(true);
    setMontantRegle(totalTTC.toFixed(3));
  }

  /**
   * Émet le ticket et enregistre le règlement.
   *
   * Passe par `/api/panier` — et non plus directement par `/api/commandes` —
   * pour que les remises de ligne et l'encaissement suivent le même chemin que
   * le panier serveur : le ticket est validé (sortie de stock, débit client)
   * puis le règlement imputé, le reste éventuel demeurant au débit.
   */
  async function emettreTicket() {
    if (!clientActif) return;
    setSaving(true);
    // Crédit : aucun encaissement, la totalité reste due.
    const montant = modePay === "Crédit" ? 0 : Number(montantRegle) || 0;
    const r = await fetch("/api/panier", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vue: "valider",
        codeCli: clientActif.id,
        typeDoc: "TIC",
        reglements: montant > 0
          ? [{
              mode: modePay,
              montant,
              numPiece: numPiece || null,
              echeance: modePay === "Chèque" || modePay === "Traite" ? echeance || null : null,
            }]
          : [],
      }),
    }).then((x) => x.json()).catch(() => ({ error: "réseau" }));
    setSaving(false);
    if (r.ok) {
      setCart([]);
      setRemises({});
      setPaiement(false);
      setShowCart(false);
      setNumPiece("");
      setEcheance("");
      const reste = Number(r.reste) || 0;
      flash(
        `Ticket ${r.refDoc} émis (${fmt(r.ttcNet)} TND)` +
        (reste > 0 ? ` — reste ${fmt(reste)} TND au débit du client` : " — réglé"),
      );
      // Le ticket s'ouvre aussitôt : en tournée, le client repart avec.
      setTicketRef(r.refDoc ?? null);
    } else {
      flash(r.error ?? "Échec de la création");
    }
  }

  /** Vide le panier, côté écran et côté serveur. */
  async function viderPanier() {
    if (cart.length === 0) return;
    const ok = await confirmer(
      `${totalItems} article(s) seront retirés du panier.`,
      { titre: "Vider le panier", intitule: "Vider le panier", danger: true },
    );
    if (!ok) return;
    // L'écran se met à jour tout de suite : les quantités réservées sont
    // relâchées, donc les pastilles « À bord » remontent immédiatement.
    setCart([]);
    setShowCart(false);
    const r = await fetch("/api/panier", { method: "DELETE" })
      .then((x) => x.json())
      .catch(() => ({ error: "réseau" }));
    flash(r.ok ? "Panier vidé" : (r.error ?? "Échec du vidage"));
  }

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 4000); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Catalogue produits</h1>
          <p className="text-[var(--text-secondary)] text-sm">
            {loading ? "Chargement…" : `${articles.length} affichés sur ${total} articles`}
          </p>
          {emplacement && (
            <p className="text-[var(--text-secondary)] text-xs mt-0.5">
              Stock du véhicule <span className="font-semibold">{plaque ?? emplacement}</span>
            </p>
          )}
        </div>
        <motion.button onClick={() => setShowCart(true)}
          className="relative flex items-center gap-2 text-white px-4 py-2.5 rounded-xl font-bold transition-all text-sm shadow-[0_10px_24px_-14px_var(--shadow-hover)] hover:shadow-[0_14px_30px_-14px_var(--shadow-hover)]"
          style={{ background: "linear-gradient(135deg, var(--accent-primary), color-mix(in srgb, var(--accent-primary) 78%, #000))" }}
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <ShoppingCart size={16} /> Panier
          {totalItems > 0 && (
            <span className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full text-xs flex items-center justify-center font-bold">
              {totalItems}
            </span>
          )}
        </motion.button>
      </div>

      {toast && (
        <div className="px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-sm font-medium flex items-center gap-2">
          <Check size={15} /> {toast}
        </div>
      )}

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setLoading(true); }}
            className="pl-9 pr-4 py-2.5 text-sm bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl w-full focus:outline-none"
            placeholder="Rechercher par désignation, référence ou code-barres…" />
        </div>
        <select value={dispo} onChange={(e) => { setDispo(e.target.value); setLoading(true); }}
          className="py-2.5 px-3 text-sm bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl focus:outline-none">
          <option value="toutes">Tous les articles</option>
          <option value="stock">En stock ({nbEnStock})</option>
          <option value="rupture">En rupture</option>
        </select>
      </div>

      {loading && <div className="py-16 text-center text-[var(--text-secondary)]"><Loader2 className="animate-spin inline" size={22} /></div>}
      {!loading && articles.length === 0 && (
        <div className="py-16 text-center text-sm text-[var(--text-secondary)]">Aucun article trouvé.</div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {!loading && articles.map((a, i) => {
          const qty = getQty(a.refArt);
          // Ce qu'il reste réellement à vendre après déduction du panier :
          // chaque « + » fait donc baisser le compteur affiché.
          const restant = dispoRestant(a);
          const rupture = restant <= 0;
          const bas = !rupture && restant <= (a.stMin || 0);
          return (
            <motion.div key={a.refArt}
              className="group flex flex-col overflow-hidden bg-[var(--bg-card)] rounded-2xl border border-[var(--border-primary)]
                         transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--accent-primary)]/25
                         hover:shadow-[0_16px_36px_-20px_var(--shadow-hover)]"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.02, 0.3) }}>
              {/* Visuel plein cadre : la photo occupe tout le haut de la carte
                  et le nom du produit se pose dessus, dans un dégradé sombre —
                  seul moyen de garder le texte lisible quelle que soit la
                  photo. Sans photo, le même bandeau est peint à l'accent. */}
              <div className="relative w-full aspect-[4/3] overflow-hidden">
                {a.aPhoto ? (
                  <>
                    {/* Fond flouté tiré de la photo : remplit les côtés quand le
                        produit n'a pas le format du cadre, sans jamais le rogner. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/articles/photo?refArt=${encodeURIComponent(a.refArt)}`} alt=""
                      aria-hidden="true" loading="lazy"
                      className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-45" />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/articles/photo?refArt=${encodeURIComponent(a.refArt)}`} alt={a.designation}
                      loading="lazy"
                      className="absolute inset-0 w-full h-full object-contain transition-transform duration-500 group-hover:scale-[1.07]" />
                  </>
                ) : (
                  <div className="absolute inset-0 flex items-start justify-center pt-7 bg-gradient-to-br from-[var(--bg-primary)] to-[var(--accent-light)]">
                    <Package size={44} className="text-[var(--accent-primary)] opacity-25" />
                  </div>
                )}

                {/* Voile : sans lui, un titre clair sur une photo claire
                    devient illisible. Sur une carte sans photo, un voile noir
                    virait au gris sale — on y peint l'accent de la maison. */}
                <div className={`absolute inset-x-0 bottom-0 h-3/5 pointer-events-none ${
                  a.aPhoto
                    ? "bg-gradient-to-t from-black/85 via-black/45 to-transparent"
                    : "bg-gradient-to-t from-[var(--accent-primary)] via-[var(--accent-primary)]/75 to-transparent"}`} />

                {/* État du stock, en haut du visuel. */}
                {(rupture || bas) && (
                  <span className={`absolute top-2.5 left-2.5 text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-lg text-white shadow-sm
                                    ${rupture ? "bg-red-500" : "bg-amber-500"}`}>
                    {rupture ? "Rupture" : "Stock bas"}
                  </span>
                )}
                <span className={`absolute top-2.5 right-2.5 text-[10px] font-bold px-2 py-1 rounded-lg backdrop-blur-sm shadow-sm whitespace-nowrap
                                  ${rupture ? "bg-red-500/90 text-white"
                                    : bas ? "bg-amber-500/90 text-white"
                                    : "bg-white/85 text-emerald-700"}`}>
                  {emplacement ? "À bord" : "Stock"} · {restant}
                </span>

                {/* Nom et prix posés sur la photo. */}
                <div className="absolute inset-x-0 bottom-0 p-3">
                  <div className="font-bold text-white text-[13.5px] leading-snug line-clamp-2 drop-shadow-sm" title={a.designation}>
                    {a.designation}
                  </div>
                  <div className="flex items-end justify-between gap-2 mt-1.5">
                    <div className="font-black text-white text-[20px] leading-none tabular-nums drop-shadow">
                      {fmt(a.tarif1Ht)} <span className="text-[11px] font-bold opacity-80">TND</span>
                    </div>
                    {/* Second stock, comme sur l'application d'origine : le camion
                        ne dit pas si le dépôt peut réapprovisionner. Seuils repris
                        de la production — vert ≥ 5, orange 1 à 4, rouge en dessous. */}
                    {emplacement && a.stockGlobal != null && (
                      <span title="Stock global de l'article (tous emplacements)"
                        className={`text-[10px] font-bold whitespace-nowrap drop-shadow
                                    ${a.stockGlobal >= 5 ? "text-emerald-300"
                                      : a.stockGlobal >= 1 ? "text-amber-300"
                                      : "text-red-300"}`}>
                        {/* Les quantités sont fractionnaires pour certains articles
                            (383,5) : on retire les zéros inutiles sans tronquer. */}
                        Dépôt · {Number(a.stockGlobal).toLocaleString("fr-FR", { maximumFractionDigits: 3 })}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Le visuel touche les bords : le padding vit donc sur le
                  contenu, pas sur la carte. */}
              <div className="flex flex-col flex-1 p-3 pt-2.5">
              <div className="flex items-center justify-between gap-2 text-[10px] text-[var(--text-secondary)]">
                <span className="truncate font-mono tracking-tight opacity-70">
                  {a.refArt}{a.codeBarre ? ` · ${a.codeBarre}` : ""}
                </span>
                <span className="shrink-0 opacity-70">TTC {fmt(a.prixTtc)} · {a.tauxTva}%</span>
              </div>

              {/* Remise et prix net, comme au catalogue de l'ERP d'origine :
                  les deux champs sont liés, l'un se déduit de l'autre. */}
              {/* Ligne de prix de l'ERP d'origine, à l'identique :
                     [ prix TTC de base — grisé ]  %  [ remise ]  $  [ net ]
                  Le premier champ rappelle le tarif catalogue et n'est pas
                  modifiable ; les deux autres sont liés (`handlePrixChange`). */}
              <div className="flex items-center gap-1 mt-2.5 mb-3 p-1 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-primary)]">
                <input type="text" value={fmt(a.prixTtc)} disabled
                  aria-label={`Prix TTC catalogue de ${a.designation}`}
                  className="w-0 flex-1 min-w-0 px-1.5 py-1.5 text-[11px] text-center tabular-nums
                             bg-transparent border-0 rounded-lg
                             text-[var(--text-secondary)] opacity-60 cursor-not-allowed" />
                <span className="text-[11px] font-bold text-[var(--text-secondary)] px-0.5">%</span>
                <input type="text" inputMode="decimal"
                  value={remises[a.refArt]?.pct ?? ""}
                  onChange={(e) => majRemise(a, "pct", e.target.value)}
                  onBlur={() => validerRemise(a)}
                  onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                  placeholder="0"
                  aria-label={`Remise en pourcentage pour ${a.designation}`}
                  className="w-0 flex-1 min-w-0 px-1.5 py-1.5 text-[11px] text-center tabular-nums font-semibold
                             bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg text-[var(--text-primary)]
                             transition focus:outline-none focus:border-[var(--accent-primary)]/50
                             focus:ring-2 focus:ring-[var(--accent-primary)]/12" />
                <span className="text-[11px] font-bold text-[var(--text-secondary)] px-0.5">$</span>
                <input type="text" inputMode="decimal"
                  value={remises[a.refArt]?.net ?? fmtNombre(a.prixTtc)}
                  onChange={(e) => majRemise(a, "net", e.target.value)}
                  onBlur={() => validerRemise(a)}
                  onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                  onFocus={(e) => e.target.select()}
                  aria-label={`Prix net TTC pour ${a.designation}`}
                  className="w-0 flex-1 min-w-0 px-1.5 py-1.5 text-[11px] text-center tabular-nums font-semibold
                             bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg text-[var(--text-primary)]
                             transition focus:outline-none focus:border-[var(--accent-primary)]/50
                             focus:ring-2 focus:ring-[var(--accent-primary)]/12" />
              </div>

              {qty === 0 ? (
                <motion.button onClick={() => addToCart(a)} disabled={rupture}
                  className="mt-auto w-full flex items-center justify-center gap-1.5 text-[13px] font-bold text-white py-2.5 rounded-xl
                             transition-all disabled:opacity-35 disabled:cursor-not-allowed
                             shadow-[0_8px_20px_-12px_var(--shadow-hover)] hover:shadow-[0_12px_26px_-12px_var(--shadow-hover)]"
                  style={{ background: rupture ? "var(--text-secondary)" : "linear-gradient(135deg, var(--accent-primary), color-mix(in srgb, var(--accent-primary) 78%, #000))" }}
                  whileHover={{ scale: rupture ? 1 : 1.015 }} whileTap={{ scale: 0.98 }}>
                  <Plus size={14} /> {rupture ? "Rupture" : "Ajouter"}
                </motion.button>
              ) : (
                <div className="mt-auto flex items-center gap-1.5 rounded-xl p-1 bg-[var(--accent-light)] border border-[var(--accent-primary)]/20">
                  <button onClick={() => updateQty(a.refArt, -1)} className="w-8 h-8 shrink-0 flex items-center justify-center bg-[var(--bg-card)] rounded-lg shadow-sm hover:bg-red-50 transition">
                    <Minus size={13} className="text-red-500" />
                  </button>
                  <span className="font-black w-6 text-center tabular-nums" style={{ color: "var(--accent-primary)" }}>{qty}</span>
                  <button onClick={() => updateQty(a.refArt, 1)} disabled={restant <= 0}
                    title={restant <= 0 ? "Plus rien à bord pour cet article" : undefined}
                    className="w-8 h-8 shrink-0 flex items-center justify-center bg-[var(--bg-card)] rounded-lg shadow-sm hover:bg-emerald-50 transition disabled:opacity-40 disabled:cursor-not-allowed">
                    <Plus size={13} className="text-emerald-500" />
                  </button>
                  {/* Total de la ligne : prix net × quantité, comme dans l'ERP
                      d'origine (`option.net * option.qteCmd`). */}
                  <div className="flex-1 min-w-0 text-right pr-1.5 text-xs font-bold tabular-nums text-[var(--text-primary)]">
                    {fmt((remises[a.refArt]?.net && Number.isFinite(Number(remises[a.refArt]?.net)) ? Number(remises[a.refArt]?.net) : a.prixTtc) * qty)}
                  </div>
                </div>
              )}
              </div>
            </motion.div>
          );
        })}
      </div>

      <AnimatePresence>
        {showCart && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowCart(false)}>
            <motion.div className="bg-[var(--bg-card)] rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
              <div className="bg-slate-800 text-white p-5 flex items-center justify-between">
                <div>
                  <div className="font-bold text-lg">Panier en cours</div>
                  <div className="text-slate-400 text-xs">{totalItems} article(s)</div>
                </div>
                <button onClick={() => setShowCart(false)} className="p-2 hover:bg-white/10 rounded-lg transition"><X size={18} /></button>
              </div>

              <div className="p-5 overflow-auto flex-1">
                {cart.length === 0 ? (
                  <div className="text-center py-10 text-[var(--text-secondary)]">
                    <ShoppingCart size={32} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Panier vide</p>
                  </div>
                ) : (
                  <>
                    {/* Le client vient du bandeau de tournée, pas d'une liste à
                        re-parcourir : la commande suit toujours la visite. */}
                    {clientActif ? (
                      <div className="mb-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3">
                        <div className="text-[10px] font-black uppercase tracking-wider text-emerald-600">
                          Commande pour
                        </div>
                        <div className="font-bold text-sm text-[var(--text-primary)] truncate mt-0.5">
                          {clientActif.raisonSocial}
                        </div>
                        <div className="text-xs text-[var(--text-secondary)] flex items-center gap-1.5 truncate">
                          <MapPin size={10} className="shrink-0" />
                          {clientActif.ville || clientActif.adresse || "—"}
                          {clientActif.soldeFin != null && clientActif.soldeFin > 0 && (
                            <span className="text-red-600 font-semibold">
                              · solde {fmt(clientActif.soldeFin)} TND
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="mb-4 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-center gap-2.5">
                        <AlertTriangle size={16} className="text-amber-600 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-xs text-[var(--text-primary)]">Aucun client sélectionné</div>
                          <div className="text-[11px] text-[var(--text-secondary)]">
                            Choisissez le client avant de valider la commande.
                          </div>
                        </div>
                        <button onClick={() => router.push("/commercial/clients")}
                          className="text-[11px] font-bold bg-amber-500 text-white px-2.5 py-1.5 rounded-lg hover:bg-amber-400 transition shrink-0">
                          Choisir
                        </button>
                      </div>
                    )}

                    <div className="space-y-2 mb-4">
                      {cart.map((item) => {
                        // La ligne se lit comme en production : `net × qteCmd`, le net
                        // étant le prix TTC après remise (`pu_ttc`). Afficher le tarif
                        // HT catalogue donnait des lignes qui ne totalisaient pas le
                        // « Net à payer » — 32,449 × 1 face à un net de 54,900.
                        const remise = item.remise ?? 0;
                        const prixPlein =
                          item.article.tarif1Ht *
                          (1 + (item.article.tauxFodec ?? 0) / 100) *
                          (1 + item.article.tauxTva / 100);
                        const net = prixPlein * (1 - remise / 100);
                        return (
                          <div key={item.article.refArt} className="flex items-center justify-between p-3 bg-[var(--bg-primary)] rounded-xl text-sm">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-[var(--text-primary)] truncate">{item.article.designation}</div>
                              <div className="text-[var(--text-secondary)] text-xs flex items-center gap-1.5 flex-wrap">
                                {remise > 0 ? (
                                  <>
                                    <span className="line-through opacity-60">{fmt(prixPlein)}</span>
                                    <span className="font-medium text-[var(--text-primary)]">{fmt(net)} × {item.qty}</span>
                                    <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-semibold text-[11px]">
                                      −{remise}%
                                    </span>
                                  </>
                                ) : (
                                  <span>{fmt(net)} × {item.qty}</span>
                                )}
                              </div>
                            </div>
                            <div className="text-right ml-3">
                              <div className="font-semibold text-[var(--text-primary)] tabular-nums">
                                {fmt(net * item.qty)}
                              </div>
                              {remise > 0 && (
                                <div className="text-[11px] text-emerald-600 tabular-nums">
                                  {/* Remise HT, comme `MT_Remise` en production. */}
                                  remise {fmt(item.article.tarif1Ht * (remise / 100) * item.qty)}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="border-t border-[var(--border-primary)] pt-3">
                      <Row label="Total HT" value={fmt(totalHT)} />
                      {/* `tot_remise` de l'ERP d'origine : le cumul des remises
                          accordées, pour que le client voie ce qu'il gagne. */}
                      {totalRemise > 0 && <Row label="Remise" value={`− ${fmt(totalRemise)}`} muted />}
                      <Row label="TVA" value={fmt(totalTVA)} muted />
                      <Row label="Net à payer" value={fmt(totalTTC)} strong />
                    </div>
                  </>
                )}
              </div>

              {/* Étape de règlement — reprend la séquence de l'application
                  d'origine : mode de paiement, montant encaissé, puis
                  émission. Un encaissement partiel laisse le solde au débit
                  du client. */}
              {cart.length > 0 && paiement && (
                <div className="p-5 border-t border-[var(--border-primary)] space-y-3">
                  <div className="text-xs font-black uppercase tracking-wider text-[var(--text-secondary)]">
                    Règlement
                  </div>

                  <div className="grid grid-cols-4 gap-1.5">
                    {MODES_PAIEMENT.map((m) => (
                      <button key={m} type="button" onClick={() => changerMode(m)}
                        className={`py-2 rounded-lg text-xs font-semibold border transition ${
                          m === "Crédit" ? "col-span-4" : ""
                        } ${
                          modePay === m
                            ? m === "Crédit"
                              ? "bg-amber-500 text-white border-amber-500"
                              : "text-white border-transparent shadow-sm"
                            : "border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]"
                        }`}
                        style={modePay === m && m !== "Crédit"
                          ? { background: "linear-gradient(135deg, var(--accent-primary), color-mix(in srgb, var(--accent-primary) 78%, #000))" }
                          : undefined}>
                        {m === "Crédit" ? "Crédit — à payer plus tard" : m}
                      </button>
                    ))}
                  </div>

                  {modePay !== "Crédit" && (
                    <label className="block">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                        Montant encaissé (TND)
                      </span>
                      <input type="number" inputMode="decimal" min={0} step="0.001"
                        value={montantRegle} onChange={(e) => setMontantRegle(e.target.value)}
                        className="w-full mt-1 px-3 py-2 text-sm text-right tabular-nums bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg focus:outline-none focus:border-[var(--accent-primary)]/50" />
                    </label>
                  )}

                  {(modePay === "Chèque" || modePay === "Traite") && (
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                          N° {modePay.toLowerCase()}
                        </span>
                        <input value={numPiece} onChange={(e) => setNumPiece(e.target.value)}
                          className="w-full mt-1 px-3 py-2 text-sm bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg focus:outline-none focus:border-[var(--accent-primary)]/50" />
                      </label>
                      <label className="block">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                          Échéance
                        </span>
                        <input type="date" value={echeance} onChange={(e) => setEcheance(e.target.value)}
                          className="w-full mt-1 px-3 py-2 text-sm bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg focus:outline-none focus:border-[var(--accent-primary)]/50" />
                      </label>
                    </div>
                  )}

                  {/* Ce qui restera dû après encaissement. */}
                  {(() => {
                    const reste = Math.round((totalTTC - (modePay === "Crédit" ? 0 : Number(montantRegle) || 0)) * 1000) / 1000;
                    return reste > 0 ? (
                      <div className="text-xs text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
                        {modePay === "Crédit" ? (
                          <>Vente à crédit : <strong>{fmt(reste)} TND</strong> portés au débit de {clientActif?.raisonSocial ?? "ce client"}, à recouvrer plus tard.</>
                        ) : (
                          <>Reste à payer : <strong>{fmt(reste)} TND</strong> — porté au débit du client</>
                        )}
                      </div>
                    ) : null;
                  })()}

                  <button onClick={emettreTicket} disabled={saving}
                    className="w-full bg-emerald-600 text-white py-3 rounded-xl font-medium hover:bg-emerald-500 transition text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                    {saving && <Loader2 className="animate-spin" size={16} />}
                    {modePay === "Crédit" ? "Émettre le ticket à crédit" : "Émettre le ticket"}
                  </button>
                  <button onClick={() => setPaiement(false)} disabled={saving}
                    className="w-full py-2.5 rounded-xl font-medium text-sm border border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-primary)] transition disabled:opacity-50">
                    Retour au panier
                  </button>
                </div>
              )}

              {cart.length > 0 && !paiement && (
                <div className="p-5 border-t border-[var(--border-primary)]">
                  <button onClick={validerPanier} disabled={saving || !clientActif}
                    className="w-full text-white py-3 rounded-xl font-bold transition-all text-sm disabled:opacity-50 flex items-center justify-center gap-2 shadow-[0_10px_24px_-14px_var(--shadow-hover)] hover:shadow-[0_14px_30px_-14px_var(--shadow-hover)]"
                    style={{ background: "linear-gradient(135deg, var(--accent-primary), color-mix(in srgb, var(--accent-primary) 78%, #000))" }}>
                    {saving && <Loader2 className="animate-spin" size={16} />}
                    Valider le panier → Ticket
                  </button>
                  <button onClick={viderPanier} disabled={saving}
                    className="w-full mt-2 py-2.5 rounded-xl font-medium text-sm border border-[var(--border-primary)]
                               text-[#b84a39] hover:bg-[#b84a39]/8 transition disabled:opacity-50
                               flex items-center justify-center gap-2">
                    <Trash2 size={15} /> Vider le panier
                  </button>
                  <p className="text-[11px] text-[var(--text-secondary)] mt-2 text-center">
                    Le ticket est émis immédiatement : le stock sort et le compte client est débité.
                  </p>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Ticket imprimable de la commande qui vient d'être créée. */}
      {ticketRef && (
        <TicketVente refDoc={ticketRef} onClose={() => setTicketRef(null)} />
      )}
    </div>
  );
}

function Row({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? "text-sm font-black mt-2 text-[var(--accent-primary)]" : muted ? "text-xs text-[var(--text-secondary)] mt-1" : "text-sm font-bold"}`}>
      <span className={strong || muted ? "" : "text-[var(--text-secondary)]"}>{label}</span>
      <span className="tabular-nums">{value} TND</span>
    </div>
  );
}
