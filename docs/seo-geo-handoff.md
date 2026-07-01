# Euclis — SEO & GEO handoff context

Use this document as the starting context for a chat dedicated to search engine optimization (SEO) and generative engine optimization (GEO) for **Euclis**.

---

## Product summary (for positioning & copy)

**Euclis** is a lightweight team task-management SaaS for small teams (hackathons, side projects, study groups, hostel groups, weekend events, coffee-shop sprints).

**Core value prop:** One shared kanban board, reachable from three “doors” without drifting out of sync:

| Channel | What it is |
|---------|------------|
| **Web dashboard** | Drag-and-drop kanban, live updates, shared assets, multiplayer whiteboard |
| **WhatsApp bot** | Natural-language task commands via Meta Cloud API + Claude Haiku (no new app to install) |
| **Claude MCP connector** | Manage the same board from Claude Desktop / claude.ai mid-conversation |

**Tagline variants in codebase:**
- Root layout default: *“Where your team's work flows together”*
- Homepage / landing: *“Run your team from anywhere, even WhatsApp”*
- Hero: *“Your team's plan stays in sync even when you're in a [Hackathon / WhatsApp thread / …]”*
- Sub-hero: *“Same board. Same truth.”*

**Target users:** Small teams who already coordinate in WhatsApp or Claude and don’t want another heavy PM tool.

**Differentiators for SEO/GEO:**
- WhatsApp-native task management (unusual vs Trello/Asana/Notion)
- No phone required at signup; WhatsApp is optional
- Free to start; email-only signup
- Real-time sync across web + WhatsApp + MCP
- Per-workspace task short IDs (`#42`) referenced in chat

---

## Production & domains

| Item | Value / notes |
|------|----------------|
| **Production domain (only domain owned)** | `https://euclis.dev` |
| **Vercel fallback** | `https://team-manegment-saas.vercel.app` (redirect to `euclis.dev` in Vercel if possible) |
| **Hosting** | Vercel (Next.js App Router) |
| **Canonical URL env** | `NEXT_PUBLIC_APP_URL=https://euclis.dev` in Vercel Production (drives sitemap URLs, WhatsApp deep links, robots.txt) |

**Note:** `euclis.com` is **not** owned or used — ignore any old Search Console / DNS confusion from that name.

---

## Tech stack (SEO-relevant)

- **Framework:** Next.js 16 App Router (`app/` directory)
- **Rendering:** Server components; marketing homepage is SSR for signed-out users
- **Auth:** Supabase — signed-in users hitting `/` redirect to `/dashboard` (not indexed)
- **Analytics:** Google Analytics 4 (`G-WW99N6L4N9`, production only) + Vercel Analytics (`@vercel/analytics/next`)

---

## Public vs private pages

### Indexable (in sitemap today)

| URL | Title / purpose |
|-----|-----------------|
| `/` | Marketing homepage (`LandingContent`) — **overrides** root layout title when signed out |
| `/landing` | Same content as `/` (alias) |
| `/signup` | Account creation |
| `/login` | Sign in |

### Blocked in `robots.txt` (do not index)

- `/dashboard`, `/settings`, `/w/*` (workspaces), `/invite/*`, `/oauth/*`, `/api/*`, `/auth/*`

### Auth middleware (`proxy.ts`)

Unauthenticated users are redirected to `/login` for protected routes. **Must stay public:** `/sitemap.xml`, `/robots.txt`, `/`, `/landing`, `/login`, `/signup`, favicon assets.

---

## Current metadata (as implemented)

### Root layout (`app/layout.tsx`)

```
Title default: Euclis | Where your team's work flows together
Title template: %s · Euclis
Description: One workspace, three doors: a web dashboard, a WhatsApp assistant, and a Claude connector...
lang: en
```

### Homepage + `/landing` (`app/page.tsx`, `app/landing/page.tsx`)

```
Title: Euclis | Run your team from anywhere, even WhatsApp
Description: A shared task board your team can reach from anywhere the conversation happens: the web dashboard, a WhatsApp message, or a chat with Claude. Built for hackathons, side projects, hostel fests, study groups and every small team in between.
```

### **Not implemented yet** (gaps for SEO/GEO work)

- `openGraph` / `twitter` card metadata
- `metadataBase` / canonical URLs
- JSON-LD structured data (Organization, SoftwareApplication, FAQ)
- `llms.txt` (not in codebase yet — recommended for GEO)
- Dedicated meta for `/login` and `/signup` pages
- Blog / docs / comparison pages (no content marketing routes yet)
- hreflang (single locale: `en` only)

---

## Sitemap & robots

**Files:**
- `app/sitemap.ts` → `/sitemap.xml`
- `app/robots.ts` → `/robots.txt`
- Base URL from `getAppBaseUrl()` in `lib/app-url.ts`

**Sitemap entries:** `/`, `/landing`, `/signup`, `/login`

**Known issue (fixed in code, deploy to confirm):** Auth middleware previously redirected `/sitemap.xml` to `/login` (HTML), causing Google Search Console error *“Sitemap is HTML”*. Fix: whitelist sitemap/robots in `proxy.ts`.

---

## Favicon & brand assets

| Asset | Path |
|-------|------|
| Favicon ICO | `app/favicon.ico` (48×48 max) |
| Icon PNG | `app/icon.png` (48×48) |
| Apple touch | `app/apple-icon.png` (180×180) |
| Logo | `public/euclis-logo.png` |
| PWA icons | `public/web-app-manifest-192x192.png`, `512x512` |

**Removed:** bloated `app/icon.svg` (~215 KB embedded raster) — was likely causing Google’s generic globe favicon in SERPs.

**Note:** Favicon updates in Google can take days–weeks; request homepage re-indexing in Search Console (no separate favicon recrawl).

