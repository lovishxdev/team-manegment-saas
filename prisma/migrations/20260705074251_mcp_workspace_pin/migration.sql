-- AlterTable
ALTER TABLE "User" ADD COLUMN     "mcpWorkspaceId" UUID;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_mcpWorkspaceId_fkey" FOREIGN KEY ("mcpWorkspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
