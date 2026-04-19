import { format } from 'date-fns'
import { ActivityChart } from './ActivityChart'
import { ProgressSummaryCard } from './ProgressSummaryCard'

export function Dashboard({ data }) {
  return (
    <div className="space-y-4">
      <ActivityChart
        weeklyStudyHours={data.weeklyStudyHours}
        activityBreakdown={data.activityBreakdown}
      />

      <div className="grid gap-3 md:grid-cols-2">
        <ProgressSummaryCard
          label="Completion Rate"
          value={`${data.weeklyStats.completionRate}%`}
          subtitle="Daily journal consistency this week"
        />
        <ProgressSummaryCard
          label="Average Session"
          value={`${data.weeklyStats.averageSessionLength} min`}
          subtitle="Estimated time per journaling session"
        />
      </div>

      <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
        <h3 className="mb-3 font-cinzel text-lg text-amber-200">Task Progress</h3>
        <div className="space-y-3">
          {data.taskProgress.map((task) => (
            <article key={task.id} className="rounded-xl border border-slate-700 bg-slate-950/60 p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-100">{task.name}</p>
                  <p className="text-xs text-slate-400">{task.subject}</p>
                </div>
                <p className="text-xs text-slate-300">Due {format(new Date(task.deadline), 'MMM d')}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                {task.stages.map((stage, index) => (
                  <div
                    key={stage}
                    className={`rounded-md border px-2 py-1 text-center text-[11px] ${
                      index <= task.currentStage
                        ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                        : 'border-slate-700 bg-slate-900 text-slate-400'
                    }`}
                  >
                    {stage}
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
        <h3 className="mb-3 font-cinzel text-lg text-amber-200">Seven-Day Streak Calendar</h3>
        <div className="grid grid-cols-7 gap-2">
          {data.streakCalendar.map((day) => (
            <div
              key={day.day}
              className={`rounded-lg p-2 text-center text-xs ${
                day.completed
                  ? 'border border-emerald-500/60 bg-emerald-600/20 text-emerald-300 shadow-[0_0_12px_rgba(34,197,94,0.2)]'
                  : 'border border-slate-700 bg-slate-900 text-slate-500'
              }`}
            >
              {day.day}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
