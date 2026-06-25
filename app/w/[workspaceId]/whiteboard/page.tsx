import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ServiceError } from "@/lib/services/project";
import { getExcalidrawState } from "@/lib/services/workspace";
import { Whiteboard } from "@/components/whiteboard";
import { displayUser } from "@/lib/username";

export default async function WhiteboardPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const user = await requireUser();

  let workspace;
  try {
    workspace = await getExcalidrawState(workspaceId, user.id);
  } catch (err) {
    if (err instanceof ServiceError) notFound();
    throw err;
  }

  const initialState =
    workspace.excalidrawState && typeof workspace.excalidrawState === "object"
      ? (workspace.excalidrawState as Record<string, unknown>)
      : {};

  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-12 shrink-0 items-center gap-4 border-b border-line bg-paper px-4">
        <Link
          href={`/w/${workspaceId}`}
          className="text-xs text-ink-soft transition hover:text-ink"
        >
          ← Board
        </Link>
        <h1 className="font-display text-sm font-semibold">
          {workspace.name} · Whiteboard
        </h1>
      </header>
      <div className="min-h-0 flex-1">
        <Whiteboard
          workspaceId={workspaceId}
          initialState={initialState}
          userLabel={displayUser(user)}
        />
      </div>
    </div>
  );
}
