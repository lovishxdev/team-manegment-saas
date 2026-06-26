/** Fast-path text commands — bypass Haiku. */
import { isWhatsAppGreeting } from "@/lib/whatsapp-bot";
import { parseAssetTagCommand } from "@/lib/whatsapp-asset-tags";

const MENU_PATTERN = /^(menu|help|commands?)$/i;
const BOARD_PATTERN = /^(board|show\s+board|my\s+board)$/i;

export function isMenuCommand(text: string): boolean {
  return MENU_PATTERN.test(text.trim());
}

export function isBoardCommand(text: string): boolean {
  return BOARD_PATTERN.test(text.trim());
}

/** True when the message will go through Haiku (not a fast path). */
export function willUseAiAgent(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (isWhatsAppGreeting(t)) return false;
  if (isMenuCommand(t)) return false;
  if (isBoardCommand(t)) return false;
  if (parseAssetTagCommand(t)) return false;
  return true;
}

export const BUTTON = {
  menuBoard: "menu_board",
  menuHelp: "menu_help",
  menuAdd: "menu_add",
  deleteCancel: "delete_cancel",
  taskStart: (shortId: number) => `task_start_${shortId}`,
  taskDone: (shortId: number) => `task_done_${shortId}`,
  deleteConfirm: (shortId: number) => `delete_confirm_${shortId}`,
} as const;

export function parseButtonId(id: string):
  | { type: "menu_board" }
  | { type: "menu_help" }
  | { type: "menu_add" }
  | { type: "delete_cancel" }
  | { type: "task_start"; shortId: number }
  | { type: "task_done"; shortId: number }
  | { type: "delete_confirm"; shortId: number }
  | null {
  if (id === BUTTON.menuBoard) return { type: "menu_board" };
  if (id === BUTTON.menuHelp) return { type: "menu_help" };
  if (id === BUTTON.menuAdd) return { type: "menu_add" };
  if (id === BUTTON.deleteCancel) return { type: "delete_cancel" };

  const start = id.match(/^task_start_(\d+)$/);
  if (start) return { type: "task_start", shortId: Number(start[1]) };

  const done = id.match(/^task_done_(\d+)$/);
  if (done) return { type: "task_done", shortId: Number(done[1]) };

  const del = id.match(/^delete_confirm_(\d+)$/);
  if (del) return { type: "delete_confirm", shortId: Number(del[1]) };

  return null;
}

export const HELP_TEXT = `*What I can do*

• Add tasks — "add a task to fix the login bug"
• Update tasks — "move #12 to in progress" or "tag #8 marketing, v2"
• Show board — send *board* or tap Board in the menu
• List files — "what files do we have?" or "show uploads"
• Save links — "save link Figma mockups https://figma.com/..."
• List links — "show workspace links"
• Rename workspace — "rename workspace to Product Team" (leader only)
• Upload files — send a photo/document (caption = tags, #N = attach to task)
• Tag files — "tag the last photo booth, marketing"

Send *menu* anytime for quick options.`;

export function linkedGreetingBody(workspaceName: string): string {
  return `You're connected to *${workspaceName}*. Pick an action below — tasks sync to your dashboard instantly.`;
}

export const GREETING_MENU_ROWS = [
  {
    id: BUTTON.menuBoard,
    title: "📋 Board",
    description: "Tasks grouped by status",
  },
  {
    id: BUTTON.menuAdd,
    title: "➕ New task",
    description: "Describe what to create",
  },
  {
    id: BUTTON.menuHelp,
    title: "💡 Help",
    description: "Commands & examples",
  },
] as const;
