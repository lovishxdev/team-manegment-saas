"use client";

import { useState, useTransition } from "react";
import { acceptInviteAction } from "@/lib/actions/workspace";
import { ui } from "@/components/ui/ui";

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
        aria-busy={pending}
        className={`whitespace-nowrap px-6 ${ui.btnPrimary}`}
      >
        {pending ? "Joining…" : "Join workspace"}
      </button>
      {error && <p className={ui.errorText}>{error}</p>}
    </div>
  );
}
