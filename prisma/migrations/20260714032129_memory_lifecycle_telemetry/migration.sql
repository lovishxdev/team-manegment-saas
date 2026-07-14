-- CreateEnum
CREATE TYPE "MemoryRetentionTier" AS ENUM ('SHORT', 'LONG', 'PERMANENT');

-- AlterTable
ALTER TABLE "MemoryDreamRun" ADD COLUMN     "details" JSONB;

-- AlterTable
ALTER TABLE "MemoryEvent" ADD COLUMN     "importance" DOUBLE PRECISION NOT NULL DEFAULT 0.65,
ADD COLUMN     "lastRecalledAt" TIMESTAMP(3),
ADD COLUMN     "recallCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "retentionTier" "MemoryRetentionTier" NOT NULL DEFAULT 'LONG';

-- CreateTable
CREATE TABLE "MemoryModelUsage" (
    "id" UUID NOT NULL,
    "workspaceId" UUID,
    "stage" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "cacheReadTokens" INTEGER NOT NULL DEFAULT 0,
    "cacheCreationTokens" INTEGER NOT NULL DEFAULT 0,
    "estimatedCostUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "durationMs" INTEGER NOT NULL,
    "conversationId" TEXT,
    "runId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemoryModelUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MemoryModelUsage_workspaceId_createdAt_idx" ON "MemoryModelUsage"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "MemoryModelUsage_stage_createdAt_idx" ON "MemoryModelUsage"("stage", "createdAt");

-- CreateIndex
CREATE INDEX "MemoryModelUsage_runId_idx" ON "MemoryModelUsage"("runId");

-- AddForeignKey
ALTER TABLE "MemoryModelUsage" ADD CONSTRAINT "MemoryModelUsage_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
