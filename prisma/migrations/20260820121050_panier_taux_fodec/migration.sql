-- Le FODEC entre dans la base de TVA : la ligne de panier doit le porter pour
-- que le TTC facturé corresponde à celui de l'ERP d'origine.
ALTER TABLE "panier_lignes" ADD COLUMN IF NOT EXISTS "tauxFodec" DOUBLE PRECISION NOT NULL DEFAULT 0;
