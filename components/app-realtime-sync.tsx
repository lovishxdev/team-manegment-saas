"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

/**
 * Subscribes to Postgres changes via Supabase Realtime and refreshes the
 * App Router tree so the sidebar, dashboard, and pages stay in sync when
 * writes happen through Prisma (web actions, WhatsApp bot, MCP, etc.).
 */
export function AppRealtimeSync({ userId }: { userId: string }) {
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

      channel = supabase
        .channel(`app-sync-${userId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "WorkspaceMembership",
            filter: `userId=eq.${userId}`,
          },
          refreshNow
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "Workspace",
          },
          refreshNow
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "Task",
          },
          refreshDebounced
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "Asset",
          },
          refreshDebounced
        )
        .subscribe((status, err) => {
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
  }, [userId, refreshNow, refreshDebounced]);

  return null;
}
