-- CreateTable
CREATE TABLE "objectifs" (
    "id" SERIAL NOT NULL,
    "vendeur" TEXT NOT NULL,
    "mois" INTEGER NOT NULL,
    "annee" INTEGER NOT NULL,
    "objectifCA" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "objectifs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "objectifs_annee_mois_idx" ON "objectifs"("annee", "mois");

-- CreateIndex
CREATE UNIQUE INDEX "objectifs_vendeur_mois_annee_key" ON "objectifs"("vendeur", "mois", "annee");
