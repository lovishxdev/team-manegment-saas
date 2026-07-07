-- AlterTable
ALTER TABLE "MemoryEvent" ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
