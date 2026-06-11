-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "taskId" UUID;

-- CreateIndex
CREATE INDEX "Asset_taskId_idx" ON "Asset"("taskId");

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
