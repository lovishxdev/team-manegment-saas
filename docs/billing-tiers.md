# Billing & plan tiers — shipped work & reference

Euclis has per-workspace **plan tiers** with limits enforced at the service
layer. Billing is **stubbed** today (no payments) — a workspace's tier is a
DB field an admin flips; a `BillingProvider` seam lets Stripe drop in later
without touching enforcement code.

Audience framing: cheap/free for the core audience (hackathons, side
projects, indie startups); paid tiers only when a team outgrows "small and
informal."

---

## Tiers & limits

Limits live in code (`lib/billing/plans.ts`), not the database. `null` = unlimited.

| Limit / feature | Hobby | Team | Business |
|-----------------|-------|------|----------|
| Members per workspace | 5 | 25 | ∞ |
| Workspaces a user can lead | 1 | 5 | ∞ |
| Open discussions per workspace | 15 | ∞ | ∞ |
| WhatsApp bot | ✅ | ✅ | ✅ |
| Max MCP scope | `context` | `full` | `full` |
| Project memory (Dreaming) | Raw capture | **Curated** (dedupe, contradiction resolution, insights) | Curated |
| Memory retention (recall/list window) | 30 days | 365 days | ∞ |
| Ambient coding-agent seats | 1 | ∞ | ∞ |
| New-member onboarding brief + history backfill | — | ✅ | ✅ |
| Automatic blocker routing to assignees | — | ✅ | ✅ |
| Leader analytics dashboard | — | ✅ | ✅ |
| Guest / client access | — | ✅ | ✅ |
| Custom subdomain | — | — | ✅ *(flag reserved, routing not built)* |
| SSO | — | — | ✅ *(flag reserved, auth not built)* |

- **WhatsApp + baseline (`context`) MCP are always free** — the adoption wedge, never gated.
- **Hobby gets raw memory capture; Team+ gets the curated/tended store** (Dreaming) — the core differentiator.
- **1 ambient coding-agent seat is free** (solo dev); a second engineer's editor brief is a Team upgrade.
- Team differentiators (curated memory, agent seats, onboarding brief, blocker routing, leader analytics, guest access) are **defined as flags in `lib/billing/plans.ts` and shown on `/pricing`**; per-feature runtime enforcement is tracked in *Not done / follow-ups*.
- Business `customSubdomain` / `sso` are reserved flags only (no routing/auth yet).

---

## Downgrade policy — grandfather existing, block new growth

Applied uniformly. A workspace/user over a cap keeps what it has; only new
growth is blocked.

| Over-cap situation | Behavior |
|--------------------|----------|
| Members over cap | Existing members stay; new invites/joins blocked |
| Discussions over cap | Existing threads stay; new discussions blocked (close/resolve one to free a slot) |
| Memory past retention | Older events **hidden from recall/list only — never deleted** |
| Workspaces-led over cap | Existing workspaces stay; new creation blocked |

Enforcement uses `currentCount >= cap`, so an over-cap count naturally
blocks the next action while leaving existing rows untouched.

---

## Architecture

```
Surfaces (web actions · MCP · WhatsApp)
        │  call service functions
        ▼
lib/services/*  (createWorkspace, acceptInvite, createPost, memory reads…)
        │  assert / filter via
        ▼
lib/billing/entitlements.ts   ← single enforcement layer
        │  resolves tier via
        ▼
lib/billing/provider.ts  (BillingProvider → StubBillingProvider today)
        │  limits from
        ▼
lib/billing/plans.ts  (PLAN_LIMITS)
```

- **Enforcement is service-layer**, not middleware or per-endpoint — one set of
  checks covers all three surfaces (web, MCP, WhatsApp).
- **UI hints mirror** the same helpers but never replace the server gate.
- Blocked actions throw `ServiceError(code: "UPGRADE_REQUIRED")`, surfaced to
  the user as the error message.

### Billing provider seam

`BillingProvider.getWorkspacePlan(workspaceId)` is the only tier lookup.
`StubBillingProvider` reads `Workspace.planTier` (an expired `planExpiresAt`
falls back to Hobby). A future `StripeBillingProvider` swaps in via
`setBillingProvider()` with **no change to enforcement call sites**.

---

## Data model

`prisma/schema.prisma` — migration `20260709190000_workspace_plan_tier`:

