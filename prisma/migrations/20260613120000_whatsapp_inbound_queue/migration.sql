-- CreateTable
CREATE TABLE "WhatsAppInboundQueue" (
    "id" UUID NOT NULL,
    "phone" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppInboundQueue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppInboundQueue_messageId_key" ON "WhatsAppInboundQueue"("messageId");

-- CreateIndex
CREATE INDEX "WhatsAppInboundQueue_phone_status_createdAt_idx" ON "WhatsAppInboundQueue"("phone", "status", "createdAt");
