export function SkeletonCard({ className = "" }) {
  return <div className={`card animate-pulse ${className}`} />;
}

export function SkeletonLine({ className = "" }) {
  return <div className={`bg-slate-100 dark:bg-white/10 rounded-full animate-pulse ${className}`} />;
}

export function SkeletonList({ rows = 4 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="card p-4 flex items-center gap-3 animate-pulse">
          <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-white/10" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/2 bg-slate-100 dark:bg-white/10 rounded" />
            <div className="h-2.5 w-1/3 bg-slate-100 dark:bg-white/10 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
