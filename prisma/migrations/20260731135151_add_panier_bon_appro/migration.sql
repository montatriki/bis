-- CreateTable
CREATE TABLE "paniers" (
    "id" SERIAL NOT NULL,
    "utilisateur" TEXT NOT NULL,
    "codeCli" INTEGER,
    "clientNom" TEXT,
    "etat" TEXT NOT NULL DEFAULT 'Ouvert',
    "refDoc" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "paniers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "panier_lignes" (
    "id" SERIAL NOT NULL,
    "panierId" INTEGER NOT NULL,
    "refArt" TEXT NOT NULL,
    "designation" TEXT,
    "unite" TEXT,
    "qte" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "puHt" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tauxTva" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "panier_lignes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bons_approvisionnement" (
    "id" SERIAL NOT NULL,
    "reference" TEXT NOT NULL,
    "utilisateur" TEXT NOT NULL,
    "commercial" TEXT,
    "vehicule" TEXT,
    "depot" TEXT,
    "dayId" INTEGER,
    "etat" TEXT NOT NULL DEFAULT 'Demandé',
    "observation" TEXT,
    "refMouvement" TEXT,
    "dateDemande" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateService" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bons_approvisionnement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bon_appro_lignes" (
    "id" SERIAL NOT NULL,
    "bonId" INTEGER NOT NULL,
    "refArt" TEXT NOT NULL,
    "designation" TEXT,
    "qteDemandee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "qteServie" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bon_appro_lignes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "paniers_utilisateur_etat_idx" ON "paniers"("utilisateur", "etat");

-- CreateIndex
CREATE INDEX "panier_lignes_panierId_idx" ON "panier_lignes"("panierId");

-- CreateIndex
CREATE UNIQUE INDEX "panier_lignes_panierId_refArt_key" ON "panier_lignes"("panierId", "refArt");

-- CreateIndex
CREATE UNIQUE INDEX "bons_approvisionnement_reference_key" ON "bons_approvisionnement"("reference");

-- CreateIndex
CREATE INDEX "bons_approvisionnement_utilisateur_idx" ON "bons_approvisionnement"("utilisateur");

-- CreateIndex
CREATE INDEX "bons_approvisionnement_etat_idx" ON "bons_approvisionnement"("etat");

-- CreateIndex
CREATE INDEX "bon_appro_lignes_bonId_idx" ON "bon_appro_lignes"("bonId");

-- CreateIndex
CREATE UNIQUE INDEX "bon_appro_lignes_bonId_refArt_key" ON "bon_appro_lignes"("bonId", "refArt");

-- AddForeignKey
ALTER TABLE "panier_lignes" ADD CONSTRAINT "panier_lignes_panierId_fkey" FOREIGN KEY ("panierId") REFERENCES "paniers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bon_appro_lignes" ADD CONSTRAINT "bon_appro_lignes_bonId_fkey" FOREIGN KEY ("bonId") REFERENCES "bons_approvisionnement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
