"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";
import {
  accountSettingsPath,
  rememberSettingsReturnPath,
  type AccountSettingsSection,
} from "@/lib/account-settings";

type OpenSettingsLinkProps = Omit<ComponentProps<typeof Link>, "href"> & {
  section?: AccountSettingsSection;
};

/** Opens account settings and remembers the current page for modal close. */
export function OpenSettingsLink({
  section,
  onClick,
  ...props
}: OpenSettingsLinkProps) {
  const pathname = usePathname();

  return (
    <Link
      {...props}
      href={section ? accountSettingsPath(section) : "/settings"}
      onClick={(event) => {
        rememberSettingsReturnPath(pathname);
        onClick?.(event);
      }}
    />
  );
}
