# Euclis design system

_Last updated: 2026-07-06_

This document describes the visual theme, design tokens, and shared UI patterns used across Euclis. The app is **light-only** today — there is no dark mode token set.

**Source of truth**

| Layer | Location |
|-------|----------|
| Color & font tokens | `app/globals.css` (`@theme`) |
| Component class recipes | `components/ui/ui.tsx` |
| Custom select | `components/ui/select.tsx` |
| App shell layout constants | `components/layout/app-shell-shared.ts` |
| Landing-only styles | `app/landing/_components/landing-styles.tsx` |
| Font loading | `app/layout.tsx` (Next.js `next/font/google`) |

---

## Theme philosophy

Euclis uses a **soft, light dashboard** aesthetic:

- **Shell** — warm gray canvas (`#efefef`) with a drifting mesh gradient (peach, pink, violet) in the top band. Feels like wallpaper, not a flat gray page.
- **Paper** — white cards and panels float above the shell with subtle borders and soft shadows.
- **Ink emphasis** — primary UI accent is near-black ink (`#1a1a1a`), not a bright brand color. Keeps the product calm and readable.
- **Status color** — rose / orange / violet for kanban columns; semantic reds/ambers/emeralds for priority. Color carries meaning on the board, not in global chrome.
- **Integration brand colors** — WhatsApp green and Claude terracotta appear only in integration-specific UI (banners, demos, landing Door cards), not as the global accent.

**Interaction feel:** fields and buttons use a slight **hover lift** (`-translate-y-px`) and soft ink focus rings. Cards gain shadow on hover. Motion respects `prefers-reduced-motion`.

---

## Design tokens

Defined in `app/globals.css` under Tailwind v4 `@theme`. Use Tailwind utilities (`bg-paper`, `text-ink`, `border-line`, etc.) or `var(--color-*)` in custom CSS.

### Surfaces

| Token | Value | Tailwind | Usage |
|-------|-------|----------|--------|
| `--color-paper` | `#ffffff` | `bg-paper` | Cards, inputs, modals |
| `--color-paper-deep` | `#e8e8e8` | `bg-paper-deep` | Subtle fills, chip backgrounds |
| `--color-shell` | `#efefef` | `bg-shell` | Page canvas |
| `--color-card` | `#ffffff` | `bg-card` | Elevated surfaces |
| `--color-card-high` | `#f8f8f8` | `bg-card-high` | Nested panels |

### Ink (text & emphasis)

| Token | Value | Tailwind | Usage |
|-------|-------|----------|--------|
| `--color-ink` | `#1a1a1a` | `text-ink`, `bg-ink` | Headings, primary buttons, links |
| `--color-ink-soft` | `#6b7280` | `text-ink-soft` | Body secondary, labels |
| `--color-ink-faint` | `#9ca3af` | `text-ink-faint` | Placeholders, meta, IDs |

### Lines (borders)

| Token | Value | Tailwind |
|-------|-------|----------|
| `--color-line` | `#e5e7eb` | `border-line` |
| `--color-line-strong` | `#d1d5db` | `border-line-strong` |

### UI accent

Ink replaces an earlier mint accent. Do **not** use mint (`#00c896`) for global buttons, selection, or links.

| Token | Value | Usage |
|-------|-------|--------|
| `--color-accent` | `#1a1a1a` | Legacy name; same as ink |
| `--color-accent-bright` | `#374151` | Hover states on dark surfaces |
| `--color-accent-soft` | `rgba(26,26,26,0.06)` | Subtle tinted backgrounds |
| `--color-on-accent` | `#ffffff` | Text on ink buttons |

**Text selection:** neutral ink tint — `rgba(26,26,26,0.14)` (see `::selection` in `globals.css`).

### Integration brand (scoped use only)

| Token | Value | When to use |
|-------|-------|-------------|
| `--color-whatsapp` | `#25d366` | WhatsApp integration prompts, landing WhatsApp door |
| `--color-whatsapp-dark` | `#1da851` | WhatsApp gradients |
| `--color-claude` | `#d97757` | Claude connector UI |
| `--color-claude-dark` | `#c15f3c` | Claude accents |

