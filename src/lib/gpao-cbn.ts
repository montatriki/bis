import prisma from "@/lib/prisma";
import { round3 } from "@/lib/vente-stats";

// GPAO — éclatement de nomenclature et calcul des besoins nets (CBN).
//
// L'ERP source expose la nomenclature à plat (`getNomenclatureArticles` : un
// SELECT par article) et laisse l'écran CBN sur la liste des documents, sans
// moteur de calcul. On reconstruit ici la chaîne complète :
//
//   1. éclatement récursif de la nomenclature (multi-niveaux)
//   2. besoin brut = Σ (qte composant × quantité à fabriquer)
//   3. besoin net  = besoin brut − stock disponible
//
// Le besoin net est ce qui déclenche un achat ou un ordre de fabrication ;
// c'est la seule information réellement actionnable.

/** Un composant obtenu par éclatement, avec sa profondeur dans l'arbre. */
export type ComposantEclate = {
  refArt: string;
  desArt: string | null;
  typeComposant: string;
  /** Quantité pour UNE unité du produit fini de tête. */
  qteUnitaire: number;
  /** Quantité totale pour la quantité demandée. */
  qteTotale: number;
  niveau: number;
  /** Article père direct — permet de reconstruire l'arbre à l'affichage. */
  parent: string;
  /** true si le composant a lui-même une nomenclature (semi-fini fabriqué). */
  fabrique: boolean;
};

export type LigneCbn = {
  refArt: string;
  desArt: string | null;
  typeComposant: string;
  unite: string | null;
  besoinBrut: number;
  stock: number;
  /** Ce qu'il faut réellement approvisionner : max(0, brut − stock). */
  besoinNet: number;
  /** Valorisation du besoin net au dernier prix d'achat connu. */
  puAchat: number;
  valeurNet: number;
  fabrique: boolean;
  /** Manquant : le composant n'existe pas au référentiel articles. */
  horsReferentiel: boolean;
};

export type ResultatCbn = {
  lignes: LigneCbn[];
  totaux: { besoinBrut: number; besoinNet: number; valeurNet: number };
  /** Nomenclatures manquantes, cycles détectés, composants inconnus. */
  alertes: string[];
};

/** Profondeur maximale d'éclatement — garde-fou contre les nomenclatures cycliques. */
const NIVEAU_MAX = 10;

/**
 * Éclate la nomenclature d'un article, récursivement.
 *
 * Un composant qui possède lui-même une nomenclature **en exploitation** est
 * éclaté à son tour ; sinon il est retenu comme besoin terminal (à acheter).
 * `qteBase` est respectée : une nomenclature qui produit 10 unités donne des
 * quantités unitaires divisées par 10.
 */
export async function eclaterNomenclature(
  refArt: string,
  quantite = 1,
  options: { niveauMax?: number; seulementExploitation?: boolean } = {}
): Promise<{ composants: ComposantEclate[]; alertes: string[] }> {
  const niveauMax = options.niveauMax ?? NIVEAU_MAX;
  const seulementExploitation = options.seulementExploitation ?? false;

  const composants: ComposantEclate[] = [];
  const alertes: string[] = [];

  // `chemin` porte la branche courante : détecte un cycle sans bloquer un
  // composant légitimement réutilisé dans deux branches distinctes.
  const descendre = async (
    ref: string,
    qteCumulee: number,
    niveau: number,
    chemin: string[]
  ): Promise<void> => {
    if (niveau > niveauMax) {
      alertes.push(`Profondeur maximale (${niveauMax}) atteinte sous ${ref} — éclatement interrompu`);
      return;
    }

    const nom = await prisma.gpaoNomenclature.findUnique({
      where: { refArt: ref },
      include: { lignes: { orderBy: [{ numSequence: "asc" }, { id: "asc" }] } },
    });

    if (!nom || nom.lignes.length === 0) return;

    // Une nomenclature qui produit `qteBase` unités : ramener à l'unité.
    const base = nom.qteBase > 0 ? nom.qteBase : 1;

    for (const ligne of nom.lignes) {
      if (chemin.includes(ligne.refArt)) {
        alertes.push(
          `Cycle détecté : ${[...chemin, ligne.refArt].join(" → ")} — branche abandonnée`
        );
        continue;
      }

      const qteUnitaire = ligne.qte / base;
      const qteTotale = qteUnitaire * qteCumulee;

      const sousNom = await prisma.gpaoNomenclature.findUnique({
        where: { refArt: ligne.refArt },
        select: { refArt: true, exploitation: true },
      });
      // Une nomenclature en élaboration n'est pas éclatée : le composant est
      // traité comme un approvisionnement. On le signale, sinon un besoin en
      // matière disparaîtrait silencieusement du calcul.
      const fabrique = Boolean(sousNom) && (!seulementExploitation || sousNom!.exploitation);
      if (sousNom && !fabrique) {
        alertes.push(
          `Nomenclature ${ligne.refArt} non exploitable (en élaboration) — composant traité comme approvisionné`
        );
      }

      composants.push({
        refArt: ligne.refArt,
        desArt: ligne.desArt,
        typeComposant: ligne.typeComposant,
        qteUnitaire: round3(qteUnitaire),
        qteTotale: round3(qteTotale),
        niveau,
        parent: ref,
        fabrique,
      });

      if (fabrique) {
        await descendre(ligne.refArt, qteTotale, niveau + 1, [...chemin, ligne.refArt]);
      }
    }
  };

  await descendre(refArt, quantite, 1, [refArt]);
  return { composants, alertes };
}

