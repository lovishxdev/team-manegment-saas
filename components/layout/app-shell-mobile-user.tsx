import { requireUserLite } from "@/lib/auth";
import { signOutAction } from "@/lib/actions/auth";
import { displayUser } from "@/lib/username";
import { Avatar } from "@/components/ui/ui";
import { OpenSettingsLink } from "@/components/settings/open-settings-link";

/** Mobile header user chrome — streamed so the shell frame paints first. */
export async function AppShellMobileUser() {
  const user = await requireUserLite();
  const userLabel = displayUser(user);

  return (
    <div className="flex items-center gap-1">
      <OpenSettingsLink className="rounded-lg px-2 py-1 text-xs text-ink-soft">
        Settings
      </OpenSettingsLink>
      <Avatar seed={user.id} label={userLabel} size="h-7 w-7 text-[10px]" />
      <form action={signOutAction}>
        <button
          type="submit"
          title="Sign out"
          aria-label="Sign out"
          className="rounded-lg p-1.5 text-ink-faint transition hover:bg-white/60 hover:text-ink"
        >
          <svg
            viewBox="0 0 16 16"
            fill="none"
            className="h-4 w-4"
            stroke="currentColor"
            strokeWidth="1.3"
          >
            <path d="M6 2H3.5A1.5 1.5 0 0 0 2 3.5v9A1.5 1.5 0 0 0 3.5 14H6M10.5 11l3-3-3-3M13.5 8H6" />
          </svg>
        </button>
      </form>
    </div>
  );
}