- **`PlanTier`** enum: `HOBBY` | `TEAM` | `BUSINESS`
- **`Workspace.planTier`** (default `HOBBY`)
- **`Workspace.planSource`** — `"default"` | `"admin"` | `"stripe"`
- **`Workspace.planExpiresAt`** — `null` = no expiry (free or active sub)

Billing is anchored **per workspace**. The only user-scoped limit is
"workspaces led" — a user's allowance is the most generous cap among the
tiers of the workspaces they currently lead (unlimited wins), defaulting to
Hobby when they lead none.

---

## Enforcement points (implemented)

| Concern | Where | Function |
|---------|-------|----------|
| Workspace-creation cap | `lib/services/workspace.ts` → `createWorkspace` | `assertCanCreateWorkspace(userId)` |
| Member cap (invite preflight) | `lib/services/workspace.ts` → `createInvite` | `assertCanAddMember(workspaceId)` |
| Member cap (authoritative, join) | `lib/services/workspace.ts` → `acceptInvite` tx | `ensureCanAddMember(tier, count)` |
| Open-discussion cap | `lib/services/post.ts` → `createPost` | `assertCanCreateDiscussion(workspaceId)` |
| Memory retention (list) | `lib/services/memory.ts` → `buildMemoryEventWhere` | `memoryRetentionCutoff(workspaceId)` |
| Memory retention (recall) | `lib/services/memory.ts` → `recallMemory` | `memoryRetentionCutoff(workspaceId)` |

Covered surfaces per point: web actions, MCP tools, and WhatsApp all route
through these same service functions.

### Scope notes / decisions

- **Member cap enforced at both invite creation and acceptance** (defense in
  depth; acceptance is authoritative to prevent overshoot from multiple
  outstanding invites).
- **Retention applies to `recall` + `list` only** — not to
  `getOpenBlockersForTask` (active work always surfaces) and not to the agent
  brief (`lib/memory/brief.ts`, the ambient coding-agent context). Revisit if
  Hobby brief scope should be clipped.
