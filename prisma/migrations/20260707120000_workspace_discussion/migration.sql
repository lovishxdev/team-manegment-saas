-- CreateTable
CREATE TABLE "WorkspaceMessage" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceMessageSave" (
    "id" UUID NOT NULL,
    "messageId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceMessageSave_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceMessageMention" (
    "id" UUID NOT NULL,
    "messageId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceMessageMention_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkspaceMessage_workspaceId_createdAt_idx" ON "WorkspaceMessage"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "WorkspaceMessageSave_userId_createdAt_idx" ON "WorkspaceMessageSave"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceMessageSave_messageId_userId_key" ON "WorkspaceMessageSave"("messageId", "userId");

-- CreateIndex
CREATE INDEX "WorkspaceMessageMention_userId_idx" ON "WorkspaceMessageMention"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceMessageMention_messageId_userId_key" ON "WorkspaceMessageMention"("messageId", "userId");

-- AddForeignKey
ALTER TABLE "WorkspaceMessage" ADD CONSTRAINT "WorkspaceMessage_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMessage" ADD CONSTRAINT "WorkspaceMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMessageSave" ADD CONSTRAINT "WorkspaceMessageSave_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "WorkspaceMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMessageSave" ADD CONSTRAINT "WorkspaceMessageSave_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMessageMention" ADD CONSTRAINT "WorkspaceMessageMention_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "WorkspaceMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMessageMention" ADD CONSTRAINT "WorkspaceMessageMention_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
