// Géométrie de la lettre de change tunisienne (traite / الكمبيالة).
//
// Le formulaire est PRÉ-IMPRIMÉ : l'imprimante ne doit sortir que les valeurs,
// posées exactement dans les cases du papier. Chaque champ est donc positionné
// en millimètres depuis le coin haut-gauche de la feuille, jamais en flux.
//
// Format retenu : A4 paysage (297 × 210 mm), la traite occupant la bande haute
// du papier — c'est la disposition des carnets de traites courants.
// Les décalages fins (imprimante, marges, carnet) se règlent à l'écran via le
// panneau de calibrage, pas en modifiant ce fichier.

export const PAGE_LARGEUR_MM = 297;
export const PAGE_HAUTEUR_MM = 210;

/** Hauteur réelle de la vignette traite dans la page (bande haute). */
export const TRAITE_HAUTEUR_MM = 105;

export type ChampTraite = {
  /** Clé de la valeur dans le formulaire. */
  cle: string;
  /** Libellé affiché en aperçu (jamais imprimé). */
  libelle: string;
  /** Position en mm depuis le bord gauche / haut de la feuille. */
  x: number;
  y: number;
  /** Largeur de la boîte en mm — sert au retour à la ligne et à l'aperçu. */
  largeur: number;
  /** Taille de police en points. */
  taille?: number;
  align?: "left" | "center" | "right";
  /** Police à chasse fixe : cases à cases (RIB, codes). */
  mono?: boolean;
  gras?: boolean;
};

/**
 * Position de chaque case, relevée sur la lettre de change standard
 * (Bill of exchange / لكمبيالة). L'origine est le coin haut-gauche de la page.
 */
export const CHAMPS_TRAITE: ChampTraite[] = [
  // ── Bandeau haut : ordre de paiement, échéance, lieu et date de création ──
  { cle: "numeroOrdre", libelle: "Ordre de paiement L.-C n°", x: 232, y: 21, largeur: 55, taille: 9, mono: true },

  { cle: "echeance", libelle: "Échéance", x: 88, y: 21, largeur: 34, taille: 10, align: "center" },
  { cle: "lieuCreation", libelle: "Lieu de création (à)", x: 130, y: 21, largeur: 30, taille: 10 },
  { cle: "dateCreation", libelle: "Date de création (le)", x: 168, y: 21, largeur: 32, taille: 10, align: "center" },

  // ── Ligne RIB du tiré + montant en chiffres (cadre haut droit) ──
  // Le RIB tunisien fait 20 chiffres : 2 (banque) 3 (agence) 13 (compte) 2 (clé).
  { cle: "ribBanque", libelle: "Code banque", x: 90, y: 34, largeur: 10, taille: 11, mono: true, align: "center" },
  { cle: "ribAgence", libelle: "Code agence", x: 102, y: 34, largeur: 13, taille: 11, mono: true, align: "center" },
  { cle: "ribCompte", libelle: "N° de compte", x: 117, y: 34, largeur: 52, taille: 11, mono: true, align: "center" },
  { cle: "ribCle", libelle: "Clé RIB", x: 171, y: 34, largeur: 10, taille: 11, mono: true, align: "center" },

  { cle: "montantChiffres", libelle: "Montant (chiffres)", x: 232, y: 34, largeur: 52, taille: 11, gras: true, align: "center" },

  // ── Bénéficiaire + rappel du montant ──
  { cle: "beneficiaire", libelle: "Payer à l'ordre de", x: 118, y: 47, largeur: 74, taille: 10, gras: true },
  { cle: "montantChiffres2", libelle: "Montant (rappel)", x: 232, y: 47, largeur: 52, taille: 11, align: "center" },

  // ── Montant en toutes lettres (bande pleine largeur) ──
  { cle: "montantLettres", libelle: "Montant en lettres", x: 40, y: 58, largeur: 185, taille: 9 },

  // ── Bandeau bas : lieu/date de création, échéance, nom du cédant ──
  { cle: "lieuCreation2", libelle: "Lieu de création", x: 16, y: 72, largeur: 32, taille: 9, align: "center" },
  { cle: "dateCreation2", libelle: "Date de création", x: 52, y: 72, largeur: 30, taille: 9, align: "center" },
  { cle: "echeance2", libelle: "Échéance", x: 86, y: 72, largeur: 30, taille: 9, align: "center" },
  { cle: "nomCedant", libelle: "Nom du cédant", x: 196, y: 72, largeur: 42, taille: 9 },

  // ── Bandeau bas : RIB répété, tiré, domiciliation ──
  { cle: "ribBanque2", libelle: "Code banque", x: 16, y: 84, largeur: 10, taille: 10, mono: true, align: "center" },
  { cle: "ribAgence2", libelle: "Code agence", x: 28, y: 84, largeur: 13, taille: 10, mono: true, align: "center" },
  { cle: "ribCompte2", libelle: "N° de compte", x: 43, y: 84, largeur: 52, taille: 10, mono: true, align: "center" },
  { cle: "ribCle2", libelle: "Clé RIB", x: 97, y: 84, largeur: 10, taille: 10, mono: true, align: "center" },

  { cle: "valeurEn", libelle: "Valeur en", x: 122, y: 84, largeur: 36, taille: 9 },

  { cle: "tireNom", libelle: "Nom du tiré", x: 163, y: 82, largeur: 46, taille: 9, gras: true },
  { cle: "tireAdresse", libelle: "Adresse du tiré", x: 163, y: 87, largeur: 46, taille: 8 },

  { cle: "domiciliation", libelle: "Domiciliation", x: 218, y: 84, largeur: 52, taille: 9 },
];

/**
 * Champs recopiés automatiquement : la traite répète certaines valeurs en haut
 * et en bas. L'opérateur ne saisit qu'une fois.
 */
export const CHAMPS_MIROIR: Record<string, string> = {
  echeance2: "echeance",
  lieuCreation2: "lieuCreation",
  dateCreation2: "dateCreation",
  montantChiffres2: "montantChiffres",
  ribBanque2: "ribBanque",
  ribAgence2: "ribAgence",
  ribCompte2: "ribCompte",
  ribCle2: "ribCle",
};

/** Applique les recopies au jeu de valeurs prêt à imprimer. */
export function appliquerMiroirs(valeurs: Record<string, string>): Record<string, string> {
  const sortie = { ...valeurs };
  for (const [cible, source] of Object.entries(CHAMPS_MIROIR)) {
    if (!sortie[cible]) sortie[cible] = sortie[source] ?? "";
  }
  return sortie;
}
