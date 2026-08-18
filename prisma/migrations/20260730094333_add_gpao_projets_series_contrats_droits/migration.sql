-- CreateTable
CREATE TABLE "gmao_machines" (
    "id" SERIAL NOT NULL,
    "numSerie" TEXT,
    "machine" TEXT NOT NULL,
    "posteCharge" TEXT,
    "etat" TEXT NOT NULL DEFAULT 'Fonctionnel',
    "dateMiseEnMarche" TIMESTAMP(3),
    "coutAcquisition" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "capaciteHoraire" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "coutHoraire" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gmao_machines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gpao_postes_charge" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "centre" TEXT,
    "mainOeuvre" BOOLEAN NOT NULL DEFAULT false,
    "machine" BOOLEAN NOT NULL DEFAULT false,
    "sousTraitance" BOOLEAN NOT NULL DEFAULT false,
    "nbRessources" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "heureDebut" TEXT NOT NULL DEFAULT '08:00',
    "heureFin" TEXT NOT NULL DEFAULT '17:00',
    "pauseDebut" TEXT NOT NULL DEFAULT '12:00',
    "pauseFin" TEXT NOT NULL DEFAULT '13:00',
    "coutHoraire" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gpao_postes_charge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gpao_jalonnements" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gpao_jalonnements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gpao_operations" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "typeJalonnement" TEXT,
    "operationSuivante" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gpao_operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gpao_nomenclatures" (
    "refArt" TEXT NOT NULL,
    "desArt" TEXT,
    "site" TEXT,
    "alternative" TEXT,
    "versionMaj" TEXT,
    "versionMin" TEXT,
    "uniteStock" TEXT,
    "uniteGes" TEXT,
    "qteBase" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "dateRef" TIMESTAMP(3),
    "dateDebutVal" TIMESTAMP(3),
    "dateFinVal" TIMESTAMP(3),
    "elaboration" BOOLEAN NOT NULL DEFAULT true,
    "exploitation" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gpao_nomenclatures_pkey" PRIMARY KEY ("refArt")
);

