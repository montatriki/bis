-- Acquittement des alertes système, qui ne sont pas persistées et se
-- recalculent à chaque chargement : sans cette table, « Tout lire » n'avait
-- aucun effet sur elles.
CREATE TABLE IF NOT EXISTS "alertes_acquittees" (
  "id"        SERIAL       NOT NULL,
  "userId"    TEXT         NOT NULL,
  "cle"       TEXT         NOT NULL,
  "empreinte" TEXT         NOT NULL,
  "acquitteA" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "alertes_acquittees_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "alertes_acquittees_userId_cle_key" ON "alertes_acquittees"("userId","cle");
CREATE INDEX IF NOT EXISTS "alertes_acquittees_userId_idx" ON "alertes_acquittees"("userId");
