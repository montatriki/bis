import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { prepareDocument } from "@/lib/document-numbering";
import { round3, TYPES_CA, signeCA } from "@/lib/vente-stats";

// Unified ERP read/write API backed by the mirrored external data.
// GET   /api/erp?resource=partners|articles|documents|ref|stats&...&f_<col>=<val>
// POST  /api/erp?resource=articles|partners|documents   (create)
// PUT   /api/erp?resource=articles|partners|documents   (update, body has id/refArt/refDoc)
// DELETE /api/erp?resource=articles|partners|documents&id=...
const PAGE = 50;
const ci = (v: string) => ({ contains: v, mode: "insensitive" as const });

// collect per-column filters: query params named f_<field>
function colFilters(sp: URLSearchParams, allowed: string[]) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of sp.entries()) {
    if (!k.startsWith("f_") || !v.trim()) continue;
    const field = k.slice(2);
    if (allowed.includes(field)) out[field] = ci(v.trim());
  }
  return out;
}

export async function GET(req: NextRequest) {
  // Back-office uniquement. Cette route sert une vingtaine de ressources
  // (base tiers complète, tous les documents, règlements, trésorerie, comptes)
  // sans notion de portefeuille : ouverte au rôle COMMERCIAL, elle exposait à
  // chaque vendeur les clients et les ventes de tous ses collègues, annulant
  // le cloisonnement appliqué par /api/clients et /api/tickets. Aucun écran
  // commercial ne l'appelle — vérifié sur src/app/commercial et
  // src/components/commercial.
  const auth = await requireSession(["ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.res;
  const sp = req.nextUrl.searchParams;
  const resource = sp.get("resource") ?? "partners";
  const page = Math.max(0, parseInt(sp.get("page") ?? "0", 10));
  const search = (sp.get("search") ?? "").trim();
  const sortField = sp.get("sort") || undefined;
  const sortDir = (sp.get("dir") === "asc" ? "asc" : "desc") as "asc" | "desc";

  // Stock d'un emplacement : alimente la saisie d'un transfert, où il faut
  // connaître le disponible du dépôt d'origine avant de saisir les quantités.
  if (resource === "stock-depot") {
    const emplacement = (sp.get("emplacement") ?? "").trim();
    if (!emplacement) return NextResponse.json({ rows: [], total: 0 });
    const rows = await prisma.stockDepot.findMany({
      where: { emplacement, quantite: { not: 0 } },
      orderBy: { refArt: "asc" },
      select: { refArt: true, quantite: true, pmp: true },
    });
    return NextResponse.json({ rows, total: rows.length });
  }

  if (resource === "ref") {
    const kind = sp.get("kind") ?? undefined;
    const rows = await prisma.refTable.findMany({ where: kind ? { kind } : undefined, orderBy: { label: "asc" } });
    return NextResponse.json({ rows, total: rows.length, pages: 1 });
  }

  if (resource === "reglements") {
    const sens = sp.get("sens") ?? "C";
    const filters = colFilters(sp, ["numDoc", "tiersNom", "modePay", "etat", "numPiece"]);
    // advanced filter-bar params
    const dateDu = sp.get("dateDu"), dateAu = sp.get("dateAu");
    const montantDu = sp.get("montantDu"), montantAu = sp.get("montantAu");
    const modePay = sp.get("modePay"), etat = sp.get("etat"), utilisateur = sp.get("utilisateur");
    const dateCond = (dateDu || dateAu) ? { datePay: { ...(dateDu ? { gte: new Date(dateDu) } : {}), ...(dateAu ? { lte: new Date(dateAu) } : {}) } } : {};
    const montantCond = (montantDu || montantAu) ? { montant: { ...(montantDu ? { gte: Number(montantDu) } : {}), ...(montantAu ? { lte: Number(montantAu) } : {}) } } : {};
    const where = {
      sens,
      ...filters,
      ...(modePay ? { modePay } : {}),
      ...(etat ? { etat } : {}),
      ...(utilisateur ? { utilisateur } : {}),
      ...dateCond,
      ...montantCond,
      ...(search ? { OR: [{ tiersNom: ci(search) }, { numDoc: ci(search) }, { numPiece: ci(search) }] } : {}),
    };
    const orderBy = sortField ? { [sortField]: sortDir } : { datePay: "desc" as const };
    const [rows, total, agg] = await Promise.all([
      prisma.erpReglement.findMany({ where, orderBy, skip: page * PAGE, take: PAGE }),
      prisma.erpReglement.count({ where }),
      prisma.erpReglement.aggregate({ where, _sum: { montant: true } }),
    ]);
    return NextResponse.json({ rows, total, page, pages: Math.ceil(total / PAGE), sum: agg._sum });
  }

  if (resource === "accounts") {
    const rows = await prisma.erpAccount.findMany({ orderBy: { id: "asc" } });
    return NextResponse.json({ rows, total: rows.length, pages: 1 });
  }

  if (resource === "machines") {
    const filters = colFilters(sp, ["numSerie", "machine", "posteCharge", "etat"]);
    const where = { ...filters, ...(search ? { OR: [{ machine: ci(search) }, { numSerie: ci(search) }] } : {}) };
    const orderBy = sortField ? { [sortField]: sortDir } : { machine: "asc" as const };
    const [rows, total] = await Promise.all([
      prisma.gmaoMachine.findMany({ where, orderBy, skip: page * PAGE, take: PAGE }),
      prisma.gmaoMachine.count({ where }),
    ]);
    return NextResponse.json({ rows, total, page, pages: Math.ceil(total / PAGE) });
  }

  // Parc roulant : la flotte réelle (`Vehicle`), avec ses échéances
  // administratives. L'écran ne listait jusqu'ici que les immatriculations de
  // `RefTable`, sans marque, statut ni date d'expiration.
  if (resource === "vehicules") {
    const filters = colFilters(sp, ["plate", "brand", "model", "status"]);
    const where = {
      ...filters,
      ...(search ? { OR: [{ plate: ci(search) }, { brand: ci(search) }, { model: ci(search) }] } : {}),
    };
    const orderBy = sortField ? { [sortField]: sortDir } : { plate: "asc" as const };
    const [rows, total] = await Promise.all([
      prisma.vehicle.findMany({ where, orderBy, skip: page * PAGE, take: PAGE }),
      prisma.vehicle.count({ where }),
    ]);

    // Une échéance dépassée (ou proche) immobilise le véhicule : on la calcule
    // ici pour que la liste puisse l'afficher sans recalcul côté client.
    const jour = 86_400_000;
    const maintenant = Date.now();
    const joursAvant = (d: Date | null) =>
      d ? Math.round((d.getTime() - maintenant) / jour) : null;

    return NextResponse.json({
      rows: rows.map((v) => {
        const echeances = [
          { cle: "assurance", jours: joursAvant(v.insuranceExpiry) },
          { cle: "controle", jours: joursAvant(v.controlExpiry) },
          { cle: "vignette", jours: joursAvant(v.taxExpiry) },
        ].filter((e) => e.jours !== null) as { cle: string; jours: number }[];

        const plusUrgente = echeances.length
          ? echeances.reduce((a, b) => (a.jours <= b.jours ? a : b))
          : null;

        return {
          ...v,
          // Nombre de jours avant la première échéance : négatif = expiré.
          echeanceProche: plusUrgente?.cle ?? null,
          joursAvantEcheance: plusUrgente?.jours ?? null,
          alerte: plusUrgente ? plusUrgente.jours <= 30 : false,
        };
      }),
      total, page, pages: Math.ceil(total / PAGE),
    });
  }

  // distinct dropdown values for the reglement filter bar
  if (resource === "reglement-options") {
    const sens = sp.get("sens") ?? "C";
    const [modes, etats, users] = await Promise.all([
      prisma.erpReglement.findMany({ where: { sens }, distinct: ["modePay"], select: { modePay: true } }),
      prisma.erpReglement.findMany({ where: { sens }, distinct: ["etat"], select: { etat: true } }),
      prisma.erpReglement.findMany({ where: { sens }, distinct: ["utilisateur"], select: { utilisateur: true } }),
    ]);
    return NextResponse.json({
      modePay: modes.map((m) => m.modePay).filter(Boolean),
      etat: etats.map((e) => e.etat).filter(Boolean),
      utilisateur: users.map((u) => u.utilisateur).filter(Boolean),
    });
  }

  // Valorisation du stock par famille / sous-famille d'articles.
  //
  // L'import ne contient que des en-têtes de documents (14 lignes de vente pour
  // 5 008 documents) : ventiler le **CA vendu** par famille serait trompeur. On
  // expose donc la valorisation du stock, qui elle est complète et vérifiable.
  if (resource === "familles") {
    const famille = sp.get("famille");   // détail d'une famille -> sous-familles

    const [articles, refs] = await Promise.all([
      prisma.article.findMany({
        where: { archiver: 0, ...(famille != null && famille !== "" ? { famille: Number(famille) } : {}) },
        select: { refArt: true, designation: true, famille: true, sousFamille: true,
                  enStock: true, puAchat: true, tarif1Ht: true },
      }),
      prisma.refTable.findMany({ where: { kind: { in: ["famille-art", "sousfamille-art"] } } }),
    ]);

    const lib = (kind: string, code: unknown) =>
      refs.find((r) => r.kind === kind && r.code === String(code))?.label ?? String(code ?? "—");

    // Un stock négatif est une anomalie d'inventaire, pas une valeur en magasin.
    const posit = (n: number) => Math.max(0, n);

    const cle = famille != null && famille !== "" ? "sousFamille" : "famille";
    const kind = cle === "famille" ? "famille-art" : "sousfamille-art";

    const groupes = new Map<string, { code: string; nb: number; qte: number; achat: number; vente: number }>();
    for (const a of articles) {
      const code = String(a[cle] ?? "");
      const g = groupes.get(code) ?? { code, nb: 0, qte: 0, achat: 0, vente: 0 };
      g.nb += 1;
      g.qte += posit(a.enStock);
      g.achat += posit(a.enStock) * a.puAchat;
      g.vente += posit(a.enStock) * a.tarif1Ht;
      groupes.set(code, g);
    }

    const rows = [...groupes.values()]
      .map((g) => ({
        code: g.code,
        libelle: lib(kind, g.code),
        nbArticles: g.nb,
        quantite: round3(g.qte),
        valeurAchat: round3(g.achat),
        valeurVente: round3(g.vente),
        // Marge potentielle si tout le stock était vendu au tarif 1.
        margePotentielle: round3(g.vente - g.achat),
      }))
      .sort((a, b) => b.valeurVente - a.valeurVente);

    return NextResponse.json({
      niveau: cle === "famille" ? "famille" : "sousFamille",
      famille: famille ?? null,
      familleLibelle: famille != null && famille !== "" ? lib("famille-art", famille) : null,
      rows,
      totaux: {
        nbArticles: rows.reduce((t, r) => t + r.nbArticles, 0),
        valeurAchat: round3(rows.reduce((t, r) => t + r.valeurAchat, 0)),
        valeurVente: round3(rows.reduce((t, r) => t + r.valeurVente, 0)),
      },
    });
  }

  // Détail des achats : ventilation par fournisseur, par mois ou par type.
  //
  // Seuls les **bons de réception (BRE)** matérialisent une entrée réelle de
  // marchandise. Additionner aussi les factures compterait deux fois le même
  // achat (43 des 145 FC reprennent au centime près un BRE du même
  // fournisseur) — c'est la règle déjà appliquée dans /api/synthese.
  //
  // La ventilation par famille d'articles n'est pas proposée : l'import ne
  // contient aucune ligne de document d'achat.
  if (resource === "achats-detail") {
    const axe = sp.get("axe") ?? "fournisseur";   // fournisseur | mois | type
    const cible = sp.get("cible");                 // détail d'un fournisseur / mois

    const bre = { nature: "Achat", typeDoc: "BRE" };
    const docs = await prisma.erpDocument.findMany({
      where: axe === "type" ? { nature: "Achat" } : bre,
      select: { refDoc: true, typeDoc: true, dateDoc: true, raisonSocial: true, ttcNet: true, thtNet: true, totTva: true },
      orderBy: { dateDoc: "desc" },
    });

    // Détail d'un groupe : la liste des documents qui le composent.
    if (cible) {
      const dedans = docs.filter((d) => {
        if (axe === "fournisseur") return (d.raisonSocial ?? "") === cible;
        if (axe === "mois") return d.dateDoc ? d.dateDoc.toISOString().slice(0, 7) === cible : false;
        return d.typeDoc === cible;
      });
      return NextResponse.json({
        axe, cible, niveau: "documents",
        rows: dedans.slice(0, 200).map((d) => ({
          refDoc: d.refDoc, typeDoc: d.typeDoc, dateDoc: d.dateDoc,
          libelle: d.raisonSocial ?? "—", montant: round3(d.ttcNet),
        })),
        totaux: { nb: dedans.length, montant: round3(dedans.reduce((t, d) => t + d.ttcNet, 0)) },
      });
    }

    const groupes = new Map<string, { nb: number; ttc: number; ht: number }>();
    for (const d of docs) {
      const cle =
        axe === "fournisseur" ? (d.raisonSocial?.trim() || "(sans fournisseur)")
        : axe === "mois" ? (d.dateDoc ? d.dateDoc.toISOString().slice(0, 7) : "(sans date)")
        : d.typeDoc;
      const g = groupes.get(cle) ?? { nb: 0, ttc: 0, ht: 0 };
      g.nb += 1;
      g.ttc += d.ttcNet;
      // HT reconstruit quand il est incohérent (221 documents d'achat ont un
      // `thtNet` supérieur au TTC dans l'import).
      const coherent = d.thtNet > 0 && d.thtNet <= d.ttcNet;
      g.ht += coherent ? d.thtNet : (d.totTva > 0 && d.totTva < d.ttcNet ? d.ttcNet - d.totTva : d.ttcNet / 1.19);
      groupes.set(cle, g);
    }

    const rows = [...groupes.entries()]
      .map(([libelle, g]) => ({ libelle, nb: g.nb, montant: round3(g.ttc), montantHt: round3(g.ht) }))
      .sort((a, b) => (axe === "mois" ? a.libelle.localeCompare(b.libelle) : b.montant - a.montant));

    return NextResponse.json({
      axe, niveau: "groupes", rows,
      totaux: {
        nb: rows.reduce((t, r) => t + r.nb, 0),
        montant: round3(rows.reduce((t, r) => t + r.montant, 0)),
        montantHt: round3(rows.reduce((t, r) => t + r.montantHt, 0)),
      },
    });
  }

  // Valeurs existantes des champs de la fiche tiers, pour proposer des listes
  // au lieu de champs libres. La saisie libre a produit 28 orthographes de
  // commerciaux et 244 villes : chaque variante casse les rapprochements.
  if (resource === "partner-options") {
    const nature = sp.get("nature") ?? "C";
    // Suffixe des référentiels : `famille-cli` pour un client, `famille-frs`
    // pour un fournisseur.
    const suffixe = nature === "F" ? "frs" : "cli";

    const [refFamille, refSousFamille, commerciaux, gouvernorats, villes] = await Promise.all([
      // Famille / sous-famille viennent du **référentiel**, pas des valeurs
      // saisies : `Partner.famille` contient 12 noms de personnes (des
      // commerciaux tombés dans la mauvaise colonne à l'import) qui polluaient
      // la liste proposée à l'utilisateur.
      prisma.refTable.findMany({ where: { kind: `famille-${suffixe}` }, select: { label: true } }),
      prisma.refTable.findMany({ where: { kind: `sousfamille-${suffixe}` }, select: { label: true } }),
      // Commercial, ville et gouvernorat n'ont pas de référentiel fiable
      // (1 675 clients portent un commercial absent de `RefTable`) : on propose
      // donc les valeurs réellement utilisées.
      prisma.partner.findMany({ where: { nature }, distinct: ["commercial"], select: { commercial: true } }),
      prisma.partner.findMany({ where: { nature }, distinct: ["gouvernorat"], select: { gouvernorat: true } }),
      prisma.partner.findMany({ where: { nature }, distinct: ["ville"], select: { ville: true } }),
    ]);

    // Dédoublonnage insensible à la casse : « MOKHTAR » et « mokhtar » sont le
    // même commercial ; on garde la première graphie rencontrée.
    const propres = (vals: (string | null)[]) => {
      const vus = new Map<string, string>();
      for (const v of vals) {
        const t = (v ?? "").trim();
        if (!t) continue;
        const k = t.toLocaleLowerCase("fr");
        if (!vus.has(k)) vus.set(k, t);
      }
      return [...vus.values()].sort((a, b) => a.localeCompare(b, "fr"));
    };

    return NextResponse.json({
      commercial: propres(commerciaux.map((r) => r.commercial)),
      famille: propres(refFamille.map((r) => r.label)),
      sousFamille: propres(refSousFamille.map((r) => r.label)),
      gouvernorat: propres(gouvernorats.map((r) => r.gouvernorat)),
      ville: propres(villes.map((r) => r.ville)),
    });
  }

  // Valeurs distinctes de la barre de filtres des documents (vente / achat).
  if (resource === "document-options") {
    const nature = sp.get("nature") ?? "Vente";
    const [types, users, etats] = await Promise.all([
      prisma.erpDocument.findMany({ where: { nature }, distinct: ["typeDoc"], select: { typeDoc: true } }),
      prisma.erpDocument.findMany({ where: { nature }, distinct: ["utilisateur"], select: { utilisateur: true } }),
      prisma.erpDocument.findMany({ where: { nature }, distinct: ["etat"], select: { etat: true } }),
    ]);
    return NextResponse.json({
      typeDoc: types.map((t) => t.typeDoc).filter(Boolean).sort(),
      utilisateur: users.map((u) => u.utilisateur).filter(Boolean).sort(),
      etat: etats.map((e) => e.etat).filter(Boolean).sort(),
    });
  }

  if (resource === "borderaux") {
    // Détail d'un bordereau : les règlements qu'il remet en banque.
    const detail = sp.get("id");
    if (detail) {
      const bord = await prisma.erpBorderau.findUnique({
        where: { id: Number(detail) },
        include: { reglements: { orderBy: { datePay: "asc" } } },
      });
      if (!bord) return NextResponse.json({ error: "Bordereau introuvable" }, { status: 404 });
      const cumul = bord.reglements.reduce((t, r) => t + r.montant, 0);
      return NextResponse.json({
        row: bord, lignes: bord.reglements, cumul,
        // Un total saisi qui ne correspond pas aux pièces remises est le
        // premier écart que la banque relève : on le signale plutôt que de
        // laisser croire que le bordereau est juste.
        ecart: Math.round((bord.total - cumul) * 1000) / 1000,
      });
    }

    const lignes = await prisma.erpBorderau.findMany({
      orderBy: { dateBord: "desc" },
      include: { _count: { select: { reglements: true } } },
    });
    const rows = lignes.map(({ _count, ...b }) => ({ ...b, nbReglements: _count.reglements }));
    return NextResponse.json({ rows, total: rows.length, pages: 1 });
  }

  // Paramétrages — real config data grouped for a module's settings screen
  if (resource === "settings") {
    const scope = sp.get("scope") ?? "stock"; // stock | achat | vente | crm
    const refs = await prisma.refTable.findMany();
    const byKind = (k: string) => refs.filter((r) => r.kind === k).map((r) => ({ code: r.code, label: r.label, data: r.data }));
    if (scope === "vente" || scope === "crm") {
      return NextResponse.json({
        sections: [
          { key: "doctypes", title: "Types de documents (Vente)", rows: byKind("doctype-vente") },
          { key: "familles", title: "Familles clients", rows: byKind("famille-cli") },
          { key: "sousfamilles", title: "Sous-familles clients", rows: byKind("sousfamille-cli") },
          { key: "commerciaux", title: "Commerciaux", rows: byKind("commercial") },
        ],
      });
    }
    if (scope === "achat") {
      return NextResponse.json({
        sections: [
          { key: "doctypes", title: "Types de documents (Achat)", rows: byKind("doctype-achat") },
          { key: "familles", title: "Familles fournisseurs", rows: byKind("famille-frs") },
          { key: "sousfamilles", title: "Sous-familles fournisseurs", rows: byKind("sousfamille-frs") },
        ],
      });
    }
    // stock (default)
    return NextResponse.json({
      sections: [
        { key: "depots", title: "Dépôts", rows: byKind("depot") },
        { key: "familles", title: "Familles articles", rows: byKind("famille-cli") },
        { key: "sousfamilles", title: "Sous-familles articles", rows: byKind("sousfamille-cli") },
        { key: "vehicules", title: "Véhicules / points de stock", rows: byKind("vehicule") },
      ],
    });
  }

  // Rapports — real statistics for a module scope
  if (resource === "reports") {
    const scope = sp.get("scope") ?? "vente";
    if (scope === "vente" || scope === "achat") {
      const nature = scope === "vente" ? "Vente" : "Achat";
      const [agg, byType, byMonthRaw, topTiers, htAchat] = await Promise.all([
        prisma.erpDocument.aggregate({ where: { nature }, _sum: { thtNet: true, ttcNet: true, totTva: true }, _count: true }),
        prisma.erpDocument.groupBy({ by: ["typeDoc"], where: { nature }, _sum: { ttcNet: true }, _count: true, orderBy: { _sum: { ttcNet: "desc" } } }),
        prisma.erpDocument.findMany({ where: { nature, dateDoc: { not: null } }, select: { dateDoc: true, ttcNet: true }, take: 5000, orderBy: { dateDoc: "desc" } }),
        // Les transferts internes (TR), inventaires (INV) et bons de sortie
        // n'ont pas de tiers — ils occupaient la première place du classement
        // avec un libellé vide et 30,8 M TND. Un « top tiers » ne retient que
        // les documents qui en désignent réellement un.
        prisma.erpDocument.groupBy({
          by: ["raisonSocial"],
          where: { nature, raisonSocial: { not: null }, NOT: { raisonSocial: "" } },
          _sum: { ttcNet: true },
          orderBy: { _sum: { ttcNet: "desc" } },
          take: 10,
        }),
        // 221 documents d'achat ont un `thtNet` corrompu (HT > TTC) : la somme
        // brute donnait un HT supérieur au TTC, ce qui est impossible. On relit
        // donc les montants pour reconstruire le HT quand il est incohérent.
        scope === "achat"
          ? prisma.erpDocument.findMany({ where: { nature: "Achat" }, select: { thtNet: true, ttcNet: true, totTva: true } })
          : Promise.resolve(null),
      ]);

      // HT fiable : la valeur du document si elle est cohérente, sinon
      // TTC − TVA (ou TTC / 1,19 à défaut de TVA renseignée).
      let totalHT = agg._sum.thtNet ?? 0;
      if (htAchat) {
        totalHT = htAchat.reduce((t, d) => {
          const coherent = d.thtNet > 0 && d.thtNet <= d.ttcNet;
          const reconstruit = d.totTva > 0 && d.totTva < d.ttcNet ? d.ttcNet - d.totTva : d.ttcNet / 1.19;
          return t + (coherent ? d.thtNet : reconstruit);
        }, 0);
      }
      // aggregate by month
      const byMonth = new Map<string, number>();
      for (const d of byMonthRaw) { if (!d.dateDoc) continue; const k = d.dateDoc.toISOString().slice(0, 7); byMonth.set(k, (byMonth.get(k) ?? 0) + d.ttcNet); }
      const parMois = [...byMonth.entries()].sort().slice(-12).map(([mois, total]) => ({ mois, total }));
      return NextResponse.json({
        kpis: { totalHT: round3(totalHT), totalTTC: agg._sum.ttcNet ?? 0, totalTVA: agg._sum.totTva ?? 0, nbDocuments: agg._count },
        parType: byType.map((t) => ({ type: t.typeDoc, count: t._count, total: t._sum.ttcNet ?? 0 })),
        parMois,
        topTiers: topTiers.map((t) => ({ nom: t.raisonSocial ?? "—", total: t._sum.ttcNet ?? 0 })),
      });
    }
    if (scope === "charge") {
      const [tiers, articles] = await Promise.all([
        prisma.partner.aggregate({ where: { nature: "T" }, _sum: { soldeFin: true, debit: true, credit: true }, _count: true }),
        prisma.article.aggregate({ where: { kind: "CH" }, _count: true }),
      ]);
      return NextResponse.json({ kpis: { nbTiers: tiers._count, soldeTiers: tiers._sum.soldeFin ?? 0, debit: tiers._sum.debit ?? 0, credit: tiers._sum.credit ?? 0, nbCharges: articles._count }, parType: [], parMois: [], topTiers: [] });
    }
    if (scope === "tourner") {
      const [missions, byEtat, byCom] = await Promise.all([
        prisma.erpMission.aggregate({ _count: true, _sum: { kmArrive: true, kmDepart: true } }),
        prisma.erpMission.groupBy({ by: ["etat"], _count: true }),
        prisma.erpMission.groupBy({ by: ["commercial"], _count: true, orderBy: { _count: { commercial: "desc" } }, take: 10 }),
      ]);
      return NextResponse.json({
        kpis: { nbMissions: missions._count, kmTotal: (missions._sum.kmArrive ?? 0) - (missions._sum.kmDepart ?? 0) },
        parType: byEtat.map((e) => ({ type: e.etat ?? "—", count: e._count, total: 0 })),
        parMois: [],
        topTiers: byCom.map((c) => ({ nom: c.commercial ?? "—", total: c._count })),
      });
    }
    // Rapport commerciaux : activité de vente par vendeur. `commercial` étant
    // vide sur les documents importés, le vendeur est porté par `utilisateur`.
    if (scope === "commerciaux") {
      const docs = await prisma.erpDocument.findMany({
        where: { nature: "Vente", typeDoc: { in: [...TYPES_CA] } },
        select: { typeDoc: true, ttcNet: true, dateDoc: true, commercial: true, utilisateur: true, codeCli: true },
      });

      const parVendeur = new Map<string, { ca: number; docs: number; clients: Set<number> }>();
      let caTotal = 0;
      for (const d of docs) {
        const nom = (d.commercial ?? "").trim() || (d.utilisateur ?? "").trim() || "Non affecté";
        const montant = signeCA(d.typeDoc) * d.ttcNet;
        caTotal += montant;
        const cur = parVendeur.get(nom) ?? { ca: 0, docs: 0, clients: new Set<number>() };
        cur.ca += montant;
        cur.docs += 1;
        if (d.codeCli != null) cur.clients.add(d.codeCli);
        parVendeur.set(nom, cur);
      }

      const lignes = [...parVendeur.entries()]
        .map(([nom, v]) => ({ nom, total: round3(v.ca), docs: v.docs, clients: v.clients.size }))
        .sort((a, b) => b.total - a.total);

      return NextResponse.json({
        kpis: {
          nbCommerciaux: lignes.length,
          caTotal: round3(caTotal),
          nbDocuments: docs.length,
          panierMoyen: docs.length ? round3(caTotal / docs.length) : 0,
        },
        parType: lignes.slice(0, 12).map((l) => ({ type: l.nom, count: l.docs, total: l.total })),
        parMois: [],
        topTiers: lignes.slice(0, 10),
      });
    }

    // Rapport tiers : état des soldes clients et fournisseurs (recouvrement).
    if (scope === "tiers") {
      const [clients, fournisseurs, debiteurs] = await Promise.all([
        prisma.partner.aggregate({ where: { nature: "C" }, _sum: { soldeFin: true, debit: true, credit: true }, _count: true }),
        prisma.partner.aggregate({ where: { nature: "F" }, _sum: { soldeFin: true, debit: true, credit: true }, _count: true }),
        prisma.partner.findMany({
          where: { nature: "C", soldeFin: { gt: 0 } },
          select: { id: true, raisonSocial: true, soldeFin: true, ville: true },
          orderBy: { soldeFin: "desc" },
          take: 10,
        }),
      ]);

      // Créances : uniquement les soldes débiteurs (voir /api/dashboard).
      const creances = await prisma.partner.aggregate({
        where: { nature: "C", soldeFin: { gt: 0 } },
        _sum: { soldeFin: true }, _count: true,
      });

      return NextResponse.json({
        kpis: {
          nbClients: clients._count,
          nbFournisseurs: fournisseurs._count,
          creances: round3(creances._sum.soldeFin ?? 0),
          nbDebiteurs: creances._count,
          dettesFournisseurs: round3(fournisseurs._sum.soldeFin ?? 0),
        },
        parType: [
          { type: "Clients", count: clients._count, total: round3(clients._sum.soldeFin ?? 0) },
          { type: "Fournisseurs", count: fournisseurs._count, total: round3(fournisseurs._sum.soldeFin ?? 0) },
        ],
        parMois: [],
        topTiers: debiteurs.map((d) => ({ nom: d.raisonSocial ?? `Client ${d.id}`, total: round3(d.soldeFin) })),
      });
    }

    return NextResponse.json({ kpis: {}, parType: [], parMois: [], topTiers: [] });
  }

  if (resource === "missions") {
    const filters = colFilters(sp, ["commercial", "vehicule", "etat", "utilisateur"]);
    const where = { ...filters, ...(search ? { OR: [{ commercial: ci(search) }, { vehicule: ci(search) }] } : {}) };
    const orderBy = sortField ? { [sortField]: sortDir } : { dateOrdre: "desc" as const };
    const [rows, total] = await Promise.all([
      prisma.erpMission.findMany({ where, orderBy, skip: page * PAGE, take: PAGE }),
      prisma.erpMission.count({ where }),
    ]);
    return NextResponse.json({ rows, total, page, pages: Math.ceil(total / PAGE) });
  }

  // Mouvements compte / Extrait compte — account movements built from règlements (both sens)
  if (resource === "mouvements-compte") {
    const banque = sp.get("banque");
    const dateDu = sp.get("dateDu"), dateAu = sp.get("dateAu");
    const dateCond = (dateDu || dateAu) ? { datePay: { ...(dateDu ? { gte: new Date(dateDu) } : {}), ...(dateAu ? { lte: new Date(dateAu) } : {}) } } : {};
    const where = { ...(banque ? { banque } : {}), ...dateCond, ...(search ? { OR: [{ tiersNom: ci(search) }, { numDoc: ci(search) }] } : {}) };
    const [raw, total, agg] = await Promise.all([
      prisma.erpReglement.findMany({ where, orderBy: { datePay: "desc" }, skip: page * PAGE, take: PAGE }),
      prisma.erpReglement.count({ where }),
      prisma.erpReglement.aggregate({ where, _sum: { montant: true } }),
    ]);
    const rows = raw.map((r) => ({
      id: r.id, type: r.sens === "C" ? "Encaissement" : "Décaissement",
      datePay: r.datePay, libelle: r.tiersNom, compte: r.banque, montant: r.sens === "C" ? r.montant : -r.montant,
      modePay: r.modePay, numDoc: r.numDoc, etat: r.etat,
    }));
    return NextResponse.json({ rows, total, page, pages: Math.ceil(total / PAGE), sum: { montant: agg._sum.montant } });
  }

  if (resource === "cheques") {
    // « Gestion chéquiers » : le registre des feuilles de chèque, comme
    // `chequiers/all-cheque` en production — et non les règlements payés par
    // chèque, qui sont déjà la liste des règlements filtrée sur le mode.
    const etat = sp.get("etat");
    const where = {
      ...(etat && etat !== "%" ? { etat } : {}),
      ...(search
        ? {
            OR: [
              { tiersNom: ci(search) },
              { refDoc: ci(search) },
              ...(Number.isFinite(Number(search)) ? [{ numero: Number(search) }] : []),
            ],
          }
        : {}),
    };
    const [lignes, total, agg] = await Promise.all([
      prisma.cheque.findMany({
        where, orderBy: { numero: "asc" }, skip: page * PAGE, take: PAGE,
        include: { chequier: { select: { banque: true, serie: true } } },
      }),
      prisma.cheque.count({ where }),
      prisma.cheque.aggregate({ where, _sum: { montant: true } }),
    ]);
    // La banque et la série vivent sur le carnet : à plat pour la grille.
    const rows = lignes.map(({ chequier, ...c }) => ({
      ...c, banque: chequier.banque, serie: chequier.serie,
    }));
    return NextResponse.json({ rows, total, page, pages: Math.ceil(total / PAGE), sum: agg._sum });
  }

  if (resource === "tresobalance") {
    const dateDu = sp.get("dateDu"), dateAu = sp.get("dateAu");
    const dateCond = (dateDu || dateAu) ? { datePay: { ...(dateDu ? { gte: new Date(dateDu) } : {}), ...(dateAu ? { lte: new Date(dateAu + "T23:59:59") } : {}) } } : {};
    const [clients, frs, byModeC, byModeF, comptes] = await Promise.all([
      prisma.erpReglement.aggregate({ where: { sens: "C", ...dateCond }, _sum: { montant: true }, _count: true }),
      prisma.erpReglement.aggregate({ where: { sens: "F", ...dateCond }, _sum: { montant: true }, _count: true }),
      prisma.erpReglement.groupBy({ by: ["modePay"], where: { sens: "C", ...dateCond }, _sum: { montant: true }, _count: true }),
      prisma.erpReglement.groupBy({ by: ["modePay"], where: { sens: "F", ...dateCond }, _sum: { montant: true }, _count: true }),
      prisma.erpAccount.count(),
    ]);
    return NextResponse.json({
      encaissements: clients._sum.montant ?? 0, nbEncaissements: clients._count,
      decaissements: frs._sum.montant ?? 0, nbDecaissements: frs._count,
      solde: (clients._sum.montant ?? 0) - (frs._sum.montant ?? 0),
      nbComptes: comptes,
      parModeEnc: byModeC.map((m) => ({ mode: m.modePay ?? "—", montant: m._sum.montant ?? 0, nb: m._count })),
      parModeDec: byModeF.map((m) => ({ mode: m.modePay ?? "—", montant: m._sum.montant ?? 0, nb: m._count })),
    });
  }

  if (resource === "partners") {
    const nature = sp.get("nature") ?? "C";
    const filters = colFilters(sp, ["raisonSocial", "famille", "sousFamille", "ville", "gouvernorat", "tel"]);
    // Liste des tiers de charge : filtre sur l'indicateur et non sur la
    // nature, sans quoi les fournisseurs marqués « charge » sont exclus.
    const charge = sp.get("charge") === "1";
    const where = {
      ...(charge ? { charge: 1 } : { nature }),
      ...filters,
      ...(search ? { raisonSocial: ci(search) } : {}),
    };
    const orderBy = sortField ? { [sortField]: sortDir } : { raisonSocial: "asc" as const };
    const [base, total] = await Promise.all([
      prisma.partner.findMany({ where, orderBy, skip: page * PAGE, take: PAGE }),
      prisma.partner.count({ where }),
    ]);

    // Ancienneté du dernier contact, comme les vues `latest_vente_view` /
    // `latest_reclamation_view` de l'ERP d'origine : c'est l'indicateur qui
    // permet de repérer un client délaissé. Seuls les documents qui constatent
    // un échange réel comptent — un devis ou une commande n'est ni une
    // livraison chez le client ni une réception du fournisseur.
    const typesContact = nature === "F" ? ["FC", "BRE"] : ["BL", "FC", "TIC"];
    const codes = base.map((p) => p.id);
    // Encours et impayés, comme les colonnes de l'ERP d'origine
    // (`clients.service.js`) : l'encours est ce qui est remis mais pas encore
    // encaissé (chèques, traites), l'impayé ce qui est revenu impayé ou en
    // préavis. Deux informations de recouvrement que le solde seul ne dit pas.
    const sensTiers = nature === "F" ? "F" : "C";
    const [ventes, reclamations, reglements] = codes.length
      ? await Promise.all([
          prisma.erpDocument.groupBy({
            by: ["codeCli"],
            where: { codeCli: { in: codes }, typeDoc: { in: typesContact } },
            _max: { dateDoc: true },
          }),
          prisma.reclamation.groupBy({
            by: ["codeCli"],
            where: { codeCli: { in: codes } },
            _max: { dateReclam: true },
          }),
          prisma.erpReglement.findMany({
            where: { tiersCode: { in: codes }, sens: sensTiers },
            select: { tiersCode: true, montant: true, etat: true },
          }),
        ])
      : [[], [], []];

    // `Etat_Rég` n'est pas normalisé en base (« En cours », « en cours ») :
    // la comparaison se fait donc en minuscules.
    const encoursParTiers = new Map<number, number>();
    const impayeParTiers = new Map<number, number>();
    for (const r of reglements) {
      if (r.tiersCode == null) continue;
      const etat = (r.etat ?? "").trim().toLowerCase();
      if (etat === "en cours") {
        encoursParTiers.set(r.tiersCode, round3((encoursParTiers.get(r.tiersCode) ?? 0) + r.montant));
      } else if (etat === "impayé" || etat === "impaye" || etat === "préavis" || etat === "preavis") {
        impayeParTiers.set(r.tiersCode, round3((impayeParTiers.get(r.tiersCode) ?? 0) + r.montant));
      }
    }

    const derniereVente = new Map(ventes.map((v) => [v.codeCli, v._max.dateDoc]));
    const derniereRecl = new Map(reclamations.map((r) => [r.codeCli, r._max.dateReclam]));
    const JOUR = 86_400_000;
    const aujourdhui = Date.now();
    const joursDepuis = (d?: Date | null) =>
      d ? Math.floor((aujourdhui - new Date(d).getTime()) / JOUR) : null;

    const rows = base.map((p) => {
      const vente = derniereVente.get(p.id) ?? null;
      const recl = derniereRecl.get(p.id) ?? null;
      // Le contact le plus récent l'emporte : une réclamation postérieure à la
      // dernière vente signifie que le client a bien été en relation depuis.
      const dernierContact =
        vente && recl ? (new Date(vente) > new Date(recl) ? vente : recl) : (vente ?? recl);
      const encours = encoursParTiers.get(p.id) ?? 0;
      const impayer = impayeParTiers.get(p.id) ?? 0;
      // Risque : un impayé pèse plus lourd qu'un simple encours, et le
      // dépassement de plafond est le signal le plus net.
      const plafond = p.plafond ?? 0;
      const depasse = plafond > 0 && p.soldeFin > plafond;
      const risque = impayer > 0 || depasse ? "Élevé" : encours > 0 ? "Moyen" : "Faible";
      return {
        ...p,
        derniereVente: vente,
        derniereReclamation: recl,
        dernierContact,
        nbrJours: joursDepuis(dernierContact),
        encours,
        impayer,
        risque,
      };
    });

    return NextResponse.json({ rows, total, page, pages: Math.ceil(total / PAGE) });
  }

  if (resource === "articles") {
    const articleKind = sp.get("articleKind");
    const filters = colFilters(sp, ["refArt", "codeBarre", "designation", "unite", "catalogue"]);
    const where = {
      ...(articleKind ? { kind: articleKind } : {}),
      ...filters,
      ...(search ? { OR: [{ designation: ci(search) }, { refArt: ci(search) }, { codeBarre: { contains: search } }] } : {}),
    };
    const ALLOWED_ART_SORT = ["refArt", "designation", "enStock", "puAchat", "tarif1Ht"];
    const orderBy = sortField && ALLOWED_ART_SORT.includes(sortField) ? { [sortField]: sortDir } : { designation: "asc" as const };
    const [raw, total, famRefs] = await Promise.all([
      prisma.article.findMany({ where, orderBy, skip: page * PAGE, take: PAGE }),
      prisma.article.count({ where }),
      // Libellés des familles **articles** : les articles ne portent qu'un code
      // numérique. On lisait ici les familles clients/fournisseurs, ce qui ne
      // correspondait à rien et laissait le code brut à l'écran.
      prisma.refTable.findMany({ where: { kind: { in: ["famille-art", "sousfamille-art"] } } }),
    ]);
    const famMap = new Map(famRefs.filter((f) => f.kind === "famille-art").map((f) => [f.code, f.label]));
    const sfamMap = new Map(famRefs.filter((f) => f.kind === "sousfamille-art").map((f) => [f.code, f.label]));
    const rows = raw.map((a) => ({
      ...a,
      t1ttc: Number((a.tarif1Ht * (1 + a.tauxTva / 100)).toFixed(3)),
      valeurAchat: Number((a.enStock * a.puAchat).toFixed(3)),
      valeurVente: Number((a.enStock * a.tarif1Ht).toFixed(3)),
      // Codes sans libellé (familles créées après l'export du référentiel) :
      // on renvoie le code, l'écran l'affiche tel quel plutôt qu'un vide.
      familleLabel: a.famille != null ? (famMap.get(String(a.famille)) ?? String(a.famille)) : null,
      sousFamilleLabel: a.sousFamille != null ? (sfamMap.get(String(a.sousFamille)) ?? String(a.sousFamille)) : null,
    }));
    return NextResponse.json({ rows, total, page, pages: Math.ceil(total / PAGE) });
  }

  if (resource === "documents") {
    const nature = sp.get("nature") ?? "Vente";
    const type = sp.get("type");
    const filters = colFilters(sp, ["refDoc", "raisonSocial", "typeDoc", "etat"]);

    // Barre de filtres reprise de l'ERP d'origine (« Liste des documents de
    // vente ») : période, client, référence, utilisateur et bornes de montant.
    const dateDu = sp.get("dateDu");
    const dateAu = sp.get("dateAu");
    const client = sp.get("client")?.trim() ?? "";
    const refDoc = sp.get("refDoc")?.trim() ?? "";
    const utilisateur = sp.get("utilisateur")?.trim() ?? "";
    const typeDocFiltre = sp.get("typeDocFiltre")?.trim() ?? "";
    const montantDu = sp.get("montantDu");
    const montantAu = sp.get("montantAu");

    // `dateAu` est inclusif : l'opérateur saisit un jour, pas un instant.
    const dateCond = (dateDu || dateAu)
      ? {
          dateDoc: {
            ...(dateDu ? { gte: new Date(dateDu) } : {}),
            ...(dateAu ? { lte: new Date(`${dateAu}T23:59:59.999`) } : {}),
          },
        }
      : {};

    const montantCond = (montantDu || montantAu)
      ? {
          ttcNet: {
            ...(montantDu ? { gte: Number(montantDu) } : {}),
            ...(montantAu ? { lte: Number(montantAu) } : {}),
          },
        }
      : {};

    const where = {
      nature,
      // Un document de charge se reconnaît à son compte de charge (`tiers`) et
      // non à son type : l'ERP d'origine filtre `WHERE E.tiers IS NOT NULL`.
      // Filtrer sur `typeDoc = "FCH"` laissait de côté les factures imputées à
      // un tiers sous un autre type (FAO230090 · DIVERS PACK).
      ...(type === "CHARGE"
        ? { tiers: { not: null } }
        : type && type !== "%" ? { typeDoc: type } : {}),
      ...filters,
      ...dateCond,
      ...montantCond,
      ...(client ? { raisonSocial: ci(client) } : {}),
      ...(refDoc ? { refDoc: ci(refDoc) } : {}),
      ...(utilisateur ? { utilisateur } : {}),
      // Le sélecteur de type ne s'applique qu'aux vues « tous types » (%).
      ...(typeDocFiltre && (!type || type === "%") ? { typeDoc: typeDocFiltre } : {}),
      ...(search ? { OR: [{ refDoc: ci(search) }, { raisonSocial: ci(search) }] } : {}),
    };
    const orderBy = sortField ? { [sortField]: sortDir } : { dateDoc: "desc" as const };

    // Bornes réelles de l'historique, hors filtre de période : elles servent à
    // ouvrir la liste sur des dates qui contiennent effectivement des pièces.
    // Sans elles, une liste s'ouvrant sur l'exercice courant paraît vide alors
    // que les documents sont en base — c'était le cas des documents charge,
    // tous antérieurs à 2026.
    const wherePortee = {
      nature,
      ...(type === "CHARGE"
        ? { tiers: { not: null } }
        : type && type !== "%" ? { typeDoc: type } : {}),
    };

    const [rows, total, agg, bornes] = await Promise.all([
      prisma.erpDocument.findMany({ where, orderBy, skip: page * PAGE, take: PAGE }),
      prisma.erpDocument.count({ where }),
      prisma.erpDocument.aggregate({ where, _sum: { thtNet: true, ttcNet: true, soldeDoc: true } }),
      prisma.erpDocument.aggregate({
        where: { ...wherePortee, dateDoc: { not: null } },
        _min: { dateDoc: true }, _max: { dateDoc: true },
      }),
    ]);
    return NextResponse.json({
      rows, total, page, pages: Math.ceil(total / PAGE), sum: agg._sum,
      periodeDisponible: {
        du: bornes._min.dateDoc ?? null,
        au: bornes._max.dateDoc ?? null,
      },
    });
  }

  if (resource === "stats") {
    const nature = sp.get("nature") ?? "C";
    if (nature === "C" || nature === "F" || nature === "T") {
      const [count, agg] = await Promise.all([
        prisma.partner.count({ where: { nature } }),
        prisma.partner.aggregate({ where: { nature }, _sum: { soldeFin: true, debit: true, credit: true } }),
      ]);
      return NextResponse.json({ count, sum: agg._sum });
    }
    const [count, agg] = await Promise.all([
      prisma.erpDocument.count({ where: { nature } }),
      prisma.erpDocument.aggregate({ where: { nature }, _sum: { thtNet: true, ttcNet: true, soldeDoc: true } }),
    ]);
    return NextResponse.json({ count, sum: agg._sum });
  }

  return NextResponse.json({ error: "unknown resource" }, { status: 400 });
}

// ---------- WRITE HANDLERS ----------
/** Statut de véhicule valide, avec repli sur PARKED. */
// Champs de la fiche véhicule repris de l'ERP d'origine (châssis, assureur,
// consommations, compteur). Partagés par la création et la modification.
function champsVehicule(body: Record<string, unknown>) {
  const entier = (v: unknown) => {
    if (v === "" || v == null) return null;
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? n : null;
  };
  const reel = (v: unknown) => {
    if (v === "" || v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  return {
    chassis: s(body.chassis) || null,
    typeVehicule: s(body.typeVehicule) || null,
    couleur: s(body.couleur) || null,
    assureur: s(body.assureur) || null,
    insuranceStart: dateOuNull(body.insuranceStart),
    controlStart: dateOuNull(body.controlStart),
    taxPaidAt: dateOuNull(body.taxPaidAt),
    kmMoyen: entier(body.kmMoyen),
    kilometrage: entier(body.kilometrage),
    consoMoyenneJour: reel(body.consoMoyenneJour),
    consoCarburant: reel(body.consoCarburant),
  };
}

const statutVehicule = (v: unknown) => {
  const t = String(v ?? "").trim().toUpperCase();
  return ["ACTIVE", "PARKED", "OFFLINE", "BREAKDOWN"].includes(t) ? t : "PARKED";
};
const dateOuNull = (v: unknown) => {
  if (!v) return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
};

const num = (v: unknown) => (v == null || v === "" ? 0 : Number(v)) || 0;
const s = (v: unknown) => (v == null ? null : String(v));
const int01 = (v: unknown) => (v ? 1 : 0);

// Data integrity: recompute a partner's credit + soldeFin from their règlements.
// soldeFin = soldeIni + debit - credit ; règlements add to credit (payments received/made).
async function recomputePartnerSolde(tiersCode: number | null | undefined, sens: string) {
  if (tiersCode == null) return;
  const nature = sens === "F" ? "F" : "C";
  const partner = await prisma.partner.findFirst({ where: { id: tiersCode, nature } });
  if (!partner) return;
  const agg = await prisma.erpReglement.aggregate({ where: { tiersCode, sens }, _sum: { montant: true } });
  const credit = agg._sum.montant ?? 0;
  await prisma.partner.update({
    where: { id: partner.id },
    data: { credit, soldeFin: partner.soldeIni + partner.debit - credit },
  });
}

// Full Fiche-article payload mapping (used by POST + PUT)
/** Photo d'article : data URL image, 600 Ko max ; `undefined` = inchangée, `null` = retirée. */
function photoArticle(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  const p = String(v);
  if (!p.startsWith("data:image/")) throw new Error("Format de photo non supporté");
  if (p.length > 600_000) throw new Error("Photo trop volumineuse (max 600 Ko)");
  return p;
}

function articleData(body: Record<string, unknown>, refArt: string) {
  const tva = num(body.tauxTva);
  const puAchatTtc = num(body.puAchatTtc) || Number((num(body.puAchat) * (1 + tva / 100)).toFixed(3));
  const enStock = num(body.enStock) || (num(body.stockIni) + num(body.entrer) - num(body.sortie));
  return {
    puAchatTtc, enStock,
    photo: photoArticle(body.photo),
    refArt, kind: s(body.kind) || "P",
    fab: s(body.fab), refOrigine: s(body.refOrigine), codeBarre: s(body.codeBarre),
    designation: s(body.designation) || "—", caract: s(body.caract),
    unite: s(body.unite), uniteEntree: s(body.uniteEntree), conversion: num(body.conversion) || 1,
    catalogue: s(body.catalogue), famille: body.famille != null && body.famille !== "" ? num(body.famille) : null,
    sousFamille: body.sousFamille != null && body.sousFamille !== "" ? num(body.sousFamille) : null,
    marque: s(body.marque), sousCategorie: s(body.sousCategorie),
    cmpteVente: s(body.cmpteVente), cmpteVenteExp: s(body.cmpteVenteExp), cmpteVenteExo: s(body.cmpteVenteExo),
    cmpteAchatLoc: s(body.cmpteAchatLoc), cmpteAchatImp: s(body.cmpteAchatImp),
    tauxTva: num(body.tauxTva), puAchat: num(body.puAchat), fodecAchat: num(body.fodecAchat),
    fodecVente: num(body.fodecVente), margePct: num(body.margePct), tarif1Ht: num(body.tarif1Ht), maTarif1: num(body.maTarif1),
    stockIni: num(body.stockIni), entrer: num(body.entrer), sortie: num(body.sortie),
    stMin: num(body.stMin), stMax: num(body.stMax), remiseMax: num(body.remiseMax), commission: num(body.commission), remiseParQte: int01(body.remiseParQte),
    puInv: num(body.puInv), dpa: num(body.dpa), pmp: num(body.pmp),
    fifo: int01(body.fifo), lifo: int01(body.lifo), gerSerie: int01(body.gerSerie), gesLot: int01(body.gesLot),
    vendable: int01(body.vendable), achetable: int01(body.achetable), archiver: int01(body.archiver),
  };
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(["ADMIN"]);
  if (!auth.ok) return auth.res;
  const resource = req.nextUrl.searchParams.get("resource");
  const body = await req.json();
  try {
    if (resource === "articles") {
      const refArt = s(body.refArt) || `ART${Date.now()}`;
      const created = await prisma.article.create({ data: articleData(body, refArt) });
      return NextResponse.json({ ok: true, row: created });
    }
    if (resource === "partners") {
      // `Date.now()/1000` donnait le même identifiant à deux créations faites
      // dans la même seconde : la seconde échouait sur la contrainte d'unicité.
      // On prend le premier identifiant réellement libre au-dessus du maximum.
      let id = body.id != null ? Number(body.id) : 0;
      if (!id) {
        const dernier = await prisma.partner.findFirst({ orderBy: { id: "desc" }, select: { id: true } });
        id = Math.max((dernier?.id ?? 0) + 1, Math.floor(Date.now() / 1000));
        while (await prisma.partner.findUnique({ where: { id }, select: { id: true } })) id++;
      }
      const created = await prisma.partner.create({
        data: {
          id, nature: s(body.nature) || "C", raisonSocial: s(body.raisonSocial) || "—",
          adresse: s(body.adresse), tel: s(body.tel), fax: s(body.fax),
          email: s(body.email), ville: s(body.ville),
          gouvernorat: s(body.gouvernorat), matriculeF: s(body.matriculeF), famille: s(body.famille),
          sousFamille: s(body.sousFamille), soldeIni: num(body.soldeIni), commercial: s(body.commercial),
          // Identité fiscale et coordonnées GPS de la fiche d'origine.
          codeTva: s(body.codeTva), cletva: s(body.cletva), categorieTva: s(body.categorieTva),
          registreCom: s(body.registreCom),
          longitude: body.longitude != null && body.longitude !== "" ? num(body.longitude) : null,
          latitude: body.latitude != null && body.latitude !== "" ? num(body.latitude) : null,
          plafond: body.plafond != null && body.plafond !== "" ? num(body.plafond) : null,
          remiseDef: num(body.remiseDef),
          // Un nouveau client part du solde initial saisi.
          soldeFin: num(body.soldeIni),
        },
      });
      return NextResponse.json({ ok: true, row: created });
    }
    if (resource === "documents") {
      const typeDoc = s(body.typeDoc) || "BL";
      const dateDoc = body.dateDoc ? new Date(body.dateDoc) : new Date();
      // Référence imposée si fournie, sinon numérotation par souche (cf. A).
      const prepared = await prepareDocument(typeDoc, dateDoc);
      const refDoc = s(body.refDoc) || prepared.refDoc;
      const created = await prisma.erpDocument.create({
        data: {
          refDoc, nature: s(body.nature) || "Vente", typeDoc,
          caraDoc: s(body.caraDoc) || prepared.caraDoc,
          numSeq: s(body.numSeq) || prepared.numSeq,
          libDoc: s(body.libDoc),
          raisonSocial: s(body.raisonSocial), codeCli: body.codeCli != null ? num(body.codeCli) : null,
          dateDoc,
          // Le compte de charge : c'est lui, et non le type de document, qui
          // fait entrer la pièce dans « Documents charge ». Sans lui, une
          // facture de charge créée depuis cet écran en disparaissait aussitôt.
          tiers: s(body.tiers),
          // Champs repris des listes : les omettre affichait une ligne vide sur
          // les colonnes correspondantes.
          adrCli: s(body.adrCli), mf: s(body.mf),
          thtBrut: num(body.thtBrut), totRemise: num(body.totRemise),
          timbre: num(body.timbre), totFodec: num(body.totFodec),
          totalRegle: num(body.totalRegle),
          modePayement: s(body.modePayement),
          codeMag: body.codeMag != null ? num(body.codeMag) : null,
          utilisateur: s(body.utilisateur) ?? auth.user.name,
          vehicule: s(body.vehicule), commercial: s(body.commercial),
          thtNet: num(body.thtNet), totTva: num(body.totTva), ttcNet: num(body.ttcNet), soldeDoc: num(body.soldeDoc), etat: s(body.etat),
        },
      });
      return NextResponse.json({ ok: true, row: created });
    }
    if (resource === "reglements") {
      const sens = s(body.sens) || "C";
      // `id` est une clé de substitution (les deux tables sources ont des
      // `ID_reg` qui se recouvrent) ; `idSource` reste la numérotation propre
      // au sens, c'est elle que la production affiche.
      const [last, lastSource] = await Promise.all([
        prisma.erpReglement.findFirst({ orderBy: { id: "desc" }, select: { id: true } }),
        prisma.erpReglement.findFirst({
          where: { sens }, orderBy: { idSource: "desc" }, select: { idSource: true },
        }),
      ]);
      const created = await prisma.erpReglement.create({
        data: {
          id: (last?.id ?? 0) + 1, idSource: (lastSource?.idSource ?? 0) + 1, sens,
          datePay: body.datePay ? new Date(body.datePay) : new Date(),
          montant: num(body.montant), echeance: s(body.echeance), numPiece: s(body.numPiece), numDoc: s(body.numDoc),
          etat: s(body.etat) || "Encaissé", modePay: s(body.modePay) || "Espèce",
          tiersCode: body.tiersCode != null ? num(body.tiersCode) : null, tiersNom: s(body.tiersNom),
          utilisateur: s(body.utilisateur), banque: s(body.banque), commentaire: s(body.commentaire),
        },
      });
      await recomputePartnerSolde(created.tiersCode, created.sens);
      return NextResponse.json({ ok: true, row: created });
    }
    if (resource === "borderaux") {
      const last = await prisma.erpBorderau.findFirst({ orderBy: { id: "desc" }, select: { id: true } });
      // Les règlements remis sont fournis par le couple (sens, idSource) : le
      // total du bordereau est alors calculé, jamais saisi, pour qu'il ne
      // puisse pas diverger des pièces qu'il porte.
      const remises: { sens?: string; idSource?: number }[] = Array.isArray(body.reglements) ? body.reglements : [];
      const cibles = remises.length > 0
        ? await prisma.erpReglement.findMany({
            where: { OR: remises.map((r) => ({ sens: s(r.sens) || "C", idSource: num(r.idSource) })) },
          })
        : [];
      const total = cibles.length > 0
        ? cibles.reduce((t, r) => t + r.montant, 0)
        : num(body.total);

      const created = await prisma.erpBorderau.create({
        data: {
          id: (last?.id ?? 0) + 1,
          dateBord: body.dateBord ? new Date(body.dateBord) : new Date(),
          numCompte: s(body.numCompte), total, type: s(body.type) || "Chèque",
          mtEsp: num(body.mtEsp), utilisateur: s(body.utilisateur),
        },
      });
      if (cibles.length > 0) {
        await prisma.erpReglement.updateMany({
          where: { id: { in: cibles.map((r) => r.id) } },
          data: { borderauId: created.id },
        });
      }
      return NextResponse.json({ ok: true, row: { ...created, nbReglements: cibles.length } });
    }
    // Une feuille de chèque n'est jamais créée seule : on tire la suivante du
    // carnet, ce qui garantit la continuité de la numérotation — un chèque
    // hors séquence est le genre d'écart qu'une banque refuse.
    if (resource === "cheques") {
      const chequierId = Number(body.chequierId);
      const carnet = await prisma.chequier.findUnique({ where: { id: chequierId } });
      if (!carnet) return NextResponse.json({ error: "Chéquier introuvable" }, { status: 404 });

      const dernier = await prisma.cheque.findFirst({
        where: { chequierId }, orderBy: { numero: "desc" }, select: { numero: true },
      });
      const numero = body.numero != null ? num(body.numero) : Math.max(carnet.suivant, (dernier?.numero ?? carnet.numDebut - 1) + 1);
      if (numero > carnet.numFin) {
        return NextResponse.json({ error: "Chéquier épuisé", code: "chequier-epuise" }, { status: 409 });
      }
      const doublon = await prisma.cheque.findFirst({ where: { chequierId, numero } });
      if (doublon) return NextResponse.json({ error: `Le chèque n° ${numero} existe déjà`, code: "doublon" }, { status: 409 });

      const created = await prisma.cheque.create({
        data: {
          chequierId, numero, montant: num(body.montant),
          dateEmis: body.dateEmis ? new Date(body.dateEmis) : new Date(),
          echeance: body.echeance ? new Date(body.echeance) : null,
          etat: s(body.etat) || "Emis", tiersNom: s(body.tiersNom),
          tiersCode: body.tiersCode != null ? num(body.tiersCode) : null,
          refDoc: s(body.refDoc),
        },
      });
      await prisma.chequier.update({
        where: { id: chequierId },
        data: { suivant: numero + 1, epuise: numero >= carnet.numFin },
      });
      return NextResponse.json({ ok: true, row: created });
    }
    if (resource === "accounts") {
      const last = await prisma.erpAccount.findFirst({ orderBy: { id: "desc" } });
      const created = await prisma.erpAccount.create({
        data: {
          id: (last?.id ?? 0) + 1, type: s(body.type), rib: s(body.rib), libelle: s(body.libelle) || "—",
          banque: s(body.banque), agence: s(body.agence), nature: s(body.nature),
        },
      });
      return NextResponse.json({ ok: true, row: created });
    }
    // Référentiels (`RefTable`) : dépôts, commerciaux, codes véhicules,
    // familles… Chaque écran passe son `kind`, qui n'est jamais pris du corps
    // de la requête pour qu'une nomenclature ne puisse pas en polluer une autre.
    if (resource === "ref") {
      const kind = s(req.nextUrl.searchParams.get("kind")) || s(body.kind);
      const label = s(body.label);
      if (!kind) return NextResponse.json({ error: "Référentiel non précisé" }, { status: 400 });
      if (!label) return NextResponse.json({ error: "Le libellé est obligatoire" }, { status: 400 });

      const code = s(body.code);
      // Un code en double rendrait le référentiel ambigu là où il sert de clé
      // (le dépôt et le commercial sont rapprochés par leur code).
      if (code) {
        const doublon = await prisma.refTable.findFirst({ where: { kind, code } });
        if (doublon) return NextResponse.json({ error: `Le code « ${code} » existe déjà` }, { status: 409 });
      }
      const created = await prisma.refTable.create({ data: { kind, code: code || null, label } });
      return NextResponse.json({ ok: true, row: created });
    }
    if (resource === "vehicules") {
      const plate = s(body.plate)?.trim();
      if (!plate) return NextResponse.json({ error: "L'immatriculation est obligatoire" }, { status: 400 });
      const created = await prisma.vehicle.create({
        data: {
          plate,
          brand: s(body.brand) || "—",
          model: s(body.model),
          year: body.year ? num(body.year) : null,
          status: statutVehicule(body.status) as "PARKED",
          insuranceExpiry: dateOuNull(body.insuranceExpiry),
          controlExpiry: dateOuNull(body.controlExpiry),
          taxExpiry: dateOuNull(body.taxExpiry),
          ...champsVehicule(body),
        },
      });
      return NextResponse.json({ ok: true, row: created });
    }
    if (resource === "machines") {
      const created = await prisma.gmaoMachine.create({
        data: {
          numSerie: s(body.numSerie), machine: s(body.machine) || "—", posteCharge: s(body.posteCharge),
          etat: s(body.etat) || "Fonctionnel", dateMiseEnMarche: body.dateMiseEnMarche ? new Date(body.dateMiseEnMarche) : null,
          coutAcquisition: num(body.coutAcquisition), capaciteHoraire: num(body.capaciteHoraire), coutHoraire: num(body.coutHoraire),
        },
      });
      return NextResponse.json({ ok: true, row: created });
    }
    return NextResponse.json({ error: "unknown resource" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireSession(["ADMIN"]);
  if (!auth.ok) return auth.res;
  const resource = req.nextUrl.searchParams.get("resource");
  const body = await req.json();
  try {
    if (resource === "articles") {
      const data = articleData(body, String(body.refArt));
      delete (data as Record<string, unknown>).refArt;
      const row = await prisma.article.update({ where: { refArt: String(body.refArt) }, data });
      return NextResponse.json({ ok: true, row });
    }
    if (resource === "partners") {
      const row = await prisma.partner.update({
        where: { id: Number(body.id) },
        data: {
          raisonSocial: s(body.raisonSocial) ?? undefined, adresse: s(body.adresse), tel: s(body.tel),
          fax: s(body.fax), email: s(body.email), ville: s(body.ville), gouvernorat: s(body.gouvernorat),
          matriculeF: s(body.matriculeF), famille: s(body.famille), sousFamille: s(body.sousFamille),
          commercial: s(body.commercial),
          codeTva: s(body.codeTva), cletva: s(body.cletva), categorieTva: s(body.categorieTva),
          registreCom: s(body.registreCom),
          longitude: body.longitude != null && body.longitude !== "" ? num(body.longitude) : null,
          latitude: body.latitude != null && body.latitude !== "" ? num(body.latitude) : null,
          plafond: body.plafond != null && body.plafond !== "" ? num(body.plafond) : null,
          remiseDef: num(body.remiseDef),
          // Les soldes courants (débit/crédit/soldeFin) restent pilotés par les
          // règlements et les documents : les modifier ici casserait la compta.
        },
      });
      return NextResponse.json({ ok: true, row });
    }
    if (resource === "documents") {
      // Seuls les champs effectivement transmis sont réécrits : une
      // modification partielle effaçait sinon le compte de charge (`tiers`) ou
      // la date, faisant disparaître la pièce de sa propre liste.
      const row = await prisma.erpDocument.update({
        where: { refDoc: String(body.refDoc) },
        data: {
          raisonSocial: "raisonSocial" in body ? s(body.raisonSocial) : undefined,
          codeCli: body.codeCli != null ? num(body.codeCli) : undefined,
          libDoc: "libDoc" in body ? s(body.libDoc) : undefined,
          dateDoc: body.dateDoc ? new Date(body.dateDoc) : undefined,
          tiers: "tiers" in body ? s(body.tiers) : undefined,
          modePayement: "modePayement" in body ? s(body.modePayement) : undefined,
          vehicule: "vehicule" in body ? s(body.vehicule) : undefined,
          commercial: "commercial" in body ? s(body.commercial) : undefined,
          thtNet: body.thtNet != null ? num(body.thtNet) : undefined,
          totTva: body.totTva != null ? num(body.totTva) : undefined,
          ttcNet: body.ttcNet != null ? num(body.ttcNet) : undefined,
          soldeDoc: body.soldeDoc != null ? num(body.soldeDoc) : undefined,
          etat: "etat" in body ? s(body.etat) : undefined,
        },
      });
      return NextResponse.json({ ok: true, row });
    }
    if (resource === "reglements") {
      const row = await prisma.erpReglement.update({
        where: { id: Number(body.id) },
        data: {
          datePay: body.datePay ? new Date(body.datePay) : undefined, montant: num(body.montant),
          echeance: s(body.echeance), numPiece: s(body.numPiece), numDoc: s(body.numDoc),
          etat: s(body.etat), modePay: s(body.modePay), tiersNom: s(body.tiersNom),
          banque: s(body.banque), commentaire: s(body.commentaire),
        },
      });
      await recomputePartnerSolde(row.tiersCode, row.sens);
      return NextResponse.json({ ok: true, row });
    }
    if (resource === "borderaux") {
      const id = Number(body.id);
      const bord = await prisma.erpBorderau.findUnique({ where: { id } });
      if (!bord) return NextResponse.json({ error: "Bordereau introuvable" }, { status: 404 });

      // « Encaisser tous » : le bordereau est passé en banque, donc tous les
      // règlements qu'il porte le sont aussi. C'est l'action qui donne son
      // intérêt à l'écran — sans elle il faudrait pointer chaque pièce.
      if (body.action === "encaisser") {
        const res = await prisma.erpReglement.updateMany({
          where: { borderauId: id },
          data: { etat: "Encaissé" },
        });
        return NextResponse.json({ ok: true, encaisses: res.count });
      }

      const row = await prisma.erpBorderau.update({
        where: { id },
        data: {
          dateBord: body.dateBord ? new Date(body.dateBord) : undefined,
          numCompte: "numCompte" in body ? s(body.numCompte) : undefined,
          type: "type" in body ? s(body.type) : undefined,
          mtEsp: body.mtEsp != null ? num(body.mtEsp) : undefined,
          utilisateur: "utilisateur" in body ? s(body.utilisateur) : undefined,
          total: body.total != null ? num(body.total) : undefined,
        },
      });
      return NextResponse.json({ ok: true, row });
    }
    if (resource === "cheques") {
      const row = await prisma.cheque.update({
        where: { id: Number(body.id) },
        data: {
          montant: body.montant != null ? num(body.montant) : undefined,
          dateEmis: body.dateEmis ? new Date(body.dateEmis) : undefined,
          echeance: body.echeance ? new Date(body.echeance) : undefined,
          etat: s(body.etat) ?? undefined,
          // Une modification partielle ne doit pas vider les champs absents du
          // corps : seul un champ explicitement transmis est réécrit.
          tiersNom: "tiersNom" in body ? s(body.tiersNom) : undefined,
          tiersCode: body.tiersCode != null ? num(body.tiersCode) : undefined,
          refDoc: "refDoc" in body ? s(body.refDoc) : undefined,
        },
      });
      return NextResponse.json({ ok: true, row });
    }
    if (resource === "accounts") {
      const row = await prisma.erpAccount.update({
        where: { id: Number(body.id) },
        data: { type: s(body.type), rib: s(body.rib), libelle: s(body.libelle) ?? undefined, banque: s(body.banque), agence: s(body.agence), nature: s(body.nature) },
      });
      return NextResponse.json({ ok: true, row });
    }
    if (resource === "ref") {
      const id = Number(body.id);
      const actuel = await prisma.refTable.findUnique({ where: { id } });
      if (!actuel) return NextResponse.json({ error: "Entrée introuvable" }, { status: 404 });

      const code = s(body.code);
      if (code && code !== actuel.code) {
        const doublon = await prisma.refTable.findFirst({
          where: { kind: actuel.kind, code, id: { not: id } },
        });
        if (doublon) return NextResponse.json({ error: `Le code « ${code} » existe déjà` }, { status: 409 });
      }
      const row = await prisma.refTable.update({
        where: { id },
        // `kind` n'est jamais modifiable : une entrée ne change pas de
        // référentiel, on la supprime et on la recrée au bon endroit.
        data: { code: code || null, label: s(body.label) || actuel.label },
      });
      return NextResponse.json({ ok: true, row });
    }
    if (resource === "vehicules") {
      const row = await prisma.vehicle.update({
        where: { id: Number(body.id) },
        data: {
          plate: s(body.plate) ?? undefined,
          brand: s(body.brand) ?? undefined,
          model: s(body.model),
          year: body.year ? num(body.year) : null,
          status: statutVehicule(body.status) as "PARKED",
          insuranceExpiry: dateOuNull(body.insuranceExpiry),
          controlExpiry: dateOuNull(body.controlExpiry),
          taxExpiry: dateOuNull(body.taxExpiry),
          ...champsVehicule(body),
        },
      });
      return NextResponse.json({ ok: true, row });
    }
    return NextResponse.json({ error: "unknown resource" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireSession(["ADMIN"]);
  if (!auth.ok) return auth.res;
  const sp = req.nextUrl.searchParams;
  const resource = sp.get("resource");
  const id = sp.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  try {
    if (resource === "articles") await prisma.article.delete({ where: { refArt: id } });
    else if (resource === "partners") await prisma.partner.delete({ where: { id: Number(id) } });
    else if (resource === "documents") await prisma.erpDocument.delete({ where: { refDoc: id } });
    else if (resource === "reglements") {
      const reg = await prisma.erpReglement.findUnique({ where: { id: Number(id) } });
      await prisma.erpReglement.delete({ where: { id: Number(id) } });
      if (reg) await recomputePartnerSolde(reg.tiersCode, reg.sens);
    }
    else if (resource === "borderaux") {
      // Les règlements remis reprennent leur vie propre : `onDelete: SetNull`
      // les détache, ils ne sont jamais supprimés avec le bordereau.
      await prisma.erpBorderau.delete({ where: { id: Number(id) } });
    }
    else if (resource === "cheques") {
      const cheque = await prisma.cheque.findUnique({ where: { id: Number(id) } });
      if (!cheque) return NextResponse.json({ error: "Chèque introuvable" }, { status: 404 });
      // Une feuille engagée auprès d'un tiers ne disparaît pas du carnet : elle
      // est déchirée. Supprimer la ligne ferait un trou dans la numérotation,
      // que rien ne permettrait ensuite de justifier.
      if (cheque.etat === "Vierge") {
        await prisma.cheque.delete({ where: { id: cheque.id } });
      } else {
        await prisma.cheque.update({ where: { id: cheque.id }, data: { etat: "Déchiré" } });
      }
    }
    else if (resource === "accounts") await prisma.erpAccount.delete({ where: { id: Number(id) } });
    else if (resource === "ref") {
      const entree = await prisma.refTable.findUnique({ where: { id: Number(id) } });
      if (!entree) return NextResponse.json({ error: "Entrée introuvable" }, { status: 404 });

      // Les référentiels sont rapprochés par libellé, sans contrainte de clé
      // étrangère : supprimer une entrée utilisée laisserait des documents
      // pointant vers un dépôt ou un commercial inexistant.
      //
      // On regarde l'historique et pas seulement l'état courant : un dépôt
      // vide aujourd'hui reste cité par les documents qui l'ont mouvementé,
      // et le supprimer rendrait ces pièces illisibles.
      // Certains libellés importés portent des espaces parasites (« 238TU1019 »)
      // alors que les documents citent la forme propre : on compare sur les
      // deux écritures pour ne pas conclure à tort qu'une entrée est inutilisée.
      const code = (entree.code ?? "").trim();
      const libelles = [...new Set([entree.label, entree.label.trim()])];
      const dansDocs = (champ: "vehicule" | "commercial") =>
        prisma.erpDocument.count({ where: { [champ]: { in: libelles } } });

      const utilise =
        entree.kind === "depot"
          ? (await prisma.stockDepot.count({ where: { emplacement: { in: libelles } } }))
            + (await dansDocs("vehicule"))
            + (await prisma.mouvementDepot.count({
                where: { OR: [{ source: { in: libelles } }, { destination: { in: libelles } }] },
              }))
          : entree.kind === "commercial"
            ? (await prisma.partner.count({ where: { commercial: { in: libelles } } }))
              + (await dansDocs("commercial"))
            : entree.kind === "vehicule"
              ? (await dansDocs("vehicule"))
                + (await prisma.vehicle.count({
                    where: { plate: { in: code ? [...libelles, code] : libelles } },
                  }))
              : 0;
      if (utilise > 0) {
        return NextResponse.json(
          { error: `« ${entree.label} » est utilisé par ${utilise} enregistrement(s) et ne peut pas être supprimé` },
          { status: 409 },
        );
      }
      await prisma.refTable.delete({ where: { id: Number(id) } });
    }
    else if (resource === "vehicules") await prisma.vehicle.delete({ where: { id: Number(id) } });
    else return NextResponse.json({ error: "unknown resource" }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