- **Discussion cap counts `Post.status = OPEN`** (resolved/closed don't count).
- **MCP `full` scope** as a Team+ gate is defined in `PLAN_LIMITS.maxMcpScope`
  but not yet wired into `mcpScope` selection / `dispatchMcpTool` — pending.
- **Agent-hook seats**: unlimited on all tiers, no enforcement (revisit if
  usage becomes a cost driver).

---

## UI upgrade hints

Advisory only — the server remains the gate. Powered by
`lib/actions/billing.ts` (`fetchWorkspaceLimitsAction`,
`fetchWorkspacesLedStatusAction`) and `getWorkspaceLimitStatus` /
`getUserWorkspacesLedStatus`.

| Surface | File | At-cap behavior |
|---------|------|-----------------|
| Invite pill | `components/workspace/workspace-header-actions-loader.tsx` → `invite-button.tsx` | Server-computed; button disabled + "Member limit reached (N). Upgrade to invite more." |
| Create workspace | `components/workspace/create-workspace-modal.tsx` | Amber banner + Create disabled |
| New discussion | `components/discussion/discussion-feed.tsx` | Amber banner + button disabled; refreshes after create/delete |

---

## Admin tier management (local dev only)

- **`/admin/plans`** — `app/admin/plans/page.tsx` + `components/admin/admin-workspace-plans.tsx`
  - Table of all workspaces (member count, current tier, source) with a
    per-row tier selector; optimistic update, rollback on error
- **`setWorkspacePlanAction`** — `lib/actions/admin.ts`, gated by `requireAdmin`
- **`getAdminWorkspacePlans`** / **`setWorkspacePlanTier`** — `lib/services/admin.ts` / `lib/billing/entitlements.ts`
- Admin UI is local-dev only (`lib/admin.ts` `isAdminEnvironment`), never on Vercel.

### CLI alternative

```bash
npm run set:plan -- --list
npm run set:plan -- --workspace-name Euclis --tier TEAM
npm run set:plan -- --workspace-id <uuid> --tier HOBBY
```

Script: `scripts/set-workspace-plan.ts`.

---

## Key files

| Area | Path |
|------|------|
| Plan limits | `lib/billing/plans.ts` |
| Provider seam | `lib/billing/provider.ts` |
| Enforcement layer | `lib/billing/entitlements.ts` |
| Client actions | `lib/actions/billing.ts` |
| Admin action | `lib/actions/admin.ts` |
| Admin plans page | `app/admin/plans/page.tsx` |
| Admin plans UI | `components/admin/admin-workspace-plans.tsx` |
| Workspace/member enforcement | `lib/services/workspace.ts` |
| Discussion enforcement | `lib/services/post.ts` |
| Memory retention | `lib/services/memory.ts` |
| Tier CLI | `scripts/set-workspace-plan.ts` |
| Schema | `prisma/schema.prisma` |

---

## Migrations

| Migration | Contents |
|-----------|----------|
| `20260709190000_workspace_plan_tier` | `PlanTier` enum; `Workspace.planTier` / `planSource` / `planExpiresAt` |

---

## Not done / follow-ups

### Team differentiators — runtime enforcement

Set in `lib/billing/plans.ts`, shown on `/pricing`, and gated via `workspaceFeature(workspaceId, key)` in `lib/billing/entitlements.ts`:

- [x] **Curated memory (`curatedMemory`)** — `runDreamCycle` (`lib/memory/dream.ts`) returns early on Hobby; Hobby keeps raw capture (`dreamedAt` stays null), Team+ gets dedupe / contradiction resolution / INSIGHTs
- [x] **Ambient agent seats (`ambientAgentSeats`)** — `claimAgentSeat` + new `AgentSeat` table (seat = engineer/user); enforced in `app/api/ingest/agent-session` (402 when a new engineer exceeds Hobby's 1 seat; existing seats grandfathered)
- [x] **Onboarding brief (`onboardingBrief`)** — `scheduleOnboardingBrief` fires from `acceptInvite`; Team-only WhatsApp welcome digest to new members (best-effort, session-window). `backfill:memory` remains a manual script.
- [x] **Blocker routing (`blockerRouting`)** — auto assignee pings gated at both capture call sites (`lib/memory/capture.ts`, `lib/memory/agent-capture.ts`); manual WhatsApp stays free
- [x] **Leader analytics (`leaderAnalytics`)** — `getWorkspaceMemoryAnalytics` powers workspace-scoped capture, Dreaming, blocker, topic and agent-context analytics on the Memory tab (also summarized in workspace Settings); leaders only, Team+
- [x] **Guest access (`guestAccess`)** — read-only `GUEST` role (see below)

### Guest access (read-only client role)

- **Model:** `GUEST` added to the `Role` enum (migration `20260710140000_guest_role`); rank `-1` (below MEMBER). `WorkspaceInvite.role` carries the granted role.
- **Read-only enforcement (server, all surfaces):** guests are blocked from every write via `assertCanWrite` / `requireWriteMember` / inline `role === "GUEST"` guards across `project.ts` (tasks, assets), `task-updates.ts`, `post.ts` (discussions), `links.ts`, `discussion-tags.ts`, `categories` (tool), `workspace.ts` (whiteboard), `memory.ts` (create/resolve). Shared helpers in `lib/services/roles.ts` (`isLeadership`, `isGuest`, `canWrite`). Reads are unchanged — guests can view everything.
- **No comments:** guests cannot post task updates or discussion messages (read-only decision; clients reach the leader directly).
- **Invite flow:** `createInvite(..., { role: "GUEST" })` gated to Team+ (`guestAccess`) + leadership; `acceptInvite` grants the invite's role. Header invite pill shows a **Member / Guest** toggle on Team+ workspaces.
- **No member cap:** guests are excluded from all member-cap counts (`assertCanAddMember`, `acceptInvite`, `getWorkspaceLimitStatus`, header hint) — invite unlimited clients.
- **UI:** guests render a static "Guest" badge in the members list (no role dropdown); leaders can still remove them. Onboarding brief is skipped for guests.

### Platform / billing

- [ ] **Stripe integration** — `Subscription` table + `/api/webhooks/stripe` + `StripeBillingProvider`; sync `planTier` on subscription events
- [ ] **MCP `full`-scope gating** — enforce `maxMcpScope` in scope selection / `dispatchMcpTool`
- [ ] **Custom subdomain routing** (Business) — host → workspace resolve in `proxy.ts`; `Workspace.customHostname`
- [ ] **SSO** (Business) — IdP config + auth path
- [ ] **Org-level analytics** (Business)
- [ ] **Trial expiry UX** — no notice when a trial ends (silently reverts to Hobby); consider banner "trial ended" state + email
- [ ] **Pricing page / upgrade flow UI** — today upgrades are manual (admin flip / contact us)
- [ ] **Decide**: should Hobby memory retention also clip the agent brief?

---

*Last updated: all six Team differentiators enforced at runtime, including read-only guest access.*
