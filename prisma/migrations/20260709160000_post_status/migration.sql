-- CreateEnum
CREATE TYPE "PostStatus" AS ENUM ('OPEN', 'RESOLVED');

-- AlterTable
ALTER TABLE "Post" ADD COLUMN "status" "PostStatus" NOT NULL DEFAULT 'OPEN';

-- CreateIndex
CREATE INDEX "Post_workspaceId_status_lastActivityAt_idx" ON "Post"("workspaceId", "status", "lastActivityAt");
