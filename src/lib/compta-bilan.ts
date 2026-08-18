import prisma from "@/lib/prisma";
import { round3 } from "@/lib/vente-stats";

// Bilan comptable actif / passif, à formules paramétrables.
//
// Reprend `parametrage_bilan` (les lignes et leur formule) et `bilan_comptable`
// (le bilan figé pour un exercice) de l'ERP source.
//
// Une formule est une liste de comptes signés, séparés par des `;` :
//
//   "+21;+22;-281;-282"   immobilisations brutes moins les amortissements
//
// Un préfixe agrège tous ses sous-comptes : `21` couvre 2110, 2181, 21800…
// C'est la façon dont le plan comptable tunisien s'utilise réellement — on ne
// liste jamais les comptes feuille un par un dans un modèle de bilan.
//
// Différence avec A : A stockait des formules en texte libre évaluées côté
// client. Ici la formule est **parsée**, jamais évaluée comme du code, et une
// formule invalide est signalée ligne par ligne plutôt que de produire
// silencieusement un zéro.

export type TermeFormule = { signe: 1 | -1; compte: string };

export type LigneBilan = {
  id: number;
  libelle: string;
  formule: string;
  type: string;
  rubrique: string | null;
  numOrdre: number;
  montant: number;
  /** Comptes effectivement trouvés, pour justifier le montant. */
  comptes: { numCompte: string; solde: number }[];
  /** Formule invalide ou compte inexistant. */
  alerte?: string;
};

export type Bilan = {
  actif: LigneBilan[];
  passif: LigneBilan[];
  totalActif: number;
  totalPassif: number;
  /** Actif − Passif : doit être nul si le paramétrage est complet. */
  ecart: number;
  equilibre: boolean;
  /** Résultat de l'exercice, calculé depuis les classes 6 et 7. */
  resultat: number;
  alertes: string[];
};

/**
 * Parse une formule en termes signés.
 *
 * Tolère les espaces, les `,` comme séparateur, et l'absence de signe
 * (interprété comme `+`). Retourne aussi les fragments rejetés : mieux vaut
 * signaler « 4x1 n'est pas un compte » que de l'ignorer.
 */
export function parserFormule(formule: string): { termes: TermeFormule[]; invalides: string[] } {
  const termes: TermeFormule[] = [];
  const invalides: string[] = [];

  for (const brut of String(formule ?? "").split(/[;,]/)) {
    const t = brut.trim();
    if (!t) continue;

    const m = /^([+-]?)\s*(\d{1,10})$/.exec(t);
    if (!m) { invalides.push(t); continue; }

    termes.push({ signe: m[1] === "-" ? -1 : 1, compte: m[2] });
  }

  return { termes, invalides };
}

/** Solde d'un compte = Σ débits − Σ crédits (convention actif). */
type SoldeCompte = { numCompte: string; debit: number; credit: number; solde: number };

/**
 * Soldes par compte pour un exercice, agrégés depuis les écritures.
 * Une seule requête : le bilan complet ne doit pas faire N requêtes par ligne.
 */
export async function soldesParCompte(exerciceId: number): Promise<SoldeCompte[]> {
  const g = await prisma.ecritureCompta.groupBy({
    by: ["numCompte"],
    where: { exerciceId },
    _sum: { debit: true, credit: true },
  });

  return g.map((x) => {
    const debit = round3(x._sum.debit ?? 0);
    const credit = round3(x._sum.credit ?? 0);
    return { numCompte: x.numCompte, debit, credit, solde: round3(debit - credit) };
  });
}

/**
 * Évalue une formule contre les soldes.
 *
 * Le signe du terme donne le sens de contribution. Pour le **passif**, les
 * comptes sont créditeurs : leur solde (débit − crédit) est négatif, donc on
 * inverse à l'affichage pour présenter des montants positifs — c'est ce que
 * fait tout bilan lisible.
 */
