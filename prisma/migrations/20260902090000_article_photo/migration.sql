-- Photo de l'article (data URL JPEG compressée, ≤ 600 Ko) : saisie par
-- l'administrateur sur la fiche article, affichée au catalogue commercial.
ALTER TABLE "articles_ext" ADD COLUMN IF NOT EXISTS "photo" TEXT;
