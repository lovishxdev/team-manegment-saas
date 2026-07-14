import { AdminAIUsage } from "@/components/admin/admin-ai-usage";
import { getAdminAIAnalytics } from "@/lib/services/admin-ai";

export default async function AdminAIUsagePage() {
  const analytics = await getAdminAIAnalytics();
  return <AdminAIUsage analytics={analytics} />;
}
