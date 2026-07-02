# Euclis — social recording demos

Animations for Reddit / social posts. **Not part of the public marketing site.**

## Branch vs gitignore?

**Neither is required.**

| Approach | Recommendation |
|----------|----------------|
| **New branch** | Optional — only if you want to experiment without merging |
| **`.gitignore`** | **No** — keep demos in the repo so you can re-render anytime |
| **Production gate** | **Yes** — `/marketing/*` returns 404 redirect to `/` in production unless `ENABLE_MARKETING_DEMOS=true` |

Demos live in `marketing/social/` (components) and `app/marketing/` (routes).

## Local URLs

```bash
npm run dev
```

| URL | Use |
|-----|-----|
| http://localhost:3000/marketing | Demo index |
| http://localhost:3000/marketing/whatsapp | WhatsApp 1:1 → kanban (Reddit launch) |
| http://localhost:3000/marketing/claude | Claude MCP → board |

**Full compiled video (~30s):**

| URL | Use |
|-----|-----|
| http://localhost:3000/demo1 | Intro → WhatsApp → Claude → web → outro (loops) |

## Recording checklist

1. Open `/marketing/whatsapp` or `/marketing/claude` in a **maximized browser window**.
2. **Full-screen the tab** (macOS: green button or ⌃⌘F · Windows: F11).
3. Start **window** screen recording (QuickTime → New Screen Recording → record this window).
4. Let one full loop play (~30–45s), then stop.
5. Export **MP4**, upload **natively** to Reddit.

No fixed 1920×1080 setup needed — the demo fills whatever window you record.

## What's different from the landing page?

- **Full-screen** layout — scales to your browser window for simple window recording
- **Larger** phone + kanban for screen recording readability
- **Reddit-oriented** copy ("Not a group bot", euclis.dev footer)
- **Separate scenes** tuned for short loops — not embedded in `/` or `/landing`

## Enable on production (optional)

Only if you need to record from the deployed URL:

```env
ENABLE_MARKETING_DEMOS=true
```

Default: blocked in production. Routes are also `noindex` and excluded from `robots.txt` indexing via `disallow: /marketing/`.
