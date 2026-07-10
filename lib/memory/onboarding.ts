import { prisma } from "@/lib/prisma";
import { scheduleBackgroundTask } from "@/lib/background-task";
import { buildWorkspaceBrief } from "@/lib/memory/brief";
import { workspaceFeature } from "@/lib/billing/entitlements";
import { isWithinWhatsAppMessagingWindow } from "@/lib/whatsapp-session";
import { sendWhatsAppText } from "@/lib/whatsapp";
import { workspaceUrl } from "@/lib/app-url";

/** WhatsApp text stays well under the 4096 cap. */
const MAX_BRIEF_CHARS = 1500;

/**
 * Team-only onboarding: when a member joins, send them the "why things are
 * this way" project digest (open blockers, decisions, insights) so they land
 * context-aware. Best-effort over WhatsApp within Meta's session window;
 * silently skips when the member has no reachable number.
 */
export function scheduleOnboardingBrief(
  workspaceId: string,
  userId: string
): void {
  scheduleBackgroundTask("onboarding brief", async () => {
    const enabled = await workspaceFeature(workspaceId, "onboardingBrief");
    if (!enabled) return;

    const [workspace, user] = await Promise.all([
      prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { name: true },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { phone: true },
      }),
    ]);
    if (!workspace || !user?.phone) return;

    if (!(await isWithinWhatsAppMessagingWindow(userId))) return;

    const brief = await buildWorkspaceBrief({
      workspaceId,
      workspaceName: workspace.name,
      userId,
    }).catch(() => null);
    if (!brief) return;

    const trimmed =
      brief.length > MAX_BRIEF_CHARS
        ? `${brief.slice(0, MAX_BRIEF_CHARS)}…`
        : brief;

    const body =
      `👋 Welcome to *${workspace.name}* on Euclis!\n\n` +
      `Here's the current state — decisions, open blockers, and what's in flight — so you're caught up:\n\n` +
      `${trimmed}\n\n` +
      `Open the workspace: ${workspaceUrl(workspaceId)}`;

    await sendWhatsAppText(user.phone, body).catch(() => {});
  });
}
