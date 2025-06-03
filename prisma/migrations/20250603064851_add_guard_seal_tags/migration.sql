-- AlterTable
ALTER TABLE "seals" ADD COLUMN     "verificationData" JSONB DEFAULT '{}';

-- CreateTable
CREATE TABLE "guard_seal_tags" (
    "id" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "sealId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verified" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "guard_seal_tags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "guard_seal_tags_sealId_barcode_key" ON "guard_seal_tags"("sealId", "barcode");

-- AddForeignKey
ALTER TABLE "guard_seal_tags" ADD CONSTRAINT "guard_seal_tags_sealId_fkey" FOREIGN KEY ("sealId") REFERENCES "seals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
