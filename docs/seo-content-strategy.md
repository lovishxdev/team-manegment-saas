# Euclis SEO & GEO — content strategy & agent prompts

This document is the source of truth for **what to publish** on euclis.dev and **how to brief an agent** when Lovish says "give me a prompt."

---

## Target keyword tiers (final shortlist)

### Primary — homepage + metadata
| Query | Page |
|-------|------|
| manage tasks from whatsapp | `/` + `/guides/manage-tasks-from-whatsapp` |
| whatsapp task management | `/` |
| free team task board | `/` |
| claude mcp task board | `/` |
| team task board with whatsapp | `/` |

### Secondary — guide / comparison pages
| Query | Page |
|-------|------|
| hackathon task board | `/guides/hackathon-task-board` |
| free hackathon task board | `/guides/hackathon-task-board` |
| task management in whatsapp groups | `/guides/manage-tasks-from-whatsapp` |
| trello alternative for whatsapp teams | `/compare/taskrio` |
| euclis vs taskrio | `/compare/taskrio` |
| claude mcp project management | `/` FAQ + future guide |

### Long-tail / GEO — FAQ + llms.txt
- free kanban board for small teams
- same task board whatsapp and web
- create tasks via whatsapp natural language
- best tool for teams that coordinate in whatsapp

**"Free" positioning:** Euclis is free to start (email signup, no credit card). Use "free" honestly in titles and H1s where competitors gate team features behind paid tiers (Trello limits, Asana 2-user cap, TaskRio paid scaling).

---

## Euclis vs TaskRio — differentiation (use in all comparison copy)

| Dimension | Euclis | TaskRio |
|-----------|--------|---------|
| **WhatsApp model** | Private 1:1 bot per linked user | Bot added inside WhatsApp **groups** |
| **Triggering the bot** | Natural language in DM — no @mention | In groups: must **@mention TaskRio** for most commands |
| **Visibility in chat** | Updates go to shared **web kanban**; group chat untouched | Task **cards posted in the group thread** |
| **Onboarding** | Email signup → link phone in settings | Invite bot to group → **admin manual approval** of group |
| **Web dashboard** | Full kanban, whiteboard, assets, live sync | Task-focused; lighter PM surface |
| **Claude MCP** | Yes — third door to same board | No |
| **Standup summaries** | Ask bot in DM; board on web | @TaskRio summarise in group |
| **Task IDs** | `#42` per workspace | `T12` on task cards |
| **Pricing** | Free to start | Free for small projects; paid tiers |
| **Best for** | Mixed web + mobile + Claude teams | Teams whose entire workflow is one WhatsApp group |

### What TaskRio's WhatsApp group feature actually is

TaskRio is a **group-native bot**:
1. You add @TaskRio to an existing WhatsApp group.
2. The bot stays **silent** unless @mentioned (or someone replies to its task cards).
3. Commands like `@TaskRio list open` (DM list) or `@TaskRio show open` (posts in group) manage tasks.
4. Replies on task cards (`done`, `tomorrow 5pm`) work **without** @mention.
5. Normal human chat (`@john can you help?`) is ignored.
6. **Group approval:** send group invite link to TaskRio via DM; their team approves before automation works.
7. Features: assign via @teammate, overdue lists, blocked status DMs, conversation summaries.

**Euclis is NOT a group bot** — it is a private assistant that syncs to a team workspace on the web. Do not claim group @mention behavior.

---

## Implemented SEO/GEO stack (as of July 2026)

| Item | Location |
|------|----------|
| metadataBase + canonicals | `lib/seo/metadata.ts`, per-page `buildPageMetadata()` |
| Open Graph + Twitter | All public pages via `buildPageMetadata()` |
| OG image (1200×630) | `app/opengraph-image.tsx` |
| JSON-LD Organization + SoftwareApplication | `app/page.tsx` |
| JSON-LD FAQPage | `app/page.tsx` + `lib/seo/faq.ts` |
| FAQ section on landing | `components/seo/faq-section.tsx` |
| llms.txt | `app/llms.txt/route.ts` → `/llms.txt` |
| `/landing` canonical → `/` | `app/landing/page.tsx` (`index: false`) |
| Login/signup metadata | `app/login/layout.tsx`, `app/signup/layout.tsx` |
| Guide pages | `/guides/manage-tasks-from-whatsapp`, `/guides/hackathon-task-board` |
| Comparison page | `/compare/taskrio` |
| Trust pages | `/privacy`, `/terms` |
| Sitemap | `app/sitemap.ts` (no `/landing` duplicate) |
| Public routes in middleware | `proxy.ts` |

