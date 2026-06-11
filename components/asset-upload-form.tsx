"use client";

import { useActionState, useEffect, useRef } from "react";
import { uploadAssetAction, type ActionState } from "@/lib/actions/workspace";

const initialState: ActionState = {};

export function AssetUploadForm({ workspaceId }: { workspaceId: string }) {
  const action = uploadAssetAction.bind(null, workspaceId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!pending && !state.error) formRef.current?.reset();
  }, [pending, state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-2 sm:flex-row sm:items-start"
    >
      <input
        name="file"
        type="file"
        required
        className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-400 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-800 file:px-3 file:py-1 file:text-xs file:text-zinc-200"
      />
      <input
        name="tags"
        placeholder="tags, comma, separated"
        className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm placeholder-zinc-600 outline-none focus:border-indigo-500"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-60"
      >
        {pending ? "Uploading..." : "Upload"}
      </button>
      {state.error && (
        <p className="text-sm text-red-400 sm:self-center">{state.error}</p>
      )}
    </form>
  );
}
