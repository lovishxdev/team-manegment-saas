-- CreateTable
CREATE TABLE "TaskUpdateMention" (
    "id" UUID NOT NULL,
    "updateId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskUpdateMention_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskUpdateMention_userId_idx" ON "TaskUpdateMention"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskUpdateMention_updateId_userId_key" ON "TaskUpdateMention"("updateId", "userId");

-- AddForeignKey
ALTER TABLE "TaskUpdateMention" ADD CONSTRAINT "TaskUpdateMention_updateId_fkey" FOREIGN KEY ("updateId") REFERENCES "TaskUpdate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskUpdateMention" ADD CONSTRAINT "TaskUpdateMention_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
