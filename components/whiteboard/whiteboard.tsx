"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  Collaborator,
  CollaboratorPointer,
  ExcalidrawImperativeAPI,
  SocketId,
} from "@excalidraw/excalidraw/types";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { saveWhiteboardAction } from "@/lib/actions/workspace";
import { useTheme } from "@/components/theme/theme-provider";
import "@excalidraw/excalidraw/index.css";

// Excalidraw touches window/document at module scope -- client-only import.
const Excalidraw = dynamic(
  async () => (await import("@excalidraw/excalidraw")).Excalidraw,
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-sm text-zinc-500">
        Loading whiteboard...
      </div>
    ),
  }
);

const SAVE_DEBOUNCE_MS = 1500;
const BROADCAST_THROTTLE_MS = 120;
const POINTER_THROTTLE_MS = 33; // ~30fps cursor/laser updates

type PointerPayload = {
  socketId: string;
  username: string;
  pointer: CollaboratorPointer;
  button: "down" | "up";
};

type SaveStatus = "saved" | "saving" | "error";

/**
 * Minimal structural view of an Excalidraw element -- enough for the
 * version-based merge. Every element carries these fields.
 */
type SyncElement = {
  id: string;
  version: number;
  versionNonce: number;
  /** Fractional index string; lexicographic order = z-order. */
  index?: string | null;
  isDeleted?: boolean;
};

/**
 * Merge remote elements into the local scene, element by element.
 * Higher `version` wins; on a tie, the lower `versionNonce` wins
 * (deterministic on both peers, same rule official excalidraw collab uses).
 */
function mergeScenes(
  local: readonly SyncElement[],
  remote: readonly SyncElement[]
): { merged: SyncElement[]; changed: boolean } {
  const map = new Map<string, SyncElement>(local.map((el) => [el.id, el]));
  let changed = false;

  for (const r of remote) {
    const cur = map.get(r.id);
    const remoteWins =
      !cur ||
      r.version > cur.version ||
      (r.version === cur.version && r.versionNonce < cur.versionNonce);
    if (remoteWins) {
      map.set(r.id, r);
      changed = true;
    }
  }

  const merged = Array.from(map.values()).sort((a, b) => {
    const ai = a.index ?? "";
    const bi = b.index ?? "";
    return ai < bi ? -1 : ai > bi ? 1 : 0;
  });
  return { merged, changed };
}

