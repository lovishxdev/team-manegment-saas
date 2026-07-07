import type { AccountSettingsSection } from "@/lib/account-settings";
import type { AccountSettingsData } from "@/lib/settings/load-account-settings";
import { AccountSection } from "@/components/settings/sections/account-section";
import { IntegrationsSection } from "@/components/settings/sections/integrations-section";
import { ProfileSection } from "@/components/settings/sections/profile-section";
import { WhatsAppSection } from "@/components/settings/sections/whatsapp-section";

export function AccountSettingsSectionBody({
  section,
  data,
}: {
  section: AccountSettingsSection;
  data: AccountSettingsData;
}) {
  const body = (() => {
    switch (section) {
      case "profile":
        return <ProfileSection data={data} />;
      case "whatsapp":
        return <WhatsAppSection data={data} />;
      case "integrations":
        return <IntegrationsSection data={data} />;
      case "account":
        return <AccountSection data={data} />;
      default:
        return <ProfileSection data={data} />;
    }
  })();

  const fillsPanel = section === "integrations";

  return (
    <div
      className={
        fillsPanel
          ? "flex h-full min-h-0 flex-col"
          : "h-full min-h-0 overflow-y-auto"
      }
    >
      {body}
    </div>
  );
}
