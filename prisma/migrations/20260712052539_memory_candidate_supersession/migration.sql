-- AlterTable
ALTER TABLE "MemoryCandidate" ADD COLUMN     "supersedesEventId" UUID;

-- CreateIndex
CREATE INDEX "MemoryCandidate_supersedesEventId_idx" ON "MemoryCandidate"("supersedesEventId");

-- AddForeignKey
ALTER TABLE "MemoryCandidate" ADD CONSTRAINT "MemoryCandidate_supersedesEventId_fkey" FOREIGN KEY ("supersedesEventId") REFERENCES "MemoryEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
