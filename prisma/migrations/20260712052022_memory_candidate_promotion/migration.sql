-- CreateEnum
CREATE TYPE "MemoryCandidateStatus" AS ENUM ('PENDING', 'PROMOTED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "MemoryCandidateScope" AS ENUM ('SESSION', 'TASK', 'PROJECT');

-- CreateEnum
CREATE TYPE "MemoryCandidateAuthority" AS ENUM ('HUMAN_EXPLICIT', 'DOCUMENT_EXPLICIT', 'AGENT_INFERRED');

-- CreateEnum
CREATE TYPE "MemoryFeedbackReason" AS ENUM ('NOT_USEFUL', 'WRONG_SCOPE', 'DUPLICATE');

-- AlterTable
ALTER TABLE "MemoryEvent" ADD COLUMN     "archiveReason" TEXT,
ADD COLUMN     "captureSource" TEXT NOT NULL DEFAULT 'UNKNOWN';

-- CreateTable
CREATE TABLE "MemoryCandidate" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "taskId" UUID,
    "sourceDocumentId" UUID,
    "authorId" UUID,
    "conversationId" TEXT,
    "kind" "MemoryEventKind" NOT NULL,
    "scope" "MemoryCandidateScope" NOT NULL,
    "authority" "MemoryCandidateAuthority" NOT NULL,
    "status" "MemoryCandidateStatus" NOT NULL DEFAULT 'PENDING',
    "summary" TEXT NOT NULL,
    "reasoning" TEXT,
    "evidenceQuote" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "durabilityScore" INTEGER NOT NULL DEFAULT 0,
    "coordinationScore" INTEGER NOT NULL DEFAULT 0,
    "codeRecoverable" BOOLEAN NOT NULL DEFAULT false,
    "localReversible" BOOLEAN NOT NULL DEFAULT false,
    "criticReason" TEXT,
    "promotedEventId" UUID,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemoryCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemoryFeedback" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "reason" "MemoryFeedbackReason" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemoryFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MemoryCandidate_promotedEventId_key" ON "MemoryCandidate"("promotedEventId");

-- CreateIndex
CREATE INDEX "MemoryCandidate_workspaceId_status_createdAt_idx" ON "MemoryCandidate"("workspaceId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "MemoryCandidate_taskId_status_idx" ON "MemoryCandidate"("taskId", "status");

-- CreateIndex
CREATE INDEX "MemoryCandidate_conversationId_idx" ON "MemoryCandidate"("conversationId");

-- CreateIndex
CREATE INDEX "MemoryFeedback_workspaceId_createdAt_idx" ON "MemoryFeedback"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "MemoryFeedback_eventId_idx" ON "MemoryFeedback"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "MemoryFeedback_eventId_userId_reason_key" ON "MemoryFeedback"("eventId", "userId", "reason");

-- AddForeignKey
ALTER TABLE "MemoryCandidate" ADD CONSTRAINT "MemoryCandidate_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryCandidate" ADD CONSTRAINT "MemoryCandidate_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryCandidate" ADD CONSTRAINT "MemoryCandidate_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "MemoryDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryCandidate" ADD CONSTRAINT "MemoryCandidate_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryCandidate" ADD CONSTRAINT "MemoryCandidate_promotedEventId_fkey" FOREIGN KEY ("promotedEventId") REFERENCES "MemoryEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryFeedback" ADD CONSTRAINT "MemoryFeedback_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryFeedback" ADD CONSTRAINT "MemoryFeedback_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "MemoryEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryFeedback" ADD CONSTRAINT "MemoryFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
