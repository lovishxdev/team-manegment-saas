function Pulse({ className }: { className: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-paper-deep/70 ${className}`}
    />
  );
}

export function BoardContentSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <div aria-hidden className="kanban-column kanban-column--todo h-80 animate-pulse" />
      <div aria-hidden className="kanban-column kanban-column--progress h-80 animate-pulse" />
      <div aria-hidden className="kanban-column kanban-column--done h-80 animate-pulse" />
    </div>
  );
}

export function AssetsContentSkeleton() {
  return (
    <div className="mt-2">
      <Pulse className="mb-8 h-24 max-w-2xl" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Pulse key={i} className="h-48" />
        ))}
      </div>
    </div>
  );
}

export function LinksContentSkeleton() {
  return (
    <div className="mt-2 flex flex-col gap-3">
      <Pulse className="h-40 max-w-2xl" />
      <Pulse className="h-24" />
      <Pulse className="h-24" />
      <Pulse className="h-24" />
    </div>
  );
}

export function SettingsContentSkeleton() {
  return (
    <div className="mt-2 flex flex-col gap-8">
      <Pulse className="h-28 max-w-2xl" />
      <div className="flex flex-col gap-2">
        <Pulse className="h-14" />
        <Pulse className="h-14" />
        <Pulse className="h-14" />
      </div>
      <Pulse className="h-32 max-w-2xl" />
    </div>
  );
}

export function DiscussionContentSkeleton() {
  return (
    <div className="mt-2 flex flex-col gap-6">
      <Pulse className="h-16 max-w-2xl" />
      <div className="flex flex-col gap-3 rounded-xl border border-line bg-white p-4">
        <Pulse className="h-8 w-48" />
        <Pulse className="h-24" />
        <Pulse className="h-20" />
      </div>
    </div>
  );
}

export function MemoryContentSkeleton() {
  return (
    <div className="mt-2 flex flex-col gap-10">
      <Pulse className="h-20 max-w-2xl" />
      <div className="flex flex-col gap-3">
        <Pulse className="h-28" />
        <Pulse className="h-28" />
      </div>
      <div className="flex flex-col gap-3">
        <Pulse className="h-24" />
        <Pulse className="h-24" />
        <Pulse className="h-24" />
      </div>
    </div>
  );
}
