-- Coût moyen pondéré par emplacement.
--
-- La valorisation d'un dépôt ou d'un camion utilisait le PMP global de
-- l'article : deux emplacements approvisionnés à des prix différents étaient
-- donc valorisés à l'identique. Chaque emplacement porte désormais son coût.

ALTER TABLE "stock_depots" ADD COLUMN IF NOT EXISTS "pmp" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Amorçage : on part du PMP global de l'article (à défaut, du prix d'achat).
-- C'est la meilleure estimation disponible pour le stock déjà en place ; les
-- entrées suivantes affineront chaque emplacement.
UPDATE "stock_depots" d
SET "pmp" = COALESCE(NULLIF(a."pmp", 0), a."puAchat", 0)
FROM "articles_ext" a
WHERE a."refArt" = d."refArt" AND d."pmp" = 0;
