-- Certaines références article existent en production avec un espace final
-- (« mah », « 1 ere sciences de la vie »). L'import des lignes de vente a
-- repris la graphie de la source, qui diffère parfois de celle du catalogue :
-- la même référence s'est retrouvée sous deux orthographes, et la statistique
-- par article la comptait en deux lignes distinctes (32 d'un côté, 3 de
-- l'autre, au lieu de 35).
--
-- La forme du catalogue fait foi : les lignes orphelines y sont ramenées.
UPDATE "document_lines_ext" l
SET "refArt" = a."refArt"
FROM "articles_ext" a
WHERE trim(l."refArt") = trim(a."refArt")
  AND l."refArt" <> a."refArt"
  AND NOT EXISTS (SELECT 1 FROM "articles_ext" x WHERE x."refArt" = l."refArt");
