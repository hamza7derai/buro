import { Skeleton } from './Skeleton';

export function SkeletonProductDetail() {
  return (
    <div className="px-4 lg:px-0 lg:grid lg:grid-cols-2 lg:gap-10 pt-2">
      <Skeleton className="aspect-square rounded-2xl" />
      <div className="flex flex-col gap-4 mt-5 lg:mt-0">
        <Skeleton className="h-5 w-28 rounded-full" />
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-12 w-full rounded-xl mt-4" />
      </div>
    </div>
  );
}
