-- AlterTable
ALTER TABLE "articles_ext" ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'P';

-- CreateIndex
CREATE INDEX "articles_ext_kind_idx" ON "articles_ext"("kind");
