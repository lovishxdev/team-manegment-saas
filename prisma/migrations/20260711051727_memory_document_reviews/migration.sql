-- CreateTable
CREATE TABLE "MemoryDocumentReview" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "path" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "title" TEXT,
    "accepted" BOOLEAN NOT NULL,
    "reason" TEXT NOT NULL,
    "explicit" BOOLEAN NOT NULL DEFAULT false,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemoryDocumentReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MemoryDocumentReview_workspaceId_accepted_reviewedAt_idx" ON "MemoryDocumentReview"("workspaceId", "accepted", "reviewedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MemoryDocumentReview_workspaceId_path_key" ON "MemoryDocumentReview"("workspaceId", "path");

-- AddForeignKey
ALTER TABLE "MemoryDocumentReview" ADD CONSTRAINT "MemoryDocumentReview_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
