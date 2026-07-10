-- AlterTable
ALTER TABLE "MemoryEvent" ADD COLUMN     "dreamedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "MemoryDreamRun" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "reviewed" INTEGER NOT NULL DEFAULT 0,
    "merged" INTEGER NOT NULL DEFAULT 0,
    "superseded" INTEGER NOT NULL DEFAULT 0,
    "insights" INTEGER NOT NULL DEFAULT 0,
    "archived" INTEGER NOT NULL DEFAULT 0,
    "skipped" TEXT,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemoryDreamRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MemoryDreamRun_workspaceId_createdAt_idx" ON "MemoryDreamRun"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "MemoryDreamRun_createdAt_idx" ON "MemoryDreamRun"("createdAt");

-- AddForeignKey
ALTER TABLE "MemoryDreamRun" ADD CONSTRAINT "MemoryDreamRun_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
