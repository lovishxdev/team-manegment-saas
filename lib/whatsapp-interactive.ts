export const BUTTON = {
  menuBoard: "menu_board",
  menuHelp: "menu_help",
  menuAdd: "menu_add",
  menuSwitch: "menu_switch",
  deleteCancel: "delete_cancel",
  taskStart: (shortId: number) => `task_start_${shortId}`,
  taskDone: (shortId: number) => `task_done_${shortId}`,
  deleteConfirm: (shortId: number) => `delete_confirm_${shortId}`,
  inviteAccept: (inviteId: string) => `invite_accept_${inviteId}`,
  inviteDecline: (inviteId: string) => `invite_decline_${inviteId}`,
  demoteConfirm: (userId: string, role: string) =>
    `demote_confirm_${userId}_${role}`,
  removeConfirm: (userId: string) => `remove_confirm_${userId}`,
  deleteAssetConfirm: (assetId: string) => `delete_asset_confirm_${assetId}`,
  memoryResolveConfirm: (eventId: string) => `mem_resolve_${eventId}`,
  memoryResolveDismiss: (eventId: string) => `mem_dismiss_${eventId}`,
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
  | { type: "invite_accept"; inviteId: string }
  | { type: "invite_decline"; inviteId: string }
  | { type: "demote_confirm"; targetUserId: string; newRole: string }
  | { type: "remove_confirm"; targetUserId: string }
  | { type: "delete_asset_confirm"; assetId: string }
  | { type: "memory_resolve_confirm"; eventId: string }
  | { type: "memory_resolve_dismiss"; eventId: string }
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

  const accept = id.match(
    /^invite_accept_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i
  );
  if (accept) return { type: "invite_accept", inviteId: accept[1] };

  const decline = id.match(
    /^invite_decline_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i
  );
  if (decline) return { type: "invite_decline", inviteId: decline[1] };

  const demote = id.match(
    /^demote_confirm_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})_(MEMBER|SUB_LEADER)$/i
  );
  if (demote) {
    return {
      type: "demote_confirm",
      targetUserId: demote[1],
      newRole: demote[2].toUpperCase(),
    };
  }

  const remove = id.match(
    /^remove_confirm_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i
  );
  if (remove) return { type: "remove_confirm", targetUserId: remove[1] };

  const delAsset = id.match(
    /^delete_asset_confirm_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i
  );
  if (delAsset) {
    return { type: "delete_asset_confirm", assetId: delAsset[1] };
  }

  const memResolve = id.match(
    /^mem_resolve_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i
  );
  if (memResolve) {
    return { type: "memory_resolve_confirm", eventId: memResolve[1] };
  }

  const memDismiss = id.match(
    /^mem_dismiss_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i
  );
  if (memDismiss) {
    return { type: "memory_resolve_dismiss", eventId: memDismiss[1] };
  }

  return null;
}

export const HELP_TEXT = `*Quick guide*

• Plain English — "add a task to fix login", "mark SEO done", "what's on the board?"
• Photos/docs upload on send (caption = tags; task name in caption attaches it)
• Tap *menu* for shortcuts

No workspace yet? *create a workspace called My Team*`;

export function linkedGreetingBody(workspaceName: string): string {
  return `Hey — you're on *${workspaceName}*. What should we tackle?`;
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
