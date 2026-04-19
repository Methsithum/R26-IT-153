export function ProgressTracker({ current, total }) {
  const percent = Math.min(100, Math.round((current / Math.max(total, 1)) * 100))

  return (
    <div className="mb-4 rounded-xl border border-amber-500/20 bg-slate-900/50 p-3">
      <div className="mb-1 flex items-center justify-between text-xs text-slate-300">
        <span>Quest Progress</span>
        <span>
          {current}/{total}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-linear-to-r from-amber-600 to-yellow-400 transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}
