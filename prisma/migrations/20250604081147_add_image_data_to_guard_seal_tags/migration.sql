/*
  Warnings:

  - You are about to drop the column `createdById` on the `seal_tags` table. All the data in the column will be lost.
  - You are about to drop the column `guardImageData` on the `seal_tags` table. All the data in the column will be lost.
  - You are about to drop the column `guardMethod` on the `seal_tags` table. All the data in the column will be lost.
  - You are about to drop the column `guardNotes` on the `seal_tags` table. All the data in the column will be lost.
  - You are about to drop the column `guardStatus` on the `seal_tags` table. All the data in the column will be lost.
  - You are about to drop the column `guardTimestamp` on the `seal_tags` table. All the data in the column will be lost.
  - You are about to drop the column `guardUserId` on the `seal_tags` table. All the data in the column will be lost.
  - You are about to drop the column `imageData` on the `seal_tags` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[barcode]` on the table `seal_tags` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "seal_tags" DROP CONSTRAINT "seal_tags_createdById_fkey";

-- DropForeignKey
ALTER TABLE "seal_tags" DROP CONSTRAINT "seal_tags_guardUserId_fkey";

-- DropIndex
DROP INDEX "seal_tags_sessionId_barcode_key";

-- AlterTable
ALTER TABLE "seal_tags" DROP COLUMN "createdById",
DROP COLUMN "guardImageData",
DROP COLUMN "guardMethod",
DROP COLUMN "guardNotes",
DROP COLUMN "guardStatus",
DROP COLUMN "guardTimestamp",
DROP COLUMN "guardUserId",
DROP COLUMN "imageData",
ADD COLUMN     "imageUrl" TEXT;

-- CreateTable
CREATE TABLE "guard_seal_tags" (
    "id" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "imageUrl" TEXT,
    "imageData" TEXT,
    "mediaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedById" TEXT,
    "status" TEXT DEFAULT 'VERIFIED',

    CONSTRAINT "guard_seal_tags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "guard_seal_tags_barcode_key" ON "guard_seal_tags"("barcode");

-- CreateIndex
CREATE UNIQUE INDEX "guard_seal_tags_mediaId_key" ON "guard_seal_tags"("mediaId");

-- CreateIndex
CREATE UNIQUE INDEX "seal_tags_barcode_key" ON "seal_tags"("barcode");

-- AddForeignKey
ALTER TABLE "guard_seal_tags" ADD CONSTRAINT "guard_seal_tags_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guard_seal_tags" ADD CONSTRAINT "guard_seal_tags_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guard_seal_tags" ADD CONSTRAINT "guard_seal_tags_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
