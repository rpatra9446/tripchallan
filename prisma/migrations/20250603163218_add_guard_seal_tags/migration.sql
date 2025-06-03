/*
  Warnings:

  - You are about to drop the column `sealId` on the `guard_seal_tags` table. All the data in the column will be lost.
  - You are about to drop the column `verified` on the `guard_seal_tags` table. All the data in the column will be lost.
  - You are about to drop the column `verificationData` on the `seals` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[barcode]` on the table `guard_seal_tags` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `sessionId` to the `guard_seal_tags` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "guard_seal_tags" DROP CONSTRAINT "guard_seal_tags_sealId_fkey";

-- DropIndex
DROP INDEX "guard_seal_tags_sealId_barcode_key";

-- AlterTable
ALTER TABLE "guard_seal_tags" DROP COLUMN "sealId",
DROP COLUMN "verified",
ADD COLUMN     "sessionId" TEXT NOT NULL,
ADD COLUMN     "status" TEXT DEFAULT 'VERIFIED',
ADD COLUMN     "verifiedById" TEXT;

-- AlterTable
ALTER TABLE "seals" DROP COLUMN "verificationData";

-- CreateIndex
CREATE UNIQUE INDEX "guard_seal_tags_barcode_key" ON "guard_seal_tags"("barcode");

-- AddForeignKey
ALTER TABLE "guard_seal_tags" ADD CONSTRAINT "guard_seal_tags_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guard_seal_tags" ADD CONSTRAINT "guard_seal_tags_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
