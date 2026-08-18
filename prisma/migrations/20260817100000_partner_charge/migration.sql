-- Indicateur « tiers de charge » repris de `clients.Charge` : c'est le critère
-- qui alimente l'écran « liste des tiers » du module Charge.
ALTER TABLE "partners" ADD COLUMN IF NOT EXISTS "charge" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "partners_charge_idx" ON "partners"("charge");