WhatsApp chat UI in demos also uses conventional bubble colors: `#ECE5DD` (chat bg), `#DCF8C6` (outbound bubble), `#128C7E` (header gradient end).

### Typography tokens

| Token | Stack | Tailwind | Usage |
|-------|-------|----------|--------|
| `--font-sans` / `--font-display` | Hanken Grotesk | default `body` | App UI, forms, nav |
| `--font-mono` | JetBrains Mono | `font-mono` | IDs, dates, chips, trust lines |
| `--font-serif` | Instrument Serif | `font-serif` | Landing headlines, marketing |
| `--font-script` | Caveat | `font-script` | Decorative (rare) |

Fonts are loaded in `app/layout.tsx`:

- **Hanken Grotesk** — `--font-hanken`
- **JetBrains Mono** — `--font-jetbrains`
- **Instrument Serif** — `--font-instruments-serif` (weight 400; must be on `<html>` for correct landing serif)
- **Caveat** — `--font-caveat` (weights 500, 600)

All use `display: swap`.

---

## Composite patterns (globals.css)

These are **not** Tailwind utilities — apply the class name directly.

### App shell background

Applied via `body` + `body::before` / `body::after`:

- Base: `#efefef`
- Top ~440px: animated mesh (warm peach / pink / violet radials) + diagonal hatch mask
- Animation: `shell-mesh-drift` (26s); disabled when `prefers-reduced-motion`

### `.dashboard-panel`

Frosted workspace container on `/dashboard`:

- `background: rgba(255,255,255,0.68)` + `backdrop-filter: blur(14px)`
- Soft white border, inset highlight, layered shadow
- `border-radius: 1rem`; padding `1.5rem` ( `2rem` on `sm+`)

Reference in code: `ui.dashboardPanel` (deprecated alias) or class `dashboard-panel`.

### `.kanban-column`

Floating column shell shared by all board columns:

- `border-radius: 0.75rem`, padding `0.75rem`
- White translucent border + float shadow (same family as dashboard panel)

Column **tints** (solid, full opacity — do not add extra opacity on top):

| Class | Background | Status |
|-------|------------|--------|
| `.kanban-column--todo` | `#ffe4e6` (rose-100) | TODO |
| `.kanban-column--progress` | `#ffedd5` (orange-100) | IN_PROGRESS |
| `.kanban-column--done` | `#ede9fe` (violet-100) | DONE |

Column **dots** (header): `bg-rose-500`, `bg-orange-500`, `bg-violet-500`.

---

## Component recipes (`components/ui/ui.tsx`)

Import `ui` for shared Tailwind class strings. Prefer these over one-off duplicates.

### Fields

| Key | Purpose |
|-----|---------|
| `ui.input` | Text inputs — `fieldSurface` + full width |
| `ui.select` | Legacy native select styling |
| `ui.focusRing` / `ui.focusWithin` | Shared field focus treatment |
| `ui.label` | `text-xs font-medium text-ink-soft` |

**Field surface behavior** (inputs, selects, focus-within rows):

- `rounded-lg border border-line bg-paper`
- Hover: `-translate-y-px`, ink border tint, white bg, soft shadow
- Focus: ink border + `0 0 0 4px rgba(26,26,26,0.12)` ring via box-shadow
- Disabled: no lift, reduced opacity

`<Select />` in `components/ui/select.tsx` mirrors the same `fieldCls` / `fieldOpenCls`.

### Buttons

| Key | Style |
|-----|--------|
| `ui.btnPrimary` | `bg-ink text-white`, shadow, hover lift, `active:scale-[0.98]` |
| `ui.btnSecondary` | bordered paper, ink text on hover |
| `ui.btnDanger` | red-50 / red-600 |
| `ui.btnGhostDanger` | ghost with red hover |

### Text utilities

| Key | Style |
|-----|--------|
| `ui.pageTitle` | `1.75rem` → `2.125rem` semibold ink |
| `ui.mutedText` | `text-sm text-ink-soft` |
| `ui.errorText` | `text-sm text-red-600` |
| `ui.successText` | `text-sm text-emerald-700` |
| `ui.linkText` | `text-ink` underline on hover |

### Cards

| Key | Style |
|-----|--------|
| `ui.card` | `rounded-2xl bg-paper shadow-sm` |

