-- AlterTable
ALTER TABLE "MemoryEvent" ADD COLUMN     "sourceDocumentId" UUID;

-- CreateTable
CREATE TABLE "MemoryDocument" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "path" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "authorId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemoryDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MemoryDocument_workspaceId_updatedAt_idx" ON "MemoryDocument"("workspaceId", "updatedAt");

-- CreateIndex
CREATE INDEX "MemoryDocument_workspaceId_contentHash_idx" ON "MemoryDocument"("workspaceId", "contentHash");

-- CreateIndex
CREATE UNIQUE INDEX "MemoryDocument_workspaceId_path_key" ON "MemoryDocument"("workspaceId", "path");

-- CreateIndex
CREATE INDEX "MemoryEvent_sourceDocumentId_idx" ON "MemoryEvent"("sourceDocumentId");

-- AddForeignKey
ALTER TABLE "MemoryEvent" ADD CONSTRAINT "MemoryEvent_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "MemoryDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryDocument" ADD CONSTRAINT "MemoryDocument_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryDocument" ADD CONSTRAINT "MemoryDocument_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
