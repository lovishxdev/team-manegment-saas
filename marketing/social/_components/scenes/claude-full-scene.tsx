"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ClaudeAssistantText,
  ClaudeChatMock,
  ClaudeMcpToolCard,
  ClaudeUserBubble,
} from "@/marketing/social/_components/claude-chat-mock";
import {
  ChatBoardSplitLayout,
  KANBAN_DEMO_CLASS,
  MobilePhoneFrame,
} from "@/marketing/social/_components/chat-board-layout";
import {
  DemoSceneCaption,
  DemoSceneCaptionSlot,
} from "@/marketing/social/_components/demo-scene-caption";
import {
  KanbanPanel,
  type KanbanTask,
} from "@/marketing/social/_components/kanban-panel";

const USER =
  "Break our hackathon MVP into tasks on Euclis: auth API, landing hero, demo video.";

const ASSISTANT = "I'll create three tasks on your workspace.";

const TOOLS = [
  '{ title: "Wire up auth API", column: "In Progress", id: "#14" }',
  '{ title: "Design landing hero", column: "To Do", id: "#15" }',
  '{ title: "Record walkthrough video", column: "To Do", id: "#16" }',
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

/** Single-play Claude MCP → board sync for the full demo reel. */
export function ClaudeFullScene() {
  const [userText, setUserText] = useState("");
  const [assistantText, setAssistantText] = useState("");
  const [toolCount, setToolCount] = useState(0);
  const [taskCount, setTaskCount] = useState(0);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    setUserText("");
    setAssistantText("");
    setToolCount(0);
    setTaskCount(0);

    let cancelled = false;

    const run = async () => {
      for (let i = 1; i <= USER.length; i++) {
        if (cancelled) return;
        await wait(16);
        setUserText(USER.slice(0, i));
      }
      await wait(500);
      for (let i = 1; i <= ASSISTANT.length; i++) {
        if (cancelled) return;
        await wait(9);
        setAssistantText(ASSISTANT.slice(0, i));
      }
      await wait(400);
      for (let i = 1; i <= TOOLS.length; i++) {
        if (cancelled) return;
        await wait(480);
        setToolCount(i);
      }
      await wait(320);
      for (let i = 1; i <= TASKS.length; i++) {
        if (cancelled) return;
        await wait(440);
        setTaskCount(i);
      }
    };

    void run();
    return () => {
      cancelled = true;
      timers.current.forEach((t) => window.clearTimeout(t));
    };

    function wait(ms: number) {
      return new Promise<void>((resolve) => {
        timers.current.push(window.setTimeout(resolve, ms));
      });
    }
  }, []);

  const boardTasks = useMemo(() => {
    const todo: KanbanTask[] = [];
    const doing: KanbanTask[] = [];
    if (taskCount >= 1) doing.push(TASKS[0]!);
    if (taskCount >= 2) todo.push(TASKS[1]!);
    if (taskCount >= 3) todo.push(TASKS[2]!);
    return { todo, doing, done: [] as KanbanTask[] };
  }, [taskCount]);

  const userTyping = userText.length > 0 && userText.length < USER.length;
  const assistantStreaming =
    assistantText.length > 0 && assistantText.length < ASSISTANT.length;

  return (
    <ChatBoardSplitLayout
      caption={
        <DemoSceneCaptionSlot>
          <DemoSceneCaption>
            Claude MCP · create tasks mid-conversation
          </DemoSceneCaption>
        </DemoSceneCaptionSlot>
      }
      phone={
        <MobilePhoneFrame innerClassName="bg-[#f4f3ee]">
          <ClaudeChatMock
            embedded
            subtitle="Euclis MCP · create_task"
          >
            {userText ? (
              <ClaudeUserBubble showCaret={userTyping}>{userText}</ClaudeUserBubble>
            ) : null}
            {assistantText ? (
              <div className="space-y-2">
                <ClaudeAssistantText showCaret={assistantStreaming}>
                  {assistantText}
                </ClaudeAssistantText>
                {toolCount > 0 ? (
                  <div className="space-y-1.5">
                    {TOOLS.slice(0, toolCount).map((args, idx) => (
                      <ClaudeMcpToolCard key={idx} toolName="create_task" args={args} />
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </ClaudeChatMock>
        </MobilePhoneFrame>
      }
      kanban={
        <KanbanPanel
          className={KANBAN_DEMO_CLASS}
          tasksByColumn={boardTasks}
          statusText={
            taskCount === 0
              ? "Waiting for MCP…"
              : taskCount < 3
                ? "Creating tasks…"
                : "✓ 3 tasks synced"
          }
          pulse={toolCount > 0 && taskCount < 3}
        />
      }
    />
  );
}
