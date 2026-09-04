/** Côté max d'une photo après redimensionnement, en pixels. */
export const PHOTO_COTE_MAX = 1000;
/** Qualité JPEG : compromis lisibilité / poids pour un envoi en 3G. */
export const PHOTO_QUALITE = 0.7;

/**
 * Redimensionne et compresse une photo en data URL JPEG.
 * Une photo de smartphone fait plusieurs Mo : la stocker telle quelle
 * saturerait la base et la connexion du commercial.
 */
export async function compresserImage(file: File, coteMax = PHOTO_COTE_MAX, qualite = PHOTO_QUALITE): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const ratio = Math.min(1, coteMax / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * ratio);
  const h = Math.round(bitmap.height * ratio);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponible");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", qualite);
}
