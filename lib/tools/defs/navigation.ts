import { z } from "zod";
import {
  buildAppNavCatalog,
  formatAppNavigationResults,
  searchAppNavigation,
} from "@/lib/app-navigation";
import { ok, type ToolDef } from "@/lib/tools/types";
import { optionalStr } from "@/lib/tools/helpers";

const getAppNavigationTool: ToolDef = {
  name: "get_app_navigation",
  webOnly: true,
  needsWorkspace: false,
  waDescription:
    "Look up where to go in the Euclis web app (dashboard, settings, workspace tabs, invites).",
  mcpDescription:
    "Look up Euclis web app routes for navigation questions.",
  inputShape: {
    query: z
      .string()
      .optional()
      .describe(
        "What the user is trying to find, e.g. invites, whiteboard, dashboard"
      ),
  },
  run: async (input, ctx) => {
    const workspaceId = ctx.web?.workspaceId ?? ctx.workspace?.workspaceId ?? null;
    const workspaceName = ctx.web?.workspaceName ?? ctx.workspace?.workspaceName ?? null;
    const catalog = buildAppNavCatalog(workspaceId, workspaceName);
    const query = optionalStr(input.query);
    const matches = searchAppNavigation(catalog, query);
    return ok(formatAppNavigationResults(matches), { entries: matches });
  },
};

export const navigationTools: ToolDef[] = [getAppNavigationTool];
