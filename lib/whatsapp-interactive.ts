export const BUTTON = {
  menuBoard: "menu_board",
  menuHelp: "menu_help",
  menuAdd: "menu_add",
  menuSwitch: "menu_switch",
  deleteCancel: "delete_cancel",
  taskStart: (shortId: number) => `task_start_${shortId}`,
  taskDone: (shortId: number) => `task_done_${shortId}`,
  deleteConfirm: (shortId: number) => `delete_confirm_${shortId}`,
} as const;

export function parseButtonId(id: string):
  | { type: "menu_board" }
  | { type: "menu_help" }
  | { type: "menu_add" }
  | { type: "menu_switch" }
  | { type: "delete_cancel" }
  | { type: "task_start"; shortId: number }
  | { type: "task_done"; shortId: number }
  | { type: "delete_confirm"; shortId: number }
  | null {
  if (id === BUTTON.menuBoard) return { type: "menu_board" };
  if (id === BUTTON.menuHelp) return { type: "menu_help" };
  if (id === BUTTON.menuAdd) return { type: "menu_add" };
  if (id === BUTTON.menuSwitch) return { type: "menu_switch" };
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

• Add tasks — describe what you need in plain language
• Update tasks — move, complete, retitle, assign, or tag tasks by #N
• Show board — ask what's on the board or task progress
• List files — ask what photos or documents are uploaded
• Save links — share a URL with a label to bookmark for the team
• List links — ask what links are saved in the workspace
• Rename workspace — ask to rename the workspace (leader only)
• Upload files — send a photo/document (caption = tags, #N = attach to task)
• Tag files — ask to tag or label an uploaded file
• Choose workspace — ask which board to use, or tap *Choose workspace* in the menu

Message me naturally — I'll figure out the right action.`;

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
    description: "Tips & examples",
  },
] as const;
