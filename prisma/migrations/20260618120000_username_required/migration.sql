-- Backfill must run first: npm run backfill:usernames
-- Then apply NOT NULL on username.
ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;
