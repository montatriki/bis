-- CreateTable
CREATE TABLE "traite_bancaire" (
    "id" SERIAL NOT NULL,
    "reference" TEXT NOT NULL,
    "numeroOrdre" TEXT,
    "codeTiers" INTEGER,
    "tireNom" TEXT NOT NULL,
    "tireAdresse" TEXT,
    "beneficiaire" TEXT NOT NULL,
    "ribBanque" TEXT,
    "ribAgence" TEXT,
    "ribCompte" TEXT,
    "ribCle" TEXT,
    "domiciliation" TEXT,
    "valeurEn" TEXT,
    "nomCedant" TEXT,
    "montant" DECIMAL(14,3) NOT NULL,
    "montantLettres" TEXT,
    "lieuCreation" TEXT,
    "dateCreation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "echeance" TIMESTAMP(3),
    "etat" TEXT NOT NULL DEFAULT 'Brouillon',
    "nbImpressions" INTEGER NOT NULL DEFAULT 0,
    "derniereImpr" TIMESTAMP(3),
    "offsetX" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "offsetY" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "utilisateur" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "traite_bancaire_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "traite_bancaire_reference_key" ON "traite_bancaire"("reference");

-- CreateIndex
CREATE INDEX "traite_bancaire_codeTiers_idx" ON "traite_bancaire"("codeTiers");

-- CreateIndex
CREATE INDEX "traite_bancaire_etat_idx" ON "traite_bancaire"("etat");

-- CreateIndex
CREATE INDEX "traite_bancaire_echeance_idx" ON "traite_bancaire"("echeance");
