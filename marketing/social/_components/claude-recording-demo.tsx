"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChatBoardSplitLayout,
  KANBAN_DEMO_CLASS,
  MobilePhoneFrame,
} from "@/marketing/social/_components/chat-board-layout";
import {
  ClaudeAssistantText,
  ClaudeChatMock,
  ClaudeMcpToolCard,
  ClaudeThinkingIndicator,
  ClaudeUserBubble,
} from "@/marketing/social/_components/claude-chat-mock";
import {
  KanbanPanel,
  type KanbanTask,
} from "@/marketing/social/_components/kanban-panel";
import { RecordCanvas } from "@/marketing/social/_components/record-canvas";

type ToolCall = {
  name: string;
  args: string;
};

const USER_PROMPT =
  "Break our hackathon MVP into tasks and add them to our Euclis board: auth API, landing hero, and a demo video.";

const ASSISTANT_INTRO = "I'll create three tasks on your Euclis workspace.";

const TOOL_CALLS: ToolCall[] = [
  {
    name: "create_task",
    args: '{ title: "Wire up auth API", column: "In Progress", id: "#14" }',
  },
  {
    name: "create_task",
    args: '{ title: "Design landing hero", column: "To Do", id: "#15" }',
  },
  {
    name: "create_task",
    args: '{ title: "Record walkthrough video", column: "To Do", id: "#16" }',
  },
];

const TASKS: KanbanTask[] = [
  {
    id: "14",
    chip: "backend",
    chipCls: "bg-orange-100 text-orange-700",
    title: "Wire up auth API",
    assignee: { initial: "A", cls: "bg-orange-100 text-orange-700" },
    meta: "In Progress · #14",
    priorityCls: "bg-amber-50 text-amber-700",
    priorityLabel: "MEDIUM",
  },
  {
    id: "15",
    chip: "design",
    chipCls: "bg-pink-100 text-pink-700",
    title: "Design landing hero",
    assignee: { initial: "L", cls: "bg-blue-100 text-blue-700" },
    meta: "To Do · #15",
    priorityCls: "bg-amber-50 text-amber-700",
    priorityLabel: "MEDIUM",
  },
  {
    id: "16",
    chip: "general",
    chipCls: "bg-gray-100 text-gray-700",
    title: "Record walkthrough video",
    assignee: { initial: "Y", cls: "bg-teal-100 text-teal-700" },
    meta: "To Do · #16",
    priorityCls: "bg-amber-50 text-amber-700",
    priorityLabel: "MEDIUM",
  },
];

type Phase =
  | "hook"
  | "typing-user"
  | "thinking"
  | "streaming"
  | "tools"
  | "tasks-sync"
  | "done"
  | "settle";

const TYPE_MS = 22;
const STREAM_MS = 12;

