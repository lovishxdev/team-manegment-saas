import { Suspense } from "react";
import { AccountSettingsDataBridge } from "@/components/settings/account-settings-provider";
import { LoadingCenter } from "@/components/ui/loading";
import { loadAccountSettingsData } from "@/lib/settings/load-account-settings";

async function AccountSettingsDataLoader() {
  const data = await loadAccountSettingsData();
  return <AccountSettingsDataBridge data={data} />;
}

export default function AccountSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Suspense fallback={<LoadingCenter label="Loading settings…" />}>
        <AccountSettingsDataLoader />
      </Suspense>
      {children}
    </>
  );
}
