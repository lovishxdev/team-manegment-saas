-- CreateTable
CREATE TABLE "MemoryMetric" (
    "id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "workspaceId" UUID NOT NULL,
    "metric" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "sum" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "MemoryMetric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MemoryMetric_workspaceId_day_idx" ON "MemoryMetric"("workspaceId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "MemoryMetric_day_workspaceId_metric_key" ON "MemoryMetric"("day", "workspaceId", "metric");
