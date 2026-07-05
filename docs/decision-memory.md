# Decision Memory

A persistent, structured "decision memory" layer built into Euclis. Instead of
project context living inside long chat threads (expensive in tokens,
impossible to query), important moments — decisions, blockers, dependencies,
milestones — are captured as discrete records: **what** happened, **why**,
**who** said it, and what it affects.

Updated: 2026-07-05.

## The three moving pieces

```
any channel (web / WhatsApp / MCP)
        │
        ▼
 createTaskUpdate ──fire-and-forget──▶ capture classifier (Haiku)
        │                                   │
        │                    ┌──────────────┼──────────────────┐
        │                    ▼              ▼                  ▼
        │              MemoryEvent    resolution        supersedes old
        │              (new record)   suggestion        decision (linked)
        │                    │        (confirm-only)
        │                    ▼
        │        open BLOCKER → WhatsApp ping to assignees
        ▼
recall_memory / list_blockers / get_project_context / Memory tab
```

### 1. Capture — quiet, after the fact

Every team-visible message in Euclis is a `TaskUpdate` (web modal, WhatsApp
`add_task_update`, MCP). `createTaskUpdate` in
[lib/services/task-updates.ts](../lib/services/task-updates.ts) fires
`scheduleMemoryCapture(updateId)` — an unawaited job, zero latency added to
posting.

The job ([lib/memory/capture.ts](../lib/memory/capture.ts)) makes **one cheap
Anthropic call** (`MEMORY_CAPTURE_MODEL`, default `claude-haiku-4-5`) with a
forced-tool JSON output. The classifier sees the update, the task context,
and the task's existing memory events (dedupe + resolution detection), and
returns one of:

- `none` — routine chatter, nothing stored (most updates)
- `new_event` — kind + summary ("what") + reasoning ("why") extracted, stored
  as a `MemoryEvent`
- `likely_resolves` — feeds the suggestion engine (**never auto-resolves**)
- `supersedes_decision` — new decision recorded; the old one is linked via
  `supersededByEventId`, never deleted, so "why did this change" stays
  answerable

### 2. Alert — the right person gets pinged

When capture records an open `BLOCKER`/`DEPENDENCY`, `notifyBlockerDetected`
([lib/whatsapp-notify.ts](../lib/whatsapp-notify.ts)) pings the task's
assignees (excluding the author; task creator as fallback) on WhatsApp.
Same constraints as assignment pings: needs `User.phone`, Meta ~24h session
window, silent failure.

### 3. Recall — short answers instead of scrollback

Tools in [lib/tools/defs/memory.ts](../lib/tools/defs/memory.ts), registered
in the shared registry (available on WhatsApp **and** MCP automatically):

| Tool | Use |
|---|---|
| `recall_memory` | "why was X decided", "what happened with Y" — hybrid semantic + keyword search over events |
| `list_blockers` | open blockers/dependencies, workspace-wide or per task |
| `record_decision` | explicit capture ("log this decision") |
| `resolve_blocker` | mark resolved (only after human confirmation) |
| `get_project_context` | session entry point for coding agents: compact brief (decisions + blockers) for the work at hand |

Web UI: the **Memory tab** (`/w/<id>/memory`) shows open blockers + timeline
with resolve buttons; the task modal shows a per-task Memory section with an
open-blocker badge. Both live-update via Supabase Realtime on `MemoryEvent`.

## Resolution: confirm, never guess (v1 rule)

No signal auto-resolves anything. The suggestion engine
([lib/memory/suggest.ts](../lib/memory/suggest.ts)) only *asks*:

- **WhatsApp:** "mark it resolved?" with ✅ Resolved / Not yet buttons
  (rides the conversation the person already has with the bot).
- **MCP/coding agents:** pull-based — no push channel exists. Instead,
  `read_task`, `ask_task`, and `add_task_update` responses append the task's
  open blockers with an instruction to confirm with the user and call
  `resolve_blocker`. Any session touching a task sees its blockers at
  exactly the moment they're relevant.

Anti-irritation rules (tracked on `MemoryEvent`): max 2 suggestions per
blocker lifetime, 1h cooldown, permanent silence after "Not yet"
(`suggestionsSuppressed`), never a standalone unsolicited ping.

Signals come only from structured Euclis events (updates, status changes,
attachments). We never guess from which files were edited — work that isn't
reflected into Euclis doesn't exist for the memory layer; the coding-agent
contract below is what gets it reflected.

## Coding-agent contract + MCP tool scopes

**Contract:** repos add the rules snippet (Memory tab → "Coding-agent rules
snippet", source: [lib/memory/rules-snippet.ts](../lib/memory/rules-snippet.ts)):
call `get_project_context` before starting, `add_task_update` after
meaningful work, `record_decision` when deciding, `resolve_blocker` (after
confirmation) when a blocker clears.

**Scopes** (enforced server-side in `dispatchMcpTool` — a prompt cannot talk
its way past them):

- `context` (default): read/query tools + memory tools + `add_task_update`.
  No deletes, no member/workspace administration. Right-sized for coding
  agents.
- `full`: complete registry, opt-in per user (Settings → Agent access).

Scope lives on the credential (`User.mcpScope`, copied to OAuth tokens at
issuance). WhatsApp always has the full registry — it authenticates a human
by phone and is the conversational management channel.

## Onboarding a project with history

- `npm run backfill:memory [workspaceId]` — runs the capture classifier over
  existing `TaskUpdate` history in chronological order. Events keep their
  **original timestamps**; blockers visibly cleared later in the thread are
  recorded RESOLVED (no suggestion pings for months-old activity).
  Resumable: already-processed updates are skipped.
- Conversational seeding — tell the bot what history can't show: "log a
  decision: …" for architectural choices, constraints, tribal knowledge.
- The Memory tab shows a seed checklist until the workspace has events.

## Environment

| Var | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | capture classifier (shared with the WhatsApp agent) |
| `MEMORY_CAPTURE_MODEL` | classifier model, default `claude-haiku-4-5` |
| `MEMORY_CAPTURE=0` | kill switch — disables capture entirely |
| `OPENROUTER_API_KEY` / `OPENAI_API_KEY` | embeddings for semantic recall (keyword-only fallback without) |

## Testing

- `npm run test:memory` — deterministic tests: scope enforcement, event
  formatting, blocker nudges, suggestion button parsing (in CI).
- `npm run check:tools` — registry parity including the 5 memory tools.
- The classifier itself is an LLM call — validate on staging by posting
  updates like "can't proceed, design files are missing" and checking the
  Memory tab.

## Data model

`MemoryEvent` ([prisma/schema.prisma](../prisma/schema.prisma)): standalone
record (not a flag on `TaskUpdate`) so future sources beyond Euclis threads
stay possible. `sourceUpdateId` = provenance; `taskId` nullable for
workspace-level decisions; embeddings inline (same JSON-vector pattern as
task RAG — pgvector is a later, contained migration if scale demands).
RLS (member read) + Realtime publication in
[supabase/setup.sql](../supabase/setup.sql).
