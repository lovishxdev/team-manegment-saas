"use client";

import { useState, useTransition } from "react";
import { acceptInviteAction } from "@/lib/actions/workspace";

export function JoinButton({ inviteId }: { inviteId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function join() {
    setError(null);
    startTransition(async () => {
      const result = await acceptInviteAction(inviteId);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={join}
        disabled={pending}
        className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-60"
      >
        {pending ? "Joining..." : "Join workspace"}
      </button>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
