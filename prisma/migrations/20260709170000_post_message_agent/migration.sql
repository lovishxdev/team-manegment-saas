-- Agent-generated discussion replies (branch to agent)

ALTER TABLE "PostMessage" ADD COLUMN "isAgentGenerated" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PostMessage" ADD COLUMN "agentTriggeredByUserId" UUID;

ALTER TABLE "PostMessage" ADD CONSTRAINT "PostMessage_agentTriggeredByUserId_fkey" FOREIGN KEY ("agentTriggeredByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
