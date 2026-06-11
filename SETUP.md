# External Setup Guide

Everything outside the codebase that you need to configure, in order. Copy
`.env.example` to `.env` first and fill values in as you go.

```bash
cp .env.example .env
```

---

## 1. Supabase (database + storage)

1. Create a project at [supabase.com/dashboard](https://supabase.com/dashboard).
2. Go to **Project Settings > Database > Connection string** (or click "Connect" at the top) and copy both URLs:
   - **Transaction pooler** (port `6543`) -> `DATABASE_URL`. Append `?pgbouncer=true`.
   - **Session / direct** (port `5432`) -> `DIRECT_URL`.

   Why two URLs: the app runs queries through PgBouncer (handles many
   serverless connections), but PgBouncer can't run DDL, so Prisma
   migrations use the direct connection (wired up in `prisma.config.ts`).
3. Go to **Project Settings > API** and copy:
   - Project URL -> `SUPABASE_URL`
   - `service_role` secret key -> `SUPABASE_SERVICE_ROLE_KEY` (server-only; never expose to a browser)
4. Create the tables:

```bash
npx prisma migrate dev --name init
```

5. Create the Storage bucket for assets. Either in the dashboard
   (**Storage > New bucket**, name `assets`, Public ON) or via SQL Editor:

```sql
insert into storage.buckets (id, name, public)
values ('assets', 'assets', true);
```

6. (Optional, for the future web dashboard) Realtime: writes go through
   Prisma, but Supabase Realtime picks them up at the Postgres level via
   `postgres_changes`. Enable it per table under
   **Database > Replication > supabase_realtime** when you build the frontend.

---

## 2. Anthropic (Claude API)

1. Create an API key at [console.anthropic.com](https://console.anthropic.com/settings/keys) -> `ANTHROPIC_API_KEY`.
2. This key is used **only** by the WhatsApp webhook (Haiku parses message intent).
   The Claude App MCP connector costs you nothing: users bring their own
   Claude subscription and authenticate with their personal `mcpToken`.

---

## 3. Meta WhatsApp Cloud API

1. Create an app at [developers.facebook.com/apps](https://developers.facebook.com/apps)
   (type: **Business**), then add the **WhatsApp** product.
2. From **WhatsApp > API Setup** copy:
   - **Phone number ID** (the long numeric ID, not the phone number) -> `WHATSAPP_PHONE_NUMBER_ID`
   - **Temporary access token** -> `WHATSAPP_ACCESS_TOKEN`
     (lasts 24h; for production, create a System User token under Business
     Settings to get a permanent one)
3. From **App Settings > Basic** copy the **App Secret** -> `WHATSAPP_APP_SECRET`
   (used to verify webhook signatures so forged requests are rejected).
4. Choose any random string for `WHATSAPP_VERIFY_TOKEN` (e.g. `openssl rand -hex 16`).
5. Expose your local server publicly for development:

```bash
npm run dev          # terminal 1
ngrok http 3000      # terminal 2 (or cloudflared tunnel)
```

6. In **WhatsApp > Configuration > Webhook**, set:
   - Callback URL: `https://<your-tunnel-domain>/api/webhooks/whatsapp`
   - Verify token: the same string you put in `WHATSAPP_VERIFY_TOKEN`
   - Click **Verify and save** (this triggers the GET handshake), then
     subscribe to the **messages** webhook field.
7. Add your personal WhatsApp number as a recipient in **API Setup**
   (test numbers can only message allow-listed recipients), and make sure a
   `User` row exists with `phone` matching your number in E.164 format
   without `+` (e.g. `919876543210`) — that's the format Meta sends.

---

## 4. Claude App (Remote MCP connector)

1. Each user has a `mcpToken` (UUID) generated automatically on their `User` row.
2. In the Claude App: **Settings > Connectors > Add custom connector**:
   - URL: `https://<your-host>/api/mcp`
   - Authentication: Bearer token = the user's `mcpToken`
3. Claude discovers `create_task`, `update_task`, and `get_board_state`
   automatically. Note: the MCP endpoint also needs a public HTTPS URL, so
   use the tunnel during development.

---

## 5. Web dashboard auth (Supabase Auth)

Identity (passwords, OAuth) lives in Supabase Auth; your `User` table is a
profile mirror kept in sync by a trigger.

1. Apply the database-side setup (auth trigger + RLS policies + Realtime):

```bash
npx prisma db execute --file supabase/setup.sql
```

2. Make sure `.env` has the browser-side variables:
   - `NEXT_PUBLIC_SUPABASE_URL` (same as `SUPABASE_URL`)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the **publishable** `sb_publishable_...` key — NOT the secret key)
3. Email/password works out of the box. For local dev convenience you can
   disable email confirmation: **Authentication > Sign In / Providers >
   Email > Confirm email** (toggle off). With it on, users must click the
   email link before they can sign in.
4. **GitHub OAuth**: GitHub > Settings > Developer settings > OAuth Apps >
   New OAuth App. Homepage `http://localhost:3000`, callback:

```
https://<project-ref>.supabase.co/auth/v1/callback
```

   Copy Client ID + a generated secret into Supabase **Authentication >
   Sign In / Providers > GitHub** and enable.
5. **Google OAuth**: [console.cloud.google.com](https://console.cloud.google.com)
   > new project > OAuth consent screen (External, add yourself as test
   user) > Credentials > Create OAuth client ID (Web application) > add the
   same Supabase callback URL as an authorized redirect URI. Copy ID +
   secret into Supabase's Google provider and enable.
6. Run `npm run dev` and open `http://localhost:3000` — you'll be
   redirected to `/login`.

Pages: `/dashboard` (workspaces), `/w/<id>` (live task board), `/settings`
(WhatsApp phone + Claude MCP token), `/invite/<id>` (join links).

---

## 6. Claude connectors (MCP)

Two ways to connect Claude, depending on the surface:

**claude.ai web + mobile (OAuth, recommended):**
1. claude.ai > Settings > Connectors > **Add custom connector**
2. URL: `https://<your-host>/api/mcp` — no client ID needed
3. Claude discovers the OAuth endpoints automatically, registers itself,
   and opens your consent page. Log in with your dashboard account, click
   **Allow access**. The connector then works on web AND in the mobile apps.

**Claude Desktop (static token, no OAuth needed):**
Settings > Developer > Edit Config:

```json
{
  "mcpServers": {
    "teams": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://<your-host>/api/mcp",
        "--header",
        "Authorization: Bearer <your-mcpToken-from-settings-page>"
      ]
    }
  }
}
```

---

## 7. Deploying to Vercel

1. Push the repo to GitHub, then import it at [vercel.com/new](https://vercel.com/new).
2. Add ALL environment variables from `.env` in the Vercel project settings
   (Production environment). `postinstall` runs `prisma generate`
   automatically during the build.
3. Migrations are NOT run by the build. Apply them from your machine:

```bash
npx prisma migrate deploy
```

   (They're already applied if you've been developing against the same
   Supabase project.)
4. After the first deploy you get a stable URL — update:
   - **Meta webhook** Callback URL -> `https://<app>.vercel.app/api/webhooks/whatsapp`
   - **Claude connector** URL -> `https://<app>.vercel.app/api/mcp`
   - **Supabase Auth**: Authentication > URL Configuration > set Site URL to
     the Vercel URL and add it to Redirect URLs (otherwise OAuth logins
     bounce back to localhost).
5. Swap the 24-hour WhatsApp token for a permanent one: Meta **Business
   Settings > Users > System users** > create a system user > Add asset
   (your app) > Generate token with `whatsapp_business_messaging` +
   `whatsapp_business_management` permissions. Put it in Vercel's
   `WHATSAPP_ACCESS_TOKEN`.

---

## Smoke-testing without external services

- `npx prisma validate` — schema is well-formed.
- `npm run typecheck` — everything compiles.
- `npx prisma studio` — browse/seed data manually once Supabase is wired up.
- Create a test user + workspace quickly via Studio, set your `phone`, then
  message the bot "add a task to fix login" and watch the row appear.
