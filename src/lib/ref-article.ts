import prisma from "@/lib/prisma";

// Résolution d'une référence article — **serveur uniquement** (accède à la base).
//
// Séparé de `tarif-article.ts`, qui est importé par des composants client :
// y placer un accès Prisma ferait entrer le driver Postgres dans le bundle
// navigateur et casserait la compilation.

/**
 * Référence d'article telle qu'elle existe réellement en base.
 *
 * 11 des 523 articles de l'import portent une référence avec un espace final
 * (« 1 ere sciences de la vie  »). Les écrans nettoient la saisie avec `trim()`,
 * si bien que ces articles devenaient « inconnus au référentiel » alors qu'ils
 * sont utilisés normalement dans les documents et le stock.
 *
 * On cherche la correspondance exacte d'abord, puis les variantes d'espaces.
 * Renvoie `null` si aucun article ne correspond.
 */
export async function resoudreRefArt(saisie: string): Promise<string | null> {
  const brut = String(saisie ?? "");
  const nettoye = brut.trim();
  if (!nettoye) return null;

  // 1) La référence telle que saisie.
  const exact = await prisma.article.findUnique({
    where: { refArt: brut },
    select: { refArt: true },
  });
  if (exact) return exact.refArt;

  // 2) La version rognée, si la saisie portait des espaces.
  if (nettoye !== brut) {
    const sansEspace = await prisma.article.findUnique({
      where: { refArt: nettoye },
      select: { refArt: true },
    });
    if (sansEspace) return sansEspace.refArt;
  }

  // 3) L'inverse : la base porte des espaces que la saisie a perdus.
  const candidats = await prisma.article.findMany({
    where: { refArt: { startsWith: nettoye } },
    select: { refArt: true },
    take: 5,
  });
  return candidats.find((c) => c.refArt.trim() === nettoye)?.refArt ?? null;
}
