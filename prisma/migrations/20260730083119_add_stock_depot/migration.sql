-- CreateTable
CREATE TABLE "stock_depots" (
    "id" SERIAL NOT NULL,
    "refArt" TEXT NOT NULL,
    "emplacement" TEXT NOT NULL,
    "quantite" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_depots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mouvements_depot" (
    "id" SERIAL NOT NULL,
    "refDoc" TEXT,
    "typeDoc" TEXT,
    "refArt" TEXT NOT NULL,
    "designation" TEXT,
    "quantite" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "source" TEXT,
    "destination" TEXT,
    "utilisateur" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mouvements_depot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stock_depots_emplacement_idx" ON "stock_depots"("emplacement");

-- CreateIndex
CREATE UNIQUE INDEX "stock_depots_refArt_emplacement_key" ON "stock_depots"("refArt", "emplacement");

-- CreateIndex
CREATE INDEX "mouvements_depot_refDoc_idx" ON "mouvements_depot"("refDoc");

-- CreateIndex
CREATE INDEX "mouvements_depot_refArt_idx" ON "mouvements_depot"("refArt");
