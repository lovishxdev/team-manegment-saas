-- Backfill @euclis user messages as private; clear bookmarks on agent-only content.

UPDATE "PostMessage"
SET "isAgentPrivate" = true
WHERE "isAgentPrivate" = false
  AND "isAgentGenerated" = false
  AND body ~* '@euclis([^a-z0-9_]|$)';

DELETE FROM "PostMessageSave"
WHERE "messageId" IN (
  SELECT id
  FROM "PostMessage"
  WHERE "isAgentPrivate" = true OR "isAgentGenerated" = true
);
