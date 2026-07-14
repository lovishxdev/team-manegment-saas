-- AlterTable
ALTER TABLE "MemoryModelUsage" ADD COLUMN     "errorCode" TEXT,
ADD COLUMN     "estimatedTokensSaved" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "feature" TEXT NOT NULL DEFAULT 'memory',
ADD COLUMN     "provider" TEXT NOT NULL DEFAULT 'anthropic',
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'SUCCESS',
ADD COLUMN     "userId" UUID;

-- CreateIndex
CREATE INDEX "MemoryModelUsage_userId_createdAt_idx" ON "MemoryModelUsage"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "MemoryModelUsage_feature_createdAt_idx" ON "MemoryModelUsage"("feature", "createdAt");

-- AddForeignKey
ALTER TABLE "MemoryModelUsage" ADD CONSTRAINT "MemoryModelUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
