-- CreateTable
CREATE TABLE "WhatsAppChatState" (
    "userId" UUID NOT NULL,
    "lastTaskShortId" INTEGER,
    "workspaceId" UUID,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppChatState_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "WhatsAppChatState" ADD CONSTRAINT "WhatsAppChatState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
