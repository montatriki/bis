-- CreateTable
CREATE TABLE "erp_missions" (
    "id" INTEGER NOT NULL,
    "utilisateur" TEXT,
    "commercial" TEXT,
    "vehicule" TEXT,
    "dateOrdre" TIMESTAMP(3),
    "kmDepart" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "kmArrive" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "etat" TEXT,
    "du" TIMESTAMP(3),
    "au" TIMESTAMP(3),

    CONSTRAINT "erp_missions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "erp_missions_commercial_idx" ON "erp_missions"("commercial");

-- CreateIndex
CREATE INDEX "erp_missions_etat_idx" ON "erp_missions"("etat");

-- CreateIndex
CREATE INDEX "erp_missions_dateOrdre_idx" ON "erp_missions"("dateOrdre");
