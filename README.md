# Teams Management SaaS — Backend

High-density project management tool operating through a **Triad** of interfaces:

1. **Web Dashboard** (Next.js, frontend not yet built)
2. **WhatsApp bot** — Meta Cloud API webhook, intent parsing by Claude Haiku
3. **Claude App** — Remote MCP connector with per-user bearer tokens

All three are thin adapters over a single shared service layer.

## Stack

Next.js (App Router) · Supabase (Postgres, Storage, Realtime) · Prisma 7 · Anthropic SDK · `mcp-handler`

## Layout

```
prisma/schema.prisma                  Database schema (single source of truth)
prisma.config.ts                      Prisma CLI config (migrations use DIRECT_URL)
lib/prisma.ts                         Prisma client singleton (pooled, pg adapter)
lib/supabase.ts                       Server-side Supabase admin client (Storage)
lib/whatsapp.ts                       Graph API send + webhook signature verify
lib/services/project.ts               Business logic shared by every interface
app/api/mcp/route.ts                  Remote MCP endpoint (Streamable HTTP)
app/api/webhooks/whatsapp/route.ts    WhatsApp webhook (verify + ingest)
```

## Quick start

```bash
npm install
cp .env.example .env      # fill in values -- see SETUP.md
npx prisma migrate dev    # create tables
npm run dev
```

Full walkthrough for Supabase, Anthropic, Meta WhatsApp, and the Claude App
connector: see [SETUP.md](SETUP.md).

## Useful commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run typecheck` | TypeScript check |
| `npx prisma migrate dev` | Apply schema changes |
| `npx prisma studio` | Browse/edit data in a GUI |
| `npm run prisma:generate` | Regenerate the Prisma client |
