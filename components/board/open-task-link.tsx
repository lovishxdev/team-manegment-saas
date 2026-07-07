"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  rememberTaskReturnPath,
  taskPath,
} from "@/lib/task-navigation";

export function OpenTaskLink({
  workspaceId,
  shortId,
  className,
  children,
}: {
  workspaceId: string;
  shortId: number;
  className?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <Link
      href={taskPath(workspaceId, shortId)}
      className={className}
      onClick={() => rememberTaskReturnPath(pathname)}
    >
      {children}
    </Link>
  );
}
