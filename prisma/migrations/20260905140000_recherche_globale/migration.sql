-- Index de la recherche globale (barre du haut).
--
-- `pg_trgm` autorise une recherche par fragments tolérante aux fautes de
-- frappe : « medinart », « médinart » et « medinar » trouvent le même client.
-- Sans index trigramme, chaque `ILIKE '%…%'` imposerait un parcours complet
-- des 4 601 tiers et 28 966 documents à chaque frappe.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Clients / fournisseurs : nom, ville, téléphone, matricule fiscal.
CREATE INDEX IF NOT EXISTS "partners_raisonSocial_trgm"
  ON "partners" USING gin ("raisonSocial" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "partners_ville_trgm"
  ON "partners" USING gin ("ville" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "partners_tel_trgm"
  ON "partners" USING gin ("tel" gin_trgm_ops);

-- Articles : désignation, référence, code-barres.
CREATE INDEX IF NOT EXISTS "articles_ext_designation_trgm"
  ON "articles_ext" USING gin ("designation" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "articles_ext_refArt_trgm"
  ON "articles_ext" USING gin ("refArt" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "articles_ext_codeBarre_trgm"
  ON "articles_ext" USING gin ("codeBarre" gin_trgm_ops);

-- Documents : numéro de pièce (TIC251545…) et nom du tiers.
CREATE INDEX IF NOT EXISTS "documents_ext_refDoc_trgm"
  ON "documents_ext" USING gin ("refDoc" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "documents_ext_raisonSocial_trgm"
  ON "documents_ext" USING gin ("raisonSocial" gin_trgm_ops);

-- Les ordres de mission n'ont pas de code stocké (« OM-2894 » est dérivé de
-- l'id) : la recherche par numéro se fait directement sur la clé primaire,
-- déjà indexée. Rien à ajouter ici.
