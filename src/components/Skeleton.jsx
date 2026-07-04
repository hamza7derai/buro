export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}

export function ProductCardSkeleton({ className = '' }) {
  return (
    <div className={`bg-white rounded-xl shadow-sm overflow-hidden flex flex-col ${className}`}>
      <Skeleton className="aspect-[5/4] rounded-none" />
      <div className="p-3 flex flex-col gap-2">
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-2/3" />
        <div className="flex items-center justify-between mt-1.5">
          <Skeleton className="h-4 w-14" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function TableRowSkeleton({ cols = 5 }) {
  return (
    <tr className="border-t border-gray-100">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="p-4">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  );
}
