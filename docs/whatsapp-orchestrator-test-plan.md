# WhatsApp Orchestrator — Smoke & Stress Test Plan

Use this alongside `docs/whatsapp-orchestrator-architecture.md`.

---

## Prerequisites

### Vercel env (production)

```bash
WHATSAPP_ORCHESTRATOR=1
WHATSAPP_JUDGE=1
WHATSAPP_WEBHOOK_DEBUG=1
OPENROUTER_API_KEY=...
ANTHROPIC_API_KEY=...
WHATSAPP_ASK_TASK_SUMMARIZE=1   # default on
```

### Local / CI (offline tests)

```bash
npm run test:orchestrator
```

### RAG stress data (euclis workspace)

```bash
# List tasks
npm run seed:task-updates -- --list

# Seed 20 updates on task #2 (Stress Test Updates System)
npm run seed:task-updates -- \
  --workspace-id 2aa40ad8-f25f-42e6-a8b5-7f3a13f2689e \
  --task-short-id 2 \
  --reset

# Re-index embeddings (recommended for ask_task)
npm run backfill:task-embeddings 2aa40ad8-f25f-42e6-a8b5-7f3a13f2689e -- --updates-only
```

---

## Part 1 — Automated tests (run before every deploy)

### 1a. Deterministic (no API keys, ~1s)

```bash
npm run test:orchestrator
```

Validates **refine rules + routing** after simulated Gemini output:

| Case | Expect intent | Expect route |
|------|---------------|--------------|
| What's on my board | board_list | simple |
| I want to work on seo queries | read_task | simple |
| I have started 2 reddit posts | post_update | simple |
| What's going on with the stress test | ask_task | sonnet |
| Mark seo queries done | update_task | simple |
| switch workspace to euclis | workspace_admin | haiku |
| Add task review Q3 budget | create_task | simple |

### 1b. Live triage (OpenRouter, ~30s)

```bash
npm run test:orchestrator -- --live
```

Same cases but calls **real Gemini Flash**. Fails CI/deploy gate if triage drifted.

### 1c. Triage stress (parallel latency)

```bash
npm run test:orchestrator -- --stress 20
```

Runs 20 parallel triage calls. Watch avg ms and that refine still forces `ask_task`.

---

## Part 2 — Manual WhatsApp smoke (production)

Run in order on **euclis** workspace. Tail logs:

```bash
npm run vercel:logs:whatsapp:live
```

| # | Send | Pass criteria | Log expect |
|---|------|---------------|------------|
| 1 | `What's on my board` | Title-first board, no `#N` | `route simple board_list` |
| 2 | `I want to work on seo queries` | “Got it — *Seo Queries*…” NOT “Posted on” | `read_task` / `judge approve` |
| 3 | `I have started 2 reddit posts` | `Posted on *Seo Queries*` | `post_update` |
| 4 | `What's going on with the stress test` | **Short summary** (budget, BetaCorp, blockers) — NOT 20 bullets | `ask_task summarizing` → `summarized { via: sonnet }` |
| 5 | `What's the current budget?` (on stress task) | Mentions ~$58k or $62k from updates | same |
| 6 | `Mark seo queries done` | `Updated *Seo Queries* → done` | `update_task` |
| 7 | `Add task smoke test item` | `Added *Smoke Test Item*` | `create_task` + buttons |

### Fail phrases (auto-fail)

- `can't post` / `use the web app`
- `Updates (20):` with long bullet list
- `#1` / `#2` in user-facing text
- `Tell me what to add or change — or send menu` (generic fallback)

---

## Part 3 — Stress scenarios

### 3a. RAG + summarize (ask_task)

**Setup:** Stress task seeded with 20 updates + embeddings backfilled.

**Messages to hammer:**

1. `What's going on with the stress test`
2. `What happened with Acme?`
3. `What's the current budget?`
4. `Any blockers?`
5. `Who is working on it?`

**Pass:** Each reply ≤ ~6 sentences or 5 bullets; cites facts from seed narrative (BetaCorp, $58k, Priya, Apple cert).

**Log:** Every message must show `ask_task summarized` — never raw pack.

### 3b. Context threading (5-message thread)

Send without repeating task name:

1. `I want to work on seo queries`
2. `I have started 2 reddit posts`
3. `What's the latest?` *(if ambiguous, acceptable to ask which task)*
4. `Yes post that` *(only after bot offered)*

**Pass:** Message 2 posts to Seo Queries, not wrong task.

### 3c. Queue / rapid fire

Send **5 messages in 30 seconds** (different intents):

```
What's on my board
Add task A
Add task B
Mark seo queries done
What's going on with the stress test
```

**Pass:** All 5 get replies; no duplicate errors; queue drains (`POST ack` in logs).

### 3d. Wrong workspace (if multi-workspace)

1. Switch away from euclis
2. Ask about stress test task

**Pass:** Either switches workspace or says task not found — not hallucinated data.

---

## Part 4 — Log scorecard template

Copy per test session:

```markdown
## Session: YYYY-MM-DD HH:MM

| Message | intent | route | judge | summarized? | Pass |
|---------|--------|-------|-------|-------------|------|
| ...     |        |       |       | y/n         | ✓/✗  |

Notes:
-
```

---

## Part 5 — Next steps (recommended order)

### Immediate (this week)

1. **Run `npm run test:orchestrator` in CI** on every PR touching `lib/whatsapp-*`
2. **Deploy + manual Part 2** after each orchestrator change
3. **Confirm summarize logs** on stress test message

### Short term (2–3 weeks)

4. **Golden conversation tests** — full end-to-end with mocked Prisma or test workspace
5. **Triage observability** — store `{ intent, route, judge, latency_ms }` per message
6. **Expand simple executor** — `switch_workspace`, high-confidence `delete_task` staging
7. **Remove legacy fast-path** when orchestrator stable 2 weeks

### Medium term

8. **Intent planner** — Gemini JSON → `executeIntent()` typed handlers (no 35-tool agent for mutations)
9. **Per-intent latency SLOs** — e.g. simple path p95 < 3s, ask_task p95 < 8s
10. **Optional “full thread” button** — summary default, tap for details

### Long term

11. **Regression dashboard** from stored triage/judge metrics
12. **A/B triage models** (Gemini 2.5 vs 3.5 Flash) on confidence calibration
13. **Multi-workspace stress** — picker + context isolation tests

---

## Quick commands cheat sheet

```bash
# Offline routing tests
npm run test:orchestrator

# + live Gemini
npm run test:orchestrator -- --live

# + parallel stress
npm run test:orchestrator -- --stress 20

# Seed RAG data
npm run seed:task-updates -- --workspace-id <uuid> --task-short-id 2 --reset
npm run backfill:task-embeddings <uuid> -- --updates-only

# Prod logs
npm run vercel:logs:whatsapp:live
```

---

*Related: `docs/whatsapp-orchestrator-architecture.md`*
