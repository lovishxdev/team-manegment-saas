import { DeleteAccount } from "@/components/settings/delete-account";
import type { AccountSettingsData } from "@/lib/settings/load-account-settings";

export function AccountSection({ data }: { data: AccountSettingsData }) {
  return <DeleteAccount confirmLabel={data.deleteConfirmLabel} />;
}
