-- Post / PostMessage discussion threads + memory provenance

CREATE TABLE "Post" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "title" TEXT,
    "taskId" UUID,
    "replyCount" INTEGER NOT NULL DEFAULT 0,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PostMessage" (
    "id" UUID NOT NULL,
    "postId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "parentMessageId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PostMessageSave" (
    "id" UUID NOT NULL,
    "messageId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostMessageSave_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PostMessageMention" (
    "id" UUID NOT NULL,
    "messageId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostMessageMention_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "MemoryEvent" ADD COLUMN "sourcePostMessageId" UUID;
ALTER TABLE "MemoryEvent" ADD COLUMN "resolvedByPostMessageId" UUID;

CREATE INDEX "Post_workspaceId_lastActivityAt_idx" ON "Post"("workspaceId", "lastActivityAt");
CREATE INDEX "PostMessage_postId_createdAt_idx" ON "PostMessage"("postId", "createdAt");
CREATE INDEX "PostMessage_parentMessageId_idx" ON "PostMessage"("parentMessageId");
CREATE INDEX "PostMessageSave_userId_createdAt_idx" ON "PostMessageSave"("userId", "createdAt");
CREATE UNIQUE INDEX "PostMessageSave_messageId_userId_key" ON "PostMessageSave"("messageId", "userId");
CREATE INDEX "PostMessageMention_userId_idx" ON "PostMessageMention"("userId");
CREATE UNIQUE INDEX "PostMessageMention_messageId_userId_key" ON "PostMessageMention"("messageId", "userId");

ALTER TABLE "Post" ADD CONSTRAINT "Post_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Post" ADD CONSTRAINT "Post_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Post" ADD CONSTRAINT "Post_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PostMessage" ADD CONSTRAINT "PostMessage_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PostMessage" ADD CONSTRAINT "PostMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PostMessage" ADD CONSTRAINT "PostMessage_parentMessageId_fkey" FOREIGN KEY ("parentMessageId") REFERENCES "PostMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PostMessageSave" ADD CONSTRAINT "PostMessageSave_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "PostMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PostMessageSave" ADD CONSTRAINT "PostMessageSave_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PostMessageMention" ADD CONSTRAINT "PostMessageMention_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "PostMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PostMessageMention" ADD CONSTRAINT "PostMessageMention_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MemoryEvent" ADD CONSTRAINT "MemoryEvent_sourcePostMessageId_fkey" FOREIGN KEY ("sourcePostMessageId") REFERENCES "PostMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MemoryEvent" ADD CONSTRAINT "MemoryEvent_resolvedByPostMessageId_fkey" FOREIGN KEY ("resolvedByPostMessageId") REFERENCES "PostMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
