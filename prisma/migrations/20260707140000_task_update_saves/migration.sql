-- CreateTable
CREATE TABLE "TaskUpdateSave" (
    "id" UUID NOT NULL,
    "updateId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskUpdateSave_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskUpdateSave_userId_createdAt_idx" ON "TaskUpdateSave"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TaskUpdateSave_updateId_userId_key" ON "TaskUpdateSave"("updateId", "userId");

-- AddForeignKey
ALTER TABLE "TaskUpdateSave" ADD CONSTRAINT "TaskUpdateSave_updateId_fkey" FOREIGN KEY ("updateId") REFERENCES "TaskUpdate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskUpdateSave" ADD CONSTRAINT "TaskUpdateSave_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
