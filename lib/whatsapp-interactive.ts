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

  return null;
}

export const HELP_TEXT = `*What I can do*

• Add tasks — describe what you need in plain language
• Update tasks — move, complete, retitle, assign, or tag tasks by #N
• Task details — ask about a task's tags, assignees, due date, or full info (#N)
• Show board — ask what's on the board or task progress
• List files — ask what photos or documents are uploaded
• Save links — share a URL with a label to bookmark for the team
• List links — ask what links are saved in the workspace
• Rename workspace — ask to rename the workspace (leader only)
• Upload files — send a photo/document (caption = tags, #N = attach to task)
• Attach uploads — ask to attach a previously uploaded photo to a task
• Tag files — ask to tag or label an uploaded file
• Choose workspace — ask which board to use, or tap *Choose workspace* in the menu
• Invite teammates — invite by username, email, or phone (up to 8 at once)
• Create invite link — get a shareable link for anyone to join
• Promote / demote members — change roles (leader only; demotion needs confirmation)
• My tasks / search — find tasks assigned to you or filter by tag, status, etc.
• Workspace list / switch — see workspaces or change active board
• Workspace summary — quick stats (open tasks, members)
• File details / delete — read or remove uploads (delete needs confirmation)
• Edit links — update, pin, or delete saved URLs
• Remove member — kick someone (leader only; needs confirmation)
• Categories — list or create task categories
• Leave workspace — leave the team (only leader guard applies)
• Bulk update — change many tasks at once (status, category, etc.)
• Unassign task — clear all assignees from #N
• Task updates — post or read blockers/notes on #N ("what's pending on task 3?")
• Whiteboard screenshots — send up to 5 images of the team whiteboard

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
