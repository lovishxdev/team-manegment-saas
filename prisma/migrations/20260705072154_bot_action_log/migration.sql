-- CreateTable
CREATE TABLE "BotActionLog" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "channel" TEXT NOT NULL,
    "tool" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "inverse" JSONB NOT NULL,
    "undoneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BotActionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BotActionLog_userId_workspaceId_createdAt_idx" ON "BotActionLog"("userId", "workspaceId", "createdAt");

-- AddForeignKey
ALTER TABLE "BotActionLog" ADD CONSTRAINT "BotActionLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
