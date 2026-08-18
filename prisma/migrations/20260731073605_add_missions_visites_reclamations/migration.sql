-- AlterTable
ALTER TABLE "documents_ext" ADD COLUMN     "dayId" INTEGER;

-- AlterTable
ALTER TABLE "erp_missions" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "objectifCA" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "erp_reglements" ADD COLUMN     "dayId" INTEGER;

-- CreateTable
CREATE TABLE "ligne_mission" (
    "id" SERIAL NOT NULL,
    "dayId" INTEGER NOT NULL,
    "codeCli" INTEGER,
    "clientNom" TEXT,
    "motif" TEXT,
    "objectif" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "numOrdre" INTEGER NOT NULL DEFAULT 0,
    "etat" TEXT NOT NULL DEFAULT 'À visiter',
    "heurePrevue" TEXT,
    "dateVisite" TIMESTAMP(3),
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "commentaire" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ligne_mission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reclamation_client" (
    "id" SERIAL NOT NULL,
    "dayId" INTEGER,
    "codeCli" INTEGER,
    "clientNom" TEXT,
    "type" TEXT NOT NULL DEFAULT 'Autre',
    "reclamation" TEXT NOT NULL,
    "etat" TEXT NOT NULL DEFAULT 'Ouverte',
    "reponse" TEXT,
    "utilisateur" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "dateReclam" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateReponse" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reclamation_client_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ligne_mission_dayId_idx" ON "ligne_mission"("dayId");

-- CreateIndex
CREATE INDEX "ligne_mission_codeCli_idx" ON "ligne_mission"("codeCli");

-- CreateIndex
CREATE INDEX "ligne_mission_etat_idx" ON "ligne_mission"("etat");

-- CreateIndex
CREATE INDEX "reclamation_client_codeCli_idx" ON "reclamation_client"("codeCli");

-- CreateIndex
CREATE INDEX "reclamation_client_etat_idx" ON "reclamation_client"("etat");

-- CreateIndex
CREATE INDEX "reclamation_client_dayId_idx" ON "reclamation_client"("dayId");

-- CreateIndex
CREATE INDEX "erp_reglements_dayId_idx" ON "erp_reglements"("dayId");

-- AddForeignKey
ALTER TABLE "documents_ext" ADD CONSTRAINT "documents_ext_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "erp_missions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "erp_reglements" ADD CONSTRAINT "erp_reglements_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "erp_missions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ligne_mission" ADD CONSTRAINT "ligne_mission_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "erp_missions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reclamation_client" ADD CONSTRAINT "reclamation_client_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "erp_missions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
