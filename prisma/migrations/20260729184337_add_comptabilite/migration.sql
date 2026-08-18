-- CreateTable
CREATE TABLE "exercices_compta" (
    "id" SERIAL NOT NULL,
    "libelle" TEXT NOT NULL,
    "annee" INTEGER NOT NULL,
    "dateDeb" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3) NOT NULL,
    "cloture" BOOLEAN NOT NULL DEFAULT false,
    "courant" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exercices_compta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journaux_compta" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'OD',

    CONSTRAINT "journaux_compta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ecritures_compta" (
    "id" SERIAL NOT NULL,
    "exerciceId" INTEGER NOT NULL,
    "codeJournal" TEXT NOT NULL,
    "numPiece" TEXT NOT NULL,
    "numOrdre" INTEGER NOT NULL DEFAULT 0,
    "numCompte" TEXT NOT NULL,
    "libelleCompte" TEXT,
    "libelleEcriture" TEXT,
    "dateEcriture" TIMESTAMP(3) NOT NULL,
    "refDoc" TEXT,
    "debit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "credit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "utilisateur" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ecritures_compta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_comptable" (
    "id" SERIAL NOT NULL,
    "numCompte" TEXT NOT NULL,
    "intitule" TEXT NOT NULL,
    "classe" INTEGER NOT NULL DEFAULT 0,
    "soldeIni" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lettrable" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "plan_comptable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "param_compta" (
    "id" SERIAL NOT NULL,
    "cle" TEXT NOT NULL,
    "numCompte" TEXT NOT NULL,
    "libelle" TEXT,

    CONSTRAINT "param_compta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "exercices_compta_annee_key" ON "exercices_compta"("annee");

-- CreateIndex
CREATE UNIQUE INDEX "journaux_compta_code_key" ON "journaux_compta"("code");

-- CreateIndex
CREATE INDEX "ecritures_compta_exerciceId_numCompte_idx" ON "ecritures_compta"("exerciceId", "numCompte");

-- CreateIndex
CREATE INDEX "ecritures_compta_numPiece_idx" ON "ecritures_compta"("numPiece");

-- CreateIndex
CREATE INDEX "ecritures_compta_dateEcriture_idx" ON "ecritures_compta"("dateEcriture");

-- CreateIndex
CREATE INDEX "ecritures_compta_refDoc_idx" ON "ecritures_compta"("refDoc");

-- CreateIndex
CREATE INDEX "plan_comptable_classe_idx" ON "plan_comptable"("classe");

-- CreateIndex
CREATE UNIQUE INDEX "plan_comptable_numCompte_key" ON "plan_comptable"("numCompte");

-- CreateIndex
CREATE UNIQUE INDEX "param_compta_cle_key" ON "param_compta"("cle");

-- AddForeignKey
ALTER TABLE "ecritures_compta" ADD CONSTRAINT "ecritures_compta_exerciceId_fkey" FOREIGN KEY ("exerciceId") REFERENCES "exercices_compta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ecritures_compta" ADD CONSTRAINT "ecritures_compta_codeJournal_fkey" FOREIGN KEY ("codeJournal") REFERENCES "journaux_compta"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
