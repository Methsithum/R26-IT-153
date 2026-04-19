import * as LucideIcons from 'lucide-react'

export function BadgeDisplay({ badges = [] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {badges.map((badge) => {
        const Icon = LucideIcons[badge.icon] || LucideIcons.Award
        return (
          <div key={badge.id} className="group relative rounded-2xl border border-amber-400/30 bg-slate-900/60 p-3 text-center">
            <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full border border-amber-300/40 bg-slate-950/70">
              <Icon className="h-6 w-6 text-amber-300" />
            </div>
            <p className="text-xs text-slate-300">{badge.name}</p>
            <div className="pointer-events-none absolute -top-2 left-1/2 z-20 hidden w-44 -translate-x-1/2 rounded-md border border-amber-500/30 bg-slate-950 px-2 py-1 text-xs text-amber-100 shadow-lg group-hover:block">
              {badge.condition}
            </div>
          </div>
        )
      })}
    </div>
  )
}