export function Whiteboard({
  workspaceId,
  initialState,
  userLabel,
}: {
  workspaceId: string;
  /** Parsed excalidrawState from the DB ({} when never saved). */
  initialState: Record<string, unknown>;
  /** Shown to other collaborators via presence (email or name). */
  userLabel: string;
}) {
  const { resolved: appTheme } = useTheme();
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [peers, setPeers] = useState(0);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<string | null>(null);
  const lastPersisted = useRef<string | null>(null);
  /** Skip saves when onChange only reflects selection / viewport noise. */
  const lastElementsKey = useRef<string | null>(null);
  const lastFilesKey = useRef<string | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const broadcastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** id -> last version this client has broadcast OR received (echo guard). */
  const syncedVersions = useRef<Map<string, number>>(new Map());
  /** True while we apply a remote update, so onChange doesn't re-save it. */
  const applyingRemote = useRef(false);

  /** Per-tab identity so the same account in two tabs gets two cursors. */
  const tabId = useRef<string>(crypto.randomUUID());
  /** Remote cursors / laser pointers, keyed by the sender's tabId. */
  const collaborators = useRef<Map<SocketId, Collaborator>>(new Map());
  const lastPointerSent = useRef(0);

  const hasContent =
    Array.isArray(initialState.elements) && initialState.elements.length > 0;

  // Treat server-loaded state as already persisted so idle canvas stays "Saved".
  // Theme is intentionally excluded — it's a per-viewer display concern driven
  // by the app theme, not something we persist into the shared document.
  if (lastPersisted.current === null && hasContent) {
    const { theme: _theme, ...persistedAppState } =
      (initialState.appState as Record<string, unknown>) ?? {};
    lastPersisted.current = JSON.stringify({
      elements: initialState.elements,
      appState: persistedAppState,
      files: initialState.files ?? null,
    });
    lastElementsKey.current = JSON.stringify(initialState.elements);
    lastFilesKey.current = JSON.stringify(initialState.files ?? null);
  }

  const initialData = hasContent
    ? {
        elements: initialState.elements as never[],
        appState: {
          ...((initialState.appState as object) ?? {}),
          // Maps/live-session fields don't survive JSON; never restore them.
          collaborators: new Map(),
          theme: appTheme,
        },
        files: (initialState.files as never) ?? undefined,
      }
    : { appState: { theme: appTheme } };

  // --- Durability: debounced save to the DB (local edits only) ------------

  const scheduleSave = useCallback(
    (
      elements: readonly unknown[],
      appState: Record<string, unknown>,
      files: unknown
    ) => {
      // Strip non-serializable / volatile fields before persisting. Theme is a
      // per-viewer display concern, so it is never written to the shared state.
      const {
        collaborators: _collaborators,
        theme: _theme,
        ...persistableAppState
      } = appState;
      const snapshot = JSON.stringify({
        elements,
        appState: persistableAppState,
        files,
      });

      if (snapshot === lastPersisted.current) return;

      latest.current = snapshot;

      if (saveTimer.current) clearTimeout(saveTimer.current);
      setStatus("saving");
      saveTimer.current = setTimeout(async () => {
        const pending = latest.current;
        if (!pending || pending === lastPersisted.current) {
          setStatus("saved");
          return;
        }
        const result = await saveWhiteboardAction(workspaceId, pending);
        if (latest.current === pending) {
          if (!result.error) lastPersisted.current = pending;
          setStatus(result.error ? "error" : "saved");
        }
      }, SAVE_DEBOUNCE_MS);
    },
    [workspaceId]
  );

  // Flush pending save on unmount/navigation.
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (latest.current) {
        void saveWhiteboardAction(workspaceId, latest.current);
      }
    };
  }, [workspaceId]);

  // --- Liveness: throttled broadcast of changed elements -------------------

  const flushBroadcast = useCallback(() => {
    broadcastTimer.current = null;
    const channel = channelRef.current;
    if (!api || !channel) return;

    const scene =
      api.getSceneElementsIncludingDeleted() as readonly SyncElement[];
    const diff = scene.filter(
      (el) => syncedVersions.current.get(el.id) !== el.version
    );
    if (diff.length === 0) return;

    for (const el of diff) syncedVersions.current.set(el.id, el.version);
    void channel.send({
      type: "broadcast",
      event: "scene",
      payload: { elements: diff },
    });
  }, [api]);

  const scheduleBroadcast = useCallback(() => {
    if (broadcastTimer.current) return;
    broadcastTimer.current = setTimeout(flushBroadcast, BROADCAST_THROTTLE_MS);
  }, [flushBroadcast]);

  // --- Presence: remote cursors + laser pointers ---------------------------

  /** Push the collaborators map into Excalidraw (renders cursors/lasers). */
  const renderCollaborators = useCallback(() => {
    if (!api) return;
    applyingRemote.current = true;
    api.updateScene({ collaborators: new Map(collaborators.current) });
    setTimeout(() => {
      applyingRemote.current = false;
    }, 0);
  }, [api]);

  /** Throttled broadcast of the local pointer (cursor position + laser). */
  const sendPointer = useCallback(
    (pointer: CollaboratorPointer, button: "down" | "up") => {
      const channel = channelRef.current;
      if (!channel) return;
      const now = Date.now();
      if (now - lastPointerSent.current < POINTER_THROTTLE_MS) return;
      lastPointerSent.current = now;
      const payload: PointerPayload = {
        socketId: tabId.current,
        username: userLabel,
        pointer,
        button,
      };
      void channel.send({ type: "broadcast", event: "pointer", payload });
    },
    [userLabel]
  );

  // --- Realtime channel: subscribe once the Excalidraw API is ready --------

  useEffect(() => {
    if (!api) return;
    const supabase = createSupabaseBrowser();
    let cancelled = false;

    const applyRemote = (remote: SyncElement[]) => {
      const local =
        api.getSceneElementsIncludingDeleted() as readonly SyncElement[];
      const { merged, changed } = mergeScenes(local, remote);
      if (!changed) return;

      // Whatever we just accepted must not be echoed back out.
      for (const el of remote) syncedVersions.current.set(el.id, el.version);

      applyingRemote.current = true;
      api.updateScene({ elements: merged as never[] });
      setTimeout(() => {
        applyingRemote.current = false;
      }, 0);
    };

    async function connect() {
      // Private channels enforce the realtime.messages RLS policies, so the
      // socket must carry the user's JWT.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session?.access_token) {
        await supabase.realtime.setAuth(session.access_token);
      }

      const channel = supabase.channel(`whiteboard-${workspaceId}`, {
        config: { private: true, broadcast: { self: false } },
      });

      channel
        .on("broadcast", { event: "scene" }, ({ payload }) => {
          const elements = payload?.elements;
          if (Array.isArray(elements)) applyRemote(elements as SyncElement[]);
        })
        .on("broadcast", { event: "pointer" }, ({ payload }) => {
          const p = payload as PointerPayload | undefined;
          if (!p?.socketId || p.socketId === tabId.current) return;
          const key = p.socketId as SocketId;
          collaborators.current.set(key, {
            ...collaborators.current.get(key),
            socketId: key,
            username: p.username,
            pointer: p.pointer,
            button: p.button,
          });
          renderCollaborators();
        })
        .on("presence", { event: "sync" }, () => {
          const state = channel.presenceState<{ socketId?: string }>();
          setPeers(Object.keys(state).length);

          // Drop cursors of peers who left.
          const active = new Set<string>();
          for (const metas of Object.values(state)) {
            for (const meta of metas) {
              if (meta.socketId) active.add(meta.socketId);
            }
          }
          let pruned = false;
          for (const key of collaborators.current.keys()) {
            if (!active.has(key)) {
              collaborators.current.delete(key);
              pruned = true;
            }
          }
          if (pruned) renderCollaborators();
        })
        .subscribe(async (st) => {
          if (st === "SUBSCRIBED") {
            await channel.track({ label: userLabel, socketId: tabId.current });
          } else if (st === "CHANNEL_ERROR" || st === "TIMED_OUT") {
            console.warn("[whiteboard] realtime channel:", st);
          }
        });

      channelRef.current = channel;
    }

    void connect();

    return () => {
      cancelled = true;
      if (broadcastTimer.current) clearTimeout(broadcastTimer.current);
      broadcastTimer.current = null;
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [api, workspaceId, userLabel, renderCollaborators]);

  return (
    <div className="relative h-full w-full">
      <div className="absolute bottom-4 left-4 z-10 flex items-center gap-2">
        {peers > 1 && (
          <div className="rounded-md border border-line bg-paper-deep/80 px-3 py-1 font-mono text-[11px] font-medium text-ink-soft">
            {peers} online
          </div>
        )}
        <div className="pointer-events-none rounded-md border border-line bg-card/95 px-3 py-1 font-mono text-[11px] text-ink-soft shadow-sm backdrop-blur-sm">
          {status === "saving" && "Saving…"}
          {status === "saved" && "Saved"}
          {status === "error" && (
            <span className="text-red-400">Save failed. Check connection</span>
          )}
        </div>
      </div>
      <Excalidraw
        excalidrawAPI={(value) => setApi(value)}
        initialData={initialData}
        theme={appTheme}
        isCollaborating={peers > 1}
        onPointerUpdate={({ pointer, button }) => sendPointer(pointer, button)}
        onChange={(elements, appState, files) => {
          // Remote merges re-trigger onChange; don't save or re-broadcast them.
          if (applyingRemote.current) return;
          scheduleBroadcast();

          const elementsKey = JSON.stringify(elements);
          const filesKey = JSON.stringify(files);
          if (
            elementsKey === lastElementsKey.current &&
            filesKey === lastFilesKey.current
          ) {
            return;
          }
          lastElementsKey.current = elementsKey;
          lastFilesKey.current = filesKey;
          scheduleSave(
            elements,
            appState as unknown as Record<string, unknown>,
            files
          );
        }}
      />
    </div>
  );
}
