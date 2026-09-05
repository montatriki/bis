-- Journal des visites terrain pointées depuis la liste clients.
-- Une seule table indexée : le journal d'un client se lit par clientId, le
-- rapport admin par visiteLe, sans parcourir de table par client.
CREATE TABLE "visites_client" (
  "id"               SERIAL PRIMARY KEY,
  "clientId"         INTEGER NOT NULL,
  "clientNom"        TEXT NOT NULL,
  "adresse"          TEXT,
  "userId"           INTEGER,
  "commercialNom"    TEXT NOT NULL,
  "visiteLe"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "latCommercial"    DOUBLE PRECISION,
  "lngCommercial"    DOUBLE PRECISION,
  "latClient"        DOUBLE PRECISION,
  "lngClient"        DOUBLE PRECISION,
  "distanceM"        INTEGER,
  "surPlace"         BOOLEAN NOT NULL DEFAULT false,
  "positionCorrigee" BOOLEAN NOT NULL DEFAULT false,
  "commentaire"      TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "visites_client_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "partners"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

-- Journal d'un client, du plus récent au plus ancien.
CREATE INDEX "visites_client_clientId_visiteLe_idx" ON "visites_client"("clientId", "visiteLe");
-- Rapport admin : toutes les visites d'une période.
CREATE INDEX "visites_client_visiteLe_idx" ON "visites_client"("visiteLe");
-- Rapport filtré par commercial.
CREATE INDEX "visites_client_commercialNom_visiteLe_idx" ON "visites_client"("commercialNom", "visiteLe");
