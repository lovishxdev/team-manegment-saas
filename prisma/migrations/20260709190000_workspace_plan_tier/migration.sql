-- Workspace billing tier (entitlements). Limits live in lib/billing/plans.ts.

-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('HOBBY', 'TEAM', 'BUSINESS');

-- AlterTable
ALTER TABLE "Workspace"
  ADD COLUMN "planTier" "PlanTier" NOT NULL DEFAULT 'HOBBY',
  ADD COLUMN "planSource" TEXT NOT NULL DEFAULT 'default',
  ADD COLUMN "planExpiresAt" TIMESTAMP(3);
