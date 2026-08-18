-- Les règlements clients et fournisseurs proviennent de deux tables MySQL
-- indépendantes dont les `ID_reg` se recouvrent (651 collisions). `id` devient
-- une clé de substitution et `idSource` conserve l'identifiant d'origine.
ALTER TABLE "erp_reglements" ADD COLUMN IF NOT EXISTS "idSource" INTEGER;

-- Les lignes déjà chargées l'ont été sous leur ID d'origine.
UPDATE "erp_reglements" SET "idSource" = "id" WHERE "idSource" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "erp_reglements_sens_idSource_key"
  ON "erp_reglements" ("sens", "idSource");
