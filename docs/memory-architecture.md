# Euclis Memory Architecture — Complete Overview

A self-contained description of the Euclis decision-memory layer, written to
be handed to another AI (or human) for architectural discussion. Everything
here is implemented unless marked as a limitation or open question.

Updated: 2026-07-06.

---

## 1. What this is

Euclis is a team task-management SaaS (web kanban + WhatsApp assistant +
MCP for AI agents). Its memory layer turns project context — which normally
rots inside long chat threads and coding-agent conversations — into
**discrete, structured, queryable records**: what happened, why, who, what
it affects, and whether it is still open.

The product bet: a team (or an AI agent) should never have to re-read
months of scrollback or re-derive context. They ask "why is X this way?" or
start a work session, and the relevant memory is simply *there*.

Three verbs define the system:

- **Capture** — recognize memory-worthy moments quietly, after the fact,
  from wherever work is discussed (task threads, WhatsApp, coding-agent
  sessions). Never interrupt, never add latency, never require anyone to
  say "log this".
- **Alert** — when something is a blocker or dependency, the right person
  is pinged automatically (WhatsApp), without manual tagging.
- **Recall** — humans and agents query memory ("why was X decided",
  "what's blocking") and get short, sourced answers; coding agents
  additionally receive an ambient brief with zero effort.

## 2. Design principles

1. **Euclis is the source of truth.** Memory signals come only from stated
   work — task updates, conversations, agent-session transcripts. Nothing
   is guessed from file edits or repo state; work not reflected into
   Euclis intentionally does not exist for the memory layer.
2. **Capture is post-hoc and fire-and-forget.** Classification runs after
   the response is sent (Next.js `after()`), one cheap LLM call per
   signal. A kill switch (`MEMORY_CAPTURE=0`) disables it entirely.
3. **Judgment, not pattern matching.** Deciding what is memory-worthy is
   done by an LLM applying explicit criteria (§5), never by phrase
   templates — the space of ways people state decisions/blockers is
   unbounded.
4. **Confirm-only resolution.** No signal ever auto-resolves a blocker; the
   system only *asks* the likely resolver (WhatsApp buttons) or *nudges*
   pull-based agents. A wrongly auto-resolved blocker destroys trust.
5. **Enforcement lives server-side.** Agent tool scopes and workspace
   confinement are enforced in the dispatch layer, on the credential — a
   prompt cannot talk its way past them.
6. **Cost discipline through input discipline.** The cost lever is what the
   judge reads (message text only, capped, deduped, throttled), not model
   choice alone.
7. **Decisions are never deleted.** A contradicting decision *supersedes*
   the old one via a link, so "why did this change?" stays answerable
   forever.

## 3. Data model

One table, `MemoryEvent` (Prisma/Postgres via Supabase):

| Field | Meaning |
|---|---|
| `kind` | `DECISION` \| `BLOCKER` \| `DEPENDENCY` \| `MILESTONE` |
| `status` | `OPEN` \| `RESOLVED`. Only blockers/dependencies are ever OPEN; decisions and milestones are born RESOLVED (facts, not open work) |
| `summary` | one line, third person: **what** happened |
| `reasoning` | **why** — the answer to a future "why was X decided" |
| `taskId?` | nullable — workspace-level decisions have no task |
| `sourceUpdateId?` | provenance: the `TaskUpdate` it was extracted from (null for agent-session or explicit captures) |
| `authorId?` | who said/did it |
| `resolvedAt / resolvedById / resolvedByUpdateId` | resolution provenance |
| `supersededByEventId?` | link to the decision that replaced this one (never deleted) |
| `embedding` | JSON vector over summary+reasoning for semantic recall (indexed fire-and-forget) |
| `lastSuggestedAt / suggestionCount / suggestionsSuppressed` | anti-irritation throttles for resolution suggestions |

Deliberately **standalone** (not a flag on `TaskUpdate`) so the layer can
ingest from sources beyond Euclis threads — which it now does (§6).
Row-level security (workspace members read) + Supabase Realtime publication
power the live web UI.

