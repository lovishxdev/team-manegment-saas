import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ServiceError } from "@/lib/services/project";
import { getExcalidrawState } from "@/lib/services/workspace";
import { Whiteboard } from "@/components/whiteboard";

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
      <header className="flex h-12 shrink-0 items-center gap-4 border-b border-zinc-800 px-4">
        <Link
          href={`/w/${workspaceId}`}
          className="text-xs text-zinc-500 transition hover:text-zinc-200"
        >
          ← Board
        </Link>
        <h1 className="text-sm font-medium">{workspace.name} · Whiteboard</h1>
      </header>
      <div className="min-h-0 flex-1">
        <Whiteboard
          workspaceId={workspaceId}
          initialState={initialState}
          userLabel={user.email ?? "Anonymous"}
        />
      </div>
    </div>
  );
}
