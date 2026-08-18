-- Enregistrement vocal d'une visite terrain.
--
-- Rattaché à `ligne_mission` (la visite réelle du planning) et non au modèle
-- démo `visits`, qui ne contient que 2 lignes de test.

CREATE TABLE IF NOT EXISTS "enregistrements_visite" (
  "id"         SERIAL PRIMARY KEY,
  "ligneId"    INTEGER NOT NULL REFERENCES "ligne_mission"("id") ON DELETE CASCADE,
  "commercial" TEXT NOT NULL,
  "codeCli"    INTEGER,
  "clientNom"  TEXT,
  "latitude"   DOUBLE PRECISION,
  "longitude"  DOUBLE PRECISION,
  "debut"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fin"        TIMESTAMP(3),
  "duree"      INTEGER NOT NULL DEFAULT 0,
  "audio"      TEXT,
  "transcript" TEXT,
  "motifFin"   TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "enregistrements_visite_ligneId_idx"    ON "enregistrements_visite"("ligneId");
CREATE INDEX IF NOT EXISTS "enregistrements_visite_commercial_idx" ON "enregistrements_visite"("commercial");
