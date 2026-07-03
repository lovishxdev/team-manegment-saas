"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

/**
 * Subscribes to Postgres changes via Supabase Realtime and refreshes the
 * App Router tree so the sidebar, dashboard, and pages stay in sync when
 * writes happen through Prisma (web actions, WhatsApp bot, MCP, etc.).
 *
 * Task/Asset/Workspace subscriptions are scoped to the workspaces this user
 * belongs to (Supabase `in` filter) so an edit in someone else's unrelated
 * workspace never triggers a full router.refresh() here.
 */
export function AppRealtimeSync({
  userId,
  workspaceIds,
}: {
  userId: string;
  workspaceIds: string[];
}) {
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Stable string key so the effect doesn't re-subscribe on array identity
  // changes when the membership set is unchanged.
  const workspaceKey = workspaceIds.join(",");

  const refreshNow = useCallback(() => {
    router.refresh();
  }, [router]);

  const refreshDebounced = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      router.refresh();
    }, 500);
  }, [router]);

  useEffect(() => {
    const supabase = createSupabaseBrowser();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    async function connect() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session?.access_token) {
        await supabase.realtime.setAuth(session.access_token);
      }

      const ids = workspaceKey ? workspaceKey.split(",") : [];
      // UUIDs contain hyphens; quote each value so Supabase `in.(…)` parses correctly.
      const quoted = ids.map((id) => `"${id}"`).join(",");
      const wsFilter = ids.length ? `id=in.(${quoted})` : null;
      const wsScopedFilter = ids.length
        ? `workspaceId=in.(${quoted})`
        : null;

      let ch = supabase
        .channel(`app-sync-${userId}`)
        // Membership changes (joined/left a workspace) — always relevant.
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "WorkspaceMembership",
            filter: `userId=eq.${userId}`,
          },
          refreshNow
        );

      // Only subscribe to workspace-scoped tables when the user actually has
      // workspaces; an empty `in.()` filter is invalid.
      if (wsFilter && wsScopedFilter) {
        ch = ch
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "Workspace",
              filter: wsFilter,
            },
            refreshNow
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "Task",
              filter: wsScopedFilter,
            },
            refreshDebounced
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "Asset",
              filter: wsScopedFilter,
            },
            refreshDebounced
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "WorkspaceLink",
              filter: wsScopedFilter,
            },
            refreshDebounced
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "TaskUpdate",
              filter: wsScopedFilter,
            },
            refreshDebounced
          );
      }

      channel = ch.subscribe((status, err) => {
        if (status === "SUBSCRIBED") {
          console.log("[realtime] app shell sync active");
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn(`[realtime] app sync ${status}`, err?.message ?? "");
        }
      });
    }

    connect();

    return () => {
      cancelled = true;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (channel) supabase.removeChannel(channel);
    };
  }, [userId, workspaceKey, refreshNow, refreshDebounced]);

  return null;
}
