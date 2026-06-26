/** Fast-path text commands — bypass Haiku. */
const MENU_PATTERN = /^(menu|help|commands?)$/i;
const BOARD_PATTERN = /^(board|show\s+board|my\s+board)$/i;

export function isMenuCommand(text: string): boolean {
  return MENU_PATTERN.test(text.trim());
}

export function isBoardCommand(text: string): boolean {
  return BOARD_PATTERN.test(text.trim());
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
• Update tasks — "move #12 to in progress" or "mark #8 done"
• Show board — send *board* or tap View board
• Upload files — send a photo/document (caption = tags, #N = attach to task)
• Tag files — "tag the last photo booth, marketing"

Send *menu* anytime for these options.`;

export function linkedGreetingBody(workspaceName: string): string {
  return `Hey! You're connected to Euclis (*${workspaceName}*). What would you like to do?`;
}
