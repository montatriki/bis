-- Champs repris de la table `vehicules` de l'ERP d'origine, absents du modèle
-- initial : ils sont tous facultatifs, aucune ligne existante n'est touchée.
ALTER TABLE "vehicles"
  ADD COLUMN IF NOT EXISTS "chassis"          TEXT,
  ADD COLUMN IF NOT EXISTS "typeVehicule"     TEXT,
  ADD COLUMN IF NOT EXISTS "couleur"          TEXT,
  ADD COLUMN IF NOT EXISTS "assureur"         TEXT,
  ADD COLUMN IF NOT EXISTS "insuranceStart"   TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "controlStart"     TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "taxPaidAt"        TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "kmMoyen"          INTEGER,
  ADD COLUMN IF NOT EXISTS "consoMoyenneJour" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "consoCarburant"   DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "kilometrage"      INTEGER;

-- Opérations périodiques d'entretien (`vehicules_opérations`).
CREATE TABLE IF NOT EXISTS "vehicules_operations" (
  "id"              SERIAL       NOT NULL,
  "vehicleId"       TEXT         NOT NULL,
  "libelle"         TEXT         NOT NULL,
  "intervalleKm"    INTEGER,
  "intervalleJours" INTEGER,
  "dernierKm"       INTEGER,
  "derniereDate"    TIMESTAMP(3),
  "prochaineDate"   TIMESTAMP(3),
  "prochainKm"      INTEGER,
  "actif"           BOOLEAN      NOT NULL DEFAULT true,
  "notes"           TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "vehicules_operations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "vehicules_operations_vehicleId_idx"     ON "vehicules_operations"("vehicleId");
CREATE INDEX IF NOT EXISTS "vehicules_operations_prochaineDate_idx" ON "vehicules_operations"("prochaineDate");

DO $$ BEGIN
  ALTER TABLE "vehicules_operations"
    ADD CONSTRAINT "vehicules_operations_vehicleId_fkey"
    FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
