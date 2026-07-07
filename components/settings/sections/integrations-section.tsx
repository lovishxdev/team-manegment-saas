import { IntegrationsConnectors } from "@/components/settings/integrations-connectors";
import type { AccountSettingsData } from "@/lib/settings/load-account-settings";

export function IntegrationsSection({ data }: { data: AccountSettingsData }) {
  return <IntegrationsConnectors data={data} />;
}
