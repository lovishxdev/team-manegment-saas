import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireApiUser } from "@/lib/auth-api";
import { runDiscussionAgentBranch } from "@/lib/discussion-agent-branch";
import { ServiceError } from "@/lib/services/project";

export const maxDuration = 60;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  const user = await requireApiUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const record = body as Record<string, unknown>;
  const workspaceId =
    typeof record.workspaceId === "string" ? record.workspaceId.trim() : "";
  const postId = typeof record.postId === "string" ? record.postId.trim() : "";
  const messageId =
    typeof record.messageId === "string" ? record.messageId.trim() : "";

  if (!UUID_RE.test(workspaceId) || !UUID_RE.test(postId) || !UUID_RE.test(messageId)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const result = await runDiscussionAgentBranch({
      workspaceId,
      postId,
      triggerMessageId: messageId,
      userId: user.id,
    });

    revalidatePath(`/w/${workspaceId}/discussion`);
    revalidatePath(`/w/${workspaceId}/discussion/${postId}`);

    return NextResponse.json({
      messageId: result.messageId,
      body: result.body,
    });
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("discussion branch-agent error:", err);
    return NextResponse.json(
      { error: "Something went wrong running the agent" },
      { status: 500 }
    );
  }
}