## 4. Capture pipelines

There are three ways memory gets created; all converge on the same table
and the same downstream behavior.

### 4a. Thread capture (task updates)

Every team-visible message is a `TaskUpdate` (web modal, WhatsApp, MCP
`add_task_update`). Posting one schedules an unawaited job that makes **one
Haiku call** (`MEMORY_CAPTURE_MODEL`, forced-tool JSON output). The
classifier sees the update, task context, and the task's existing memory
events, and returns one of:

- `none` — routine chatter (most updates); nothing stored
- `new_event` — kind + summary + reasoning stored as a `MemoryEvent`
- `likely_resolves` — feeds the confirm-only suggestion engine (§7)
- `supersedes_decision` — new decision stored, old one linked as superseded

### 4b. Ambient agent-session capture (agent hooks) — the newest piece

Problem it solves: MCP is pull-based, so relying on the model to
voluntarily call `record_decision` / `get_project_context` made the
coding-agent integration feel like "a normal MCP" — and explicitly telling
the agent "log this to memory" is worthless (anyone can do that). Memory
must build itself as a **side effect of working**.

Mechanism — rides Cursor's hook system, entirely outside the agent loop:

```
Cursor agent run finishes ("stop" hook fires)
        │  hook payload includes transcript_path — the session's
        │  own persisted context; nothing intercepted mid-session
        ▼
.cursor/hooks/euclis-memory.mjs   (local, no deps, fails silent)
        │  reads transcript JSONL
        │  extracts ONLY user/agent message text
        │  (tool output & file diffs never leave the machine)
        │  computes delta since last flush (offset state per conversation
        │  in ~/.cursor/euclis-state/)
        │  skips deltas < 300 chars (they accumulate); caps at 24k chars
        ▼
POST /api/ingest/agent-session    (bearer: personal token or OAuth token;
        │                          workspace-pinned credentials confined
        │                          exactly like MCP tool calls)
        ├──► fire-and-forget: session judge (one Haiku call, §5)
        │        creates MemoryEvents · links tasks · flags supersession
        │        blocker created → WhatsApp ping to assignees
        │        blocker plausibly cleared → confirm-only WhatsApp ask
        │
        └──► response carries the fresh workspace brief
                 │
                 ▼
        hook writes .cursor/rules/euclis-memory.mdc (alwaysApply)
        → every NEW session is born context-aware, zero tool calls
```

Both directions — capture out, context in — cost the user nothing: no tool
calls during the session, no latency, nothing to remember. Server-side
throttles: 2-minute judge cooldown per conversation, 200k request cap.

The same flow runs on **Claude Code**: its `Stop` hook carries the same
idea with different field names (`session_id`/`cwd` instead of
`conversation_id`/`workspace_roots`), and one shared hook script handles
both payloads and both transcript shapes. The brief lands where each agent
auto-loads context — Cursor in `.cursor/rules/euclis-memory.mdc`
(`alwaysApply`), Claude Code in `.claude/euclis-memory.md` imported from
`CLAUDE.md` via an `@` line added once by the installer (so the committed
`CLAUDE.md` never churns).

Install is one command per repo per agent (served by `/api/agent-hooks`,
shown in Settings → connectors):

```bash
curl -fsSL "<origin>/api/agent-hooks?agent=cursor"      | bash -s -- <personal-token>
curl -fsSL "<origin>/api/agent-hooks?agent=claude-code" | bash -s -- <personal-token>
```

It writes the hook script, registers it non-destructively
(`.cursor/hooks.json` / `.claude/settings.json`), stores the credential in
a shared `.euclis.json`, and gitignores the credential and generated
briefs.

**Multi-agent adapter model.** The server side is agent-agnostic; each
agent needs only a thin local adapter: a trigger (end-of-run event),
transcript access, and a brief injection point. Current matrix:

