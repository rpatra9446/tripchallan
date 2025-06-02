-- CreateTable
CREATE TABLE "seal_tags" (
    "id" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seal_tags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "seal_tags_barcode_key" ON "seal_tags"("barcode");

-- AddForeignKey
ALTER TABLE "seal_tags" ADD CONSTRAINT "seal_tags_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
