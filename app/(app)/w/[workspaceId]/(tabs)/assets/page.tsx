import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getAssetsView, ServiceError } from "@/lib/services/project";
import { AssetCard, type AssetItem } from "@/components/assets/asset-card";
import { AssetUploadForm } from "@/components/assets/asset-upload-form";
import {
  formatWhatsAppBotNumber,
  getWhatsAppBotNumber,
} from "@/lib/whatsapp-bot";
import { displayUser } from "@/lib/username";
import { AssetsContentSkeleton } from "@/components/ui/tab-content-skeleton";

async function AssetsData({ workspaceId }: { workspaceId: string }) {
  const user = await requireUser();

  let data;
  try {
    data = await getAssetsView(workspaceId, user.id);
  } catch (err) {
    if (err instanceof ServiceError) notFound();
    throw err;
  }

  const { assets } = data;
  const whatsAppBotNumber = getWhatsAppBotNumber();
  const whatsAppBotLabel = whatsAppBotNumber
    ? formatWhatsAppBotNumber(whatsAppBotNumber)
    : null;

  const items: AssetItem[] = assets.map((a) => ({
    id: a.id,
    url: a.url,
    fileType: a.fileType,
    tags: a.tags,
    uploaderUsername: displayUser(a.uploadedBy),
    createdAt: a.createdAt.toISOString(),
  }));

  return (
    <>
      <div className="mb-8 max-w-2xl">
        <AssetUploadForm workspaceId={workspaceId} />
        <p className="mt-2 text-xs text-ink-faint">
          Max 10 MB. Add comma-separated tags when uploading, or edit tags on
          each card below. On WhatsApp, send a photo or document with a caption
          like{" "}
          <span className="font-mono text-ink-soft">booth, banner</span> to tag
          it. Use <span className="font-mono text-ink-soft">#42</span> in the
          caption to attach to a task. You can also message{" "}
          <span className="font-mono text-ink-soft">
            tag the last photo booth, marketing
          </span>
          {whatsAppBotLabel ? (
            <>
              {" "}
              to the bot at{" "}
              <span className="font-mono text-ink-soft">
                {whatsAppBotLabel}
              </span>
            </>
          ) : null}
          .
          {!whatsAppBotLabel ? (
            <span> Configure the bot number in Settings.</span>
          ) : null}
        </p>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-line/80 bg-paper px-8 py-14 text-center shadow-[0_1px_3px_rgba(26,26,26,0.04)]">
          <p className="font-display text-lg text-ink">Nothing here yet.</p>
          <p className="mt-1 text-sm text-ink-soft">
            Upload a file above
            {whatsAppBotLabel ? (
              <>
                {" "}
                or send one to{" "}
                <span className="font-mono text-ink">{whatsAppBotLabel}</span>{" "}
                on WhatsApp
              </>
            ) : (
              " or send one to the WhatsApp bot"
            )}
            .
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((asset) => (
            <AssetCard key={asset.id} workspaceId={workspaceId} asset={asset} />
          ))}
        </div>
      )}
    </>
  );
}

export default async function AssetsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;

  return (
    <Suspense fallback={<AssetsContentSkeleton />}>
      <AssetsData workspaceId={workspaceId} />
    </Suspense>
  );
}
