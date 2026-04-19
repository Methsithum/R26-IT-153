import { cn } from '../../utils/helpers'

function getTierClasses(level) {
  if (level <= 5) return 'border-amber-700 text-amber-500'
  if (level <= 10) return 'border-slate-300 text-slate-200'
  if (level <= 20) return 'border-amber-300 text-amber-200'
  return 'border-cyan-300 text-cyan-200'
}

export function LevelBadge({ level }) {
  return (
    <div className="inline-flex flex-col items-center gap-2">
      <div
        className={cn(
          'flex h-20 w-20 items-center justify-center border-2 bg-slate-900/70 font-cinzel text-2xl shadow-[0_0_16px_rgba(251,191,36,0.25)]',
          getTierClasses(level),
        )}
        style={{ clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)' }}
      >
        {level}
      </div>
      <span className="text-xs uppercase tracking-wider text-slate-400">Scholar Tier</span>
    </div>
  )
}
