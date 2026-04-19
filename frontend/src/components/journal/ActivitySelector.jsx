import * as LucideIcons from 'lucide-react'
import { cn } from '../../utils/helpers'

export function ActivitySelector({ activities, selectedActivities, onToggle, onContinue }) {
  const selectedIds = new Set(selectedActivities.map((item) => item.id))
  const canContinue = selectedActivities.length > 0

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {activities.map((activity) => {
          const Icon = LucideIcons[activity.icon] || LucideIcons.BookOpen
          const isSelected = selectedIds.has(activity.id)

          return (
            <button
              key={activity.id}
              type="button"
              onClick={() => onToggle(activity)}
              className={cn(
                'rounded-2xl border bg-slate-900/60 p-4 text-left transition-all duration-200 hover:scale-[1.01]',
                isSelected
                  ? 'border-amber-400 shadow-[0_0_24px_rgba(245,158,11,0.35)]'
                  : 'border-slate-700 hover:border-amber-500/60',
              )}
            >
              <div className="mb-3 flex items-center justify-between">
                <Icon className={cn('h-5 w-5', isSelected ? 'text-amber-300' : 'text-slate-400')} />
                <span className="rounded-full border border-slate-600 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-300">
                  {activity.category}
                </span>
              </div>
              <p className="text-sm font-medium text-slate-100">{activity.label}</p>
            </button>
          )
        })}
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          disabled={!canContinue}
          onClick={onContinue}
          className={cn(
            'rounded-xl px-4 py-2 text-sm font-semibold transition-all',
            canContinue
              ? 'bg-linear-to-r from-amber-500 to-yellow-400 text-slate-950 shadow-[0_0_22px_rgba(250,204,21,0.4)] hover:scale-105'
              : 'cursor-not-allowed bg-slate-700 text-slate-400',
          )}
        >
          Continue to Questions
        </button>
      </div>
    </div>
  )
}
