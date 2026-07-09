# Discussion system — shipped work & reference

Team-wide **Discussions** (standalone threads) replaced the old flat `WorkspaceMessage` feed. Task-scoped notes remain **Task Updates** on the board — they are separate products.

---

## Product distinction

| Feature | Scope | Where |
|--------|--------|--------|
| **Task Updates** | Notes on a specific task | Task page → Updates |
| **Discussion** | Workspace-wide threads; optional task link | Discussion tab |

---

## Phase 1 — core primitive (done)

### Data model

- **`Post`** — thread container (`title?`, `replyCount`, `lastActivityAt`, optional `taskId`)
- **`PostMessage`** — messages in a thread; exactly one opener per post (`parentMessageId = null`)
- **`PostMessageMention`** — @mentions on messages
- **`PostMessageSave`** — per-user bookmarks
- **`MemoryEvent`** — `sourcePostMessageId` / `resolvedByPostMessageId` for memory capture from discussions
- **`WorkspaceMessage`** — kept for legacy; app reads/writes `Post` / `PostMessage` for new UI

### Backend

- `lib/services/post.ts` — CRUD, feed, thread, saves, replies
- `lib/actions/discussion.ts` — server actions for the UI
- `lib/post-title.ts` — feed title (60 char preview), full thread title (no persisted truncation bug)
- `lib/post-thread.ts` — threading depth / display helpers
- `lib/memory/capture.ts` — `captureFromPostMessage`, `schedulePostMessageMemoryCapture`

### UI & routes

- **`/w/[workspaceId]/discussion`** — feed (`DiscussionFeed`)
- **`/w/[workspaceId]/discussion/[postId]`** — thread (`DiscussionThread`)
- Tab label stays **Discussion** (not “Posts”)
- Threading: 2-level visual indent + “↳ replying to @x” for deeper replies
- Compose with @mentions (`UpdateCompose`)

### Migration & realtime

- Migration: `prisma/migrations/20260709120000_posts`
- Script: `scripts/migrate-workspace-messages-to-posts.ts` (`WorkspaceMessage` → `Post` + opener `PostMessage`; uses `DIRECT_URL` + `dotenv`)
- Supabase realtime: `Post`, `PostMessage` in publication + replica identity (`supabase/setup.sql`)

### Title fix

- New posts store `title: null` unless explicit
- Feed truncates at display; thread shows full opener via `postThreadTitle()`
- Legacy truncated DB titles are healed at read time when title ends with `…`

---

## Phase 1 additions (done)

### Saved messages tab

- **Discussions | Saved** tabs on the feed
- Saved list: message row + link to parent discussion (“In {title}”)
- Bookmark from thread message menu; unsave/delete from Saved tab
- Ordered by save time (`PostMessageSave.createdAt`)

---

## Phase 2 — kinds, pinning, task linking (done)

### Schema (`20260709140000_post_kind_and_pin`)

- **`PostKind`** enum: `DISCUSSION`, `QUESTION`, `ANNOUNCEMENT`, `PROPOSAL`
- **`Post.kind`** (default `DISCUSSION`)
- **`Post.pinned`** (default `false`); feed sorts pinned first

### UI

- Kind badges on feed cards and thread header
- Kind filter pills + kind picker when composing
- **Pin / unpin** — leaders & sub-leaders only
- **Task linking** — optional task on create; link/update/remove on thread
- **`TaskLinkedDiscussions`** on task page (below Updates): list + start linked discussion
- **`TaskLinkPicker`** — searchable task picker for linking

### MCP / WhatsApp tools (`lib/tools/defs/discussion.ts`)

