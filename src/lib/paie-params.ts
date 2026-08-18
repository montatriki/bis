import prisma from "@/lib/prisma";
import { PARAMS_DEFAUT, type ParamsPaie, type TrancheIrpp, round3 } from "@/lib/paie-calc";

// Paramétrage de paie lu depuis la base — complète le moteur `paie-calc.ts`.
//
// Comble ce qui manquait au §8 : rubriques de paie personnalisées, grilles de
// salaire, types CNSS paramétrables et barème IRPP modifiable
// (`rubrique_paie`, `rubrique_employe`, `grille_salaire`, `grh_typecnss`,
// `grh_impo` de l'ERP source).
//
// Le moteur de calcul n'est pas touché : il accepte déjà un `ParamsPaie`
// surchargé. Ici on construit ce `ParamsPaie` depuis la base, et on résout les
// rubriques d'un employé en primes / retenues à lui passer.

/**
 * Barème IRPP depuis la base, avec repli sur le barème codé.
 *
 * Un barème partiel en base serait plus dangereux qu'aucun barème : on ne
 * l'utilise que s'il commence à 0, sinon les premiers dinars échapperaient
 * silencieusement à l'impôt.
 */
export async function baremeDepuisBase(): Promise<{ bareme: TrancheIrpp[]; source: "base" | "defaut"; alerte?: string }> {
  const rows = await prisma.grhTrancheIrpp.findMany({ orderBy: { du: "asc" } });
  if (rows.length === 0) return { bareme: PARAMS_DEFAUT.bareme, source: "defaut" };

  if (rows[0].du > 0) {
    return {
      bareme: PARAMS_DEFAUT.bareme,
      source: "defaut",
      alerte: `Barème IRPP en base incomplet (première tranche à ${rows[0].du} au lieu de 0) — barème par défaut appliqué`,
    };
  }

  // `au` nul = dernière tranche, illimitée.
  const bareme: TrancheIrpp[] = rows.map((r) => ({
    du: r.du,
    au: r.au == null ? Infinity : r.au,
    taux: r.taux,
  }));

  // Trou ou chevauchement entre tranches : le montant d'impôt serait faux.
  const alertes: string[] = [];
  for (let i = 1; i < bareme.length; i++) {
    if (Math.abs(bareme[i].du - bareme[i - 1].au) > 0.001) {
      alertes.push(`discontinuité entre ${bareme[i - 1].au} et ${bareme[i].du}`);
    }
  }
  if (bareme[bareme.length - 1].au !== Infinity) {
    alertes.push("la dernière tranche est bornée — les hauts revenus ne seraient pas imposés au-delà");
  }

  return {
    bareme,
    source: "base",
    alerte: alertes.length ? `Barème IRPP : ${alertes.join(" ; ")}` : undefined,
  };
}

/** Type CNSS applicable : celui de l'employé, sinon celui marqué par défaut. */
export async function typeCnssApplicable(code?: string | null) {
  if (code) {
    const t = await prisma.grhTypeCnss.findUnique({ where: { code } });
    if (t) return t;
  }
  return prisma.grhTypeCnss.findFirst({ where: { parDefaut: true } });
}

/**
 * Comme `typeCnssApplicable`, mais indique si le type demandé a été trouvé.
 *
 * La distinction compte : un code inconnu qui retombe sur le type par défaut
 * applique des **taux différents de ceux attendus**. Sans ce retour, la bascule
 * serait silencieuse et le bulletin faux sans que personne ne le sache.
 */
async function resoudreTypeCnss(code?: string | null) {
  if (code) {
    const t = await prisma.grhTypeCnss.findUnique({ where: { code } });
    if (t) return { type: t, trouve: true };
    const defaut = await prisma.grhTypeCnss.findFirst({ where: { parDefaut: true } });
    return { type: defaut, trouve: false };
  }
  return { type: await prisma.grhTypeCnss.findFirst({ where: { parDefaut: true } }), trouve: true };
}

/**
 * Construit les paramètres de paie depuis la base pour un employé donné.
 * Les surcharges d'appel (`override`) restent prioritaires : le traitement peut
 * simuler un taux sans modifier le paramétrage.
 */
export async function paramsPaieDepuisBase(
  typeCnss?: string | null,
  override: Partial<ParamsPaie> = {}
): Promise<{ params: ParamsPaie; alertes: string[] }> {
  const alertes: string[] = [];

  const { bareme, alerte } = await baremeDepuisBase();
  if (alerte) alertes.push(alerte);

  const { type: cnss, trouve } = await resoudreTypeCnss(typeCnss);
  if (!trouve) {
    alertes.push(
      `Type CNSS « ${typeCnss} » inconnu — ${cnss ? `type par défaut « ${cnss.code} »` : "taux par défaut"} appliqué`
    );
  }

  const params: ParamsPaie = {
    ...PARAMS_DEFAUT,
    bareme,
    ...(cnss ? { tauxCnss: cnss.retCnss, appliquerIrpp: cnss.retenuIrpp } : {}),
    ...override,
  };

  return { params, alertes };
}

