-- CreateTable
CREATE TABLE "opportunites" (
    "id" SERIAL NOT NULL,
    "libelle" TEXT NOT NULL,
    "codeCli" INTEGER,
    "clientNom" TEXT,
    "etape" TEXT NOT NULL DEFAULT 'Prospection',
    "montant" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "probabilite" INTEGER NOT NULL DEFAULT 50,
    "source" TEXT,
    "suiviPar" TEXT,
    "description" TEXT,
    "dateCloture" TIMESTAMP(3),
    "archiver" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "opportunites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evenements_opportunite" (
    "id" SERIAL NOT NULL,
    "opportuniteId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "dateEvent" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "auteur" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evenements_opportunite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets_sav" (
    "id" SERIAL NOT NULL,
    "reference" TEXT NOT NULL,
    "codeCli" INTEGER,
    "clientNom" TEXT,
    "typePanne" TEXT,
    "description" TEXT NOT NULL,
    "etat" TEXT NOT NULL DEFAULT 'Ouvert',
    "priorite" TEXT NOT NULL DEFAULT 'Normale',
    "intervenant" TEXT,
    "solution" TEXT,
    "dateReclamation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateReparation" TIMESTAMP(3),
    "refDoc" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tickets_sav_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "opportunites_etape_idx" ON "opportunites"("etape");

-- CreateIndex
CREATE INDEX "opportunites_codeCli_idx" ON "opportunites"("codeCli");

-- CreateIndex
CREATE INDEX "evenements_opportunite_opportuniteId_idx" ON "evenements_opportunite"("opportuniteId");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_sav_reference_key" ON "tickets_sav"("reference");

-- CreateIndex
CREATE INDEX "tickets_sav_etat_idx" ON "tickets_sav"("etat");

-- CreateIndex
CREATE INDEX "tickets_sav_codeCli_idx" ON "tickets_sav"("codeCli");

-- AddForeignKey
ALTER TABLE "evenements_opportunite" ADD CONSTRAINT "evenements_opportunite_opportuniteId_fkey" FOREIGN KEY ("opportuniteId") REFERENCES "opportunites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
