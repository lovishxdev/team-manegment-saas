"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ui } from "@/components/ui/ui";

const TABS = [
  { id: "board", label: "Overview", path: "" },
  { id: "memory", label: "Memory", path: "/memory" },
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
    /^\/w\/([^/]+)(?:\/(memory|links|assets|whiteboard|settings))?/
  );
  if (!match) return null;

  const workspaceId = match[1];
  const activeTab = match[2] ?? "board";

  return (
    <nav className="flex gap-0.5 overflow-x-auto border-b border-line/80 bg-white/50 px-3 py-1 backdrop-blur-sm md:hidden">
      {TABS.map((tab) => (
        <Link
          key={tab.id}
          href={`/w/${workspaceId}${tab.path}`}
          className={`${ui.tabItem} py-2 text-xs ${tab.id === activeTab ? ui.tabItemActive : ""}`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