### Avatars & tags

- `Avatar({ seed, label, size })` — deterministic color from `AVATAR_COLORS`
- `tagColor(tag: string)` — deterministic chip color from `TAG_COLORS`

**Task chip base** (board): `rounded px-2 py-1 font-mono text-[10px] font-medium tracking-wide`

---

## Semantic UI (board & tasks)

Defined in `components/board/task-board.tsx` (not global tokens — keep in sync if you add statuses).

### Priority chips

| Priority | Classes |
|----------|---------|
| HIGH | `bg-rose-50 text-rose-700` |
| MEDIUM | hidden on card (default) |
| LOW | `bg-emerald-50 text-emerald-700` |

### Task cards

- Surface: `rounded-lg border border-line bg-card p-4` + light shadow
- Hover: stronger border + `shadow-[0_4px_12px_rgba(26,26,26,0.08)]`
- Title: `text-lg font-medium text-ink`
- Short ID: `font-mono text-[10px] text-ink-faint/70`
- Overdue due date: `text-red-400 font-semibold`

### Drop targets (drag-and-drop)

Per-column ring/active colors match column family (rose / orange / violet).

---

## Landing page (`lp-*`)

Marketing styles live in `landing-styles.tsx` — **prefixed `lp-`** to avoid collisions with the app.

| Pattern | Notes |
|---------|--------|
| `.lp-nav-pill` | Floating glass nav |
| `.lp-hero` / `.lp-hero-photo` | Full-bleed hero image + pan animation |
| `.lp-hero-wash` | White gradient wash for headline readability |
| `.lp-grain` | Subtle film grain overlay |
| `.lp-reveal` | Scroll-reveal (opacity + translate) |
| `.lp-marquee` | Use-case ticker |
| `.lp-tile` | Door cards — hover lift |
| `.lp-mesh` | Section background mesh |
| `.lp-wa-gradient` | WhatsApp header chip |

**Landing typography:** `font-serif` (Instrument Serif) for `h1`/`h2`; body stays Hanken. Hero scale example: `text-[2.6rem]` → `lg:text-[5.2rem]`, `tracking-tight`.

**Landing images:** optimized WebP in `public/` (`landingimg1.webp`, `landing-phone.webp`); hero uses `next/image` with blur placeholder.

---

## App shell layout

Constants in `components/layout/app-shell-shared.ts`:

- Sidebar width: `w-60` / `lg:w-64`
- Shared horizontal padding tokens: `SHELL_SIDEBAR_X`, `SHELL_MAIN_X`, `SHELL_TOP`
- Brand row: logo + `text-[1.375rem] font-semibold tracking-tight`

Main content sits on the mesh shell; workspace views use `dashboard-panel` or white cards inside.

---

## Do / don't

### Do

- Use semantic tokens (`text-ink`, `bg-paper`, `border-line`) instead of raw hex in components.
- Use `ui.*` recipes for buttons, inputs, and page titles.
- Keep kanban column tints **solid** — float effect comes from shadow, not opacity.
- Scope WhatsApp/Claude greens and oranges to integration UI.
- Use `font-mono` for task IDs, dates, and small metadata chips.
- Use `font-serif` only on marketing / editorial surfaces.

### Don't

- Don't use mint `#00c896` as a global accent (retired).
- Don't put `Instrument Serif` only inside a nested wrapper — CSS variable must be on `<html>` or headings fall back to Georgia (looks heavier).
- Don't add `transition` on `transform` for drag-and-drop cards (conflicts with dnd-kit).
- Don't use `bg-accent` expecting green — accent is ink.

---

## Extending the system

**New color:** add to `@theme` in `globals.css`, then use as `bg-*` / `text-*` Tailwind utility.

**New component variant:** add a key to `ui` in `components/ui/ui.tsx` rather than copying long class strings.

**New marketing section:** add styles to `landing-styles.tsx` with `lp-` prefix.

**New status column:** extend `.kanban-column--*` in `globals.css` and `COLUMNS` in `task-board.tsx` together.

---

## Related docs

- `docs/seo-geo-handoff.md` — logo path, marketing surface notes
- `app/landing/_components/landing-content.tsx` — reference landing composition
- `components/board/task-board.tsx` — kanban visual spec
