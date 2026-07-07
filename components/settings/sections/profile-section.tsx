import { UsernameForm } from "@/components/settings/username-form";
import type { AccountSettingsData } from "@/lib/settings/load-account-settings";

export function ProfileSection({ data }: { data: AccountSettingsData }) {
  const { user } = data;

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-soft">
        Signed in as{" "}
        <span className="font-mono text-xs text-ink">@{user.username}</span>
        {user.email ? (
          <>
            {" "}
            (
            <span className="font-mono text-xs text-ink-faint">{user.email}</span>
            )
          </>
        ) : null}
        . Your username is shown to teammates on boards and member lists.
      </p>
      <UsernameForm currentUsername={user.username} />
    </div>
  );
}
