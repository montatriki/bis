-- CreateTable
CREATE TABLE "erp_reglements" (
    "id" INTEGER NOT NULL,
    "sens" TEXT NOT NULL,
    "datePay" TIMESTAMP(3),
    "montant" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "echeance" TEXT,
    "numPiece" TEXT,
    "numDoc" TEXT,
    "etat" TEXT,
    "modePay" TEXT,
    "tiersCode" INTEGER,
    "tiersNom" TEXT,
    "utilisateur" TEXT,
    "banque" TEXT,
    "idEmplac" INTEGER,
    "commentaire" TEXT,

    CONSTRAINT "erp_reglements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "erp_accounts" (
    "id" INTEGER NOT NULL,
    "type" TEXT,
    "rib" TEXT,
    "libelle" TEXT,
    "banque" TEXT,
    "agence" TEXT,
    "nature" TEXT,
    "codeJournal" TEXT,
    "planComptable" TEXT,

    CONSTRAINT "erp_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "erp_borderaux" (
    "id" INTEGER NOT NULL,
    "dateBord" TIMESTAMP(3),
    "numCompte" TEXT,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "type" TEXT,
    "mtEsp" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "utilisateur" TEXT,

    CONSTRAINT "erp_borderaux_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "erp_reglements_sens_idx" ON "erp_reglements"("sens");

-- CreateIndex
CREATE INDEX "erp_reglements_datePay_idx" ON "erp_reglements"("datePay");
