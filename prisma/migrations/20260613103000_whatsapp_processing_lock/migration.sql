-- CreateTable
CREATE TABLE "WhatsAppProcessingLock" (
    "phone" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppProcessingLock_pkey" PRIMARY KEY ("phone")
);
