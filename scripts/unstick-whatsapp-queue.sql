UPDATE "WhatsAppInboundQueue" SET status = 'pending' WHERE status = 'processing';
DELETE FROM "WhatsAppProcessingLock";
