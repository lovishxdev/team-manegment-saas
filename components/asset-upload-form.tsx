"use client";

import { useActionState, useEffect, useMemo, useRef } from "react";
import { uploadAssetAction, type ActionState } from "@/lib/actions/workspace";
import { ui } from "@/components/ui";

const initialState: ActionState = {};

export function AssetUploadForm({ workspaceId }: { workspaceId: string }) {
  const action = useMemo(
    () => uploadAssetAction.bind(null, workspaceId),
    [workspaceId]
  );
  const [state, formAction, pending] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!pending && !state.error) formRef.current?.reset();
  }, [pending, state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2">
      <div className={`${ui.inputRow} flex-col sm:flex-row`}>
        <div className={ui.inputRowField}>
          <input
            name="file"
            type="file"
            required
            disabled={pending}
            className="w-full rounded-md border border-line bg-card px-3 py-2 text-sm text-ink-soft file:mr-3 file:rounded file:border-0 file:bg-white file:px-3 file:py-1 file:font-mono file:text-xs file:text-black"
          />
        </div>
        <div className="w-full shrink-0 sm:w-56">
          <input
            name="tags"
            disabled={pending}
            placeholder="tags, comma, separated"
            className={ui.input}
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className={`${ui.btnPrimary} ${ui.btnShrink} w-full self-center sm:w-auto`}
        >
          Upload
        </button>
      </div>
      {state.error && <p className="text-sm text-red-300">{state.error}</p>}
    </form>
  );
}
