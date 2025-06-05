-- AlterTable
ALTER TABLE "seal_tags" ADD COLUMN     "imageData" TEXT,
ADD COLUMN     "scannedById" TEXT,
ADD COLUMN     "scannedByName" TEXT;

-- AddForeignKey
ALTER TABLE "seal_tags" ADD CONSTRAINT "seal_tags_scannedById_fkey" FOREIGN KEY ("scannedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
