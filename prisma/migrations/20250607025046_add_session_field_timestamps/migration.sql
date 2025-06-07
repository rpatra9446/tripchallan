-- CreateTable
CREATE TABLE "session_field_timestamps" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedById" TEXT NOT NULL,

    CONSTRAINT "session_field_timestamps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "session_field_timestamps_sessionId_fieldName_key" ON "session_field_timestamps"("sessionId", "fieldName");

-- AddForeignKey
ALTER TABLE "session_field_timestamps" ADD CONSTRAINT "session_field_timestamps_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_field_timestamps" ADD CONSTRAINT "session_field_timestamps_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
