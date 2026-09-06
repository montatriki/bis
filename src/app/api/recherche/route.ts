import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { requireSession } from "@/lib/session";
import { filtrePortefeuille } from "@/lib/perimetre-commercial";

// Recherche globale de la barre du haut.
//
// GET /api/recherche?q=…
//
// Trois principes :
//   1. cloisonnement — un commercial ne trouve que SES clients, SES documents,
//      SES tournées ; un client ne cherche que dans ses propres achats ;
//   2. index — chaque requête s'appuie sur les index trigrammes créés par la
//      migration `20260905140000_recherche_globale`, jamais sur un parcours
//      complet des 4 601 tiers et 28 966 documents ;
//   3. intention — la forme de la saisie oriente la recherche : « TIC251545 »
//      est un numéro de pièce, « 6192207300800 » un code-barres, « 41101015 »
//      un code client. On interroge alors la bonne table en priorité.

type Resultat = {
  type: "client" | "article" | "document" | "mission" | "commercial" | "page";
  id: string;
  titre: string;
  detail?: string;
  info?: string;
  lien: string;
};

/** Écrans atteignables au clavier, filtrés par rôle. */
const PAGES: { titre: string; lien: string; mots: string; roles: string[] }[] = [
  { titre: "Tableau de bord", lien: "/admin/dashboard", mots: "accueil supervision", roles: ["ADMIN", "MANAGER"] },
  { titre: "Synthèse", lien: "/admin/synthese", mots: "objectifs resultats", roles: ["ADMIN", "MANAGER"] },
  { titre: "Comptabilité", lien: "/admin/compta", mots: "compta ecritures journal", roles: ["ADMIN"] },
  { titre: "État du stock", lien: "/admin/etat-stock", mots: "stock inventaire depot", roles: ["ADMIN", "MANAGER"] },
  { titre: "Ordres de mission", lien: "/admin/missions", mots: "tournees om", roles: ["ADMIN", "MANAGER"] },
  { titre: "Commerciaux", lien: "/admin/commerciaux", mots: "vendeurs equipe", roles: ["ADMIN", "MANAGER"] },
  { titre: "Visites terrain", lien: "/admin/visites", mots: "pointages je suis la", roles: ["ADMIN", "MANAGER"] },
  { titre: "Rapports", lien: "/admin/rapports-admin", mots: "editions exports", roles: ["ADMIN", "MANAGER"] },
  { titre: "Utilisateurs", lien: "/admin/users", mots: "comptes acces droits", roles: ["ADMIN"] },
  { titre: "Clients", lien: "/admin/modules/vente/clients", mots: "tiers portefeuille", roles: ["ADMIN", "MANAGER"] },
  { titre: "Planning du jour", lien: "/commercial/planning", mots: "tournee visites etapes", roles: ["COMMERCIAL"] },
  { titre: "Mes clients", lien: "/commercial/clients", mots: "portefeuille tiers", roles: ["COMMERCIAL"] },
  { titre: "Catalogue", lien: "/commercial/catalogue", mots: "produits articles prix", roles: ["COMMERCIAL"] },
  { titre: "Panier de commande", lien: "/commercial/panier", mots: "commande en cours", roles: ["COMMERCIAL"] },
  { titre: "Recouvrement", lien: "/commercial/recouvrement", mots: "encaissement reglement impaye", roles: ["COMMERCIAL"] },
  { titre: "Stock véhicule", lien: "/commercial/retour-stock", mots: "camion chargement", roles: ["COMMERCIAL"] },
  { titre: "Journal de caisse", lien: "/commercial/journal", mots: "caisse encaissements", roles: ["COMMERCIAL"] },
  { titre: "Dernier ticket", lien: "/commercial/dernier-ticket", mots: "ticket vente impression", roles: ["COMMERCIAL"] },
  { titre: "Carte GPS", lien: "/commercial/map", mots: "geolocalisation carte", roles: ["COMMERCIAL"] },
  { titre: "Réclamations", lien: "/commercial/reclamation", mots: "litige sav", roles: ["COMMERCIAL"] },
  { titre: "Mes achats", lien: "/client/historique", mots: "historique commandes", roles: ["CLIENT"] },
];

