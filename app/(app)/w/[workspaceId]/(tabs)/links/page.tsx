import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ServiceError } from "@/lib/services/project";
import { getLinksView } from "@/lib/services/links";
import { LinkForm } from "@/components/link-form";
import { LinkRow, type LinkItem } from "@/components/link-row";
import { WorkspacePageHeader } from "@/components/workspace-page-header";
import { displayUser } from "@/lib/username";
import { Role } from "@/lib/generated/prisma/client";

export default async function LinksPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const user = await requireUser();

  let data;
  try {
    data = await getLinksView(workspaceId, user.id);
  } catch (err) {
    if (err instanceof ServiceError) notFound();
    throw err;
  }

  const { workspace, links, selfRole } = data;
  const canInvite =
    selfRole === Role.LEADER || selfRole === Role.SUB_LEADER;

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
    <main className="mx-auto w-full max-w-6xl">
      <WorkspacePageHeader
        workspaceId={workspaceId}
        workspaceName={workspace.name}
        activeTab="links"
        breadcrumbLeaf="Links"
        members={[]}
        canInvite={canInvite}
      />

      <section className="mb-8 max-w-2xl">
        <h2 className="mb-1 text-sm font-semibold text-ink">Add a link</h2>
        <p className="mb-4 text-sm text-ink-soft">
          Save important URLs for the whole workspace — docs, Figma files,
          staging sites, and anything the team needs quick access to.
        </p>
        <LinkForm workspaceId={workspaceId} />
      </section>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line-strong bg-paper p-12 text-center">
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
    </main>
  );
}
