import { requireUser } from "@/lib/auth";
import { AppNav } from "@/components/app-nav";
import { CopyField } from "@/components/copy-field";
import { PhoneForm } from "@/components/phone-form";
import { RegenerateToken } from "@/components/regenerate-token";

export default async function SettingsPage() {
  const user = await requireUser();

  return (
    <div>
      <AppNav email={user.email} />
      <main className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="mb-8 text-xl font-semibold tracking-tight">Settings</h1>

        <section className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
          <h2 className="font-medium">WhatsApp</h2>
          <p className="mb-4 mt-1 text-sm text-zinc-400">
            Link your phone number to manage tasks by messaging the bot.
          </p>
          <PhoneForm currentPhone={user.phone} />
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
          <h2 className="font-medium">Claude App connector</h2>
          <p className="mb-4 mt-1 text-sm text-zinc-400">
            Add this app as a custom connector in Claude (Settings &gt;
            Connectors) using the MCP endpoint{" "}
            <code className="rounded bg-zinc-950 px-1.5 py-0.5 text-xs">
              /api/mcp
            </code>{" "}
            and the token below as your Bearer token. Treat it like a password.
          </p>
          <CopyField value={user.mcpToken} />
          <RegenerateToken />
        </section>
      </main>
    </div>
  );
}