const fmt = (n: number) => new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(n ?? 0);

export async function GET(req: NextRequest) {
  const auth = await requireSession();
  if (!auth.ok) return auth.res;

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  // Deux lettres suffisent à cibler ; en deçà, tout ressortirait.
  if (q.length < 2) return NextResponse.json({ resultats: [], q });

  const role = auth.user.role;
  const nom = auth.user.name;
  const estCommercial = role === "COMMERCIAL";
  const estClient = role === "CLIENT";

  // Forme de la saisie : elle indique ce que l'utilisateur cherche.
  const chiffresSeuls = /^\d+$/.test(q);
  const ressembleAPiece = /^(TIC|BL|FAC|AV|BR|BRE|FC|COM|OM)[-\s]?\d+/i.test(q);
  const ressembleACodeBarre = chiffresSeuls && q.length >= 8;
  const ressembleACodeClient = chiffresSeuls && q.length >= 6 && q.length <= 8;

  const contient = { contains: q, mode: "insensitive" as const };

  // Recherche mot à mot : les noms importés contiennent parenthèses, tirets et
  // espaces doubles (« Ste Anouar express (abou dhabi) »). Exiger la ponctuation
  // exacte rendait le client introuvable dès qu'on tapait le nom naturellement.
  // Chaque mot doit être présent, dans n'importe quel ordre.
  const mots = q.split(/[^\p{L}\p{N}]+/u).filter((m) => m.length >= 2);
  /** Champ contenant TOUS les mots de la requête, où qu'ils soient. */
  const tousLesMots = (champ: string) =>
    mots.length > 1
      ? { AND: mots.map((m) => ({ [champ]: { contains: m, mode: "insensitive" as const } })) }
      : { [champ]: contient };

  const resultats: Resultat[] = [];

  // --- Clients (et fournisseurs pour l'administration)
  if (!estClient) {
    const portefeuille = filtrePortefeuille({ role, name: nom });
    const clients = await prisma.partner.findMany({
      where: {
        ...(portefeuille ?? {}),
        ...(estCommercial ? { nature: "C" } : {}),
        OR: [
          tousLesMots("raisonSocial"),
          { ville: contient },
          { tel: contient },
          { matriculeF: contient },
          ...(ressembleACodeClient && Number.isFinite(Number(q)) ? [{ id: Number(q) }] : []),
        ],
      },
      take: 6,
      orderBy: { soldeFin: "desc" },
      select: { id: true, raisonSocial: true, ville: true, gouvernorat: true, soldeFin: true, nature: true },
    });
    const baseFiche = estCommercial ? "/commercial/clients" : "/admin/modules/vente/clients";
    for (const c of clients) {
      resultats.push({
        type: "client",
        id: `client-${c.id}`,
        titre: c.raisonSocial,
        detail: [c.ville, c.gouvernorat].filter(Boolean).join(" — ") || undefined,
        info: c.soldeFin > 0 ? `${fmt(c.soldeFin)} TND dus` : undefined,
        lien: `${baseFiche}/${c.id}`,
      });
    }
  }

  // --- Articles : le code-barres scanné doit tomber juste du premier coup.
  if (!estClient) {
    const articles = await prisma.article.findMany({
      where: { OR: [tousLesMots("designation"), { refArt: contient }, { codeBarre: contient }] },
      take: ressembleACodeBarre ? 6 : 4,
      select: { refArt: true, designation: true, codeBarre: true, tarif1Ht: true },
    });
    const lienCatalogue = estCommercial ? "/commercial/catalogue" : "/admin/etat-stock";
    for (const a of articles) {
      resultats.push({
        type: "article",
        id: `article-${a.refArt}`,
        titre: a.designation,
        detail: [a.refArt, a.codeBarre].filter(Boolean).join(" · "),
        info: a.tarif1Ht ? `${fmt(a.tarif1Ht)} TND HT` : undefined,
        lien: `${lienCatalogue}?q=${encodeURIComponent(a.refArt)}`,
      });
    }
  }

  // --- Documents : numéro de pièce ou nom du tiers.
  {
    const where: Record<string, unknown> = {
      OR: [{ refDoc: contient }, tousLesMots("raisonSocial")],
    };
    // Chaque rôle dans son périmètre : le commercial ses ventes, le client ses
    // propres pièces.
    if (estCommercial) where.commercial = { equals: nom, mode: "insensitive" };
    if (estClient) where.codeCli = auth.user.id;

    const docs = await prisma.erpDocument.findMany({
      where,
      take: ressembleAPiece ? 8 : 4,
      orderBy: { dateDoc: "desc" },
      select: { refDoc: true, typeDoc: true, dateDoc: true, raisonSocial: true, ttcNet: true, soldeDoc: true },
    });
    const lienJournal = estCommercial ? "/commercial/journal" : estClient ? "/client/historique" : "/admin/modules/vente/documents";
    for (const d of docs) {
      resultats.push({
        type: "document",
        id: `doc-${d.refDoc}`,
        titre: d.refDoc.toUpperCase().startsWith((d.typeDoc ?? "").toUpperCase())
          ? d.refDoc
          : `${d.typeDoc ?? "Pièce"} ${d.refDoc}`,
        detail: [d.raisonSocial, d.dateDoc ? new Date(d.dateDoc).toLocaleDateString("fr-FR") : null].filter(Boolean).join(" · "),
        info: `${fmt(d.ttcNet)} TND${d.soldeDoc > 0 ? ` · ${fmt(d.soldeDoc)} dus` : ""}`,
        lien: `${lienJournal}?doc=${encodeURIComponent(d.refDoc)}`,
      });
    }
  }

  // --- Ordres de mission : « OM-2894 » ou le nom d'un commercial.
  if (!estClient) {
    const numero = q.match(/(?:OM[-\s]?)?(\d{3,})/i)?.[1];
    const missions = await prisma.erpMission.findMany({
      where: {
        ...(estCommercial ? { commercial: { contains: nom.split(" ")[0], mode: "insensitive" } } : {}),
        OR: [
          ...(numero ? [{ id: Number(numero) }] : []),
          { commercial: contient },
          { vehicule: contient },
        ],
      },
      take: 3,
      orderBy: { dateOrdre: "desc" },
      select: { id: true, commercial: true, vehicule: true, dateOrdre: true, etat: true },
    });
    const lienMission = estCommercial ? "/commercial/planning" : "/admin/missions";
    for (const m of missions) {
      resultats.push({
        type: "mission",
        id: `mission-${m.id}`,
        titre: `OM-${m.id}`,
        detail: [m.commercial, m.vehicule].filter(Boolean).join(" · "),
        info: [m.dateOrdre ? new Date(m.dateOrdre).toLocaleDateString("fr-FR") : null, m.etat].filter(Boolean).join(" · "),
        lien: `${lienMission}?om=${m.id}`,
      });
    }
  }

  // --- Commerciaux : l'administration doit retrouver un vendeur par son nom.
  // La source est le portefeuille ERP (`partners.commercial`), pas la table
  // des comptes : des vendeurs de production n'ont pas d'accès à l'application.
  if (role === "ADMIN" || role === "MANAGER") {
    const groupes = await prisma.partner.groupBy({
      by: ["commercial"],
      where: { nature: "C", commercial: contient },
      _count: { _all: true },
      _sum: { soldeFin: true },
      orderBy: { _count: { commercial: "desc" } },
      take: 4,
    });
    for (const g of groupes) {
      if (!g.commercial) continue;
      resultats.push({
        type: "commercial",
        id: `commercial-${g.commercial}`,
        titre: g.commercial,
        detail: `${g._count._all} client${g._count._all > 1 ? "s" : ""} au portefeuille`,
        info: g._sum.soldeFin ? `${fmt(g._sum.soldeFin)} TND dus` : undefined,
        lien: `/admin/commerciaux/${encodeURIComponent(g.commercial)}`,
      });
    }
  }

  // --- Écrans : « recouvrement », « stock »… mènent directement à la page.
  const qn = q.toLowerCase();
  for (const p of PAGES) {
    if (!p.roles.includes(role)) continue;
    if (p.titre.toLowerCase().includes(qn) || p.mots.includes(qn)) {
      resultats.push({ type: "page", id: `page-${p.lien}`, titre: p.titre, detail: "Ouvrir l'écran", lien: p.lien });
    }
  }

  // --- Rattrapage : rien trouvé alors que l'utilisateur cherchait un nom ?
  // On propose les plus ressemblants (similarité trigramme), pour couvrir les
  // fautes de frappe et les graphies approximatives — « medinar » pour
  // « ste medinart », « anwar » pour « anouar ».
  const aDesNoms = resultats.some((r) => r.type === "client" || r.type === "commercial");
  if (!aDesNoms && !estClient && q.length >= 4 && !chiffresSeuls) {
    const portefeuille = filtrePortefeuille({ role, name: nom });
    // `similarity()` n'existe pas côté Prisma : requête brute, paramétrée.
    const proches = await prisma.$queryRaw<{ id: number; raisonSocial: string; ville: string | null; gouvernorat: string | null; soldeFin: number; score: number }[]>`
      SELECT id, "raisonSocial", ville, gouvernorat, "soldeFin",
             similarity("raisonSocial", ${q}) AS score
      FROM partners
      WHERE nature = 'C'
        AND ("raisonSocial" % ${q})
        ${portefeuille ? Prisma.sql`AND lower(commercial) = lower(${nom})` : Prisma.empty}
      ORDER BY score DESC
      LIMIT 5`;
    const baseFiche = estCommercial ? "/commercial/clients" : "/admin/modules/vente/clients";
    for (const c of proches) {
      resultats.push({
        type: "client",
        id: `proche-${c.id}`,
        titre: c.raisonSocial,
        detail: [c.ville, c.gouvernorat].filter(Boolean).join(" — ") || undefined,
        // L'utilisateur doit savoir que ce n'est pas une correspondance exacte.
        info: "nom approchant",
        lien: `${baseFiche}/${c.id}`,
      });
    }
  }

  // Répartition : sans quota, les clients (souvent les plus nombreux)
  // occupaient les 20 places et masquaient commerciaux, écrans et missions.
  // On sert d'abord ce que chaque nature a de plus pertinent, puis on complète.
  const QUOTA: Record<Resultat["type"], number> = {
    page: 3, commercial: 3, client: 5, article: 4, document: 4, mission: 2,
  };
  const retenus: Resultat[] = [];
  const compte: Record<string, number> = {};
  // Premier tour : chaque nature dans la limite de son quota.
  for (const r of resultats) {
    const n = compte[r.type] ?? 0;
    if (n < QUOTA[r.type]) { retenus.push(r); compte[r.type] = n + 1; }
  }
  // Second tour : on comble les places libres avec le reste, dans l'ordre.
  for (const r of resultats) {
    if (retenus.length >= 20) break;
    if (!retenus.includes(r)) retenus.push(r);
  }

  // Affichage : d'abord les écrans (une intention de navigation est immédiate),
  // puis les personnes, puis ce qu'elles produisent.
  const RANG: Record<Resultat["type"], number> = {
    page: 0, commercial: 1, client: 2, article: 3, mission: 4, document: 5,
  };
  retenus.sort((a, b) => RANG[a.type] - RANG[b.type]);

  return NextResponse.json({ q, resultats: retenus.slice(0, 20) });
}
