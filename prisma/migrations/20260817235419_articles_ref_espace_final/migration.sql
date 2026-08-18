-- La production stocke certaines références article avec un espace final
-- (« jouet », « mah »…). L'import de complément les a normalisées, créant 11
-- articles en double : la même fiche sous deux clés.
--
-- La forme faisant foi est celle de la production (avec l'espace) : les lignes
-- de document qui pointaient sur la variante trimée y sont ramenées, puis les
-- doublons créés à tort sont supprimés.

UPDATE "document_lines_ext" l
SET "refArt" = l."refArt" || ' '
WHERE EXISTS (
  SELECT 1 FROM "articles_ext" a WHERE a."refArt" = l."refArt" || ' '
)
AND EXISTS (
  SELECT 1 FROM "articles_ext" b WHERE b."refArt" = l."refArt"
);

DELETE FROM "articles_ext" a
WHERE a."refArt" = trim(a."refArt")
  AND EXISTS (SELECT 1 FROM "articles_ext" b WHERE b."refArt" = a."refArt" || ' ');
