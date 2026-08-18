-- CreateTable
CREATE TABLE "chequiers" (
    "id" SERIAL NOT NULL,
    "banque" TEXT NOT NULL,
    "numCompte" TEXT,
    "serie" TEXT,
    "numDebut" INTEGER NOT NULL,
    "numFin" INTEGER NOT NULL,
    "suivant" INTEGER NOT NULL DEFAULT 0,
    "epuise" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chequiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cheques" (
    "id" SERIAL NOT NULL,
    "chequierId" INTEGER NOT NULL,
    "numero" INTEGER NOT NULL,
    "montant" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dateEmis" TIMESTAMP(3),
    "echeance" TIMESTAMP(3),
    "etat" TEXT NOT NULL DEFAULT 'Emis',
    "tiersNom" TEXT,
    "tiersCode" INTEGER,
    "refDoc" TEXT,
    "borderauId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cheques_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "borderau_lignes" (
    "id" SERIAL NOT NULL,
    "borderauId" INTEGER NOT NULL,
    "reglementId" INTEGER,
    "chequeId" INTEGER,
    "numPiece" TEXT,
    "tiersNom" TEXT,
    "montant" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "echeance" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "borderau_lignes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mouvements_compte" (
    "id" SERIAL NOT NULL,
    "compteId" INTEGER NOT NULL,
    "dateMvt" TIMESTAMP(3) NOT NULL,
    "libelle" TEXT NOT NULL,
    "sens" TEXT NOT NULL,
    "montant" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "soldeApres" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reference" TEXT,
    "refDoc" TEXT,
    "reglementId" INTEGER,
    "borderauId" INTEGER,
    "utilisateur" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mouvements_compte_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chequiers_banque_idx" ON "chequiers"("banque");

-- CreateIndex
CREATE INDEX "cheques_etat_idx" ON "cheques"("etat");

-- CreateIndex
CREATE INDEX "cheques_echeance_idx" ON "cheques"("echeance");

-- CreateIndex
CREATE UNIQUE INDEX "cheques_chequierId_numero_key" ON "cheques"("chequierId", "numero");

-- CreateIndex
CREATE INDEX "borderau_lignes_borderauId_idx" ON "borderau_lignes"("borderauId");

-- CreateIndex
CREATE INDEX "mouvements_compte_compteId_dateMvt_idx" ON "mouvements_compte"("compteId", "dateMvt");

-- AddForeignKey
ALTER TABLE "cheques" ADD CONSTRAINT "cheques_chequierId_fkey" FOREIGN KEY ("chequierId") REFERENCES "chequiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
