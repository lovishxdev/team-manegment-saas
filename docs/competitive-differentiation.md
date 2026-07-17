# Euclis vs competitors — differentiation brief

Last updated: 2026-07-16  
Purpose: YC / Product Hunt positioning. Product-level differences only — not a technical deep dive.

---

## One-line Euclis position

**Euclis is a project coordination workspace where humans and AI coding agents share decisions, blockers, tasks, and living project memory — captured from WhatsApp, Cursor, Claude, and the web.**

Competitors mostly build a *company brain* or *agent memory layer*. Euclis aims to own the loop:

> conversation → decision → task/blocker → shared memory → next human or agent session

---

## What is *not* differentiation anymore

These claims are now category language. Do not lead with them alone:

| Claim | Why it's weak alone |
|-------|---------------------|
| Shared memory for humans and agents | Memory Store, Glen, Hyper, Wato, Sentra, Dust all say this |
| MCP access for coding agents | Now table stakes |
| Capture from Slack / docs / meetings | Crowded connector play |
| Dedup / contradiction handling | Multiple “company brain” products pitch this |
| “Context layer” / “company brain” | Saturated positioning in 2025–2026 YC batches |

---

## Euclis wedge (working hypothesis)

**WhatsApp-first project coordination for small AI-native software teams.**

| Pillar | What Euclis does | Why it can differ |
|--------|------------------|-------------------|
| Project, not company | Scoped to a workspace/project: decisions, blockers, milestones, tasks | Most competitors sell org-wide knowledge |
| Coordinate, don't only recall | Discussions + kanban + memory in one place | Memory tools stop at “ask and retrieve” |
| WhatsApp as a first-class surface | Team updates and assets from WhatsApp | Enterprise competitors optimize for Slack / M365 |
| Agents as project members | Agents get the same brief humans do; work lands on the board | Infra tools give memory APIs; they don't run the project |
| Small-team default | Hobby free forever; Team when the project outgrows informal | Incumbents sell seats and enterprise search |

> Validate before locking this for YC: do target teams actually run serious project work in WhatsApp?

---

## Top picks — how we differ

### Tier A — closest product overlap

#### 1. Memory Store (YC Spring 2026)

| | Memory Store | Euclis |
|---|--------------|--------|
| Pitch | One memory for your team's agents (“company brain”) | Project brain + coordination for team and agents |
| Sources | Slack, Gmail, Granola, Claude sessions | WhatsApp, Cursor, Claude, web, in-app discussions |
| Output | Living memory + auto-updating briefs | Memory + tasks + discussions + blockers |
| Buyer | Teams wanting agent-readable company context | Small software / product teams running a project |

**Difference:** Memory Store is *capture → memory → brief*. Euclis is *discuss → decide → assign → remember*.

#### 2. Glen (YC Summer 2026)

| | Glen | Euclis |
|---|------|--------|
| Pitch | Unified organizational context for agents and humans | Shared project memory tied to active work |
| Strength | Code, PRs, issues, docs, meetings — “why a line was written” | Decisions/blockers linked to tasks and threads |
| Shape | Context reconciliation layer | Workspace product (board + discussions + memory) |

**Difference:** Glen stitches org evidence for agents. Euclis is where the team *runs* the project and agents read that state.

#### 3. Hyper (YC Spring 2026)

| | Hyper | Euclis |
|---|-------|--------|
| Pitch | Self-maintaining company brain feeding every AI tool | Project memory maintained inside a team workspace |
| Strength | Silent sync across company systems; plug back into AI tools | Explicit decisions, blockers, discussions humans own |
| Adoption | Connect everything → brain gets smarter | Open a workspace → work and memory live together |

**Difference:** Hyper is ambient org intelligence. Euclis is an opinionated project OS with memory.

#### 4. Wato (YC Spring 2026)

| | Wato | Euclis |
|---|------|--------|
| Pitch | Control point for AI agents at work | Project workspace for humans + coding agents |
| Includes | Shared memory, skills, MCP permissions, cloud agent sessions | Memory, discussions, kanban, WhatsApp |
| Center of gravity | Agent workspace / governance | Human project coordination with agents attached |

**Difference:** Wato is agent operations + shared memory. Euclis is team project execution with agents as participants.

#### 5. Supermemory

| | Supermemory | Euclis |
|---|-------------|--------|
| Pitch | Memory / context infrastructure for AI agents (+ personal app) | End-user product for teams running projects |
| Buyer | Developers embedding memory; power users across AI tools | Founders / eng leads / small product teams |
| Shape | API, plugins, connectors, memory graph | Workspace UI + MCP + WhatsApp |

**Difference:** Supermemory is plumbing. Euclis is the product a team opens every day. Don't compete as “better Mem0/Supermemory.”

#### 6. Product Brain

