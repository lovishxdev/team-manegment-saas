"use server";

import { requireUser } from "@/lib/auth";
import { getDashboardSearchIndex } from "@/lib/services/workspace";

/** Fetched on demand when the user searches — not on initial dashboard paint. */
export async function loadDashboardSearchIndex() {
  const user = await requireUser();
  return getDashboardSearchIndex(user.id);
}
