-- `tiers` : compte de charge rattaché au document. C'est le critère qui
-- identifie une charge dans l'ERP d'origine, indépendamment du type de
-- document. Facultatif : aucune ligne existante n'est modifiée.
ALTER TABLE "documents_ext" ADD COLUMN IF NOT EXISTS "tiers" TEXT;
CREATE INDEX IF NOT EXISTS "documents_ext_tiers_idx" ON "documents_ext"("tiers");
