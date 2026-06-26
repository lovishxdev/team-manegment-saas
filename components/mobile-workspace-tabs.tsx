"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { id: "board", label: "Overview", path: "" },
  { id: "links", label: "Links", path: "/links" },
  { id: "assets", label: "Assets", path: "/assets" },
  { id: "whiteboard", label: "Whiteboard", path: "/whiteboard" },
  { id: "settings", label: "Settings", path: "/settings" },
] as const;

/**
 * Mobile-only workspace tab bar. Derives the active workspace + tab from the
 * URL so it can live in the persistent app layout without per-page props.
 */
export function MobileWorkspaceTabs() {
  const pathname = usePathname();
  const match = pathname.match(
    /^\/w\/([^/]+)(?:\/(links|assets|whiteboard|settings))?/
  );
  if (!match) return null;

  const workspaceId = match[1];
  const activeTab = match[2] ?? "board";

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-line px-4 py-2 md:hidden">
      {TABS.map((tab) => (
        <Link
          key={tab.id}
          href={`/w/${workspaceId}${tab.path}`}
          className={`shrink-0 rounded-lg px-3 py-1.5 text-xs transition ${
            tab.id === activeTab
              ? "bg-paper font-medium text-ink shadow-sm"
              : "text-ink-soft"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
