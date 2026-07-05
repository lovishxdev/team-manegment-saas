# WhatsApp Agent Architecture

_Last updated: 2026-07-05. Replaces the retired triage-orchestrator design._

## Design principle

The WhatsApp bot is structurally identical to the MCP connector — a thin
channel over a shared tool registry — plus a chat loop. Code owns truth
(tools, task resolution, formatting); one capable model classifies, calls
tools, and composes answers. There is no triage router, no LLM judge, and
no regex intent layer.

```
WhatsApp message (Meta webhook)
  │  verify signature → dedup → per-phone FIFO queue
  │  deterministic shortcuts: greeting/menu, buttons, workspace picker, media
  ▼
Single agent loop            lib/whatsapp-agent-loop.ts
  model: WHATSAPP_AGENT_MODEL (default claude-sonnet-4-5)
  tools: all 39 from the shared registry (tool-search deferral for rare ones)
  prompt caching: tools + system cached (~90% off repeated input)
  │
  ▼
Shared tool registry         lib/tools/registry.ts + lib/tools/defs/*
  one ToolDef per tool → Anthropic schema + MCP registration + dispatch
  channel-aware handlers (WhatsApp: session, staging, confirm buttons)
  │
  ▼
Services layer               lib/services/*, lib/bot/extended-tools.ts
  CRUD, RAG (ask_task), invites, links, assets — unchanged by channel
  │
  ▼
Deterministic reply guard    lib/whatsapp-reply-guard.ts   (no LLM)
  *bold* normalization · #N stripping · refusal fallback ·
  RAG-pack compression · length cap
  │
  ▼
Graph API send (+ typing indicator refresh every 12s during work)
```

## Reply composition rules

| Tool class | Final reply comes from |
|---|---|
| Mutations (create/update/delete/post/invite) + board list | Deterministic tool output — model leaves final text empty |
| Inquiries (`ask_task`, `read_task`, `list_task_updates`, `find_task`, `search_tasks`, …) | The model's own composed answer (2–5 sentences, facts from tool results only) |
| No tools ran | Model text (greeting/chit-chat) |

`ask_task` keeps the RAG-in-code design: `buildTaskContextPack` fetches the
task + update thread (embeddings + keyword + typo-tolerant title matching),
and the agent summarizes it in-loop — no separate summarize call.

## State

- **Conversation window** — `WhatsAppMessage` rows, last 2h / 12 turns.
- **Last discussed task** — `WhatsAppChatState` table (userId → shortId +
  workspaceId). Written when tools resolve a task; read on the next message.
  Ignored across workspaces or after the 2h window. Mining previous bot
  replies for titles is only a fallback for pre-table conversations.
- **Pending confirmations** — `WhatsAppPendingAction` (delete/demote/remove
  staging with Confirm/Cancel buttons), unchanged.

## Task resolution (single path)

`resolveWhatsAppTaskShortId` (lib/whatsapp-tool-guard.ts):
explicit #N from the model → persisted last-discussed task → title match
against the board (`resolveTaskFromBoard`, typo-tolerant, ambiguity returns
a "which one?" pick list). Runs inside the task tools, not in a router.

## Testing

| Command | What it covers |
|---|---|
| `npm run test:whatsapp` | Reply guard rules, typo-tolerant title matching, progress/affirmation heuristics |
| `npm run check:tools` | Registry ↔ schema parity, enums/descriptions, MCP surface |
| `npm run typecheck` | Whole project |

All three run in CI (`.github/workflows/ci.yml`). Rule: when a real
conversation misbehaves, add a test case and fix the prompt or tool
description — never add a regex layer.

### Manual smoke (after deploy)

1. `What's on my board` → title-first board list
2. `Add task review Q3 budget` → "Created *Review Q3 Budget*"
3. `Mark it done` → resolves from chat state, no "which task?"
4. `I have started 2 reddit posts` → posts update on discussed task
5. `What's going on with <task>` (typo'd name) → short composed answer, not a dump
6. Delete a task → Confirm/Cancel buttons, nothing deleted until confirm

## Environment

| Var | Purpose |
|---|---|
| `WHATSAPP_AGENT_MODEL` | Agent model (default `claude-sonnet-4-5`; set `claude-haiku-4-5` to trade quality for cost) |
| `ANTHROPIC_API_KEY` | Agent |
| `OPENROUTER_API_KEY` / `OPENAI_API_KEY` | Embeddings for ask_task RAG only |
| `WHATSAPP_TOOL_SEARCH` | `0` disables deferred tool loading |
| `WHATSAPP_WEBHOOK_DEBUG` | `1` for verbose webhook logs |

Retired (no longer read): `WHATSAPP_ORCHESTRATOR`, `WHATSAPP_JUDGE`,
`WHATSAPP_TRIAGE_MODEL`, `WHATSAPP_JUDGE_MODEL`, `WHATSAPP_SIMPLE_MODEL`,
`WHATSAPP_COMPLEX_MODEL`, `WHATSAPP_ASK_TASK_SUMMARIZE`,
`WHATSAPP_SONNET_POLISH`, `WHATSAPP_SIMPLE_CONFIDENCE`.

## Cost

One Sonnet conversation per message (multi-turn only when tools chain).
With prompt caching on tools + system, per-message cost is roughly at parity
with the old Flash-triage + Haiku + judge pipeline, with 1–3 fewer sequential
LLM hops of latency and one model to tune instead of four.