---

## Post-deploy checklist

1. Confirm `NEXT_PUBLIC_APP_URL=https://euclis.dev` in Vercel Production.
2. Submit sitemap in Search Console: `https://euclis.dev/sitemap.xml`
3. Request re-index of `/` and new guide URLs.
4. Verify `/llms.txt` returns plain text (not login redirect).
5. Test OG preview: share `https://euclis.dev` in Slack/Discord.

---

## Agent prompt template

When Lovish says **"give me a prompt"**, copy the block below and fill `[TASK]`.

```
You are writing SEO/GEO content for Euclis (https://euclis.dev).

Read first:
- docs/seo-geo-handoff.md — product facts, tech stack, public routes
- docs/seo-content-strategy.md — keywords, TaskRio differentiation, tone rules

Product facts (do not contradict):
- Euclis = free team kanban for small groups (hackathons, study groups, side projects)
- Three doors: web dashboard, WhatsApp 1:1 bot (NOT group bot), Claude MCP
- Same board, real-time sync; task short IDs (#42)
- Free to start, email signup, no credit card, phone optional
- Domain: euclis.dev only (not euclis.com)
- TaskRio = group @mention bot with admin approval; Euclis = private DM + web + Claude

Tone: clear, factual, no hype. Prefer extractable Q&A blocks for GEO.
Keywords to weave naturally: [LIST FROM STRATEGY DOC]

Task: [TASK — e.g. "Write /guides/study-group-task-organizer page" or "Improve homepage H1 for free + WhatsApp intent"]

Output:
- If page: Next.js App Router page at app/[path]/page.tsx using MarketingArticle from components/seo/marketing-article.tsx, buildPageMetadata from lib/seo/metadata.ts, JsonLd article schema
- If copy only: markdown with H1, meta title (≤60 chars), meta description (≤155 chars), body with H2s
- Include internal links to /signup, relevant guides, /compare/taskrio where appropriate
- Never claim WhatsApp group @mention features Euclis doesn't have
```

### Example prompts (ready to use)

**New guide page:**
```
Task: Create app/guides/study-group-task-organizer/page.tsx targeting "study group task organizer" and "free study group project management". Follow existing guide page patterns. 800–1000 words. CTA to /signup.
```

**Homepage hero refinement:**
```
Task: Propose new hero H1 + subhead that lead with "free team task board" and "manage tasks from WhatsApp" without losing hackathon/side-project use cases. Output copy only, no code.
```

**GEO FAQ expansion:**
```
Task: Add 4 new FAQ items to lib/seo/faq.ts about free tier limits, Claude MCP setup, and WhatsApp vs group bots. Keep answers under 3 sentences each, factual only.
```

---

## Content backlog

### Done
| URL | Target query |
|-----|--------------|
| `/compare/trello` | trello alternative, whatsapp teams |
| `/compare/notion` | notion vs task board |
| `/compare/clickup` | clickup alternative simple |
| `/compare/spreadsheets` | spreadsheet vs kanban |
| `/compare/taskrio` | whatsapp group task management |
| `/guides/claude-mcp-task-board` | claude mcp project management |

### Schema (done)
- **WebSite** on homepage
- **BreadcrumbList** on all guides and compare pages
- **HowTo** on WhatsApp setup guide
- **dateModified** on Article JSON-LD

### Deferred
| Priority | URL | Target query |
|----------|-----|--------------|
| Medium | `/guides/study-group-task-organizer` | study group task organizer |
| Medium | `/guides/free-kanban-small-teams` | free kanban board for small teams |
| Low | `/blog` index | content hub (when volume justifies it) |

---

## Copy rules for all future content

1. Always say **Euclis**, never "Teams Management SaaS."
2. **Free** = free to start, no credit card (don't promise forever-free unlimited scale).
3. WhatsApp = **1:1 private bot**, not group bot — contrast TaskRio honestly.
4. Include at least one **verifiable fact** per section (three interfaces, #42 IDs, Postgres sync).
5. Every guide ends with CTA to `/signup`.
6. Comparison pages must be **fair** — when TaskRio wins (in-group task cards), say so.