export function ClaudeRecordingDemo() {
  const [loopKey, setLoopKey] = useState(0);
  const [phase, setPhase] = useState<Phase>("hook");
  const [userText, setUserText] = useState("");
  const [assistantText, setAssistantText] = useState("");
  const [visibleTools, setVisibleTools] = useState(0);
  const [visibleTaskCount, setVisibleTaskCount] = useState(0);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    setUserText("");
    setAssistantText("");
    setVisibleTools(0);
    setVisibleTaskCount(0);
    setPhase("hook");

    let cancelled = false;

    const run = async () => {
      await wait(2200);
      if (cancelled) return;
      setPhase("typing-user");

      for (let i = 1; i <= USER_PROMPT.length; i++) {
        if (cancelled) return;
        await wait(TYPE_MS);
        setUserText(USER_PROMPT.slice(0, i));
      }

      await wait(500);
      setPhase("thinking");
      await wait(1400);

      setPhase("streaming");
      for (let i = 1; i <= ASSISTANT_INTRO.length; i++) {
        if (cancelled) return;
        await wait(STREAM_MS);
        setAssistantText(ASSISTANT_INTRO.slice(0, i));
      }

      await wait(600);
      setPhase("tools");

      for (let i = 1; i <= TOOL_CALLS.length; i++) {
        if (cancelled) return;
        await wait(650);
        setVisibleTools(i);
      }

      await wait(400);
      setPhase("tasks-sync");

      for (let i = 1; i <= TASKS.length; i++) {
        if (cancelled) return;
        await wait(550);
        setVisibleTaskCount(i);
      }

      await wait(300);
      setPhase("done");

      await wait(3200);
      setPhase("settle");
      await wait(800);

      if (!cancelled) setLoopKey((k) => k + 1);
    };

    void run();

    return () => {
      cancelled = true;
      timers.current.forEach((t) => window.clearTimeout(t));
    };

    function wait(ms: number) {
      return new Promise<void>((resolve) => {
        const id = window.setTimeout(resolve, ms);
        timers.current.push(id);
      });
    };
  }, [loopKey]);

  const boardTasks = useMemo(() => {
    const todo: KanbanTask[] = [];
    const doing: KanbanTask[] = [];

    if (visibleTaskCount >= 1) doing.push(TASKS[0]!);
    if (visibleTaskCount >= 2) todo.push(TASKS[1]!);
    if (visibleTaskCount >= 3) todo.push(TASKS[2]!);

    return { todo, doing, done: [] as KanbanTask[] };
  }, [visibleTaskCount]);

  const caption =
    phase === "hook"
      ? "Plan in Claude · Tasks land on the board"
      : phase === "settle" || phase === "done"
        ? "Claude MCP · Same Euclis workspace"
        : undefined;

  const footer =
    phase === "settle" || phase === "done"
      ? "euclis.dev · Completely free · no credit card"
      : undefined;

  return (
    <RecordCanvas caption={caption} footer={footer}>
      <ChatBoardSplitLayout
        phone={
          <ClaudePanel
            userText={userText}
            assistantText={assistantText}
            phase={phase}
            visibleTools={visibleTools}
          />
        }
        kanban={
          <KanbanPanel
            className={KANBAN_DEMO_CLASS}
            tasksByColumn={boardTasks}
            statusText={
              visibleTaskCount === 0
                ? "Waiting for MCP…"
                : visibleTaskCount < 3
                  ? "Creating tasks…"
                  : "✓ 3 tasks synced"
            }
            pulse={phase === "tasks-sync" || phase === "tools"}
          />
        }
      />
    </RecordCanvas>
  );
}

function ClaudePanel({
  userText,
  assistantText,
  phase,
  visibleTools,
}: {
  userText: string;
  assistantText: string;
  phase: Phase;
  visibleTools: number;
}) {
  const showAssistant =
    phase === "streaming" ||
    phase === "tools" ||
    phase === "tasks-sync" ||
    phase === "done" ||
    phase === "settle";

  return (
    <MobilePhoneFrame innerClassName="bg-[#f4f3ee]">
      <ClaudeChatMock embedded subtitle="Euclis MCP · create_task · update_task">
        {phase !== "hook" && userText ? (
          <ClaudeUserBubble showCaret={phase === "typing-user"}>
            {userText}
          </ClaudeUserBubble>
        ) : null}

        {phase === "thinking" ? <ClaudeThinkingIndicator /> : null}

        {showAssistant && assistantText ? (
          <div className="space-y-2">
            <ClaudeAssistantText showCaret={phase === "streaming"}>
              {assistantText}
            </ClaudeAssistantText>

            {visibleTools > 0 ? (
              <div className="space-y-1.5">
                {TOOL_CALLS.slice(0, visibleTools).map((tool, idx) => (
                  <ClaudeMcpToolCard
                    key={`${tool.name}-${idx}`}
                    toolName={tool.name}
                    args={tool.args}
                  />
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </ClaudeChatMock>
    </MobilePhoneFrame>
  );
}
