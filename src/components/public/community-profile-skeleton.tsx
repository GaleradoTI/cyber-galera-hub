import { Skeleton } from "@/components/ui/skeleton";

export function CommunityProfileSkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5 mt-10" aria-busy="true" aria-live="polite">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="glass rounded-xl border border-primary/20 p-5 flex flex-col h-full">
          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-4">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div className="min-w-0 space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          </div>
          <div className="mt-auto pt-5 flex gap-2">
            <Skeleton className="h-8 flex-1" />
            <Skeleton className="h-8 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}