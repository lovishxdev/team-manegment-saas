-- Extend WhatsApp chat state into a full session cache (workspace, tasks, updates, blockers).
ALTER TABLE "WhatsAppChatState" ADD COLUMN "workspaceName" TEXT;
ALTER TABLE "WhatsAppChatState" ADD COLUMN "lastTaskTitle" TEXT;
ALTER TABLE "WhatsAppChatState" ADD COLUMN "lastCreatedTaskShortId" INTEGER;
ALTER TABLE "WhatsAppChatState" ADD COLUMN "lastCreatedTaskTitle" TEXT;
ALTER TABLE "WhatsAppChatState" ADD COLUMN "lastUpdateTaskShortId" INTEGER;
ALTER TABLE "WhatsAppChatState" ADD COLUMN "lastUpdateTaskTitle" TEXT;
ALTER TABLE "WhatsAppChatState" ADD COLUMN "lastUpdateBody" TEXT;
ALTER TABLE "WhatsAppChatState" ADD COLUMN "lastUpdateAt" TIMESTAMP(3);
ALTER TABLE "WhatsAppChatState" ADD COLUMN "lastBlockerEventId" UUID;
ALTER TABLE "WhatsAppChatState" ADD COLUMN "lastBlockerSummary" TEXT;
