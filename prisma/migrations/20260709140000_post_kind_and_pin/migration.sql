-- Post kinds + pinning (Phase 2)

CREATE TYPE "PostKind" AS ENUM ('DISCUSSION', 'QUESTION', 'ANNOUNCEMENT', 'PROPOSAL');

ALTER TABLE "Post" ADD COLUMN "kind" "PostKind" NOT NULL DEFAULT 'DISCUSSION';
ALTER TABLE "Post" ADD COLUMN "pinned" BOOLEAN NOT NULL DEFAULT false;

DROP INDEX IF EXISTS "Post_workspaceId_lastActivityAt_idx";

CREATE INDEX "Post_workspaceId_pinned_lastActivityAt_idx" ON "Post"("workspaceId", "pinned", "lastActivityAt");
CREATE INDEX "Post_workspaceId_kind_lastActivityAt_idx" ON "Post"("workspaceId", "kind", "lastActivityAt");
CREATE INDEX "Post_taskId_lastActivityAt_idx" ON "Post"("taskId", "lastActivityAt");