| Agent | Trigger | Transcript | Brief injection | Status |
|---|---|---|---|---|
| Cursor | `stop` hook | `transcript_path` in payload | `.cursor/rules/*.mdc` | shipped |
| Claude Code | `Stop` hook | `transcript_path` in payload | `CLAUDE.md` `@`-import | shipped |
| Codex | lifecycle hooks (`Stop`) | rollout JSONL, `transcript_path` | `AGENTS.md` | feasible, not built |
| OpenCode | JS plugin (`session.status`) | via plugin SDK | `AGENTS.md` | feasible (plugin, not script) |
| Antigravity | no public hooks API | not exposed | reads `AGENTS.md` | baseline tier only |

The universal baseline under the hooks: every agent above speaks MCP and
reads `AGENTS.md`, so the worst case is the voluntary tools + rules
contract; hook adapters are an upgrade tier per agent.

### 4c. Explicit capture

`record_decision` (WhatsApp / MCP / web chat) for things conversation and
transcripts can't show — tribal knowledge, constraints, decisions made
outside any tracked channel. Also the seeding path when onboarding an
existing project (plus `npm run backfill:memory`, which replays task-update
history through the thread classifier with original timestamps).

## 5. The judge criteria

The heart of capture quality. Both judges (thread + session) are LLMs with
a mandate expressed as **tests**, not phrase patterns — a moment is
memory-worthy if it passes ANY of:

1. **Future-why** — someone will later ask "why is it this way?" and the
   code/board alone cannot answer: rationale, alternatives rejected,
   constraints discovered.
2. **Coordination** — a teammate working on the project *in parallel*
   needs it to avoid conflicting or duplicated work, or to know they are
   blocked/unblocked: agreed interfaces, direction changes, blockers,
   dependencies.
3. **Commitment** — it binds future work: a convention, contract,
   tool/library choice, or agreed plan the team is expected to honor.
4. **Onboarding** — someone joining months from now would need it to
   understand why the project is the way it is.

Explicitly failing every test: progress narration (files edited, tests
passed), anything recoverable by reading the repo, unsettled exploration
and dead ends, restatements of already-recorded memory (existing events are
shown to the judge in-prompt for dedupe and supersession detection).

The session judge is tuned stricter than the thread judge because coding
transcripts are far more verbose — "most sessions produce zero events" is
stated as the expected correct output.

## 6. Context delivery (recall surfaces)

| Surface | Mechanism |
|---|---|
| **Ambient brief** (coding agents) | `.cursor/rules/euclis-memory.mdc`, auto-refreshed by the hook after every run: open blockers, current decisions, active tasks + assignees, working agreement. Loads into every new session — no tool call |
| `get_project_context` | on-demand deep pull, query-scoped: relevant decisions (semantic + keyword search) + open blockers for the work at hand |
| `recall_memory` | "why was X decided" — hybrid search over events, returns sourced records |
| `list_blockers` | open blockers/dependencies, workspace-wide or per task |
| Enriched task tools | `read_task` / `ask_task` / `add_task_update` responses append the task's open blockers at exactly the moment an agent touches the task |
| **Web UI** | Memory tab (blockers + timeline + resolve buttons) and a per-task Memory section in the task modal; live via Supabase Realtime |
| **WhatsApp** | the assistant answers memory questions with the same tools |

## 7. Alert + resolution lifecycle

- New OPEN blocker/dependency → WhatsApp ping to the task's assignees
  (excluding the author; creator as fallback).
- Resolution is **confirm-only, always**:
  - WhatsApp: "mark it resolved?" with ✅ Resolved / Not yet buttons —
    rides an existing conversation, never a cold ping.
  - Coding agents (pull-based, no push channel): blocker nudges ride tool
    responses and the ambient brief, instructing the agent to confirm with
    the user before calling `resolve_blocker`.
- Anti-irritation throttles on the event: max 2 suggestions per lifetime,
  1h cooldown, permanent silence after a decline.

## 8. Agent access control

