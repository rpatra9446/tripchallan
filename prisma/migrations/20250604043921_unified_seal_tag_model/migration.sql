/*
  Warnings:

  - You are about to drop the column `logo` on the `companies` table. All the data in the column will be lost.
  - You are about to drop the column `imageUrl` on the `seal_tags` table. All the data in the column will be lost.
  - You are about to drop the `guard_seal_tags` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[logoId]` on the table `companies` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[sessionId,barcode]` on the table `seal_tags` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `createdById` to the `seal_tags` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "guard_seal_tags" DROP CONSTRAINT "guard_seal_tags_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "guard_seal_tags" DROP CONSTRAINT "guard_seal_tags_verifiedById_fkey";

-- DropIndex
DROP INDEX "seal_tags_barcode_key";

-- AlterTable
ALTER TABLE "companies" DROP COLUMN "logo",
ADD COLUMN     "logoId" TEXT;

-- AlterTable
ALTER TABLE "seal_tags" DROP COLUMN "imageUrl",
ADD COLUMN     "createdById" TEXT NOT NULL,
ADD COLUMN     "guardImageData" TEXT,
ADD COLUMN     "guardMethod" TEXT,
ADD COLUMN     "guardNotes" TEXT,
ADD COLUMN     "guardStatus" TEXT DEFAULT 'UNVERIFIED',
ADD COLUMN     "guardTimestamp" TIMESTAMP(3),
ADD COLUMN     "guardUserId" TEXT,
ADD COLUMN     "imageData" TEXT;

-- DropTable
DROP TABLE "guard_seal_tags";

-- CreateTable
CREATE TABLE "company_owners" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_owners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "company_owners_userId_key" ON "company_owners"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "company_owners_companyId_key" ON "company_owners"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "companies_logoId_key" ON "companies"("logoId");

-- CreateIndex
CREATE UNIQUE INDEX "seal_tags_sessionId_barcode_key" ON "seal_tags"("sessionId", "barcode");

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_logoId_fkey" FOREIGN KEY ("logoId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_owners" ADD CONSTRAINT "company_owners_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_owners" ADD CONSTRAINT "company_owners_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seal_tags" ADD CONSTRAINT "seal_tags_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seal_tags" ADD CONSTRAINT "seal_tags_guardUserId_fkey" FOREIGN KEY ("guardUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
