-- CreateTable
CREATE TABLE "fam_art" (
    "code" INTEGER NOT NULL,
    "libelle" TEXT NOT NULL,
    "charge" BOOLEAN NOT NULL DEFAULT false,
    "lettreCompta" TEXT,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fam_art_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "sous_fam_art" (
    "code" INTEGER NOT NULL,
    "libelle" TEXT NOT NULL,
    "charge" BOOLEAN NOT NULL DEFAULT false,
    "lettreCompta" TEXT,
    "image" TEXT,
    "codeFamille" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sous_fam_art_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "unite_art" (
    "unite" TEXT NOT NULL,
    "libelle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "unite_art_pkey" PRIMARY KEY ("unite")
);

-- CreateTable
CREATE TABLE "catalogue_art" (
    "code" INTEGER NOT NULL,
    "libelle" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "catalogue_art_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "charges_fixes" (
    "id" SERIAL NOT NULL,
    "libelle" TEXT,
    "du" TIMESTAMP(3) NOT NULL,
    "au" TIMESTAMP(3) NOT NULL,
    "montant" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "montantJr" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "nbJour" INTEGER NOT NULL DEFAULT 0,
    "etat" TEXT NOT NULL DEFAULT 'Brouillon',
    "dateRepartition" TIMESTAMP(3),
    "lignesTouchees" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "charges_fixes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "frais_mission" (
    "id" SERIAL NOT NULL,
    "dayId" INTEGER NOT NULL,
    "refArt" TEXT,
    "libelle" TEXT,
    "montant" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "puAchat" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "carburant" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "frais_mission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_comptable_standard" (
    "id" SERIAL NOT NULL,
    "numCompte" TEXT NOT NULL,
    "intitule" TEXT NOT NULL,
    "utilisable" BOOLEAN NOT NULL DEFAULT true,
    "pointable" BOOLEAN NOT NULL DEFAULT false,
    "lettrable" BOOLEAN NOT NULL DEFAULT false,
    "commentaire" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_comptable_standard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sous_fam_art_codeFamille_idx" ON "sous_fam_art"("codeFamille");

-- CreateIndex
CREATE INDEX "charges_fixes_etat_idx" ON "charges_fixes"("etat");

-- CreateIndex
CREATE INDEX "frais_mission_dayId_idx" ON "frais_mission"("dayId");

-- CreateIndex
CREATE UNIQUE INDEX "plan_comptable_standard_numCompte_key" ON "plan_comptable_standard"("numCompte");

-- AddForeignKey
ALTER TABLE "frais_mission" ADD CONSTRAINT "frais_mission_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "erp_missions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
