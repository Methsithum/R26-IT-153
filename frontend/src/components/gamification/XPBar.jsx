import { cn } from '../../utils/helpers'

export function XPBar({ level, currentXp, nextLevelXp }) {
  const progress = Math.min(100, Math.round((currentXp / nextLevelXp) * 100))

  return (
    <div className="rounded-2xl border border-amber-500/20 bg-slate-900/60 p-4 shadow-[0_0_25px_rgba(245,158,11,0.08)]">
      <div className="mb-2 flex items-center justify-between text-sm text-slate-300">
        <span className="font-cinzel text-amber-300">Level {level}</span>
        <span>
          {currentXp} / {nextLevelXp} XP
        </span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-slate-800">
        <div
          className={cn(
            'h-full rounded-full bg-linear-to-r from-amber-500 via-yellow-400 to-amber-300 transition-all duration-500',
          )}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}
