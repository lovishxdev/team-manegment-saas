"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";
import {
  createInviteAction,
  createWorkspaceWithInviteAction,
  type ActionState,
} from "@/lib/actions/workspace";
import { fetchWorkspacesLedStatusAction } from "@/lib/actions/billing";
import { CopyField } from "@/components/ui/copy-field";
import { ui } from "@/components/ui/ui";

const initialState: ActionState = {};

function inviteUrl(inviteId: string) {
  return `${window.location.origin}/invite/${inviteId}`;
}

export function CreateWorkspaceModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [state, formAction, pending] = useActionState(
    createWorkspaceWithInviteAction,
    initialState
  );
  const [invitePending, startInviteTransition] = useTransition();
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [capReason, setCapReason] = useState<string | null>(null);
  const workspaceId = state.workspaceId;
  const created = Boolean(workspaceId);

  useEffect(() => {
    let active = true;
    fetchWorkspacesLedStatusAction().then((result) => {
      if (!active || !result.status || result.status.canCreate) return;
      setCapReason(
        result.status.limit === 1
          ? "The Hobby plan includes 1 workspace. Upgrade to Team to create more."
          : `Your plan allows up to ${result.status.limit} workspaces. Upgrade to create more.`
      );
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!state.inviteId) return;
    setInviteLink(inviteUrl(state.inviteId));
    setInviteError(null);
  }, [state.inviteId]);

  useEffect(() => {
    if (!state.workspaceId) return;
    router.refresh();
  }, [state.workspaceId, router]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function generateInviteLink() {
    if (!workspaceId) return;
    setInviteError(null);
    startInviteTransition(async () => {
      const result = await createInviteAction(workspaceId);
      if (result.error) {
        setInviteError(result.error);
      } else if (result.inviteId) {
        setInviteLink(inviteUrl(result.inviteId));
      }
    });
  }

  function openWorkspace() {
    if (!workspaceId) return;
    onClose();
    router.push(`/w/${workspaceId}`);
  }

  const nameField = (
    <div>
      <label
        htmlFor="workspace-name"
        className="mb-2 block text-sm font-medium text-ink-soft"
      >
        Workspace name<span className="text-ink-faint">*</span>
      </label>
      <input
        id="workspace-name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        readOnly={created || pending}
        placeholder="Ex. Product squad"
        className={`${ui.input} text-base`}
        autoFocus={!created}
      />
    </div>
  );

  return (
    <div
      className="app-scope fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-line bg-card shadow-[0_24px_80px_rgba(26,26,26,0.18)]"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-workspace-title"
      >
        <div className="modal-accent-band h-28 border-b border-line/60" aria-hidden />

        <div className="px-7 pb-7 pt-6">
          <h2
            id="create-workspace-title"
            className="text-left text-xl font-semibold tracking-tight text-ink"
          >
            New Workspace
          </h2>

          <div className="mt-6 space-y-5">
            {created ? (
              <>
                {nameField}

                <div>
                  <label className="mb-2 block text-sm font-medium text-ink-soft">
                    Invitation
                  </label>
                  {inviteLink ? (
                    <CopyField value={inviteLink} secret={false} />
                  ) : (
                    <button
                      type="button"
                      onClick={generateInviteLink}
                      disabled={invitePending}
                      className={`${ui.btnSecondary} w-full py-3 text-base`}
                    >
                      {invitePending ? "Generating…" : "Generate link"}
                    </button>
                  )}
                  {inviteError ? (
                    <p className="mt-2 text-sm text-red-600">{inviteError}</p>
                  ) : null}
                  {inviteLink ? (
                    <button
                      type="button"
                      onClick={generateInviteLink}
                      disabled={invitePending}
                      className="mt-2 text-sm text-ink-faint underline-offset-2 transition hover:text-ink hover:underline disabled:opacity-60"
                    >
                      Generate new link
                    </button>
                  ) : null}
                </div>

                <div className="flex flex-col gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={openWorkspace}
                    className={`${ui.btnPrimary} w-full py-3 text-base`}
                  >
                    Open workspace
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className={`${ui.btnSecondary} w-full py-3 text-base`}
                  >
                    Done
                  </button>
                </div>
              </>
            ) : (
              <form action={formAction} className="space-y-5">
                <input type="hidden" name="name" value={name} />
                {nameField}

                {capReason ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
                    {capReason}
                  </div>
                ) : null}

                {state.error ? (
                  <p className="text-sm text-red-600">{state.error}</p>
                ) : null}

                <button
                  type="submit"
                  disabled={pending || Boolean(capReason)}
                  aria-busy={pending}
                  className={`${ui.btnPrimary} w-full py-3 text-base`}
                >
                  {pending ? "Creating…" : "Create workspace"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
