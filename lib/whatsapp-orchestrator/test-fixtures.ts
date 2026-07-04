import type { OrchestratorContextPack } from "@/lib/whatsapp-orchestrator/context-pack";

/** Minimal euclis-like board for offline orchestrator tests. */
export function mockContextPack(
  userMessage: string,
  opts?: {
    recentTurns?: OrchestratorContextPack["recent_turns"];
    lastTaskShortId?: number | null;
  }
): OrchestratorContextPack {
  return {
    user_message: userMessage,
    workspace_name: "euclis",
    workspace_id: "2aa40ad8-f25f-42e6-a8b5-7f3a13f2689e",
    today: "2026-07-04",
    weekday: "Saturday",
    recent_turns: opts?.recentTurns ?? [],
    board_tasks: [
      {
        shortId: 1,
        title: "Seo Queries",
        status: "IN_PROGRESS",
        priority: "HIGH",
      },
      {
        shortId: 2,
        title: "Stress Test Updates System",
        status: "TODO",
        priority: "MEDIUM",
      },
      {
        shortId: 3,
        title: "Review Q3 Budget",
        status: "TODO",
        priority: "MEDIUM",
      },
      {
        shortId: 4,
        title: "Login Page Redesgin",
        status: "TODO",
        priority: "MEDIUM",
      },
    ],
    last_discussed_task_short_id: opts?.lastTaskShortId ?? 1,
    task_title_hints: ["Seo Queries"],
    pending_flags: { delete_confirm: false, workspace_picker: false },
  };
}
