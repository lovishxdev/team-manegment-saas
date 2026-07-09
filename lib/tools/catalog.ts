import { taskTools } from "@/lib/tools/defs/tasks";
import { workspaceTools } from "@/lib/tools/defs/workspace";
import { memberTools } from "@/lib/tools/defs/members";
import { assetTools } from "@/lib/tools/defs/assets";
import { discussionTools } from "@/lib/tools/defs/discussion";
import { miscTools } from "@/lib/tools/defs/misc";
import { memoryTools } from "@/lib/tools/defs/memory";
import { navigationTools } from "@/lib/tools/defs/navigation";
import type { ToolDef } from "@/lib/tools/types";

/** Canonical tool catalog — single composition point (no dispatch imports). */
export const ALL_TOOLS: ToolDef[] = [
  ...taskTools,
  ...workspaceTools,
  ...memberTools,
  ...assetTools,
  ...discussionTools,
  ...miscTools,
  ...memoryTools,
  ...navigationTools,
];

/** Tools exposed to the WhatsApp agent (everything except web-only). */
export const WHATSAPP_TOOL_NAMES: ReadonlySet<string> = new Set(
  ALL_TOOLS.filter((t) => !t.webOnly).map((t) => t.name)
);

export const KNOWN_TOOL_NAMES: ReadonlySet<string> = new Set(
  ALL_TOOLS.map((t) => t.name)
);
