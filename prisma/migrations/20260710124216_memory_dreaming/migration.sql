-- AlterEnum
ALTER TYPE "MemoryEventKind" ADD VALUE 'INSIGHT';

-- AlterTable
ALTER TABLE "MemoryEvent" ADD COLUMN     "archivedAt" TIMESTAMP(3);
