-- Workspace-scoped task categories (defaults + custom).

CREATE TABLE "WorkspaceCategory" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkspaceCategory_workspaceId_slug_key" ON "WorkspaceCategory"("workspaceId", "slug");
CREATE INDEX "WorkspaceCategory_workspaceId_idx" ON "WorkspaceCategory"("workspaceId");

ALTER TABLE "WorkspaceCategory" ADD CONSTRAINT "WorkspaceCategory_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed default categories for every existing workspace.
INSERT INTO "WorkspaceCategory" ("id", "workspaceId", "name", "slug", "sortOrder", "createdAt")
SELECT gen_random_uuid(), w."id", def.name, def.slug, def.sort_order, NOW()
FROM "Workspace" w
CROSS JOIN (
    VALUES
        ('General', 'general', 0),
        ('Frontend', 'frontend', 1),
        ('Backend', 'backend', 2),
        ('Design', 'design', 3)
) AS def(name, slug, sort_order);

ALTER TABLE "Task" ADD COLUMN "categoryId" UUID;

UPDATE "Task" t
SET "categoryId" = c."id"
FROM "WorkspaceCategory" c
WHERE c."workspaceId" = t."workspaceId"
  AND c."slug" = LOWER(t."scope"::text);

UPDATE "Task" t
SET "categoryId" = c."id"
FROM "WorkspaceCategory" c
WHERE t."categoryId" IS NULL
  AND c."workspaceId" = t."workspaceId"
  AND c."slug" = 'general';

ALTER TABLE "Task" ALTER COLUMN "categoryId" SET NOT NULL;

ALTER TABLE "Task" ADD CONSTRAINT "Task_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "WorkspaceCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Task_workspaceId_categoryId_idx" ON "Task"("workspaceId", "categoryId");

ALTER TABLE "Task" DROP COLUMN "scope";

DROP TYPE "TaskScope";
