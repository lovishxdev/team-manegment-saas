-- Self-serve trial marker: one trial per workspace lifetime.

ALTER TABLE "Workspace" ADD COLUMN "trialStartedAt" TIMESTAMP(3);
