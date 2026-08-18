-- CreateTable
CREATE TABLE "document_lines_ext" (
    "id" SERIAL NOT NULL,
    "refDoc" TEXT NOT NULL,
    "refArt" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "unite" TEXT,
    "qte" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "puHt" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "remise" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tauxTva" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tauxFodec" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "thtBrut" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "thtNet" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totTva" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ttcNet" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_lines_ext_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "document_lines_ext_refDoc_idx" ON "document_lines_ext"("refDoc");

-- CreateIndex
CREATE INDEX "document_lines_ext_refArt_idx" ON "document_lines_ext"("refArt");

-- AddForeignKey
ALTER TABLE "document_lines_ext" ADD CONSTRAINT "document_lines_ext_refDoc_fkey" FOREIGN KEY ("refDoc") REFERENCES "documents_ext"("refDoc") ON DELETE CASCADE ON UPDATE CASCADE;
