-- Semantic index for task update RAG (Phase B).
CREATE TABLE "TaskUpdateEmbedding" (
    "taskUpdateId" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "contentHash" TEXT NOT NULL,
    "embedding" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskUpdateEmbedding_pkey" PRIMARY KEY ("taskUpdateId")
);

CREATE INDEX "TaskUpdateEmbedding_taskId_idx" ON "TaskUpdateEmbedding"("taskId");
CREATE INDEX "TaskUpdateEmbedding_workspaceId_idx" ON "TaskUpdateEmbedding"("workspaceId");

ALTER TABLE "TaskUpdateEmbedding" ADD CONSTRAINT "TaskUpdateEmbedding_taskUpdateId_fkey" FOREIGN KEY ("taskUpdateId") REFERENCES "TaskUpdate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
