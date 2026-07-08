import { AccountSettingsSectionBody } from "@/components/settings/account-settings-section-body";
import {
  parseAccountSettingsSection,
} from "@/lib/account-settings";
import { loadAccountSettingsData } from "@/lib/settings/load-account-settings";

export async function AccountSettingsSectionContent({
  sectionSegments,
}: {
  sectionSegments?: string[];
}) {
  const section = parseAccountSettingsSection(sectionSegments);
  const data = await loadAccountSettingsData();
  return <AccountSettingsSectionBody section={section} data={data} />;
}
