"use client";

import { useState, useTransition } from "react";
import { vibeWhiteboardAction } from "@/lib/actions/workspace";
import { ui } from "@/components/ui/ui";

/**
 * Natural-language whiteboard prompt — same vibe_whiteboard pipeline as
 * WhatsApp / MCP / web chat. Live peers pick up the scene via broadcast;
 * this tab reloads so Excalidraw remounts with the saved state.
 */
export function WhiteboardVibeBar({ workspaceId }: { workspaceId: string }) {
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<"replace" | "append">("replace");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    const text = prompt.trim();
    if (!text || pending) return;
    setError(null);
    startTransition(async () => {
      const result = await vibeWhiteboardAction(workspaceId, text, mode);
      if (result.error) {
        setError(result.error);
        return;
      }
      setPrompt("");
      // Remount with server-persisted scene (broadcast may also update peers).
      window.location.reload();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line bg-paper px-4 py-2">
      <input
        type="text"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
        placeholder='Vibe: “Euclis adapters → tool registry → services → memory”'
        disabled={pending}
        className={`${ui.input} h-9 min-w-[16rem] flex-1 text-sm`}
      />
      <select
        value={mode}
        onChange={(e) =>
          setMode(e.target.value === "append" ? "append" : "replace")
        }
        disabled={pending}
        className={`${ui.select} h-9 w-auto text-xs`}
        aria-label="Vibe mode"
      >
        <option value="replace">Replace board</option>
        <option value="append">Append</option>
      </select>
      <button
        type="button"
        onClick={submit}
        disabled={pending || !prompt.trim()}
        aria-busy={pending}
        className={`${ui.btnPrimary} h-9 px-3 text-xs`}
      >
        {pending ? "Drawing…" : "Vibe"}
      </button>
      {error ? <p className={`${ui.errorText} w-full text-xs`}>{error}</p> : null}
    </div>
  );
}
