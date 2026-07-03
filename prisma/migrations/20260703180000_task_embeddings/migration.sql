-- Semantic task index for hybrid retrieval (Phase A).
CREATE TABLE "TaskEmbedding" (
    "taskId" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "contentHash" TEXT NOT NULL,
    "embedding" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskEmbedding_pkey" PRIMARY KEY ("taskId")
);

CREATE INDEX "TaskEmbedding_workspaceId_idx" ON "TaskEmbedding"("workspaceId");

ALTER TABLE "TaskEmbedding" ADD CONSTRAINT "TaskEmbedding_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
