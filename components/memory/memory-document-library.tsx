"use client";

import { useState } from "react";
import { fetchMemoryDocumentAction } from "@/lib/actions/workspace";
import { MarkdownContent } from "@/components/markdown/markdown-content";
import { AppModal } from "@/components/ui/app-modal";

export type MemoryDocumentView = {
  id: string;
  path: string;
  title: string;
  tags: string[];
  updatedAt: string;
  authorLabel: string | null;
  eventCount: number;
};

function DocumentCard({
  workspaceId,
  document,
}: {
  workspaceId: string;
  document: MemoryDocumentView;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    if (content !== null) {
      setOpen(true);
      return;
    }
    setLoading(true);
    setError(null);
    const result = await fetchMemoryDocumentAction(workspaceId, document.id);
    setLoading(false);
    if (result.error || result.content === null) {
      setError(result.error ?? "Document could not be loaded");
      return;
    }
    setContent(result.content);
    setOpen(true);
  }

  return (
    <article className="rounded-xl border border-line bg-card p-4 shadow-[0_1px_3px_rgba(26,26,26,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-medium text-ink">
            {document.title}
          </h3>
          <p className="mt-1 truncate font-mono text-[10px] text-ink-faint">
            {document.path}
          </p>
        </div>
        <span className="shrink-0 rounded bg-paper-deep px-2 py-1 font-mono text-[10px] text-ink-soft">
          {document.eventCount} event{document.eventCount === 1 ? "" : "s"}
        </span>
      </div>

      {document.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {document.tags.map((tag) => (
            <span
              key={tag}
              className="rounded bg-paper-deep px-1.5 py-0.5 font-mono text-[10px] text-ink-soft"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-ink-faint">
        <span>
          Updated{" "}
          {new Date(document.updatedAt).toLocaleDateString("en-GB", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
          {document.authorLabel ? ` · @${document.authorLabel}` : ""}
        </span>
        <button
          type="button"
          onClick={toggle}
          disabled={loading}
          aria-expanded={open}
          className="font-medium text-ink-soft underline-offset-2 hover:text-ink hover:underline disabled:opacity-50"
        >
          {loading ? "Loading…" : open ? "Hide preview" : "Preview"}
        </button>
      </div>

      {error && <p className="mt-3 text-xs text-rose-600">{error}</p>}
      {open && content !== null && (
        <AppModal
          size="xl"
          title={document.title}
          subtitle={document.path}
          onClose={() => setOpen(false)}
          bodyClassName="overflow-y-auto"
        >
          <div className="p-5 sm:p-6">
            <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-line pb-4">
              {document.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded bg-paper-deep px-2 py-1 font-mono text-[10px] text-ink-soft"
                >
                  #{tag}
                </span>
              ))}
              <span className="ml-auto text-xs text-ink-faint">
                {document.eventCount} linked event
                {document.eventCount === 1 ? "" : "s"}
              </span>
            </div>
            <MarkdownContent source={content} />
          </div>
        </AppModal>
      )}
    </article>
  );
}

export function MemoryDocumentLibrary({
  workspaceId,
  documents,
}: {
  workspaceId: string;
  documents: MemoryDocumentView[];
}) {
  if (documents.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line py-8 text-center text-sm text-ink-soft">
        No Markdown sources have been synced yet. Complete an agent run to
        begin indexing repository documents.
      </div>
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {documents.map((document) => (
        <DocumentCard
          key={document.id}
          workspaceId={workspaceId}
          document={document}
        />
      ))}
    </div>
  );
}
