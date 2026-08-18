-- AlterTable
ALTER TABLE "documents_ext" ADD COLUMN     "dateValide" TIMESTAMP(3),
ADD COLUMN     "valide" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "stock_movements_ext" (
    "id" SERIAL NOT NULL,
    "refDoc" TEXT,
    "refArt" TEXT NOT NULL,
    "sens" TEXT NOT NULL,
    "qte" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stockAvant" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stockApres" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "puHt" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "typeDoc" TEXT,
    "codeMag" INTEGER,
    "motif" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_ext_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stock_movements_ext_refDoc_idx" ON "stock_movements_ext"("refDoc");

-- CreateIndex
CREATE INDEX "stock_movements_ext_refArt_idx" ON "stock_movements_ext"("refArt");

-- CreateIndex
CREATE INDEX "stock_movements_ext_createdAt_idx" ON "stock_movements_ext"("createdAt");

-- AddForeignKey
ALTER TABLE "stock_movements_ext" ADD CONSTRAINT "stock_movements_ext_refDoc_fkey" FOREIGN KEY ("refDoc") REFERENCES "documents_ext"("refDoc") ON DELETE SET NULL ON UPDATE CASCADE;
