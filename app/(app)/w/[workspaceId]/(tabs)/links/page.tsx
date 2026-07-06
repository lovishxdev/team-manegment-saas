import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ServiceError } from "@/lib/services/project";
import { getLinksView } from "@/lib/services/links";
import { LinkForm } from "@/components/links/link-form";
import { LinkRow, type LinkItem } from "@/components/links/link-row";
import { displayUser } from "@/lib/username";
import { LinksContentSkeleton } from "@/components/ui/tab-content-skeleton";

async function LinksData({ workspaceId }: { workspaceId: string }) {
  const user = await requireUser();

  let data;
  try {
    data = await getLinksView(workspaceId, user.id);
  } catch (err) {
    if (err instanceof ServiceError) notFound();
    throw err;
  }

  const { links } = data;

  const items: LinkItem[] = links.map((link) => ({
    id: link.id,
    title: link.title,
    url: link.url,
    description: link.description,
    pinned: link.pinned,
    creatorLabel: displayUser(link.createdBy),
    createdAt: link.createdAt.toISOString(),
  }));

  return (
    <>
      <section className="mb-8 max-w-2xl">
        <h2 className="mb-1 text-sm font-semibold text-ink">Add a link</h2>
        <p className="mb-4 text-sm text-ink-soft">
          Save important URLs for the whole workspace: docs, Figma files,
          staging sites, and anything the team needs quick access to.
        </p>
        <LinkForm workspaceId={workspaceId} />
      </section>

      {items.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-line/80 bg-paper px-8 py-14 text-center shadow-[0_1px_3px_rgba(26,26,26,0.04)]">
          <p className="font-display text-lg text-ink">No links yet.</p>
          <p className="mt-1 text-sm text-ink-soft">
            Add your first bookmark above so everyone on the team can find it.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((link) => (
            <LinkRow key={link.id} workspaceId={workspaceId} link={link} />
          ))}
        </div>
      )}
    </>
  );
}

export default async function LinksPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;

  return (
    <Suspense fallback={<LinksContentSkeleton />}>
      <LinksData workspaceId={workspaceId} />
    </Suspense>
  );
}
