import { z } from "zod";
import {
  buildAppNavCatalog,
  findWorkspaceMentionInQuery,
  formatAppNavigationResults,
  searchAppNavigation,
} from "@/lib/app-navigation";
import { resolveUserWorkspaceContext } from "@/lib/services/project";
import { ok, type ToolDef } from "@/lib/tools/types";
import { optionalStr, workspaceParam } from "@/lib/tools/helpers";

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
        "What the user is trying to find, e.g. invites, whiteboard, dashboard, settings page of Acme workspace"
      ),
    workspace: workspaceParam,
  },
  run: async (input, ctx) => {
    const userId = ctx.userId;
    const query = optionalStr(input.query);
    const explicitWorkspace = optionalStr(input.workspace);

    let workspaceId =
      ctx.web?.workspaceId ?? ctx.workspace?.workspaceId ?? null;
    let workspaceName =
      ctx.web?.workspaceName ?? ctx.workspace?.workspaceName ?? null;
    let workspaceResolved = Boolean(workspaceId);

    if (explicitWorkspace) {
      try {
        const resolved = await resolveUserWorkspaceContext(
          userId,
          explicitWorkspace
        );
        workspaceId = resolved.workspaceId;
        workspaceName = resolved.workspaceName;
        workspaceResolved = true;
      } catch {
        // Keep current context if the hint doesn't match.
      }
    } else if (query) {
      const fromQuery = await findWorkspaceMentionInQuery(userId, query);
      if (fromQuery) {
        workspaceId = fromQuery.workspaceId;
        workspaceName = fromQuery.workspaceName;
        workspaceResolved = true;
      }
    }

    const catalog = buildAppNavCatalog(workspaceId, workspaceName);
    const matches = searchAppNavigation(catalog, query, { workspaceResolved });
    return ok(formatAppNavigationResults(matches), { entries: matches });
  },
};

export const navigationTools: ToolDef[] = [getAppNavigationTool];
