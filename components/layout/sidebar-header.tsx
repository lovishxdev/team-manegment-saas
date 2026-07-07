"use client";

import Image from "next/image";
import Link from "next/link";
import { X } from "lucide-react";
import { useSidebar } from "@/components/layout/sidebar-context";
import { SHELL_HEADER_H } from "@/components/layout/app-shell-shared";

function CollapseIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      className="h-[19px] w-[19px]"
      stroke="currentColor"
      strokeWidth="1.35"
      aria-hidden
    >
      <rect x="2.5" y="3.5" width="15" height="13" rx="2" />
      <path d="M7.5 3.5v13" />
      {collapsed ? (
        <path d="M13.5 10l-2.5 2.5M13.5 10l-2.5-2.5" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M11 10l2.5 2.5M11 10l2.5-2.5" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

const toggleBtn =
  "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ink-faint transition hover:bg-ink/[0.06] hover:text-ink";

function Logo() {
  return (
    <Image
      src="/euclis-logo.png"
      alt="Euclis"
      width={30}
      height={30}
      className="block h-[30px] w-[30px] shrink-0 rounded-md"
      priority
    />
  );
}

/** Header inside the expanded sidebar rail: logo + collapse toggle. */
export function SidebarHeader() {
  const { toggle, closeMobile } = useSidebar();

  function onToggleClick() {
    if (window.matchMedia("(max-width: 767px)").matches) {
      closeMobile();
      return;
    }
    toggle();
  }

  return (
    <header
      className={`flex ${SHELL_HEADER_H} shrink-0 items-center justify-between border-b border-line bg-paper px-4 md:bg-transparent`}
    >
      <Link href="/dashboard" className="shrink-0" title="Euclis" onClick={closeMobile}>
        <Logo />
      </Link>

      <button
        type="button"
        onClick={onToggleClick}
        className={toggleBtn}
        title="Close menu"
        aria-label="Close menu"
      >
        <span className="md:hidden">
          <X className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <span className="hidden md:inline">
          <CollapseIcon collapsed={false} />
        </span>
      </button>
    </header>
  );
}

/**
 * When collapsed there is no sidebar panel — logo and expand toggle in a
 * compact row at the top; content below uses the full page width.
 */
export function CollapsedTopBar() {
  const { collapsed, toggle } = useSidebar();

  if (!collapsed) return null;

  return (
    <div
      className={`hidden ${SHELL_HEADER_H} shrink-0 items-center gap-3 px-4 md:flex`}
    >
      <Link href="/dashboard" title="Euclis">
        <Logo />
      </Link>
      <button
        type="button"
        onClick={toggle}
        className={toggleBtn}
        title="Expand sidebar"
        aria-label="Expand sidebar"
      >
        <CollapseIcon collapsed />
      </button>
    </div>
  );
}