export function evaluerFormule(
  formule: string,
  soldes: SoldeCompte[],
  inverser = false
): { montant: number; comptes: { numCompte: string; solde: number }[]; alerte?: string } {
  const { termes, invalides } = parserFormule(formule);

  if (termes.length === 0) {
    return {
      montant: 0,
      comptes: [],
      alerte: invalides.length
        ? `Formule invalide : ${invalides.join(", ")}`
        : "Aucune formule définie",
    };
  }

  let montant = 0;
  const utilises: { numCompte: string; solde: number }[] = [];

  // Un compte n'est compté qu'UNE fois, par le terme le plus spécifique qui le
  // couvre. Sans cela, une formule comme « +53;+532 » compterait 532000 deux
  // fois ; et surtout « +21;-281 » doit soustraire 2810 et non l'ajouter via
  // le préfixe court. Le préfixe le plus long gagne : c'est la règle du plan
  // comptable, où un sous-compte précise son parent.
  for (const s of soldes) {
    let meilleur: TermeFormule | null = null;
    for (const t of termes) {
      if (!s.numCompte.startsWith(t.compte)) continue;
      if (!meilleur || t.compte.length > meilleur.compte.length) meilleur = t;
    }
    if (!meilleur) continue;

    montant += meilleur.signe * s.solde;
    utilises.push({ numCompte: s.numCompte, solde: s.solde });
  }

  const alerte = invalides.length ? `Termes ignorés : ${invalides.join(", ")}` : undefined;
  return { montant: round3(inverser ? -montant : montant), comptes: utilises, alerte };
}

/**
 * Construit le bilan d'un exercice depuis le paramétrage.
 *
 * Le résultat de l'exercice (classes 7 − 6) est ajouté au passif : sans lui le
 * bilan ne peut pas s'équilibrer, puisque le bénéfice n'est encore affecté à
 * aucun compte de capitaux propres.
 */
export async function construireBilan(exerciceId: number): Promise<Bilan> {
  const [params, soldes] = await Promise.all([
    prisma.paramBilan.findMany({ orderBy: [{ type: "asc" }, { numOrdre: "asc" }] }),
    soldesParCompte(exerciceId),
  ]);

  const alertes: string[] = [];

  if (params.length === 0) {
    alertes.push("Aucun modèle de bilan paramétré — utilisez « Initialiser le modèle »");
  }
  if (soldes.length === 0) {
    alertes.push("Aucune écriture sur cet exercice — le bilan est vide");
  }

  const ligne = (p: (typeof params)[number]): LigneBilan => {
    const inverser = p.type === "PASSIF";
    const { montant, comptes, alerte } = evaluerFormule(p.formule, soldes, inverser);
    if (alerte) alertes.push(`${p.libelle} : ${alerte}`);
    return {
      id: p.id, libelle: p.libelle, formule: p.formule, type: p.type,
      rubrique: p.rubrique, numOrdre: p.numOrdre,
      montant, comptes, alerte,
    };
  };

  const actif = params.filter((p) => p.type === "ACTIF").map(ligne);
  const passif = params.filter((p) => p.type === "PASSIF").map(ligne);

  // Résultat de l'exercice : produits (classe 7) − charges (classe 6).
  const produits = soldes.filter((s) => s.numCompte.startsWith("7"))
    .reduce((t, s) => t + s.credit - s.debit, 0);
  const charges = soldes.filter((s) => s.numCompte.startsWith("6"))
    .reduce((t, s) => t + s.debit - s.credit, 0);
  const resultat = round3(produits - charges);

  if (resultat !== 0) {
    passif.push({
      id: -1,
      libelle: resultat >= 0 ? "Résultat de l'exercice (bénéfice)" : "Résultat de l'exercice (perte)",
      formule: "+7;-6", type: "PASSIF", rubrique: "Capitaux propres",
      numOrdre: 9999, montant: resultat, comptes: [],
    });
  }

  const totalActif = round3(actif.reduce((t, l) => t + l.montant, 0));
  const totalPassif = round3(passif.reduce((t, l) => t + l.montant, 0));
  const ecart = round3(totalActif - totalPassif);

  if (Math.abs(ecart) > 0.001) {
    alertes.push(
      `Bilan déséquilibré de ${ecart} — le modèle ne couvre probablement pas tous les comptes mouvementés`
    );
  }

  return {
    actif, passif, totalActif, totalPassif, ecart,
    equilibre: Math.abs(ecart) <= 0.001,
    resultat,
    alertes: [...new Set(alertes)],
  };
}

/**
 * Modèle de bilan par défaut, conforme au plan comptable tunisien (NCT).
 * Sert de point de départ : chaque ligne reste modifiable.
 */
