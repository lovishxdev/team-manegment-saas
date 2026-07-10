-- Guest role: read-only external collaborator (Team+ only, excluded from member cap).

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'GUEST';

-- AlterTable: invites carry the role granted on accept (default MEMBER).
ALTER TABLE "WorkspaceInvite" ADD COLUMN "role" "Role" NOT NULL DEFAULT 'MEMBER';