---

## Landing page structure (for on-page SEO)

Single long-scroll page at `/` and `/landing`:

1. **Hero** — H1: team sync + rotating use-case words
2. **Use-case marquee** — hackathon, hostel, sprint, etc.
3. **WhatsApp section** (`#whatsapp`) — H2: “Run your team from the app you already live in”
4. **The triad** (`#how-it-works`) — Web / WhatsApp / Claude cards
5. **Dashboard preview** — kanban, whiteboard, assets, short IDs
6. **Final CTA** — signup / login
7. **Footer** — links to `#whatsapp`, `/login`, `/signup`

**Internal anchor links:** `#how-it-works`, `#whatsapp`

---

## Keyword themes (from existing copy)

See **`docs/seo-content-strategy.md`** for the full target query shortlist, TaskRio differentiation, and agent prompt templates.

Primary:
- team task board / kanban
- WhatsApp task management / WhatsApp bot for teams
- manage tasks from WhatsApp
- Claude MCP project management
- small team project management

Secondary / long-tail:
- hackathon task board
- study group task organizer
- no-install team tool
- shared board realtime sync
- natural language task creation

Competitor adjacency (for comparison content, not in site yet):
- Trello, Asana, Notion, Linear — but lighter + WhatsApp-native

---

## Analytics & Search Console

| Tool | ID / URL |
|------|----------|
| Google Analytics 4 | `G-WW99N6L4N9` (`components/analytics/google-analytics.tsx`) |
| Vercel Analytics | `@vercel/analytics` in `app/layout.tsx` — enable in Vercel dashboard |
| Google Search Console | Property: `https://euclis.dev` |
| Sitemap to submit | `https://euclis.dev/sitemap.xml` |

---

## GEO (Generative Engine Optimization) notes

Euclis is a strong GEO candidate because the positioning is **specific and verifiable**:
- Three interfaces, one Postgres source of truth
- WhatsApp + Claude MCP are rare in PM tools
- Clear use cases (hackathons, hostel groups, WhatsApp threads)

**Recommendations for GEO work:**
1. Add clear, factual `llms.txt` at `/llms.txt` summarizing product, pricing (free start), and URLs
2. Add JSON-LD `SoftwareApplication` with `applicationCategory`, `offers`, `featureList`
3. Ensure homepage has extractable Q&A blocks (e.g. “Can I manage tasks from WhatsApp?” → yes, how)
4. Consistent entity naming: **Euclis** (not “Teams Management SaaS” — old repo name)
5. Public comparison / “how it works” pages give LLMs citable anchors
6. Avoid duplicate content issue: `/` and `/landing` are identical — pick canonical (usually `/`)

---

## Key file paths (for implementation)

```
app/layout.tsx              Global metadata, GA, Vercel Analytics
app/page.tsx                Homepage metadata + LandingContent
app/landing/page.tsx        Landing alias metadata
app/sitemap.ts              XML sitemap
app/robots.ts               robots.txt
app/manifest.ts             Web app manifest
proxy.ts                    Auth middleware — keep SEO routes public
lib/app-url.ts              getAppBaseUrl() for canonical base URL
app/landing/_components/landing-content.tsx   Marketing page body
components/analytics/google-analytics.tsx
```

---

## Recent SEO-related changes (conversation history)

1. Added `app/sitemap.ts` + `app/robots.ts`
2. Fixed middleware blocking sitemap (HTML redirect bug)
3. Added GA4 + Vercel Analytics
4. Fixed favicon setup (removed huge SVG, added `app/icon.png`, explicit `metadata.icons`)
5. Cursor trail effects scoped to landing only (not app shell)

---

## Suggested priority backlog for SEO/GEO chat

**High impact**
- [x] Set `metadataBase` + canonical URLs on all public pages
- [x] Add Open Graph + Twitter cards (title, description, `og:image` — use hero or logo)
- [x] Canonical: `/landing` → `/` (or vice versa) to avoid duplicate content
- [x] JSON-LD: Organization + SoftwareApplication on homepage
- [x] Create `/llms.txt` for GEO
- [ ] Confirm `NEXT_PUBLIC_APP_URL=https://euclis.dev` in Vercel production

**Medium**
- [x] Page-specific metadata for `/login`, `/signup`
- [x] FAQ section on landing with schema.org FAQPage
- [x] `og:image` asset (1200×630) dedicated for social/search previews
- [ ] Higher-res favicon source (192×192) if bookmark quality matters

**Content / growth**
- [x] `/blog` or `/guides` (e.g. “Manage hackathon tasks from WhatsApp”)
- [x] Comparison pages (Euclis vs spreadsheets, vs Trello for WhatsApp teams)
- [x] Privacy policy + Terms (trust signals for Search & LLMs)

---

## One-paragraph elevator pitch (copy-paste for meta/LLM context)

> Euclis is a free team task board built for small groups who coordinate in WhatsApp, Claude, or the browser. Create a workspace, invite your team, and manage kanban tasks from a web dashboard, by messaging a WhatsApp bot in plain English, or through Claude’s MCP connector — all synced to the same board in real time. No credit card, no phone required at signup. Ideal for hackathons, study groups, side projects, and any team that lives in group chat.

---

## Prompt starter for new chat

```
I'm working on SEO and GEO for Euclis (https://euclis.dev) — a small-team task board 
reachable via web, WhatsApp, and Claude MCP. Read the handoff doc at 
docs/seo-geo-handoff.md in the repo. Help me [specific task: e.g. add Open Graph, 
llms.txt, JSON-LD, fix canonicals, content strategy, etc.]. Stack is Next.js 16 App 
Router on Vercel. Public pages: /, /landing, /signup, /login. App routes are auth-gated.
```
