"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Settings } from "lucide-react";
import { signOutAction } from "@/lib/actions/auth";
import { Avatar } from "@/components/ui/ui";

const iconBtn =
  "rounded-lg p-1.5 text-ink-faint transition hover:bg-paper/80 hover:text-ink";

export function SidebarAccount({
  userId,
  userLabel,
}: {
  userId: string;
  userLabel: string | null;
}) {
  const pathname = usePathname();
  const onSettings = pathname === "/settings";
  const displayName = userLabel ?? "Account";

  return (
    <div className="flex items-center gap-2 px-2 py-1">
      <Link
        href="/settings"
        className="shrink-0 rounded-lg transition hover:opacity-90"
        title={displayName}
      >
        <Avatar seed={userId} label={userLabel} size="h-8 w-8 text-xs" />
      </Link>

      <Link
        href="/settings"
        title={displayName}
        className="min-w-0 flex-1 rounded-lg transition hover:bg-paper/50"
      >
        <p className="truncate text-[15px] font-medium text-ink">
          {displayName}
        </p>
      </Link>

      <div className="flex shrink-0 items-center gap-0.5">
        <Link
          href="/settings"
          title="Settings"
          aria-label="Settings"
          aria-current={onSettings ? "page" : undefined}
          className={`${iconBtn} ${onSettings ? "text-ink" : ""}`}
        >
          <Settings className="h-4 w-4" strokeWidth={1.75} />
        </Link>
        <form action={signOutAction}>
          <button
            type="submit"
            title="Sign out"
            aria-label="Sign out"
            className={iconBtn}
          >
            <LogOut className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </form>
      </div>
    </div>
  );
}
