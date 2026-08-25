/**
 * Rapprochement entre les objectifs saisis et les ventes réalisées.
 *
 * Le nom d'un vendeur n'a pas la même forme des deux côtés : les objectifs
 * portent « FOUED », « sihem », « MOKHTAR » là où les documents portent
 * « Foued Fakhfekh », « SIHEM HARABI », « mokhtar trabelsi ». Un rapprochement
 * sur le nom brut ne trouvait que « HENI LAJMI », identique par hasard : sept
 * vendeurs sur huit s'affichaient à 0 % alors que leur objectif existait.
 *
 * Le regroupement par prénom seul ne convient pas non plus — « heni rekik » et
 * « HENI LAJMI » sont deux personnes, qui coexistent le même mois avec des
 * montants distincts. On retient donc le nom complet quand il y en a un, et on
 * ne rattache un prénom isolé que lorsque le rapprochement est sans ambiguïté.
 */

/** Nom réduit à sa forme comparable : sans accents, en minuscules, espaces normalisés. */
export function normaliserNom(nom: string): string {
  return String(nom ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");
}

/**
 * Construit la fonction de rapprochement pour un jeu de noms donné.
 *
 * @param nomsVentes   noms tels qu'ils apparaissent sur les documents
 * @param nomsObjectifs noms tels qu'ils ont été saisis dans les objectifs
 */
export function rapprocheur(nomsVentes: string[], nomsObjectifs: string[]) {
  const tous = [...nomsVentes, ...nomsObjectifs].map(normaliserNom).filter(Boolean);
  const complets = new Set(tous.filter((n) => n.includes(" ")));

  // Un prénom porté par plusieurs noms complets est ambigu.
  const parPrenom = new Map<string, string>();
  const ambigus = new Set<string>();
  for (const c of complets) {
    const p = c.split(" ")[0];
    const deja = parPrenom.get(p);
    if (deja && deja !== c) ambigus.add(p);
    else parPrenom.set(p, c);
  }

  // Un prénom ambigu se rattache au nom complet qui n'a pas déjà son propre
  // objectif : les deux Heni ont chacun le leur, donc « heni » désigne l'autre.
  const objectifsComplets = new Set(
    nomsObjectifs.map(normaliserNom).filter((n) => n.includes(" ")),
  );
  const leve = new Map<string, string>();
  for (const p of ambigus) {
    const candidats = [...complets].filter(
      (c) => c.split(" ")[0] === p && !objectifsComplets.has(c),
    );
    if (candidats.length === 1) leve.set(p, candidats[0]);
  }

  /** Clé canonique d'un vendeur : deux écritures du même vendeur la partagent. */
  return function cle(nom: string): string {
    const n = normaliserNom(nom);
    if (!n) return "";
    if (n.includes(" ")) return n;
    if (ambigus.has(n)) return leve.get(n) ?? n;
    return parPrenom.get(n) ?? n;
  };
}
