import { cn } from '../../utils/helpers'

export function StreakCounter({ streak }) {
  return (
    <div className="rounded-2xl border border-orange-500/20 bg-slate-900/60 p-4 text-center shadow-[0_0_25px_rgba(249,115,22,0.08)]">
      <p
        className={cn(
          'bg-linear-to-r from-orange-300 via-red-400 to-orange-500 bg-clip-text text-xl font-semibold text-transparent',
          streak > 7 && 'animate-pulse',
        )}
      >
        🔥 {streak} day streak
      </p>
    </div>
  )
}
