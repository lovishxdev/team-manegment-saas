-- AlterTable
ALTER TABLE "OAuthCode" ADD COLUMN     "scope" TEXT NOT NULL DEFAULT 'context',
ADD COLUMN     "workspaceId" UUID;

-- AlterTable
ALTER TABLE "OAuthToken" ADD COLUMN     "workspaceId" UUID;
