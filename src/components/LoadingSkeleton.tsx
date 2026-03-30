const shimmerClass = 'bg-gradient-to-r from-brand-surface-light/50 via-brand-surface-light/90 via-50% to-brand-surface-light/50 bg-[length:200%_100%] animate-shimmer-sweep';

export function CardSkeleton() {
  return (
    <div className="card overflow-hidden">
      <div className={`aspect-[5/6] ${shimmerClass}`} />
      <div className="p-3 space-y-2.5">
        <div className={`h-4 rounded w-3/4 ${shimmerClass}`} />
        <div className={`h-3 rounded w-1/2 ${shimmerClass}`} />
        <div className="flex items-center justify-between pt-1">
          <div className={`h-5 rounded w-14 ${shimmerClass}`} />
          <div className={`h-7 rounded-lg w-14 ${shimmerClass}`} />
        </div>
      </div>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="section-padding py-8">
      <div className={`h-8 rounded-lg w-48 mb-6 ${shimmerClass}`} />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 lg:gap-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
