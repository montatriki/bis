// Conversion d'un montant en toutes lettres — case « Montant en lettres » de la
// lettre de change. Le dinar tunisien a 3 décimales : 20.000 DT se dit
// « vingt dinars », 3650.550 DT « trois mille six cent cinquante dinars et cinq
// cent cinquante millimes ».

const UNITES = [
  "zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf",
  "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize",
  "dix-sept", "dix-huit", "dix-neuf",
];

const DIZAINES = [
  "", "", "vingt", "trente", "quarante", "cinquante",
  "soixante", "soixante", "quatre-vingt", "quatre-vingt",
];

/**
 * 0 → 99. Gère les irrégularités françaises (70-79, 80, 90-99).
 * `suivi` : un multiplicateur suit, « quatre-vingt » reste alors invariable
 * (« quatre-vingt mille » contre « quatre-vingts dinars »).
 */
function centaineBasse(n: number, suivi = false): string {
  if (n < 20) return UNITES[n];

  const d = Math.floor(n / 10);
  const u = n % 10;

  // 70-79 et 90-99 se construisent sur soixante/quatre-vingt + 10..19.
  if (d === 7 || d === 9) {
    const base = DIZAINES[d];
    const reste = UNITES[10 + u];
    // « soixante et onze », mais « quatre-vingt-onze ».
    return u === 1 && d === 7 ? `${base} et ${reste}` : `${base}-${reste}`;
  }

  if (u === 0) {
    // « quatre-vingts » prend un s sauf devant un multiplicateur.
    return d === 8 ? (suivi ? "quatre-vingt" : "quatre-vingts") : DIZAINES[d];
  }
  // « vingt et un », « trente et un »… mais « quatre-vingt-un ».
  if (u === 1 && d !== 8) return `${DIZAINES[d]} et un`;
  return `${DIZAINES[d]}-${u === 1 ? "un" : UNITES[u]}`;
}

/**
 * 0 → 999.
 * `suivi` indique qu'un multiplicateur (mille, million…) suit : « cent » reste
 * alors invariable — « cinq cent mille », mais « cinq cents dinars ».
 */
function centaines(n: number, suivi = false): string {
  if (n < 100) return centaineBasse(n, suivi);

  const c = Math.floor(n / 100);
  const reste = n % 100;
  // « cent » seul, « deux cents », mais « deux cent trois » (pas de s si suivi).
  const pluriel = reste === 0 && !suivi;
  const tete = c === 1 ? "cent" : `${UNITES[c]} cent${pluriel ? "s" : ""}`;
  return reste === 0 ? tete : `${tete} ${centaineBasse(reste)}`;
}

/** Nombre entier positif en toutes lettres (jusqu'aux milliards). */
export function entierEnLettres(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "";
  n = Math.floor(n);
  if (n === 0) return "zéro";

  const tranches: { valeur: number; sing: string; plur: string }[] = [
    { valeur: 1_000_000_000, sing: "milliard", plur: "milliards" },
    { valeur: 1_000_000, sing: "million", plur: "millions" },
    { valeur: 1_000, sing: "mille", plur: "mille" }, // « mille » est invariable
  ];

  const mots: string[] = [];
  let reste = n;

  for (const t of tranches) {
    const q = Math.floor(reste / t.valeur);
    if (q === 0) continue;
    reste %= t.valeur;
    // « mille » et non « un mille » ; en revanche « un million ».
    if (q === 1 && t.valeur === 1_000) mots.push("mille");
    else mots.push(`${centaines(q, true)} ${q > 1 ? t.plur : t.sing}`);
  }

  if (reste > 0) mots.push(centaines(reste));
  return mots.join(" ");
}

/**
 * Montant en dinars → texte de la case « Montant en lettres ».
 * Les millimes sont les 3 décimales du dinar (1 DT = 1000 millimes).
 */
export function montantEnLettres(montant: number): string {
  if (!Number.isFinite(montant) || montant < 0) return "";

  // Arrondi au millime pour éviter les artefacts de virgule flottante
  // (20.0000000001 doit rester « vingt dinars »).
  const millimesTotal = Math.round(montant * 1000);
  const dinars = Math.floor(millimesTotal / 1000);
  const millimes = millimesTotal % 1000;

  // « deux millions DE dinars », mais « deux mille dinars » : le complément
  // prend « de » quand le nombre se termine par million(s)/milliard(s).
  const lettresDinars = entierEnLettres(dinars);
  const liaison = /\bmillions?$|\bmilliards?$/.test(lettresDinars) ? "de " : "";
  const partDinars = `${lettresDinars} ${liaison}${dinars > 1 ? "dinars" : "dinar"}`;
  if (millimes === 0) return majuscule(partDinars);

  const partMillimes = `${entierEnLettres(millimes)} ${millimes > 1 ? "millimes" : "millime"}`;
  return majuscule(`${partDinars} et ${partMillimes}`);
}

function majuscule(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Montant formaté à la tunisienne : 3 décimales + « DT » (3 650.550 DT). */
export function formatDT(montant: number): string {
  if (!Number.isFinite(montant)) return "—";
  return `${montant.toLocaleString("fr-FR", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })} DT`;
}