/**
 * Salaire de base depuis la grille, si l'employé n'en a pas de propre.
 *
 * A applique la grille par (régime, catégorie, échelon). Un employé avec un
 * salaire saisi le conserve : la grille est une valeur de référence, pas une
 * écrasure de ce que la fiche indique.
 */
export async function salaireDeGrille(
  regime: string,
  categorie?: string | null,
  echelon?: string | null
): Promise<number | null> {
  if (!categorie || !echelon) return null;
  const g = await prisma.grhGrilleSalaire.findUnique({
    where: { regime_categorie_echelon: { regime, categorie, echelon } },
  });
  return g ? g.salaireBase : null;
}

export type RubriquesResolues = {
  /** Gains soumis à cotisation, à ajouter au brut. */
  primes: number;
  /** Retenues, déduites du net. */
  retenues: number;
  /** Gains non soumis à CNSS ni IRPP (indemnités exonérées). */
  primesExonerees: number;
  detail: {
    code: string; libelle: string; sens: string;
    montant: number; quantite: number; total: number;
    soumisCnss: boolean; soumisIrpp: boolean;
  }[];
};

/**
 * Résout les rubriques d'un employé pour une session.
 *
 * Les rubriques permanentes (`sessionId` nul) s'appliquent à toutes les
 * sessions ; une rubrique définie pour la session **remplace** la permanente de
 * même code — sinon une prime exceptionnelle s'ajouterait à la prime habituelle
 * au lieu de la remplacer.
 *
 * `parQuantite` : montant × quantité (heures, repas, kilomètres…).
 * `prorataAbsence` : réduit au prorata des jours réellement travaillés.
 */
export async function rubriquesEmploye(
  codeEmploye: string,
  sessionId: number,
  prorata = 1
): Promise<RubriquesResolues> {
  const lignes = await prisma.grhRubriqueEmploye.findMany({
    where: { codeEmploye, OR: [{ sessionId }, { sessionId: null }] },
    include: { rubrique: true },
  });

  // La rubrique de session gagne sur la permanente de même code.
  const parCode = new Map<string, (typeof lignes)[number]>();
  for (const l of lignes) {
    if (!l.rubrique.actif) continue;
    const prev = parCode.get(l.rubrique.code);
    if (!prev || (prev.sessionId == null && l.sessionId != null)) {
      parCode.set(l.rubrique.code, l);
    }
  }

  let primes = 0;
  let retenues = 0;
  let primesExonerees = 0;
  const detail: RubriquesResolues["detail"] = [];

  for (const l of parCode.values()) {
    const r = l.rubrique;
    const base = r.parQuantite ? l.montant * l.quantite : l.montant;
    const total = round3(r.prorataAbsence ? base * prorata : base);

    if (r.sens === "Retenue") retenues += total;
    else if (r.soumisCnss || r.soumisIrpp) primes += total;
    else primesExonerees += total;

    detail.push({
      code: r.code, libelle: r.libelle, sens: r.sens,
      montant: l.montant, quantite: l.quantite, total,
      soumisCnss: r.soumisCnss, soumisIrpp: r.soumisIrpp,
    });
  }

  return {
    primes: round3(primes),
    retenues: round3(retenues),
    primesExonerees: round3(primesExonerees),
    detail,
  };
}

/** Barème IRPP tunisien par défaut, à charger en base pour le rendre éditable. */
export async function initialiserBareme(): Promise<{ crees: number; total: number }> {
  const n = await prisma.grhTrancheIrpp.count();
  if (n > 0) return { crees: 0, total: n };

  await prisma.grhTrancheIrpp.createMany({
    data: PARAMS_DEFAUT.bareme.map((t) => ({
      du: t.du,
      au: Number.isFinite(t.au) ? t.au : null,
      taux: t.taux,
    })),
  });
  return { crees: PARAMS_DEFAUT.bareme.length, total: PARAMS_DEFAUT.bareme.length };
}

/** Types CNSS usuels, pour démarrer le paramétrage. */
export async function initialiserTypesCnss(): Promise<{ crees: number; total: number }> {
  const defauts = [
    { code: "RSNA", libelle: "Régime salarié non agricole", retCnss: 9.18, chCnss: 16.57, retenuIrpp: true, parDefaut: true },
    { code: "RSA", libelle: "Régime salarié agricole", retCnss: 6.31, chCnss: 10.79, retenuIrpp: true, parDefaut: false },
    { code: "STAGE", libelle: "Stagiaire (SIVP/CIVP)", retCnss: 0, chCnss: 0, retenuIrpp: false, parDefaut: false },
  ];

  const existants = await prisma.grhTypeCnss.findMany({ select: { code: true } });
  const deja = new Set(existants.map((e) => e.code));
  const aCreer = defauts.filter((d) => !deja.has(d.code));
  if (aCreer.length > 0) await prisma.grhTypeCnss.createMany({ data: aCreer });

  const total = await prisma.grhTypeCnss.count();
  return { crees: aCreer.length, total };
}
