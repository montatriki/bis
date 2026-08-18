-- AlterTable
ALTER TABLE "document_lines_ext" ADD COLUMN     "docLiee" TEXT;

-- AlterTable
ALTER TABLE "documents_ext" ADD COLUMN     "docSource" TEXT,
ADD COLUMN     "transformeEn" TEXT;
