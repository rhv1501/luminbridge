import { Skeleton, SkeletonCardGrid } from "@/app/ui/Skeleton";

export default function LoadingFactory() {
  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-8">
        <div className="space-y-3">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-[520px] max-w-full" />
        </div>

        <div className="flex gap-2">
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>

        <SkeletonCardGrid count={6} />
      </div>
    </div>
  );
}
