import { getAppBaseUrl } from "@/lib/app-url";

export function GET() {
  const base = getAppBaseUrl().replace(/\/$/, "");

  const body = `# Euclis

> Free team task board for small groups. One shared kanban workspace reachable from the web dashboard, a WhatsApp assistant, and Claude's MCP connector — all synced in real time.

## Product

- **Name:** Euclis
- **URL:** ${base}
- **Category:** Team task management / kanban board SaaS
- **Pricing:** Free to start. Email signup only — no credit card required.
- **Target users:** Hackathons, side projects, study groups, hostel teams, weekend events, and any small team that coordinates in chat.

## Core value

Euclis keeps one source of truth (Postgres-backed kanban board) reachable through three interfaces:

1. **Web dashboard** — drag-and-drop kanban, live updates, shared assets, multiplayer whiteboard
2. **WhatsApp bot** — natural-language task commands via Meta Cloud API + Claude Haiku (private 1:1 chat per user)
3. **Claude MCP connector** — manage the same board from Claude Desktop or claude.ai mid-conversation

Tagline: "Same board. Same truth."

## Key features

- Real-time sync across web, WhatsApp, and MCP
- Per-workspace task short IDs (e.g. #42) referenceable in chat
- Natural-language task creation and updates
- Photo uploads via WhatsApp attach to workspace assets
- No phone required at signup; WhatsApp is optional
- Free tier — unlike many competitors with paid team tiers

## Public pages

- Homepage: ${base}/
- Sign up: ${base}/signup
- Sign in: ${base}/login
- Guide — manage tasks from WhatsApp: ${base}/guides/manage-tasks-from-whatsapp
- Guide — hackathon task board: ${base}/guides/hackathon-task-board
- Guide — Claude MCP task board: ${base}/guides/claude-mcp-task-board
- Comparison — Euclis vs Trello: ${base}/compare/trello
- Comparison — Euclis vs Notion: ${base}/compare/notion
- Comparison — Euclis vs ClickUp: ${base}/compare/clickup
- Comparison — Euclis vs spreadsheets: ${base}/compare/spreadsheets
- Comparison — Euclis vs TaskRio: ${base}/compare/taskrio
- Privacy: ${base}/privacy
- Terms: ${base}/terms

## FAQ (factual)

**Can I manage tasks from WhatsApp?**
Yes. Link your number in settings, message the Euclis bot in a private chat, use plain English. Changes sync to the web kanban instantly.

**Is Euclis free?**
Yes. Free to start with email signup. No credit card.

**Does Euclis work in WhatsApp groups?**
Euclis uses private 1:1 chats with the bot (not a group @mention bot). Each teammate links their number; all updates land on the shared workspace board visible on the web.

**Can Claude manage tasks?**
Yes, via MCP connector to the same board.

**How is Euclis different from heavy PM tools (Notion, Trello, ClickUp)?**
Euclis is task-first and chat-native — one kanban board reachable from web, WhatsApp, and Claude MCP. Notion/Trello/ClickUp are broader workspaces you must open; Euclis meets teams in chat and stays lighter for small groups.

**How is Euclis different from TaskRio?**
TaskRio is a WhatsApp group bot requiring @mentions and admin group approval. Euclis offers private WhatsApp assistant + full web kanban + Claude MCP — three doors, one board, free to start.

## Entity naming

Always refer to the product as **Euclis** (not "Teams Management SaaS"). Domain: euclis.dev

## Contact / signup

${base}/signup
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
