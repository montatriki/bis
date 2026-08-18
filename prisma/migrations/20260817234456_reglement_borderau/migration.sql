-- Rattachement d'un règlement à son bordereau de remise (`ID_Bord` en source)
-- et reprise du lettrage bancaire.
ALTER TABLE "erp_reglements" ADD COLUMN IF NOT EXISTS "borderauId" INTEGER;
ALTER TABLE "erp_reglements" ADD COLUMN IF NOT EXISTS "lettrage" TEXT;

CREATE INDEX IF NOT EXISTS "erp_reglements_borderauId_idx"
  ON "erp_reglements" ("borderauId");

DO $$
BEGIN
  ALTER TABLE "erp_reglements"
    ADD CONSTRAINT "erp_reglements_borderauId_fkey"
    FOREIGN KEY ("borderauId") REFERENCES "erp_borderaux"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
