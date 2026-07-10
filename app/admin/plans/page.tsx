import { AdminWorkspacePlans } from "@/components/admin/admin-workspace-plans";
import { getAdminWorkspacePlans } from "@/lib/services/admin";

export default async function AdminPlansPage() {
  const workspaces = await getAdminWorkspacePlans();

  return <AdminWorkspacePlans workspaces={workspaces} />;
}
