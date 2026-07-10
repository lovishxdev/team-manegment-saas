import { getAppBaseUrl } from "@/lib/app-url";

export function GET() {
  const base = getAppBaseUrl().replace(/\/$/, "");

  const body = `# Euclis

> The project brain for your team — and your AI agents. Shared project memory captured from WhatsApp, Claude, Cursor, and the web. Dreaming keeps it current. One brief for humans and agents.

## Product

- **Name:** Euclis
- **URL:** ${base}
- **Category:** Project memory / team collaboration SaaS (with kanban, discussions, MCP)
- **Pricing:** Hobby free forever. Team trial available. Email signup — no credit card required.
- **Target users:** Small teams that ship with AI in the loop — hackathons, side projects, indie startups, study groups.

## Core value

Context shouldn't live in scrollback. Euclis:

1. **Captures** decisions, blockers, and milestones from WhatsApp, Claude, Cursor, and the web
2. **Structures** them into linked project memory
3. **Dreams** on a schedule — merges duplicates, reconciles contradictions, surfaces patterns, files stale items (nothing is deleted)
4. **Shares** one brief with teammates and coding agents via MCP (\`get_project_context\`)

You also get a kanban board, discussions, whiteboard, and assets — but the product is memory, not another place to re-enter tasks.

## Key features

- Project memory (decisions, blockers, dependencies, milestones)
- Dreaming (curated memory on Team+; raw capture on Hobby)
- WhatsApp 1:1 bot (not a group @mention bot)
- Claude / Cursor MCP connector
- Discussions for humans and agents
- Kanban with short IDs (#42)
- Free Hobby tier; WhatsApp + baseline MCP context always included

## Public pages

- Homepage: ${base}/
- Pricing: ${base}/pricing
- Sign up: ${base}/signup
- Sign in: ${base}/login
- Guide — project memory & Dreaming: ${base}/guides/project-memory-dreaming
- Guide — manage tasks from WhatsApp: ${base}/guides/manage-tasks-from-whatsapp
- Guide — Claude MCP / get_project_context: ${base}/guides/claude-mcp-task-board
- Guide — hackathon teams: ${base}/guides/hackathon-task-board
- Comparison — Euclis vs Trello: ${base}/compare/trello
- Comparison — Euclis vs Notion: ${base}/compare/notion
- Comparison — Euclis vs ClickUp: ${base}/compare/clickup
- Comparison — Euclis vs spreadsheets: ${base}/compare/spreadsheets
- Comparison — Euclis vs TaskRio: ${base}/compare/taskrio
- Privacy: ${base}/privacy
- Terms: ${base}/terms

## FAQ (factual)

**What is Euclis?**
Shared project memory for teams and AI agents. Capture from chat and editors; one brief everyone can pull.

**What is Dreaming?**
Scheduled memory maintenance: merge duplicates, reconcile contradictions, surface patterns, archive stale items. Nothing is deleted.

**How do agents use Euclis?**
Via MCP — call get_project_context for the same brief teammates see.

**Can I manage tasks from WhatsApp?**
Yes, private 1:1 bot. Not a WhatsApp group bot.

**Is Euclis free?**
Hobby is free forever. Team adds curated Dreaming and more collaboration features.

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
