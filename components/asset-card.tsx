"use client";

import { useState, useTransition } from "react";
import { deleteAssetAction } from "@/lib/actions/workspace";

export type AssetItem = {
  id: string;
  url: string;
  fileType: string;
  tags: string[];
  uploaderEmail: string | null;
  createdAt: string;
};

export function AssetCard({
  workspaceId,
  asset,
}: {
  workspaceId: string;
  asset: AssetItem;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isImage = asset.fileType.startsWith("image/");
  const fileName = decodeURIComponent(
    asset.url.split("/").pop()?.replace(/^\d+-/, "") ?? "file"
  );

  function remove() {
    if (!window.confirm(`Delete "${fileName}"?`)) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteAssetAction(workspaceId, asset.id);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="group overflow-hidden rounded-lg border border-line bg-card transition hover:border-line-strong">
      <a href={asset.url} target="_blank" rel="noreferrer" className="block">
        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={asset.url}
            alt={fileName}
            className="h-36 w-full object-cover transition group-hover:opacity-90"
          />
        ) : (
          <div className="flex h-36 w-full items-center justify-center bg-paper-deep text-3xl">
            📄
          </div>
        )}
      </a>
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-xs font-medium text-ink" title={fileName}>
            {fileName}
          </p>
          <button
            onClick={remove}
            disabled={pending}
            title="Delete asset"
            className="shrink-0 text-sm leading-none text-ink-faint transition hover:text-red-400 disabled:opacity-60"
          >
            ×
          </button>
        </div>
        <p className="mt-1 text-[10px] text-ink-faint">
          {asset.uploaderEmail?.split("@")[0] ?? "unknown"} ·{" "}
          {new Date(asset.createdAt).toLocaleDateString("en-GB")}
        </p>
        {asset.tags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {asset.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-md bg-paper-deep px-1.5 py-0.5 text-[10px] text-ink-soft"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        {error && <p className="mt-1 text-xs text-red-300">{error}</p>}
      </div>
    </div>
  );
}
