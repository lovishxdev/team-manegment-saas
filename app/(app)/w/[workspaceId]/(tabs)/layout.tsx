import { Suspense } from "react";
import { WorkspaceTabsLayout } from "@/components/workspace/workspace-tabs-layout";
import { WorkspaceTitle } from "@/components/workspace/workspace-title";
import { WorkspaceHeaderActionsLoader } from "@/components/workspace/workspace-header-actions-loader";

function TitleSkeleton() {
  return (
    <div
      aria-hidden
      className="mt-5 h-12 w-64 max-w-full animate-pulse rounded-lg bg-paper-deep/70 sm:h-14 sm:w-80"
    />
  );
}

function HeaderActionsSkeleton() {
  return (
    <div
      aria-hidden
      className="flex items-center gap-3"
    >
      <div className="flex items-center pr-1">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-9 w-9 animate-pulse rounded-full bg-paper-deep/70 ring-2 ring-shell"
            style={{ marginLeft: i === 0 ? 0 : -10, zIndex: 3 - i }}
          />
        ))}
      </div>
      <div className="h-9 w-16 animate-pulse rounded-full bg-paper-deep/70" />
    </div>
  );
}

/**
 * Shared workspace chrome (tabs + breadcrumb) lives here so tab clicks update
 * instantly from the URL while each page streams its own content via Suspense.
 */
export default async function WorkspaceTabsRouteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;

  return (
    <WorkspaceTabsLayout
      workspaceId={workspaceId}
      title={
        <Suspense fallback={<TitleSkeleton />}>
          <WorkspaceTitle workspaceId={workspaceId} />
        </Suspense>
      }
      headerActions={
        <Suspense fallback={<HeaderActionsSkeleton />}>
          <WorkspaceHeaderActionsLoader workspaceId={workspaceId} />
        </Suspense>
      }
    >
      {children}
    </WorkspaceTabsLayout>
  );
}