export const MODELE_BILAN: { libelle: string; formule: string; type: string; rubrique: string; numOrdre: number }[] = [
  // ---------------------------------- ACTIF ----------------------------------
  { libelle: "Immobilisations incorporelles", formule: "+21;-281", type: "ACTIF", rubrique: "Actifs non courants", numOrdre: 10 },
  { libelle: "Immobilisations corporelles", formule: "+22;+23;+24;-282;-283;-284", type: "ACTIF", rubrique: "Actifs non courants", numOrdre: 20 },
  { libelle: "Immobilisations financières", formule: "+25;+26;-29", type: "ACTIF", rubrique: "Actifs non courants", numOrdre: 30 },
  { libelle: "Stocks", formule: "+31;+32;+33;+34;+35;+37;-39", type: "ACTIF", rubrique: "Actifs courants", numOrdre: 40 },
  { libelle: "Clients et comptes rattachés", formule: "+411;+413;+416;+418;-419", type: "ACTIF", rubrique: "Actifs courants", numOrdre: 50 },
  { libelle: "Autres actifs courants", formule: "+4366;+425;+4457;+47", type: "ACTIF", rubrique: "Actifs courants", numOrdre: 60 },
  { libelle: "Placements et autres actifs financiers", formule: "+50;+51", type: "ACTIF", rubrique: "Actifs courants", numOrdre: 70 },
  { libelle: "Liquidités et équivalents", formule: "+53;+54", type: "ACTIF", rubrique: "Actifs courants", numOrdre: 80 },

  // ---------------------------------- PASSIF ---------------------------------
  { libelle: "Capital social", formule: "+10", type: "PASSIF", rubrique: "Capitaux propres", numOrdre: 10 },
  { libelle: "Réserves et résultats reportés", formule: "+11;+12;+13;+14", type: "PASSIF", rubrique: "Capitaux propres", numOrdre: 20 },
  { libelle: "Emprunts et dettes financières", formule: "+16;+17", type: "PASSIF", rubrique: "Passifs non courants", numOrdre: 40 },
  { libelle: "Provisions", formule: "+15;+19", type: "PASSIF", rubrique: "Passifs non courants", numOrdre: 50 },
  { libelle: "Fournisseurs et comptes rattachés", formule: "+401;+403;+404;+408", type: "PASSIF", rubrique: "Passifs courants", numOrdre: 60 },
  { libelle: "Autres passifs courants", formule: "+42;+4367;+4368;+44;+45;+46", type: "PASSIF", rubrique: "Passifs courants", numOrdre: 70 },
  { libelle: "Concours bancaires", formule: "+52;+55", type: "PASSIF", rubrique: "Passifs courants", numOrdre: 80 },
];

/** Crée le modèle par défaut s'il n'existe pas. Idempotent. */
export async function initialiserModeleBilan(): Promise<{ crees: number; total: number }> {
  const existants = await prisma.paramBilan.findMany({ select: { libelle: true, type: true } });
  const deja = new Set(existants.map((e) => `${e.type}|${e.libelle}`));

  const aCreer = MODELE_BILAN.filter((m) => !deja.has(`${m.type}|${m.libelle}`));
  if (aCreer.length > 0) await prisma.paramBilan.createMany({ data: aCreer });

  const total = await prisma.paramBilan.count();
  return { crees: aCreer.length, total };
}

/**
 * Fige le bilan d'un exercice.
 *
 * Un bilan arrêté est une pièce : on remplace l'arrêté précédent du même
 * exercice plutôt que d'empiler des versions muettes.
 */
export async function figerBilan(exerciceId: number): Promise<{ ok: boolean; lignes: number; message: string }> {
  const bilan = await construireBilan(exerciceId);
  const toutes = [...bilan.actif, ...bilan.passif];

  if (toutes.length === 0) {
    return { ok: false, lignes: 0, message: "Rien à figer : aucun modèle de bilan paramétré" };
  }

  await prisma.$transaction([
    prisma.bilanComptable.deleteMany({ where: { exerciceId } }),
    prisma.bilanComptable.createMany({
      data: toutes.map((l) => ({
        exerciceId, libelle: l.libelle, montant: l.montant,
        type: l.type, rubrique: l.rubrique, numOrdre: l.numOrdre,
      })),
    }),
  ]);

  return {
    ok: true,
    lignes: toutes.length,
    message: `Bilan arrêté : ${toutes.length} ligne(s)`
      + (bilan.equilibre ? " — équilibré" : ` — ⚠ écart de ${bilan.ecart}`),
  };
}
