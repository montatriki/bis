-- CreateTable
CREATE TABLE "grh_fonction" (
    "id" SERIAL NOT NULL,
    "libelle" TEXT NOT NULL,
    "code" TEXT,

    CONSTRAINT "grh_fonction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grh_grade" (
    "id" SERIAL NOT NULL,
    "libelle" TEXT NOT NULL,
    "code" TEXT,

    CONSTRAINT "grh_grade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grh_service" (
    "id" SERIAL NOT NULL,
    "libelle" TEXT NOT NULL,
    "code" TEXT,

    CONSTRAINT "grh_service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grh_categorie" (
    "id" SERIAL NOT NULL,
    "libelle" TEXT NOT NULL,
    "code" TEXT,

    CONSTRAINT "grh_categorie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grh_echelon" (
    "id" SERIAL NOT NULL,
    "libelle" TEXT NOT NULL,
    "code" TEXT,

    CONSTRAINT "grh_echelon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grh_session" (
    "id" SERIAL NOT NULL,
    "libelle" TEXT NOT NULL,
    "mois" INTEGER,
    "annee" INTEGER,
    "nHeures" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "nJours" DOUBLE PRECISION NOT NULL DEFAULT 26,
    "cloturee" BOOLEAN NOT NULL DEFAULT false,
    "dateDeb" TIMESTAMP(3),
    "dateFin" TIMESTAMP(3),

    CONSTRAINT "grh_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grh_personnel" (
    "id" SERIAL NOT NULL,
    "codeEmploye" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT,
    "cin" TEXT,
    "lieuCin" TEXT,
    "dateCin" TIMESTAMP(3),
    "sexe" TEXT,
    "dateNaiss" TIMESTAMP(3),
    "lieuNaiss" TEXT,
    "situationFamiliale" TEXT,
    "chefFamille" BOOLEAN NOT NULL DEFAULT false,
    "nbrEnfants" INTEGER NOT NULL DEFAULT 0,
    "nbrHandicape" INTEGER NOT NULL DEFAULT 0,
    "adresse" TEXT,
    "tel" TEXT,
    "email" TEXT,
    "numContrat" TEXT,
    "contratDu" TIMESTAMP(3),
    "contratAu" TIMESTAMP(3),
    "dateEmbauche" TIMESTAMP(3),
    "dateDepart" TIMESTAMP(3),
    "titularisation" TIMESTAMP(3),
    "partant" BOOLEAN NOT NULL DEFAULT false,
    "traitement" TEXT,
    "salaireBase" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "coutHoraire" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "njTraitNormal" DOUBLE PRECISION NOT NULL DEFAULT 26,
    "njMaxMois" DOUBLE PRECISION NOT NULL DEFAULT 30,
    "smigar" BOOLEAN NOT NULL DEFAULT false,
    "plafondCredit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "soldeConge" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "prixConge" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "numCnss" TEXT,
    "typeCnss" TEXT,
    "pourcentageAssGro" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pourcentageAssAccTra" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "montExoAss" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "fonctionId" INTEGER,
    "gradeId" INTEGER,
    "serviceId" INTEGER,
    "categorieId" INTEGER,
    "echelonId" INTEGER,

    CONSTRAINT "grh_personnel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grh_pointage" (
    "id" SERIAL NOT NULL,
    "codeEmploye" TEXT NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "regime" TEXT NOT NULL DEFAULT 'M',
    "presenceJ" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "presenceH" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ferieJ" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ferieH" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ferieTrJ" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ferieTrH" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "congeJ" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "congeH" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "absenceJ" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "absenceH" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hSupp" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grh_pointage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grh_conge" (
    "id" SERIAL NOT NULL,
    "codeEmploye" TEXT NOT NULL,
    "sessionId" INTEGER,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3) NOT NULL,
    "nbrJours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "motif" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'En attente',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grh_conge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grh_bulletin" (
    "id" SERIAL NOT NULL,
    "codeEmploye" TEXT NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "salaireBase" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "primes" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "heuresSupp" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "brutImposable" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cnss" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "irpp" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "css" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "autresRet" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netAPayer" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "jourTravailles" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grh_bulletin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "grh_personnel_codeEmploye_key" ON "grh_personnel"("codeEmploye");

-- CreateIndex
CREATE INDEX "grh_personnel_nom_idx" ON "grh_personnel"("nom");

-- CreateIndex
CREATE INDEX "grh_personnel_actif_idx" ON "grh_personnel"("actif");

-- CreateIndex
CREATE INDEX "grh_pointage_sessionId_idx" ON "grh_pointage"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "grh_pointage_codeEmploye_sessionId_key" ON "grh_pointage"("codeEmploye", "sessionId");

-- CreateIndex
CREATE INDEX "grh_conge_codeEmploye_idx" ON "grh_conge"("codeEmploye");

-- CreateIndex
CREATE INDEX "grh_conge_sessionId_idx" ON "grh_conge"("sessionId");

-- CreateIndex
CREATE INDEX "grh_bulletin_sessionId_idx" ON "grh_bulletin"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "grh_bulletin_codeEmploye_sessionId_key" ON "grh_bulletin"("codeEmploye", "sessionId");

-- AddForeignKey
ALTER TABLE "grh_personnel" ADD CONSTRAINT "grh_personnel_fonctionId_fkey" FOREIGN KEY ("fonctionId") REFERENCES "grh_fonction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grh_personnel" ADD CONSTRAINT "grh_personnel_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "grh_grade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grh_personnel" ADD CONSTRAINT "grh_personnel_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "grh_service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grh_personnel" ADD CONSTRAINT "grh_personnel_categorieId_fkey" FOREIGN KEY ("categorieId") REFERENCES "grh_categorie"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grh_personnel" ADD CONSTRAINT "grh_personnel_echelonId_fkey" FOREIGN KEY ("echelonId") REFERENCES "grh_echelon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grh_pointage" ADD CONSTRAINT "grh_pointage_codeEmploye_fkey" FOREIGN KEY ("codeEmploye") REFERENCES "grh_personnel"("codeEmploye") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grh_pointage" ADD CONSTRAINT "grh_pointage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "grh_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grh_conge" ADD CONSTRAINT "grh_conge_codeEmploye_fkey" FOREIGN KEY ("codeEmploye") REFERENCES "grh_personnel"("codeEmploye") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grh_conge" ADD CONSTRAINT "grh_conge_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "grh_session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grh_bulletin" ADD CONSTRAINT "grh_bulletin_codeEmploye_fkey" FOREIGN KEY ("codeEmploye") REFERENCES "grh_personnel"("codeEmploye") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grh_bulletin" ADD CONSTRAINT "grh_bulletin_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "grh_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
