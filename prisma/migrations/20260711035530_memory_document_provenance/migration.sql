-- AlterTable
ALTER TABLE "MemoryEvent" ADD COLUMN     "sourceDocumentHash" TEXT,
ADD COLUMN     "sourceDocumentPath" TEXT;

-- CreateIndex
CREATE INDEX "MemoryEvent_workspaceId_sourceDocumentHash_idx" ON "MemoryEvent"("workspaceId", "sourceDocumentHash");
