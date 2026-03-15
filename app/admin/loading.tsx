import { Skeleton, SkeletonCardGrid } from "@/app/ui/Skeleton";

export default function LoadingAdmin() {
  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-8">
        <div className="space-y-3">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>

        <SkeletonCardGrid count={6} />
      </div>
    </div>
  );
}
