import { redirect } from "next/navigation";

/** Members tab merged into Settings — keep old links working. */
export default async function MembersRedirectPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  redirect(`/w/${workspaceId}/settings`);
}
