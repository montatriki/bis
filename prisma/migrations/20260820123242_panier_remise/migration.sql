-- Remise par ligne de panier, en pourcentage du prix TTC : l'ERP d'origine
-- laisse le commercial saisir soit le taux, soit le prix net, les deux étant
-- liés et plafonnés par la remise maximale de l'article.
ALTER TABLE "panier_lignes" ADD COLUMN IF NOT EXISTS "remise" DOUBLE PRECISION NOT NULL DEFAULT 0;
