"use client";

import { useActionState } from "react";
import {
  disconnectMcpConnectionAction,
  type SettingsState,
} from "@/lib/actions/settings";
import { ui } from "@/components/ui/ui";
import type { McpOAuthConnection } from "@/lib/settings/load-account-settings";

const initialState: SettingsState = {};

/**
 * Active OAuth connections with server-side revocation. Removing a server
 * inside the client app (Cursor, Claude) never reaches Euclis — this is the
 * authoritative "disconnect", after which the app's next call gets a 401
 * and re-adding runs a fresh OAuth consent.
 */
export function McpConnectionList({
  connections,
}: {
  connections: McpOAuthConnection[];
}) {
  const [state, formAction, pending] = useActionState(
    disconnectMcpConnectionAction,
    initialState
  );

  if (connections.length === 0) {
    return (
      <p className="text-xs text-ink-faint">
        No active connections. Removing an app&apos;s access here is the
        authoritative disconnect — deleting the server inside the app alone
        doesn&apos;t revoke it.
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-line bg-paper px-3 py-2.5">
      <p className="text-xs font-medium text-ink">Active connections</p>
      <ul className="mt-2 space-y-2">
        {connections.map((row) => (
          <li
            key={row.clientId}
            className="flex items-center justify-between gap-3"
          >
            <span className="min-w-0 text-xs text-ink-soft">
              <span className="font-medium text-ink">{row.clientName}</span>
              {" · "}
              {row.scope} scope
              {row.workspaceId ? " · pinned workspace" : " · all workspaces"}
              {" · since "}
              {row.connectedAt.slice(0, 10)}
            </span>
            <form action={formAction}>
              <input type="hidden" name="clientId" value={row.clientId} />
              <button
                type="submit"
                disabled={pending}
                aria-busy={pending}
                className={`${ui.btnSecondary} h-7 px-2.5 py-0 text-xs`}
              >
                Disconnect
              </button>
            </form>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-ink-faint">
        Disconnecting revokes the app&apos;s tokens immediately — reconnect
        from the app to sign in again (fresh consent, new scope/workspace
        choices). Removing the server inside the app alone doesn&apos;t revoke
        access here.
      </p>
      {state.error && <p className={ui.errorText}>{state.error}</p>}
      {state.message && <p className={ui.successText}>{state.message}</p>}
    </div>
  );
}