- **Tool scopes on the credential**, enforced in `dispatchMcpTool`:
  `context` (read/query + memory tools + `add_task_update`; no deletes, no
  admin — right-sized for coding agents) vs `full` (complete registry,
  opt-in). WhatsApp is exempt: it authenticates a human by phone.
- **Per-connection workspace confinement**: chosen once on the OAuth
  consent screen, stored on the token. A pinned connection has calls
  naming any other workspace rejected — the agent never has a reason to
  think about other workspaces. The ingest endpoint honors the same pin.
- The personal bearer token uses account-level equivalents.

## 9. Cost model

Per signal, roughly:

| Path | LLM cost |
|---|---|
| Task update | 1 Haiku call (~1–2k tokens in) — most return `none` |
| Agent session run | 1 Haiku call per substantive delta (≤24k chars of message text; cooldown-throttled) — most return zero events |
| Recall query | embedding lookup + no generation (records returned raw) |
| Ambient brief | zero LLM — assembled from the DB on each ingest |

What keeps this flat: message-text-only extraction (tool noise stripped
locally before upload), minimum-delta accumulation, hard caps, per-
conversation cooldowns, in-prompt dedupe against existing events, and
embeddings stored as JSON vectors (no vector-DB infra; pgvector is a
contained later migration if scale demands).

## 10. File map

| Piece | Location |
|---|---|
| Schema (`MemoryEvent`) | `prisma/schema.prisma` |
| Memory service (CRUD, hybrid recall) | `lib/services/memory.ts` |
| Thread capture classifier | `lib/memory/capture.ts` |
| Session judge (ambient) | `lib/memory/agent-capture.ts` |
| Workspace brief builder | `lib/memory/brief.ts` |
| Resolution suggestions (confirm-only) | `lib/memory/suggest.ts` |
| Ingest endpoint | `app/api/ingest/agent-session/route.ts` |
| Hook script + installer | `lib/memory/hooks-snippet.ts`, served by `app/api/agent-hooks/route.ts` |
| Rules snippet (tool-use contract) | `lib/memory/rules-snippet.ts`, served by `app/api/agent-rules/route.ts` |
| Memory tools (5) | `lib/tools/defs/memory.ts` via shared registry `lib/tools/registry.ts` |
| Scope/pin enforcement | `dispatchMcpTool` in `lib/tools/registry.ts` |
| Web UI | Memory tab `app/(app)/w/[workspaceId]/(tabs)/memory/`, task modal section `components/board/task-memory-section.tsx` |
| Background execution | `lib/background-task.ts` (`next/server` `after()`) |
| Backfill | `scripts/backfill-memory-capture.ts` |

## 11. Known limitations & open questions

- **Editor coverage.** Ambient capture ships for Cursor and Claude Code
  (one shared hook script). Codex and OpenCode are feasible next adapters
  (see matrix in §4b); agents without hooks fall back to the rules-snippet
  contract (voluntary tool calls).
- **Judge recall/precision is unmeasured.** The criteria are explicit, but
  there is no evaluation set yet for "should this session have produced an
  event?". A lightweight review affordance (web UI shows provenance;
  events can be superseded/resolved) is the current correction mechanism —
  there is no draft/approval queue before events land.
- **Brief staleness.** The ambient brief refreshes only when a run
  completes in that repo; a blocker recorded from WhatsApp minutes ago
  won't appear until the next run ends (deep pulls via
  `get_project_context` are always live).
- **Conversation-level state is local.** Transcript offsets live in
  `~/.euclis/state/`; wiping it re-sends old transcript text (the
  in-prompt dedupe absorbs this — no duplicate events, but a wasted judge
  call).
- **Single-instance throttles.** The judge cooldown is an in-process TTL
  cache; multi-instance deployments would need a shared store (same noted
  trade-off as the identity cache).
- **Embedding scale.** JSON-vector cosine similarity in app code is fine
  at current scale; pgvector is the contained migration path.
- **Cross-workspace memory.** Events are strictly workspace-scoped; there
  is no org-level memory or cross-project recall.