-- CreateTable
CREATE TABLE "gpao_nomenclature_lignes" (
    "id" SERIAL NOT NULL,
    "refNom" TEXT NOT NULL,
    "refArt" TEXT NOT NULL,
    "desArt" TEXT,
    "typeComposant" TEXT NOT NULL DEFAULT 'MP',
    "numOrdre" INTEGER NOT NULL DEFAULT 0,
    "numSequence" INTEGER NOT NULL DEFAULT 0,
    "qte" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gpao_nomenclature_lignes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gpao_gammes" (
    "id" SERIAL NOT NULL,
    "gamme" TEXT NOT NULL,
    "desGamme" TEXT,
    "refArt" TEXT,
    "site" TEXT,
    "alternative" TEXT,
    "versionMaj" TEXT,
    "versionMin" TEXT,
    "dateRef" TIMESTAMP(3),
    "dateDebutVal" TIMESTAMP(3),
    "dateFinVal" TIMESTAMP(3),
    "elaboration" BOOLEAN NOT NULL DEFAULT true,
    "exploitation" BOOLEAN NOT NULL DEFAULT false,
    "qteMin" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "qteMax" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gpao_gammes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gpao_operations_gamme" (
    "id" SERIAL NOT NULL,
    "gammeId" INTEGER NOT NULL,
    "operationId" INTEGER,
    "desOperation" TEXT NOT NULL,
    "numSequence" INTEGER NOT NULL DEFAULT 0,
    "posteChargeId" INTEGER,
    "nbPosteCharge" INTEGER NOT NULL DEFAULT 1,
    "posteMo" TEXT,
    "nbPosteMo" INTEGER NOT NULL DEFAULT 0,
    "tempsReg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tempsPreparation" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tempsOperatoire" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "qteBase" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "coeffCharge" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "efficience" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gpao_operations_gamme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gpao_operations_of" (
    "id" SERIAL NOT NULL,
    "refDoc" TEXT NOT NULL,
    "desArt" TEXT,
    "operationId" INTEGER,
    "desOperation" TEXT NOT NULL,
    "numSequence" INTEGER NOT NULL DEFAULT 0,
    "posteChargeId" INTEGER,
    "posteMo" TEXT,
    "tempsReg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tempsPreparation" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tempsOperatoire" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "duree" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gpao_operations_of_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gpao_plannification" (
    "id" SERIAL NOT NULL,
    "refDoc" TEXT NOT NULL,
    "operationId" INTEGER,
    "desOperation" TEXT,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3) NOT NULL,
    "duree" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "typeDuree" TEXT NOT NULL DEFAULT 'Temps opératoire',
    "posteChargeId" INTEGER,
    "posteMo" TEXT,
    "disponibilite" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gpao_plannification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "numeros_serie" (
    "id" SERIAL NOT NULL,
    "numSerie" TEXT NOT NULL,
    "refArt" TEXT NOT NULL,
    "desArt" TEXT,
    "sens" TEXT NOT NULL DEFAULT 'Achat',
    "refDoc" TEXT,
    "ligneId" INTEGER,
    "codeCli" INTEGER,
    "tiersNom" TEXT,
    "dateDoc" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "numeros_serie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projets" (
    "id" SERIAL NOT NULL,
    "projet" TEXT NOT NULL,
    "codeCli" INTEGER,
    "raisonSoc" TEXT,
    "respProjet" TEXT,
    "famille" TEXT,
    "description" TEXT,
    "adresse" TEXT,
    "modePay" TEXT,
    "dateAccept" TIMESTAMP(3),
    "periodeDu" TIMESTAMP(3),
    "periodeAu" TIMESTAMP(3),
    "dateLiv" TIMESTAMP(3),
    "dateFinReel" TIMESTAMP(3),
    "etat" TEXT NOT NULL DEFAULT 'En attente',
    "avancement" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "budget" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projet_jalons" (
    "id" SERIAL NOT NULL,
    "projetId" INTEGER NOT NULL,
    "libelle" TEXT NOT NULL,
    "numOrdre" INTEGER NOT NULL DEFAULT 0,
    "poids" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "avancement" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "datePrevue" TIMESTAMP(3),
    "dateReelle" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projet_jalons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grh_contrats" (
    "id" SERIAL NOT NULL,
    "personnelId" INTEGER NOT NULL,
    "typeContrat" TEXT NOT NULL DEFAULT 'CDI',
    "reference" TEXT,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3),
    "essaiMois" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "salaireBrut" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "poste" TEXT,
    "lieuTravail" TEXT,
    "horaire" TEXT,
    "observation" TEXT,
    "etat" TEXT NOT NULL DEFAULT 'En cours',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grh_contrats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "list_droit_access" (
    "id" SERIAL NOT NULL,
    "component" TEXT NOT NULL,
    "funcName" TEXT NOT NULL,
    "funcLib" TEXT NOT NULL,
    "typeFn" TEXT NOT NULL DEFAULT 'action',
    "numOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "list_droit_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "component_user_droit" (
    "id" SERIAL NOT NULL,
    "login" TEXT NOT NULL,
    "fonctionId" INTEGER NOT NULL,
    "valeur" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "component_user_droit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "gpao_postes_charge_code_key" ON "gpao_postes_charge"("code");

-- CreateIndex
CREATE UNIQUE INDEX "gpao_jalonnements_code_key" ON "gpao_jalonnements"("code");

-- CreateIndex
CREATE UNIQUE INDEX "gpao_operations_code_key" ON "gpao_operations"("code");

-- CreateIndex
CREATE INDEX "gpao_nomenclature_lignes_refNom_idx" ON "gpao_nomenclature_lignes"("refNom");

-- CreateIndex
CREATE INDEX "gpao_nomenclature_lignes_refArt_idx" ON "gpao_nomenclature_lignes"("refArt");

-- CreateIndex
CREATE UNIQUE INDEX "gpao_gammes_gamme_key" ON "gpao_gammes"("gamme");

-- CreateIndex
CREATE INDEX "gpao_gammes_refArt_idx" ON "gpao_gammes"("refArt");

-- CreateIndex
CREATE INDEX "gpao_operations_gamme_gammeId_idx" ON "gpao_operations_gamme"("gammeId");

-- CreateIndex
CREATE INDEX "gpao_operations_of_refDoc_idx" ON "gpao_operations_of"("refDoc");

-- CreateIndex
CREATE INDEX "gpao_plannification_refDoc_idx" ON "gpao_plannification"("refDoc");

-- CreateIndex
CREATE INDEX "gpao_plannification_dateDebut_idx" ON "gpao_plannification"("dateDebut");

-- CreateIndex
CREATE INDEX "numeros_serie_numSerie_idx" ON "numeros_serie"("numSerie");

-- CreateIndex
CREATE INDEX "numeros_serie_refArt_idx" ON "numeros_serie"("refArt");

-- CreateIndex
CREATE INDEX "numeros_serie_refDoc_idx" ON "numeros_serie"("refDoc");

-- CreateIndex
CREATE INDEX "projets_codeCli_idx" ON "projets"("codeCli");

-- CreateIndex
CREATE INDEX "projets_etat_idx" ON "projets"("etat");

-- CreateIndex
CREATE INDEX "projet_jalons_projetId_idx" ON "projet_jalons"("projetId");

-- CreateIndex
CREATE INDEX "grh_contrats_personnelId_idx" ON "grh_contrats"("personnelId");

-- CreateIndex
CREATE INDEX "grh_contrats_etat_idx" ON "grh_contrats"("etat");

-- CreateIndex
CREATE INDEX "list_droit_access_component_idx" ON "list_droit_access"("component");

-- CreateIndex
CREATE UNIQUE INDEX "list_droit_access_component_funcName_key" ON "list_droit_access"("component", "funcName");

-- CreateIndex
CREATE INDEX "component_user_droit_login_idx" ON "component_user_droit"("login");

-- CreateIndex
CREATE UNIQUE INDEX "component_user_droit_login_fonctionId_key" ON "component_user_droit"("login", "fonctionId");

-- AddForeignKey
ALTER TABLE "gpao_nomenclature_lignes" ADD CONSTRAINT "gpao_nomenclature_lignes_refNom_fkey" FOREIGN KEY ("refNom") REFERENCES "gpao_nomenclatures"("refArt") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gpao_operations_gamme" ADD CONSTRAINT "gpao_operations_gamme_gammeId_fkey" FOREIGN KEY ("gammeId") REFERENCES "gpao_gammes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gpao_operations_gamme" ADD CONSTRAINT "gpao_operations_gamme_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "gpao_operations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gpao_operations_gamme" ADD CONSTRAINT "gpao_operations_gamme_posteChargeId_fkey" FOREIGN KEY ("posteChargeId") REFERENCES "gpao_postes_charge"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gpao_plannification" ADD CONSTRAINT "gpao_plannification_posteChargeId_fkey" FOREIGN KEY ("posteChargeId") REFERENCES "gpao_postes_charge"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projet_jalons" ADD CONSTRAINT "projet_jalons_projetId_fkey" FOREIGN KEY ("projetId") REFERENCES "projets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grh_contrats" ADD CONSTRAINT "grh_contrats_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "grh_personnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "component_user_droit" ADD CONSTRAINT "component_user_droit_fonctionId_fkey" FOREIGN KEY ("fonctionId") REFERENCES "list_droit_access"("id") ON DELETE CASCADE ON UPDATE CASCADE;
