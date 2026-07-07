import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  getDatabaseTargetLabel,
  isAdminAccessConfigured,
} from "@/lib/admin";
import { AdminNav } from "@/components/admin/admin-nav";
import { ui } from "@/components/ui/ui";

export function AdminShell({
  userLabel,
  children,
}: {
  userLabel: string | null;
  children: ReactNode;
}) {
  const dbHost = getDatabaseTargetLabel();
  const accessRestricted = isAdminAccessConfigured();

  return (
    <div className="min-h-screen">
      <header className="shell-glass sticky top-0 z-20 border-b border-line/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/admin" className="flex items-center gap-2.5">
              <Image
                src="/euclis-logo.png"
                alt="Euclis"
                width={32}
                height={32}
                className="h-8 w-8 shrink-0 rounded-md"
              />
              <span className="text-sm font-semibold text-ink">Admin</span>
            </Link>
            <span className="rounded-full border border-amber-200/80 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
              Local only
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm text-ink-soft">
            {userLabel ? (
              <span className="hidden truncate sm:inline">{userLabel}</span>
            ) : null}
            <Link href="/dashboard" className={`${ui.btnSecondary} px-3 py-1.5 text-xs`}>
              Back to app
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-6">
        <div className="mb-6 space-y-2">
          <div className="rounded-xl border border-line/80 bg-paper/90 px-4 py-3 text-sm text-ink-soft">
            <span className="font-medium text-ink">Database:</span>{" "}
            <code className="font-mono text-xs text-ink">{dbHost}</code>
            <span className="mt-1 block text-xs text-ink-faint">
              Admin is disabled on Vercel. This view reflects whatever{" "}
              <code className="font-mono">DATABASE_URL</code> points at locally.
            </span>
          </div>
          {!accessRestricted ? (
            <div className="rounded-xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm text-amber-900">
              <span className="font-medium">Open access in dev.</span> Set{" "}
              <code className="font-mono text-xs">EUCLIS_ADMIN_USER_ID</code> in{" "}
              <code className="font-mono text-xs">.env</code> to restrict admin to
              your user only.
            </div>
          ) : null}
        </div>

        <AdminNav />
        {children}
      </div>
    </div>
  );
}