| | Product Brain | Euclis |
|---|---------------|--------|
| Pitch | Governed source of product truth for every agent | Living project memory + execution surface |
| Strength | Decisions, standards, tensions, governed graph | Capture from chat/agents + tasks/discussions |
| Workflow | Capture → draft → commit → agents read | Capture while work happens; board stays current |

**Difference:** Closest philosophically on *product decisions*. Euclis differentiates with WhatsApp + coding-agent ambient capture + task/discussion execution in-product.

---

### Tier B — enterprise / platform threat

These win on distribution if the customer already lives there. Euclis should not fight them as “enterprise search.”

| Competitor | What they own | Euclis difference |
|------------|---------------|-------------------|
| **Dust** | Multiplayer human–agent workspace on company knowledge | Smaller, project-scoped; WhatsApp + coding agents; less “build agent fleets” |
| **Notion AI** | Docs + projects + enterprise search | Euclis is decision/blocker/agent brief first, wiki second |
| **Atlassian Rovo** | Jira/Confluence Teamwork Graph + agents | Euclis targets teams *not* on Atlassian stacks / too small for Rovo |
| **Glean** | Enterprise search + knowledge graph + MCP gateway | Search vs coordination; enterprise vs small-team wedge |
| **Microsoft Work IQ** | M365 organizational context for agents | Irrelevant until customer is M365-native enterprise |

**Position vs platforms:** Euclis is the thin layer for AI-native teams that won't (yet) centralize in Notion/Jira/M365 — especially WhatsApp-native or hackathon/startup stacks.

---

### Tier C — adjacent (don't confuse in pitch)

| Product | Category | Relation to Euclis |
|---------|----------|--------------------|
| Mem0, Zep, Letta, Cognee | Agent memory infra / SDKs | Build-vs-buy alternative for *developers*, not our UI buyer |
| Nessie | AI conversation → personal/team context | Overlaps on AI-chat memory; weaker on project execution |
| ContextForge, memnos, Zikra | Shared memory for coding agents | Overlap on agent brief; usually no full team workspace |
| Sentra, SharedMemory | Company brain / decision graph | Same category as Memory Store / Hyper |
| Linear / Jira / Trello alone | Task tracking | Track *what*; don't maintain *why* for agents |
| CLAUDE.md / AGENTS.md | Manual agent context | Cheap workaround; Euclis automates and shares it |

---

## Comparison matrix (high level)

| Dimension | Euclis | Memory Store / Hyper / Sentra | Glen | Wato / Dust | Supermemory / Mem0 | Notion / Rovo / Glean |
|-----------|--------|-------------------------------|------|-------------|--------------------|-----------------------|
| Primary job | Run + remember the project | Company brain for agents | Org context for agents | Agent workspace | Memory infra | Search / work platform AI |
| Unit of value | Workspace / project | Org knowledge graph | Org evidence | Shared agent ops | API / plugin | Seat + existing stack |
| WhatsApp-native | Strong (wedge) | Weak / none | Weak | Weak | Weak | Weak |
| Tasks + discussions | Yes | Usually no | No | Partial | No | Yes (platform) |
| Coding-agent MCP brief | Yes | Yes | Yes | Yes | Yes (as library) | Emerging |
| Best for | 2–25 person AI-native teams | Orgs feeding many agents | Eng + agent context depth | Teams standardizing agents | Builders adding memory | Companies already on stack |

---

## Honest gaps (say these internally)

1. **Crowded narrative** — “shared memory for humans and agents” alone will not clear YC or Product Hunt.
2. **WhatsApp wedge unvalidated** — strong product bet; still needs customer proof.
3. **Fewer enterprise connectors** — do not race Slack/Gmail/Drive coverage against Hyper/Glean.
4. **Board alone is not the story** — kanban is table stakes; memory + agents + WhatsApp is the story.
5. **No public testimonials yet** — traction claims must stay factual.

---

## Preferred external phrasing

**Do say:**

> Euclis helps small software teams run projects with their AI agents. Conversations and agent work become tasks, decisions, and blockers — so nobody re-explains the project every session.

**Don't say:**

> Euclis is the company brain / universal memory layer for all AI agents.

---

## Suggested research order (keep updating this doc)

1. Memory Store  
2. Glen  
3. Hyper  
4. Product Brain  
5. Supermemory  
6. Dust  
7. Wato  
8. Sentra  
9. Atlassian Rovo / Notion AI (as platform alternatives)  

For each: customer, painful event, wedge, capture sources, proof of demand, why Euclis wins or loses.

---

## Open questions for customer interviews

1. Where do decisions actually get made today — WhatsApp, Slack, Notion, meetings, or agent chats?
2. Would you open a dedicated workspace, or only accept a layer inside tools you already use?
3. Is the painful moment “agent forgot context,” “teammate onboarding,” or “decision archaeology”?
4. What would you miss if Euclis disappeared after two weeks?
5. Would you pay for WhatsApp ↔ project memory, coding-agent brief, or both?
