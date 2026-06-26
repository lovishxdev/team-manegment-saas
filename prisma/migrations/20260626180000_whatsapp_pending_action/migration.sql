-- CreateTable
CREATE TABLE "WhatsAppPendingAction" (
    "phone" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppPendingAction_pkey" PRIMARY KEY ("phone")
);

-- CreateIndex
CREATE INDEX "WhatsAppPendingAction_expiresAt_idx" ON "WhatsAppPendingAction"("expiresAt");

-- AddForeignKey
ALTER TABLE "WhatsAppPendingAction" ADD CONSTRAINT "WhatsAppPendingAction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
