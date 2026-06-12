"use client";

import { useActionState, useEffect, useRef } from "react";
import { uploadAssetAction, type ActionState } from "@/lib/actions/workspace";
import { ui } from "@/components/ui";

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
        className="flex-1 rounded-md border border-line bg-card px-3 py-2 text-sm text-ink-soft file:mr-3 file:rounded file:border-0 file:bg-white file:px-3 file:py-1 file:font-mono file:text-xs file:text-black"
      />
      <input
        name="tags"
        placeholder="tags, comma, separated"
        className={`sm:w-56 ${ui.input}`}
      />
      <button type="submit" disabled={pending} className={ui.btnPrimary}>
        {pending ? "Uploading..." : "Upload"}
      </button>
      {state.error && (
        <p className="text-sm text-red-300 sm:self-center">{state.error}</p>
      )}
    </form>
  );
}