| Tool | Purpose |
|------|---------|
| `create_post` | Start a discussion (kind, task #, mentions) |
| `reply_to_post` | Reply by title/snippet/id |
| `list_discussions` | Recent threads (pinned first, optional kind filter) |

Included in MCP **context** scope (`lib/tools/registry.ts`).

---

## Custom workspace tags (done)

### Schema (`20260709150000_discussion_tags`)

- **`Post.tags`** — `String[]` of tag slugs on each post
- **`WorkspaceDiscussionTag`** — workspace vocabulary (`name`, `slug`, up to 24 per workspace)

### UI & behavior

- Filter bar: built-in kinds + custom tags + **Add tag**
- Tag toggles when composing a new discussion
- Tag chips on feed cards
- **Client-side filtering** from one cached post list (no server round-trip per tab click)
- Filter-specific empty states (“No questions yet” vs “No discussions yet”)
- Stale-fetch guard + stable Supabase subscription (no reconnect on filter change)

### Backend

- `lib/services/discussion-tags.ts` — list/create tags, validate slugs
- `fetchDiscussionTagsAction`, `createDiscussionTagAction`

---

## Key files

| Area | Path |
|------|------|
| Schema | `prisma/schema.prisma` |
| Post service | `lib/services/post.ts` |
| Discussion tags | `lib/services/discussion-tags.ts` |
| Server actions | `lib/actions/discussion.ts` |
| Titles | `lib/post-title.ts` |
| Mentions / @euclis | `lib/mentions.ts` |
| Kinds | `lib/post-kind.ts` |
| Feed UI | `components/discussion/discussion-feed.tsx` |
| Filter bar | `components/discussion/discussion-filter-bar.tsx` |
| Thread UI | `components/discussion/discussion-thread.tsx` |
| Message row | `components/discussion/post-message-row.tsx` |
| Agent branch | `lib/discussion-agent-branch.ts` |
| Branch API | `app/api/discussion/branch-agent/route.ts` |
| Saved / top tabs | `components/discussion/discussion-tabs.tsx` |
| Task link (task page) | `components/discussion/task-linked-discussions.tsx` |
| Task picker | `components/discussion/task-link-picker.tsx` |
| Memory | `lib/memory/capture.ts` |
| Migration script | `scripts/migrate-workspace-messages-to-posts.ts` |
| Discussion seed samples | `scripts/seed-discussion-samples.ts` (`npm run seed:discussions`) |
| Bot tools | `lib/tools/defs/discussion.ts` |
| Legacy (task updates only) | `components/discussion/discussion-section.tsx` |

---

## Deploy / ops checklist

```bash
npx prisma migrate deploy
npx tsx scripts/migrate-workspace-messages-to-posts.ts   # once, if legacy messages exist
# Re-run supabase/setup.sql publication block if realtime is stale
```

Env: migration script needs `DIRECT_URL` (and `.env` loaded).

---

## Phase 3 — close / resolve threads (done)

### Schema (`20260709160000_post_status`)

- **`PostStatus`** enum: `OPEN`, `RESOLVED` (same values as `MemoryEventStatus`)
- **`Post.status`** (default `OPEN`)

### Behavior

- **Close / reopen** — post author, leader, or sub-leader (same tier as task linking; pin remains leader-only)
- **Closed threads** — fully readable; new replies blocked at the service layer (`createPostReply` returns a clear error)
- **Memory on close** — closing a `QUESTION` or `PROPOSAL` schedules `captureFromPostClosed` (full transcript + close signal); provenance uses opener `sourcePostMessageId`, author = whoever closed the thread

### UI

- Thread header: **Close / Reopen** next to pin; **Closed** badge; compose replaced with a closed notice
- Feed cards: **Closed** pill + muted card styling

### API

- `setPostStatus` in `lib/services/post.ts`
- `setDiscussionStatusAction` in `lib/actions/discussion.ts`

---

## Phase 3 — branch to agent (done)

### Schema (`20260709170000_post_message_agent`)

- **`PostMessage.isAgentGenerated`** — `true` for agent-authored replies
- **`PostMessage.agentTriggeredByUserId`** — FK to the user who clicked “Branch to agent”

### Behavior

- Any workspace member can **Branch to agent** from a message menu (opener or reply)
- Type **@euclis** in a reply (or new discussion) to ask the agent inline — same branch flow; your message is also **private** (only you see it and the agent reply)
- Agent runs an Anthropic tool loop with the user’s MCP scope; workspace is pinned to the discussion’s workspace
- **`create_post`** and **`reply_to_post`** are excluded from branch tools (agent replies in-thread only)
- Final reply is posted as a threaded child of the trigger message via `createAgentBranchReply`
- **Private to requester** — `@euclis` messages and agent replies are only visible to you; hidden from feed for others when the opener is private; no public reply-count or feed activity bump
- **Private agent titles** — feed/saved headers show `Private agent conversation` instead of leaking the `@euclis` question text (`PRIVATE_AGENT_DISCUSSION_TITLE` in `lib/post-title.ts`)
- **No bookmarks on agent content** — `isAgentPrivate` and `isAgentGenerated` messages cannot be saved; Save is hidden in the message menu; existing saves were cleared by backfill migration
- Displayed as **Euclis agent** with ink/amber brand styling and Euclis logo avatar; “Requested by @user” shows who triggered it
- **Closed threads** block branching (same as new replies)
- **MCP workspace pin mismatch** returns a clear error if the user’s MCP scope is pinned to another workspace
- Memory capture runs on agent messages when enabled (`schedulePostMessageMemoryCapture`)

### Schema (`20260709180000_post_message_agent_private`)

- **`PostMessage.isAgentPrivate`** — `true` when the message body mentions `@euclis` (set on create via `bodyMentionsAgent()`)

### @euclis mentions (`lib/mentions.ts`)

- **`AGENT_MENTION_HANDLE`** = `euclis`; shown first in compose autocomplete with Euclis logo (`discussionMentionMembers()`)
- **`@euclis` in compose** — excluded from teammate mention resolution (`resolveDiscussionMentionUserIds()`)
- **New discussion with `@euclis`** — redirects to thread with `?branchAgent=1` for auto-branch after opener loads
- **Reply with `@euclis`** — auto-runs agent branch after reply is posted
- **Mention rendering** — `@euclis` uses amber brand chip in `mention-text.tsx`; teammates use paper-deep chip

### Agent reply formatting

- `composeDiscussionBranchReply()` in `lib/discussion-agent-branch.ts` prefers `assistantNote` over raw tool dumps; strips long Supabase URLs before display
- Agent messages render via `MarkdownContent` in `post-message-row.tsx`

### API & backend

- `POST /api/discussion/branch-agent` — `{ workspaceId, postId, messageId }`; `maxDuration: 60`
- `lib/discussion-agent-branch.ts` — `runDiscussionAgentBranch()`
- `lib/services/post.ts` — `createAgentBranchReply()`
- `lib/tools/registry.ts` — `discussionBranchToolDefs`, `dispatchDiscussionBranchTool`

### UI

- Message menu: **Branch to agent** (Sparkles icon); Save hidden for private/agent messages
- Loading spinner on the trigger row while the agent runs; other branches disabled until complete
- **Private** badge on `@euclis` user messages (visible only to author)
- Agent rows: amber gradient background, Euclis logo avatar, markdown reply panel
- **Saved tab** uses `PostMessageRow` for consistent styling with the thread view

### Branch vs @euclis

| | **Branch to agent** | **@euclis** |
|--|---------------------|-------------|
| Trigger | Message menu on an existing message | Type `@euclis` in compose |
| User message | None (agent replies under the selected message) | New private user message + private agent reply |
| Visibility | Agent reply private to requester | Both request and reply private to author |

Env: requires `ANTHROPIC_API_KEY` (via `getAnthropicApiKey()`).

### Seed data

- `scripts/seed-discussion-samples.ts` — `npm run seed:discussions -- --workspace-name <name>` (optional `--reset`)
- Creates sample threads tagged `agent-demo-seed` for manual agent / `@euclis` testing

---

## Phase 3 polish (done)

### Title cleanup (one-time data fix)

- Cleared legacy persisted truncation: `UPDATE "Post" SET title = NULL WHERE title LIKE '%…';`
- Affects only rows that stored a truncated opener in `Post.title`; display titles are derived from opener body at read time via `postThreadTitle()` / `postFeedTitle()`

### Delete whole discussion (done)

- **`deletePost()`** in `lib/services/post.ts` — hard delete (same pattern as reply delete)
- **Permission** — author, leader, or sub-leader (matches close/reopen / task link tier)
- **Cascade** — `Post` delete cascades `PostMessage`, `PostMessageMention`, and `PostMessageSave`; memory event FKs on messages `SetNull`
- **`deleteDiscussionAction`** in `lib/actions/discussion.ts`
- **UI** — **Delete** in thread header (next to Close/Reopen); trash icon on feed cards for eligible users
- Deleted posts return **Discussion not found** from `getPostThread()`; thread UI redirects to the feed; direct URLs are not resolvable

### Privacy backfill (`20260709180100_backfill_agent_private`)

- Sets `isAgentPrivate = true` on existing messages whose body matches `@euclis`
- Deletes all `PostMessageSave` rows for `isAgentPrivate` or `isAgentGenerated` messages

### UX fixes

- **Post vs save pending** — separate `useTransition` hooks so saving a message no longer flips the compose button to “Posting…” (`discussion-feed.tsx`, `discussion-thread.tsx`, `discussion-section.tsx`)
- **`TaskLinkPicker` search icon** — `z-10` on the Search icon so it isn’t covered by the input’s opaque background (matches dashboard search)
- **Stale Prisma client guard** — `lib/prisma.ts` `PRISMA_CLIENT_BUILD` marker forces client refresh in dev after schema migrations
- **Feed error race** — saved-tab load failures no longer poison the discussions feed; silent realtime refresh doesn’t overwrite good state

---

## Not done / optional follow-ups

- [ ] **`PostMessage` embeddings** — workspace search over discussion content
- [ ] **`PostMessageSave` in Supabase realtime** — live Saved tab across browser tabs
- [ ] **Edit message / edit post kind after create**
- [ ] **WhatsApp copy** — document `create_post` / `reply_to_post` in `docs/whatsapp-integration.md`

### Dead code note

- **Removed:** `components/workspace/workspace-discussion-section.tsx` (no imports)
- **Kept:** `components/discussion/discussion-section.tsx` — still used by `components/board/task-updates-section.tsx` for task-scoped updates UI

---

## Migrations (discussion-related)

| Migration | Contents |
|-----------|----------|
| `20260709120000_posts` | `Post`, `PostMessage`, mentions, saves, memory FKs |
| `20260709140000_post_kind_and_pin` | `PostKind`, `pinned`, indexes |
| `20260709150000_discussion_tags` | `Post.tags`, `WorkspaceDiscussionTag` |
| `20260709160000_post_status` | `PostStatus`, `Post.status` |
| `20260709170000_post_message_agent` | `isAgentGenerated`, `agentTriggeredByUserId` |
| `20260709180000_post_message_agent_private` | `isAgentPrivate` on `@euclis` user messages |
| `20260709180100_backfill_agent_private` | Backfill `isAgentPrivate`; purge saves on agent/private messages |

---

*Last updated: cleanup pass — title fix, delete discussion, dead code removal.*
