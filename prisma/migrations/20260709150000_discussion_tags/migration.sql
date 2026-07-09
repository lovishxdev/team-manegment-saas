-- Workspace discussion tags + post topic tags

ALTER TABLE "Post" ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE TABLE "WorkspaceDiscussionTag" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceDiscussionTag_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkspaceDiscussionTag_workspaceId_slug_key" ON "WorkspaceDiscussionTag"("workspaceId", "slug");
CREATE INDEX "WorkspaceDiscussionTag_workspaceId_idx" ON "WorkspaceDiscussionTag"("workspaceId");

ALTER TABLE "WorkspaceDiscussionTag" ADD CONSTRAINT "WorkspaceDiscussionTag_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
