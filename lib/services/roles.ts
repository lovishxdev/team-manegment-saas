import type { Role } from "@/lib/generated/prisma/client";

/** Leaders and sub-leaders — the management tier. */
export function isLeadership(role: Role): boolean {
  return role === "LEADER" || role === "SUB_LEADER";
}

/** Read-only external collaborator (client). */
export function isGuest(role: Role): boolean {
  return role === "GUEST";
}

/** Any role that may create/edit/delete content. Guests are read-only. */
export function canWrite(role: Role): boolean {
  return role !== "GUEST";
}
