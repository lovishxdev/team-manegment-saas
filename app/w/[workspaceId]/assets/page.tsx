import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { listAssets, ServiceError } from "@/lib/services/project";
import { AppShell } from "@/components/app-shell";
import { AssetCard, type AssetItem } from "@/components/asset-card";
import { AssetUploadForm } from "@/components/asset-upload-form";

export default async function AssetsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const user = await requireUser();

  let assets;
  try {
    assets = await listAssets(workspaceId, user.id);
  } catch (err) {
    if (err instanceof ServiceError) notFound();
    throw err;
  }

  const items: AssetItem[] = assets.map((a) => ({
    id: a.id,
    url: a.url,
    fileType: a.fileType,
    tags: a.tags,
    uploaderEmail: a.uploadedBy.email,
    createdAt: a.createdAt.toISOString(),
  }));

  return (
    <AppShell
      userId={user.id}
      userLabel={user.username ?? user.email}
      activeWorkspaceId={workspaceId}
      activeTab="assets"
    >
      <main className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="mb-8 font-display text-2xl font-semibold tracking-tight">
          Assets
        </h1>

        <div className="mb-8 max-w-2xl">
          <AssetUploadForm workspaceId={workspaceId} />
          <p className="mt-2 text-xs text-ink-faint">
            Max 10 MB. You can also send images or documents to the WhatsApp
            bot and they&apos;ll land here.
          </p>
        </div>

        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-line-strong p-12 text-center">
            <p className="font-display text-lg text-ink">Nothing here yet.</p>
            <p className="mt-1 text-sm text-ink-soft">
              Upload a file above or send one to the WhatsApp bot.
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
    </AppShell>
  );
}
