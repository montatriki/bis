-- Champs de transfert de stock (`Type_doc = TR`) et suivi du cycle du
-- document, repris de la table `entete_achat` de l'ERP d'origine.
-- Tous facultatifs : aucune ligne existante n'est modifiée.
ALTER TABLE "documents_ext"
  ADD COLUMN IF NOT EXISTS "transferFrom"  TEXT,
  ADD COLUMN IF NOT EXISTS "transferTo"    TEXT,
  ADD COLUMN IF NOT EXISTS "generer"       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "facturer"      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "comptabiliser" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "documents_ext_transferFrom_idx" ON "documents_ext"("transferFrom");
CREATE INDEX IF NOT EXISTS "documents_ext_transferTo_idx"   ON "documents_ext"("transferTo");
