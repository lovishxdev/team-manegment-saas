import { AdminOverview } from "@/components/admin/admin-overview";
import { getAdminOverview } from "@/lib/services/admin";

export default async function AdminPage() {
  const overview = await getAdminOverview();

  return <AdminOverview overview={overview} />;
}
