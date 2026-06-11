import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { listAssets, ServiceError } from "@/lib/services/project";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/app-nav";
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
  let workspace;
  try {
    [assets, workspace] = await Promise.all([
      listAssets(workspaceId, user.id),
      prisma.workspace.findUniqueOrThrow({
        where: { id: workspaceId },
        select: { id: true, name: true },
      }),
    ]);
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
    <div>
      <AppNav email={user.email} />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-8">
          <Link
            href={`/w/${workspaceId}`}
            className="text-xs text-zinc-500 hover:text-zinc-300"
          >
            ← Back to board
          </Link>
          <h1 className="mt-2 text-xl font-semibold tracking-tight">
            {workspace.name} · Assets
          </h1>
        </div>

        <div className="mb-8 max-w-2xl">
          <AssetUploadForm workspaceId={workspaceId} />
          <p className="mt-2 text-xs text-zinc-600">
            Max 10 MB. You can also send images or documents to the WhatsApp
            bot and they'll land here.
          </p>
        </div>

        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-800 p-12 text-center text-sm text-zinc-500">
            No assets yet. Upload a file above or send one to the WhatsApp bot.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((asset) => (
              <AssetCard key={asset.id} workspaceId={workspaceId} asset={asset} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