/** Une demande de fabrication : un article et une quantité. */
export type BesoinDemande = { refArt: string; quantite: number };

/**
 * Calcul des besoins nets pour un ou plusieurs articles à fabriquer.
 *
 * `deduireStock: false` donne le besoin brut seul (utile pour chiffrer une
 * commande sans tenir compte de l'existant).
 *
 * Un semi-fini fabriqué apparaît dans le résultat **et** est éclaté : on veut
 * savoir qu'il faut le produire, et de quoi il a besoin.
 */
export async function calculerBesoinsNets(
  demandes: BesoinDemande[],
  options: { deduireStock?: boolean; seulementExploitation?: boolean } = {}
): Promise<ResultatCbn> {
  const deduireStock = options.deduireStock ?? true;
  const alertes: string[] = [];

  // Agrégation par composant : deux produits finis peuvent partager une matière.
  const agrege = new Map<
    string,
    { desArt: string | null; typeComposant: string; besoinBrut: number; fabrique: boolean }
  >();

  for (const d of demandes) {
    const ref = String(d.refArt ?? "").trim();
    const qte = Number(d.quantite);
    if (!ref) continue;
    if (!Number.isFinite(qte) || qte <= 0) {
      alertes.push(`Quantité invalide pour ${ref} — ligne ignorée`);
      continue;
    }

    const { composants, alertes: a } = await eclaterNomenclature(ref, qte, {
      seulementExploitation: options.seulementExploitation,
    });
    alertes.push(...a);

    if (composants.length === 0) {
      alertes.push(`${ref} : aucune nomenclature — rien à éclater`);
      continue;
    }

    for (const c of composants) {
      const prev = agrege.get(c.refArt);
      if (prev) {
        prev.besoinBrut += c.qteTotale;
        prev.fabrique = prev.fabrique || c.fabrique;
      } else {
        agrege.set(c.refArt, {
          desArt: c.desArt,
          typeComposant: c.typeComposant,
          besoinBrut: c.qteTotale,
          fabrique: c.fabrique,
        });
      }
    }
  }

  const refs = [...agrege.keys()];
  const articles = refs.length
    ? await prisma.article.findMany({
        where: { refArt: { in: refs } },
        select: { refArt: true, designation: true, enStock: true, puAchat: true, pmp: true, unite: true },
      })
    : [];
  const parRef = new Map(articles.map((a) => [a.refArt, a]));

  const lignes: LigneCbn[] = refs.map((ref) => {
    const b = agrege.get(ref)!;
    const art = parRef.get(ref);
    const besoinBrut = round3(b.besoinBrut);
    const stock = deduireStock ? Number(art?.enStock ?? 0) : 0;
    const besoinNet = round3(Math.max(0, besoinBrut - stock));
    // PMP en priorité : c'est le coût réel du stock, le prix d'achat catalogue
    // n'est qu'un repli quand l'article n'a jamais été valorisé.
    const puAchat = Number(art?.pmp || art?.puAchat || 0);

    if (!art) alertes.push(`Composant ${ref} absent du référentiel articles — stock supposé nul`);

    return {
      refArt: ref,
      desArt: b.desArt ?? art?.designation ?? null,
      typeComposant: b.typeComposant,
      unite: art?.unite ?? null,
      besoinBrut,
      stock: round3(stock),
      besoinNet,
      puAchat: round3(puAchat),
      valeurNet: round3(besoinNet * puAchat),
      fabrique: b.fabrique,
      horsReferentiel: !art,
    };
  });

  // Les besoins à approvisionner d'abord, puis par valeur décroissante.
  lignes.sort((x, y) => y.besoinNet - x.besoinNet || y.valeurNet - x.valeurNet);

  return {
    lignes,
    totaux: {
      besoinBrut: round3(lignes.reduce((s, l) => s + l.besoinBrut, 0)),
      besoinNet: round3(lignes.reduce((s, l) => s + l.besoinNet, 0)),
      valeurNet: round3(lignes.reduce((s, l) => s + l.valeurNet, 0)),
    },
    alertes: [...new Set(alertes)],
  };
}

/**
 * CBN à partir d'ordres de fabrication existants.
 *
 * Les lignes de l'OF donnent l'article et la quantité à produire ; on éclate
 * chacune. Un OF sans lignes ne peut rien exiger — il est signalé.
 */
export async function cbnDepuisDocuments(
  refDocs: string[],
  options: { deduireStock?: boolean } = {}
): Promise<ResultatCbn & { documents: string[] }> {
  const refs = refDocs.map((r) => String(r).trim()).filter(Boolean);
  if (refs.length === 0) {
    return { lignes: [], totaux: { besoinBrut: 0, besoinNet: 0, valeurNet: 0 }, alertes: [], documents: [] };
  }

  const lignes = await prisma.erpDocumentLine.findMany({
    where: { refDoc: { in: refs } },
    select: { refDoc: true, refArt: true, qte: true },
  });

  const demandes = new Map<string, number>();
  for (const l of lignes) {
    if (!l.refArt) continue;
    demandes.set(l.refArt, (demandes.get(l.refArt) ?? 0) + Number(l.qte || 0));
  }

  const res = await calculerBesoinsNets(
    [...demandes.entries()].map(([refArt, quantite]) => ({ refArt, quantite })),
    options
  );

  const avecLignes = new Set(lignes.map((l) => l.refDoc));
  for (const r of refs) {
    if (!avecLignes.has(r)) res.alertes.push(`${r} : document sans lignes — aucun besoin calculé`);
  }

  return { ...res, documents: refs };
}
