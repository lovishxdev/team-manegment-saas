# Euclis

**Project memory for teams and coding agents.**

Euclis is a multi-surface team workspace: a web kanban, a WhatsApp assistant, and an MCP connector for tools like Cursor and Claude. All three are thin adapters over one service layer. The research-facing bet is **decision memory** — turn work that normally dies in chat scrollback into structured, queryable records (decisions, blockers, dependencies) that humans and agents can recall without re-deriving context.

Live product: [euclis.dev](https://euclis.dev)

---

## Why it exists

Long AI and team chats are expensive to re-read and impossible to query. Euclis captures what mattered — what was decided, what is blocked, why — as discrete events with author, time, tags, and open/resolved state. Coding agents pull a short relevant brief instead of a wall of history.

Three verbs:

| | |
| --- | --- |
| **Capture** | Quietly classify memory-worthy moments from task updates, WhatsApp, and agent sessions (post-hoc, non-blocking). |
| **Alert** | Ping the right person on WhatsApp when a blocker/dependency appears; confirm-only resolution (nothing auto-closes). |
| **Recall** | Humans and agents ask “why / what’s blocking”; MCP tools and an ambient brief feed coding sessions. |

Deeper write-up: [docs/memory-architecture.md](docs/memory-architecture.md)

---

## Surfaces

```
WhatsApp ─┐
Web UI   ─┼─► Tool registry ─► Services (tasks, memory, whiteboard, …) ─► Postgres / Storage
MCP      ─┘
```

1. **Web** — workspace board, task threads, Memory tab, collaborative Excalidraw whiteboard (including NL “vibe” diagrams).
2. **WhatsApp** — Meta Cloud API webhook; conversational agent with the same tools as MCP; FIFO queue + `wamid` dedupe for Meta retries.
3. **MCP** — Streamable HTTP (`/api/mcp`) for Cursor / Claude; OAuth or personal token; per-connection workspace pin and `context` vs `full` tool scope (enforced server-side).

---

## Stack

| Layer | Choice |
| --- | --- |
| App | Next.js (App Router) |
| Data | Supabase Postgres + Storage + Realtime |
| ORM | Prisma 7 (`@prisma/adapter-pg`, pooled `DATABASE_URL`) |
| Agents | Anthropic SDK (WhatsApp / memory / chat) |
| MCP | `mcp-handler` |

---

## Repository map

```
app/                          Next.js routes (web, MCP, WhatsApp webhook, cron)
lib/services/                 Shared business logic
lib/tools/                    ToolDefs — one catalog for WhatsApp + MCP + web chat
lib/memory/                   Capture, dream cycle, candidates, ambient brief
lib/whiteboard/               NL → diagram DSL → Excalidraw scene
prisma/                       Schema + migrations
docs/                         Architecture and product notes
```

---

## Quick start

```bash
npm install
cp .env.example .env   # fill values — see SETUP.md
npx prisma migrate dev
npm run dev
```

Full setup (Supabase, Anthropic, Meta WhatsApp, MCP): **[SETUP.md](SETUP.md)**

### Useful commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run typecheck` | TypeScript check |
| `npx prisma migrate dev` | Apply schema |
| `npm run check:tools` | Tool registry parity |
| `npm run test:memory` | Memory-layer smoke tests |

---

## Research / architecture notes

- [docs/memory-architecture.md](docs/memory-architecture.md) — capture, alert, recall; candidates, dreaming, ambient hooks  
- [docs/billing-tiers.md](docs/billing-tiers.md) — plan limits and enforcement  
- [docs/design-system.md](docs/design-system.md) — UI tokens  

---

## Security

- Do not commit `.env`. Use `.env.example` as the template.
- WhatsApp webhooks verify `X-Hub-Signature-256` over the raw body.
- MCP scopes and workspace confinement are enforced in dispatch, not only in prompts.
- Local admin (`/admin`) is gated; keep `DEMO_LOGIN` off in public production.

If you find a vulnerability, open a private report rather than a public issue with secrets.

---

## License

MIT — see [LICENSE](LICENSE).
