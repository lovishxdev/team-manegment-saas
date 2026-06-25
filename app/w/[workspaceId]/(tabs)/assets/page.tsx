import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { listAssets, ServiceError } from "@/lib/services/project";
import { getWorkspaceMembers } from "@/lib/services/workspace";
import { prisma } from "@/lib/prisma";
import { AssetCard, type AssetItem } from "@/components/asset-card";
import { AssetUploadForm } from "@/components/asset-upload-form";
import { WorkspacePageHeader } from "@/components/workspace-page-header";
import {
  formatWhatsAppBotNumber,
  getWhatsAppBotNumber,
} from "@/lib/whatsapp-bot";

export default async function AssetsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const user = await requireUser();

  let assets;
  let memberData;
  let workspace;
  try {
    [assets, memberData, workspace] = await Promise.all([
      listAssets(workspaceId, user.id),
      getWorkspaceMembers(workspaceId, user.id),
      prisma.workspace.findUniqueOrThrow({
        where: { id: workspaceId },
        select: { id: true, name: true },
      }),
    ]);
  } catch (err) {
    if (err instanceof ServiceError) notFound();
    throw err;
  }

  const { selfRole, members } = memberData;
  const canInvite = selfRole === "LEADER" || selfRole === "SUB_LEADER";
  const whatsAppBotNumber = getWhatsAppBotNumber();
  const whatsAppBotLabel = whatsAppBotNumber
    ? formatWhatsAppBotNumber(whatsAppBotNumber)
    : null;

  const items: AssetItem[] = assets.map((a) => ({
    id: a.id,
    url: a.url,
    fileType: a.fileType,
    tags: a.tags,
    uploaderEmail: a.uploadedBy.email,
    createdAt: a.createdAt.toISOString(),
  }));

  return (
    <main className="mx-auto w-full max-w-6xl">
      <WorkspacePageHeader
        workspaceId={workspaceId}
        workspaceName={workspace.name}
        activeTab="assets"
        breadcrumbLeaf="Assets"
        members={members.map((m) => ({
          id: m.user.id,
          label: m.user.username ?? m.user.email,
        }))}
        canInvite={canInvite}
      />

      <div className="mb-8 max-w-2xl">
        <AssetUploadForm workspaceId={workspaceId} />
        <p className="mt-2 text-xs text-ink-faint">
          Max 10 MB. You can also send images or documents to the WhatsApp bot
          {whatsAppBotLabel ? (
            <>
              {" "}
              at{" "}
              <span className="font-mono text-ink-soft">
                {whatsAppBotLabel}
              </span>
            </>
          ) : null}{" "}
          and they&apos;ll land here.{" "}
          {!whatsAppBotLabel ? (
            <span>Configure the bot number in Settings.</span>
          ) : null}
        </p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line-strong bg-paper p-12 text-center">
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
    </main>
  );
}
