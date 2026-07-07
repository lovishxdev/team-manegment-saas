"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Menu } from "lucide-react";
import { useSidebar } from "@/components/layout/sidebar-context";

export function MobileHeader({ userChrome }: { userChrome: ReactNode }) {
  const { toggleMobile } = useSidebar();

  return (
    <header className="shell-glass sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line/80 px-4 py-2.5 md:hidden">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={toggleMobile}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-paper hover:text-ink"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" strokeWidth={1.75} />
        </button>
        <Link href="/dashboard" className="flex items-center gap-2">
          <Image
            src="/euclis-logo.png"
            alt="Euclis"
            width={32}
            height={32}
            className="h-8 w-8 shrink-0 rounded-md"
            priority
          />
          <span className="sr-only">Euclis</span>
        </Link>
      </div>
      {userChrome}
    </header>
  );
}
