-- CreateTable
CREATE TABLE "rubrique_paie" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "sens" TEXT NOT NULL DEFAULT 'Gain',
    "soumisCnss" BOOLEAN NOT NULL DEFAULT true,
    "soumisIrpp" BOOLEAN NOT NULL DEFAULT true,
    "soumisAccTravail" BOOLEAN NOT NULL DEFAULT false,
    "soumisAssGroupe" BOOLEAN NOT NULL DEFAULT false,
    "prorataAbsence" BOOLEAN NOT NULL DEFAULT false,
    "parQuantite" BOOLEAN NOT NULL DEFAULT false,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rubrique_paie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rubrique_employe" (
    "id" SERIAL NOT NULL,
    "rubriqueId" INTEGER NOT NULL,
    "codeEmploye" TEXT NOT NULL,
    "sessionId" INTEGER,
    "montant" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "quantite" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rubrique_employe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grille_salaire" (
    "id" SERIAL NOT NULL,
    "regime" TEXT NOT NULL,
    "categorie" TEXT NOT NULL,
    "echelon" TEXT NOT NULL,
    "salaireBase" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dureeEchelon" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grille_salaire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grh_typecnss" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "retCnss" DOUBLE PRECISION NOT NULL DEFAULT 9.18,
    "chCnss" DOUBLE PRECISION NOT NULL DEFAULT 16.57,
    "retCavis" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "chCavis" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "retenuIrpp" BOOLEAN NOT NULL DEFAULT true,
    "parDefaut" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grh_typecnss_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grh_impo" (
    "id" SERIAL NOT NULL,
    "du" DOUBLE PRECISION NOT NULL,
    "au" DOUBLE PRECISION,
    "taux" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grh_impo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parametrage_bilan" (
    "id" SERIAL NOT NULL,
    "libelle" TEXT NOT NULL,
    "formule" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL,
    "rubrique" TEXT,
    "numOrdre" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parametrage_bilan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bilan_comptable" (
    "id" SERIAL NOT NULL,
    "exerciceId" INTEGER NOT NULL,
    "libelle" TEXT NOT NULL,
    "montant" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "type" TEXT NOT NULL,
    "rubrique" TEXT,
    "numOrdre" INTEGER NOT NULL DEFAULT 0,
    "dateArret" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bilan_comptable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventaires" (
    "id" SERIAL NOT NULL,
    "reference" TEXT NOT NULL,
    "libelle" TEXT,
    "emplacement" TEXT,
    "dateInv" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "etat" TEXT NOT NULL DEFAULT 'Brouillon',
    "utilisateur" TEXT,
    "observation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventaires_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventaire_lignes" (
    "id" SERIAL NOT NULL,
    "inventaireId" INTEGER NOT NULL,
    "refArt" TEXT NOT NULL,
    "designation" TEXT,
    "qteTheorique" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "qteComptee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ecart" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pmp" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "valeurEcart" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventaire_lignes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rubrique_paie_code_key" ON "rubrique_paie"("code");

-- CreateIndex
CREATE INDEX "rubrique_employe_codeEmploye_idx" ON "rubrique_employe"("codeEmploye");

-- CreateIndex
CREATE INDEX "rubrique_employe_sessionId_idx" ON "rubrique_employe"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "rubrique_employe_rubriqueId_codeEmploye_sessionId_key" ON "rubrique_employe"("rubriqueId", "codeEmploye", "sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "grille_salaire_regime_categorie_echelon_key" ON "grille_salaire"("regime", "categorie", "echelon");

-- CreateIndex
CREATE UNIQUE INDEX "grh_typecnss_code_key" ON "grh_typecnss"("code");

-- CreateIndex
CREATE UNIQUE INDEX "grh_impo_du_key" ON "grh_impo"("du");

-- CreateIndex
CREATE INDEX "parametrage_bilan_type_idx" ON "parametrage_bilan"("type");

-- CreateIndex
CREATE INDEX "bilan_comptable_exerciceId_idx" ON "bilan_comptable"("exerciceId");

-- CreateIndex
CREATE UNIQUE INDEX "inventaires_reference_key" ON "inventaires"("reference");

-- CreateIndex
CREATE INDEX "inventaires_etat_idx" ON "inventaires"("etat");

-- CreateIndex
CREATE INDEX "inventaire_lignes_refArt_idx" ON "inventaire_lignes"("refArt");

-- CreateIndex
CREATE UNIQUE INDEX "inventaire_lignes_inventaireId_refArt_key" ON "inventaire_lignes"("inventaireId", "refArt");

-- AddForeignKey
ALTER TABLE "rubrique_employe" ADD CONSTRAINT "rubrique_employe_rubriqueId_fkey" FOREIGN KEY ("rubriqueId") REFERENCES "rubrique_paie"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rubrique_employe" ADD CONSTRAINT "rubrique_employe_codeEmploye_fkey" FOREIGN KEY ("codeEmploye") REFERENCES "grh_personnel"("codeEmploye") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rubrique_employe" ADD CONSTRAINT "rubrique_employe_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "grh_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bilan_comptable" ADD CONSTRAINT "bilan_comptable_exerciceId_fkey" FOREIGN KEY ("exerciceId") REFERENCES "exercices_compta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventaire_lignes" ADD CONSTRAINT "inventaire_lignes_inventaireId_fkey" FOREIGN KEY ("inventaireId") REFERENCES "inventaires"("id") ON DELETE CASCADE ON UPDATE CASCADE;
