-- CreateEnum
CREATE TYPE "MemoryEventKind" AS ENUM ('DECISION', 'BLOCKER', 'DEPENDENCY', 'MILESTONE');

-- CreateEnum
CREATE TYPE "MemoryEventStatus" AS ENUM ('OPEN', 'RESOLVED');

-- AlterTable
ALTER TABLE "OAuthToken" ADD COLUMN     "scope" TEXT NOT NULL DEFAULT 'context';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "mcpScope" TEXT NOT NULL DEFAULT 'context';

-- CreateTable
CREATE TABLE "MemoryEvent" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "taskId" UUID,
    "sourceUpdateId" UUID,
    "kind" "MemoryEventKind" NOT NULL,
    "status" "MemoryEventStatus" NOT NULL DEFAULT 'OPEN',
    "summary" TEXT NOT NULL,
    "reasoning" TEXT,
    "authorId" UUID,
    "resolvedAt" TIMESTAMP(3),
    "resolvedByUpdateId" UUID,
    "resolvedById" UUID,
    "supersededByEventId" UUID,
    "embedding" JSONB,
    "contentHash" TEXT,
    "lastSuggestedAt" TIMESTAMP(3),
    "suggestionCount" INTEGER NOT NULL DEFAULT 0,
    "suggestionsSuppressed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemoryEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MemoryEvent_workspaceId_status_kind_idx" ON "MemoryEvent"("workspaceId", "status", "kind");

-- CreateIndex
CREATE INDEX "MemoryEvent_taskId_createdAt_idx" ON "MemoryEvent"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "MemoryEvent_workspaceId_createdAt_idx" ON "MemoryEvent"("workspaceId", "createdAt");

-- AddForeignKey
ALTER TABLE "MemoryEvent" ADD CONSTRAINT "MemoryEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryEvent" ADD CONSTRAINT "MemoryEvent_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryEvent" ADD CONSTRAINT "MemoryEvent_sourceUpdateId_fkey" FOREIGN KEY ("sourceUpdateId") REFERENCES "TaskUpdate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryEvent" ADD CONSTRAINT "MemoryEvent_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryEvent" ADD CONSTRAINT "MemoryEvent_supersededByEventId_fkey" FOREIGN KEY ("supersededByEventId") REFERENCES "MemoryEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
