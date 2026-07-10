"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ui } from "@/components/ui/ui";

const links = [
  { href: "/admin", label: "Overview", exact: true },
  { href: "/admin/users", label: "Users", exact: false },
  { href: "/admin/memory", label: "Memory", exact: false },
  { href: "/admin/plans", label: "Plans", exact: false },
] as const;

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Admin sections"
      className="mb-6 flex flex-wrap gap-2 border-b border-line/70 pb-4"
    >
      {links.map((link) => {
        const active = link.exact
          ? pathname === link.href
          : pathname.startsWith(link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-lg px-3 py-1.5 text-sm transition ${
              active
                ? "bg-ink font-medium text-white shadow-sm dark:text-on-accent"
                : "text-ink-soft hover:bg-paper-deep/70 hover:text-ink"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
