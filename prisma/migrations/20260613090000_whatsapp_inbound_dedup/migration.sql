-- CreateTable
CREATE TABLE "WhatsAppInboundDedup" (
    "messageId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppInboundDedup_pkey" PRIMARY KEY ("messageId")
);
