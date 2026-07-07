import { InviteCardSkeleton } from "@/components/ui/loading";

export default function InviteLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <InviteCardSkeleton />
    </div>
  );
}
