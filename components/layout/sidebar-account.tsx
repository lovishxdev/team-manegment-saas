"use client";

import { ChevronRight, LogOut } from "lucide-react";
import { signOutAction } from "@/lib/actions/auth";
import { OpenSettingsLink } from "@/components/settings/open-settings-link";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Avatar } from "@/components/ui/ui";

export function SidebarAccount({
  userId,
  userLabel,
}: {
  userId: string;
  userLabel: string | null;
}) {
  const displayName = userLabel ?? "Account";

  return (
    <div className="flex items-center gap-1">
      <OpenSettingsLink
        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2 py-2 transition hover:bg-white/60 dark:hover:bg-white/10"
        title="Account settings"
      >
        <Avatar seed={userId} label={userLabel} size="h-8 w-8 text-xs" />
        <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-ink">
          {displayName}
        </span>
        <ChevronRight
          className="h-4 w-4 shrink-0 text-ink-faint"
          strokeWidth={1.75}
        />
      </OpenSettingsLink>
      <ThemeToggle />
      <form action={signOutAction}>
        <button
          type="submit"
          title="Sign out"
          aria-label="Sign out"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-faint transition hover:bg-white/60 hover:text-ink dark:hover:bg-white/10"
        >
          <LogOut className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </form>
    </div>
  );
}
