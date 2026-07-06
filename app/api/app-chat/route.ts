import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth-api";
import { runAppChat, type AppChatMessage } from "@/lib/app-chat-agent";

export const maxDuration = 60;

function parseMessages(raw: unknown): AppChatMessage[] | null {
  if (!Array.isArray(raw)) return null;
  const messages: AppChatMessage[] = [];
  for (const item of raw) {
    if (
      !item ||
      typeof item !== "object" ||
      (item.role !== "user" && item.role !== "assistant") ||
      typeof item.content !== "string"
    ) {
      return null;
    }
    const content = item.content.trim();
    if (!content) continue;
    messages.push({ role: item.role, content });
  }
  return messages.length > 0 ? messages : null;
}

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
  const messages = parseMessages(record.messages);
  if (!messages) {
    return NextResponse.json({ error: "messages required" }, { status: 400 });
  }

  const pathname =
    typeof record.pathname === "string" ? record.pathname : "/dashboard";

  try {
    const result = await runAppChat({
      userId: user.id,
      pathname,
      messages,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("app-chat error:", err);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
