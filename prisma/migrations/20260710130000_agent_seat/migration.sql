-- Ambient coding-agent seats: distinct engineers per workspace (headcount metering).

-- CreateTable
CREATE TABLE "AgentSeat" (
    "workspaceId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentSeat_pkey" PRIMARY KEY ("workspaceId", "userId")
);

-- CreateIndex
CREATE INDEX "AgentSeat_workspaceId_idx" ON "AgentSeat"("workspaceId");

-- AddForeignKey
ALTER TABLE "AgentSeat" ADD CONSTRAINT "AgentSeat_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentSeat" ADD CONSTRAINT "AgentSeat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
