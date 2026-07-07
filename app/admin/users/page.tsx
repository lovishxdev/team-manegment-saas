import { AdminUsersTable } from "@/components/admin/admin-users-table";
import { getAdminUserAnalytics } from "@/lib/services/admin";

export default async function AdminUsersPage() {
  const analytics = await getAdminUserAnalytics();

  return <AdminUsersTable analytics={analytics} />;
}
