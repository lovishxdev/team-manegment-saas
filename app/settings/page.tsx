import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { CopyField } from "@/components/copy-field";
import { PhoneForm } from "@/components/phone-form";
import { RegenerateToken } from "@/components/regenerate-token";
import { UsernameForm } from "@/components/username-form";

export default async function SettingsPage() {
  const user = await requireUser();

  return (
    <AppShell userId={user.id} userLabel={user.username ?? user.email}>
      <main className="mx-auto max-w-2xl px-6 py-8">
        <h1 className="mb-8 font-display text-2xl font-semibold tracking-tight">
          Settings
        </h1>

        <section className="mb-6 rounded-lg border border-line bg-card p-6">
          <h2 className="font-display text-base font-semibold">Profile</h2>
          <p className="mb-4 mt-1 text-sm text-ink-soft">
            Signed in as{" "}
            <span className="font-mono text-xs text-ink">{user.email}</span>.
            Pick a username your teammates will see on boards and member lists.
          </p>
          <UsernameForm currentUsername={user.username} />
        </section>

        <section className="mb-6 rounded-lg border border-line bg-card p-6">
          <h2 className="font-display text-base font-semibold">WhatsApp</h2>
          <p className="mb-4 mt-1 text-sm text-ink-soft">
            Link your phone number to manage tasks by messaging the bot.
          </p>
          <PhoneForm currentPhone={user.phone} />
        </section>

        <section className="rounded-lg border border-line bg-card p-6">
          <h2 className="font-display text-base font-semibold">
            Claude App connector
          </h2>
          <p className="mb-4 mt-1 text-sm text-ink-soft">
            Add this app as a custom connector in Claude (Settings &gt;
            Connectors) using the MCP endpoint{" "}
            <code className="rounded-md bg-paper-deep px-1.5 py-0.5 text-xs">
              /api/mcp
            </code>{" "}
            and the token below as your Bearer token. Treat it like a password.
          </p>
          <CopyField value={user.mcpToken} />
          <RegenerateToken />
        </section>
      </main>
    </AppShell>
  );
}
