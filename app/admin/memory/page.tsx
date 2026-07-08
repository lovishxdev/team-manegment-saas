import { AdminMemory } from "@/components/admin/admin-memory";
import { getAdminMemoryAnalytics } from "@/lib/services/admin-memory";

export default async function AdminMemoryPage() {
  const analytics = await getAdminMemoryAnalytics();

  return <AdminMemory analytics={analytics} />;
}
