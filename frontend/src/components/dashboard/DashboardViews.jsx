import { useMemo, useState } from 'react'
import { formatDeadline, getTodayIso, priorityConfig } from '../../data/dashboardData.js'

export const SummaryCard = ({ value, label, subtitle, accent, trend, trendUp }) => (
  <div className="group rounded-[1.6rem] border border-white/80 bg-white/88 p-4 shadow-[0_14px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl transition-transform duration-200 hover:-translate-y-1 hover:shadow-[0_22px_55px_rgba(15,23,42,0.12)]">
    <div className={`mb-4 h-1.5 w-16 rounded-full ${accent.replace('text-', 'bg-')}`} />
    <div className="mb-3 flex items-start justify-between gap-3">
      <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${accent} bg-slate-100 text-sm font-bold ring-1 ring-white/70`}>
        {label.slice(0, 2).toUpperCase()}
      </div>
      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${trendUp ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
        {trend}
      </span>
    </div>
    <p className="text-3xl font-black tracking-tight text-slate-900">{value}</p>
    <p className="text-sm font-medium text-slate-700">{label}</p>
    <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
  </div>
)

const Panel = ({ title, subtitle, children, className = '' }) => (
  <section className={`rounded-[1.6rem] border border-white/80 bg-white/88 p-5 shadow-[0_14px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl ${className}`}>
    <div className="mb-5 flex items-start justify-between gap-3">
      <div>
        <h3 className="text-base font-semibold tracking-tight text-slate-900">{title}</h3>
        {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
      </div>
      <span className="h-2.5 w-2.5 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-400 shadow-[0_0_0_6px_rgba(99,102,241,0.08)]" />
    </div>
    {children}
  </section>
)

const getProgressWidth = (value) => `${Math.max(8, Math.min(100, value))}%`

export const DashboardView = ({ greeting, studentData, modules, completedTasks, totalTasks, upcomingDeadlines, weeklyStudyHours, highPriorityPending, todayTasks }) => {
  const progressPercent = Math.round((completedTasks / Math.max(totalTasks, 1)) * 100)

  return (
    <div className="space-y-6">
      <Panel title={`${greeting.emoji} ${greeting.text}, ${studentData.name.split(' ')[0]}!`} subtitle={greeting.sub} className="relative overflow-hidden">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gradient-to-br from-indigo-200/40 to-cyan-200/20 blur-3xl" />
        <div className="absolute left-1/3 top-0 h-24 w-24 rounded-full bg-emerald-200/20 blur-2xl" />
        <div className="relative grid gap-5 md:grid-cols-[1.25fr_0.75fr] md:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-indigo-500" />
              Personalized study snapshot
            </div>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500">Your week is structured around deadlines, weak areas, and daily momentum. The planner highlights what matters now, not just what is overdue.</p>
            {todayTasks.length > 0 ? (
              <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 shadow-sm">
                <span>●</span>
                <span>{todayTasks.length} task{todayTasks.length > 1 ? 's' : ''} due today</span>
              </div>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-[1.4rem] bg-slate-950 px-4 py-4 text-white shadow-[0_20px_50px_rgba(15,23,42,0.18)]">
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Current GPA</p>
              <p className="mt-2 text-3xl font-black tracking-tight">{studentData.gpa}</p>
              <p className="mt-2 text-xs text-slate-300">Target: 3.8</p>
            </div>
            <div className="rounded-[1.4rem] bg-gradient-to-br from-emerald-500 to-cyan-500 px-4 py-4 text-white shadow-[0_20px_50px_rgba(16,185,129,0.18)]">
              <p className="text-[11px] uppercase tracking-[0.22em] text-emerald-50/80">Tasks Done</p>
              <p className="mt-2 text-3xl font-black tracking-tight">{completedTasks}/{totalTasks}</p>
              <p className="mt-2 text-xs text-emerald-50/90">Keep the streak alive</p>
            </div>
          </div>
        </div>
      </Panel>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard value={studentData.gpa} label="Current GPA" subtitle="Target 3.8" accent="text-indigo-600" trend="+0.12" trendUp />
        <SummaryCard value={upcomingDeadlines} label="Upcoming Deadlines" subtitle="Next 5 days" accent="text-rose-600" trend={`${highPriorityPending} high`} trendUp={false} />
        <SummaryCard value={totalTasks - completedTasks} label="Pending Tasks" subtitle={`${completedTasks} completed`} accent="text-sky-600" trend={`${progressPercent}%`} trendUp={progressPercent > 50} />
        <SummaryCard value={`${weeklyStudyHours}h`} label="Weekly Study" subtitle={`Goal ${studentData.weeklyStudyGoal}h`} accent="text-emerald-600" trend={weeklyStudyHours >= studentData.weeklyStudyGoal ? 'On track' : 'Behind'} trendUp={weeklyStudyHours >= studentData.weeklyStudyGoal} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title="Study Consistency" subtitle="Weekly study hours over time" className="xl:col-span-2">
          <div className="grid gap-3">
            {[28, 32, 30, 35, 33, 37, 34, weeklyStudyHours].map((value, index) => (
              <div key={index} className="flex items-center gap-3">
                <span className="w-16 text-xs text-slate-500">W{index + 1}</span>
                <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500" style={{ width: getProgressWidth(value * 2.5) }} />
                </div>
                <span className="w-10 text-right text-xs font-semibold text-slate-700">{value}h</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Module Grades" subtitle="Current performance">
          <div className="space-y-4">
            {modules.map((mod) => (
              <div key={mod.id}>
                <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                  <span className="truncate font-medium text-slate-700">{mod.name}</span>
                  <span className="font-semibold text-slate-900">{mod.grade}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full" style={{ width: `${mod.grade}%`, backgroundColor: mod.grade >= 85 ? '#10b981' : mod.grade >= 70 ? '#f59e0b' : '#ef4444' }} />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Panel title="Today's Focus" subtitle="Most urgent items in your queue">
          {todayTasks.length > 0 ? (
            <ul className="space-y-2">
              {todayTasks.map((task) => (
                <li key={task.id} className="flex items-center gap-3 rounded-2xl bg-indigo-50/70 px-3 py-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
                  <span className="flex-1 text-sm text-slate-700">{task.task}</span>
                  <span className="text-xs font-medium text-slate-500">{task.moduleCode}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">No tasks due today. Use the extra time to review weak areas.</p>
          )}
        </Panel>

        <Panel title="AI Recommendations" subtitle="Suggested next actions">
          <ul className="space-y-3 text-sm text-slate-600">
            <li className="flex gap-3 rounded-2xl bg-emerald-50/80 px-3 py-3">
              <span className="mt-0.5 text-emerald-600">Up</span>
              <span>Focus on <strong>Database Systems</strong> for an expected grade lift with 2 extra hours.</span>
            </li>
            <li className="flex gap-3 rounded-2xl bg-amber-50/80 px-3 py-3">
              <span className="mt-0.5 text-amber-600">!</span>
              <span><strong>Machine Learning</strong> needs immediate attention because of the pending report.</span>
            </li>
            <li className="flex gap-3 rounded-2xl bg-sky-50/80 px-3 py-3">
              <span className="mt-0.5 text-sky-600">OK</span>
              <span>You are stable in <strong>Web Development</strong>. Keep the current pace.</span>
            </li>
          </ul>
        </Panel>
      </div>
    </div>
  )
}

export const StudyPlannerView = ({ weeklySchedule, missedTasks, setShowRescheduleModal, showRescheduleModal, rescheduleTask }) => {
  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const timeSlots = ['8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM']

  const getSessionForSlot = (day, time) => weeklySchedule.find((entry) => entry.day === day)?.sessions.find((session) => session.time === time) ?? null

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Study Planner</h2>
          <p className="text-sm text-slate-500">AI-powered adaptive schedule, week of May 11-17, 2026</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700">Generate AI Schedule</button>
          <button type="button" className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Reschedule Missed</button>
        </div>
      </div>

      {missedTasks.length > 0 ? (
        <section className="rounded-3xl border border-red-200 bg-red-50/70 p-4 shadow-sm backdrop-blur-xl">
          <div className="mb-3 flex items-center gap-2 text-red-700">
            <span>!</span>
            <span className="font-semibold">Missed Tasks ({missedTasks.length})</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {missedTasks.map((task) => (
              <button key={task.id} type="button" onClick={() => setShowRescheduleModal(task)} className="rounded-2xl border border-red-200 bg-white px-3 py-2 text-sm text-red-700 transition hover:bg-red-50">
                {task.task} - Reschedule
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-[1.5rem] border border-white/70 bg-white/85 p-4 shadow-[0_12px_40px_rgba(15,23,42,0.06)] backdrop-blur-xl">
        <div className="min-w-[800px]">
          <div className="grid grid-cols-7 gap-2 pb-3 text-center">
            {weeklySchedule.map((day) => (
              <div key={day.day}>
                <p className="text-sm font-semibold text-slate-900">{day.day}</p>
                <p className="text-xs text-slate-400">{day.date}</p>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            {timeSlots.map((time) => (
              <div key={time} className="grid grid-cols-7 gap-2">
                {daysOfWeek.map((day) => {
                  const session = getSessionForSlot(day, time)

                  return (
                    <div
                      key={`${day}-${time}`}
                      className={`min-h-10 rounded-2xl border p-2 text-xs ${session ? session.type === 'ai-suggested' ? 'border-indigo-200 bg-indigo-50' : 'border-slate-200 bg-slate-50' : 'border-dashed border-slate-200 bg-slate-50/40'}`}
                      title={session ? `${session.module} - ${session.duration}` : ''}
                    >
                      {session ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="truncate font-semibold text-slate-700">{session.module}</span>
                          <span className="text-[10px] text-slate-500">{session.duration}</span>
                          {session.type === 'ai-suggested' ? <span className="mt-0.5 inline-flex w-fit rounded-full bg-indigo-200/70 px-1.5 py-0.5 text-[9px] font-semibold text-indigo-700">AI</span> : null}
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-4 text-xs text-slate-600">
        <span className="inline-flex items-center gap-2"><i className="h-3 w-3 rounded-full bg-indigo-100 ring-1 ring-indigo-200" />AI Suggested</span>
        <span className="inline-flex items-center gap-2"><i className="h-3 w-3 rounded-full bg-slate-100 ring-1 ring-slate-200" />Scheduled</span>
        <span className="inline-flex items-center gap-2"><i className="h-3 w-3 rounded-full border border-dashed border-slate-200 bg-slate-50" />Available</span>
      </div>

      {showRescheduleModal ? (
        <RescheduleModal task={showRescheduleModal} onClose={() => setShowRescheduleModal(null)} onConfirm={rescheduleTask} />
      ) : null}
    </div>
  )
}

const RescheduleModal = ({ task, onClose, onConfirm }) => {
  const [newDate, setNewDate] = useState(getTodayIso())

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[1.5rem] bg-white p-6 shadow-2xl">
        <h3 className="text-lg font-bold text-slate-900">Reschedule Task</h3>
        <p className="mt-2 text-sm text-slate-600"><strong>{task.task}</strong> - {task.moduleName}</p>
        <label className="mt-4 block text-sm font-medium text-slate-700">New Date</label>
        <input type="date" value={newDate} onChange={(event) => setNewDate(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200" />
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">Cancel</button>
          <button type="button" onClick={() => onConfirm(task.id, newDate)} className="rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700">Reschedule</button>
        </div>
      </div>
    </div>
  )
}

export const TasksView = ({ tasks, toggleTask, completedTasks, totalTasks, missedTasks, setShowRescheduleModal, showRescheduleModal, rescheduleTask }) => {
  const [filter, setFilter] = useState('all')
  const [sortBy, setSortBy] = useState('deadline')
  const todayIso = getTodayIso()

  const filteredTasks = useMemo(() => {
    let result = [...tasks]

    if (filter === 'pending') result = result.filter((task) => !task.completed)
    if (filter === 'completed') result = result.filter((task) => task.completed)
    if (filter === 'high') result = result.filter((task) => task.priority === 'high' && !task.completed)
    if (filter === 'missed') result = result.filter((task) => task.deadline < todayIso && !task.completed)

    if (sortBy === 'deadline') result.sort((left, right) => new Date(left.deadline) - new Date(right.deadline))
    if (sortBy === 'priority') {
      const order = { high: 0, medium: 1, low: 2 }
      result.sort((left, right) => order[left.priority] - order[right.priority])
    }

    return result
  }, [filter, sortBy, tasks, todayIso])

  const progressPercent = Math.round((completedTasks / Math.max(totalTasks, 1)) * 100)

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Tasks & Reminders</h2>
          <p className="text-sm text-slate-500">{completedTasks} of {totalTasks} completed - {missedTasks.length} missed</p>
        </div>
        <button type="button" className="rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700">Add Task</button>
      </div>

      <section className="rounded-[1.5rem] border border-white/70 bg-white/85 p-5 shadow-[0_12px_40px_rgba(15,23,42,0.06)] backdrop-blur-xl">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-semibold text-slate-700">Daily Goals Tracker</span>
          <span className="font-bold text-indigo-600">{progressPercent}%</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" style={{ width: `${progressPercent}%` }} />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {progressPercent >= 80 ? 'Great progress. Keep pushing.' : progressPercent >= 50 ? 'Good pace. Stay consistent.' : 'Time to focus and rebuild momentum.'}
        </p>
      </section>

      <div className="flex flex-wrap gap-2">
        {['all', 'pending', 'high', 'missed', 'completed'].map((item) => (
          <button key={item} type="button" onClick={() => setFilter(item)} className={`rounded-2xl px-3 py-2 text-xs font-semibold capitalize transition ${filter === item ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
            {item === 'high' ? 'High Priority' : item}
          </button>
        ))}
        <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} className="ml-auto rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 outline-none">
          <option value="deadline">Sort by Deadline</option>
          <option value="priority">Sort by Priority</option>
        </select>
      </div>

      <div className="space-y-3">
        {filteredTasks.map((task) => {
          const meta = priorityConfig[task.priority]
          const isMissed = task.deadline < todayIso && !task.completed
          const isToday = task.deadline === todayIso

          return (
            <article key={task.id} className={`flex items-center gap-4 rounded-[1.5rem] border border-white/70 bg-white/85 p-4 shadow-[0_12px_40px_rgba(15,23,42,0.05)] backdrop-blur-xl ${task.completed ? 'opacity-65' : ''} ${isMissed ? 'ring-1 ring-red-200' : isToday ? 'ring-1 ring-amber-200' : ''}`}>
              <button type="button" onClick={() => toggleTask(task.id)} className={`flex h-7 w-7 flex-none items-center justify-center rounded-full border-2 transition ${task.completed ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 hover:border-indigo-400'}`}>
                {task.completed ? '✓' : ''}
              </button>

              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium ${task.completed ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{task.task}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-500">{task.moduleName} - {task.moduleCode}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${meta.chip}`}>{meta.label}</span>
                  {isMissed ? <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">Missed</span> : null}
                  {isToday ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">Due Today</span> : null}
                </div>
              </div>

              <div className="text-right">
                <p className={`text-xs font-semibold ${isMissed ? 'text-red-600' : 'text-slate-600'}`}>{formatDeadline(task.deadline)}</p>
                {isMissed && !task.completed ? (
                  <button type="button" onClick={() => setShowRescheduleModal(task)} className="mt-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800">
                    Reschedule
                  </button>
                ) : null}
              </div>
            </article>
          )
        })}

        {filteredTasks.length === 0 ? (
          <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-white/70 py-12 text-center text-slate-400">
            No tasks found for this filter.
          </div>
        ) : null}
      </div>

      {showRescheduleModal ? (
        <RescheduleModal task={showRescheduleModal} onClose={() => setShowRescheduleModal(null)} onConfirm={rescheduleTask} />
      ) : null}
    </div>
  )
}

export const AnalyticsView = ({ modules, studentData, weeklyStudyHours }) => {
  const weakModules = modules.filter((module) => module.weakArea)
  const strongModules = modules.filter((module) => !module.weakArea)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Academic Analytics</h2>
        <p className="text-sm text-slate-500">ML-powered insights and performance predictions</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Module Performance Comparison" subtitle="Current vs predicted grades">
          <div className="space-y-4">
            {modules.map((module) => (
              <div key={module.id}>
                <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                  <span>{module.code}</span>
                  <span>{module.grade}%{' -> '}{module.predictedGrade}%</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="h-3 overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full rounded-full bg-indigo-500" style={{ width: `${module.grade}%` }} />
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-violet-400" style={{ width: `${module.predictedGrade}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Time Allocation per Module" subtitle="Study hours distribution">
          <div className="space-y-4">
            {modules.map((module) => (
              <div key={module.id} className="flex items-center gap-3">
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: module.color }} />
                <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{module.name}</span>
                <span className="text-sm font-semibold text-slate-900">{module.studyHours}h</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="GPA Trend" subtitle="Observed and projected trajectory" className="lg:col-span-2">
          <div className="grid grid-cols-7 items-end gap-2">
            {[3.4, 3.5, 3.55, 3.6, 3.72, 3.78, 3.85].map((value, index) => (
              <div key={index} className="flex flex-col items-center gap-2">
                <div className="flex h-44 w-full items-end rounded-2xl bg-slate-50 p-2">
                  <div className={`w-full rounded-xl ${index < 5 ? 'bg-gradient-to-t from-indigo-500 to-cyan-400' : 'bg-gradient-to-t from-amber-500 to-orange-400'}`} style={{ height: `${(value - 3) * 100}%` }} />
                </div>
                <span className="text-[11px] text-slate-500">{index < 5 ? ['Jan', 'Feb', 'Mar', 'Apr', 'May'][index] : ['Jun', 'Jul'][index - 5]}{index >= 5 ? ' (Pred.)' : ''}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Weak Subject Detection" subtitle="Where to focus next">
          {weakModules.length > 0 ? (
            <div className="space-y-3">
              {weakModules.map((module) => (
                <div key={module.id} className="rounded-2xl border border-red-200 bg-red-50 p-3">
                  <p className="text-sm font-semibold text-red-800">{module.name}</p>
                  <p className="mt-1 text-xs text-red-600">Current {module.grade}%{' -> '}Predicted {module.predictedGrade}%</p>
                  <p className="mt-1 text-xs text-red-500">Needs a few extra study hours this week.</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No weak subjects detected.</p>
          )}

          {strongModules.length > 0 ? (
            <div className="mt-5">
              <p className="mb-2 text-sm font-semibold text-emerald-700">Strong Subjects</p>
              <div className="space-y-2">
                {strongModules.map((module) => (
                  <div key={module.id} className="flex items-center gap-2 text-xs text-emerald-600">
                    <span>OK</span>
                    <span>{module.name} ({module.grade}%)</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </Panel>
      </div>

      <Panel title="AI-Generated Insights & Recommendations" subtitle="Habit and performance signals">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <InsightCard tone="emerald" title="Consistency Improving" description="Your study consistency is trending upward over the last four weeks." />
          <InsightCard tone="amber" title="Optimal Study Time" description="Morning sessions between 8 and 11 AM appear to work best." />
          <InsightCard tone="rose" title="Risk Alert" description="Database Systems is still the weakest area and needs sustained attention." />
        </div>
        <p className="mt-4 text-xs text-slate-500">Student snapshot: {studentData.name} - weekly study load {weeklyStudyHours} hours</p>
      </Panel>
    </div>
  )
}

const InsightCard = ({ tone, title, description }) => {
  const toneMap = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    rose: 'bg-rose-50 text-rose-700 border-rose-100',
  }

  return (
    <div className={`rounded-3xl border p-4 ${toneMap[tone]}`}>
      <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
      <p className="mt-1 text-xs text-slate-600">{description}</p>
    </div>
  )
}

export const ProfileView = ({ studentData, modules }) => (
  <div className="max-w-4xl space-y-6">
    <div>
      <h2 className="text-2xl font-bold text-slate-900">Student Profile</h2>
      <p className="text-sm text-slate-500">Academic identity and enrolled modules</p>
    </div>

    <section className="rounded-[1.5rem] border border-white/70 bg-white/85 p-6 shadow-[0_12px_40px_rgba(15,23,42,0.06)] backdrop-blur-xl">
      <div className="flex flex-col gap-5 md:flex-row md:items-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-[1.5rem] bg-gradient-to-br from-indigo-500 to-violet-500 text-3xl font-bold text-white shadow-lg shadow-indigo-200/60">
          {studentData.name.charAt(0)}
        </div>
        <div>
          <h3 className="text-xl font-bold text-slate-900">{studentData.name}</h3>
          <p className="text-sm text-slate-500">ID: {studentData.id}</p>
          <p className="text-sm text-slate-500">{studentData.program} - Year {studentData.year}, Semester {studentData.semester}</p>
          <span className="mt-3 inline-flex rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">GPA {studentData.gpa}</span>
        </div>
      </div>
    </section>

    <section className="rounded-[1.5rem] border border-white/70 bg-white/85 p-6 shadow-[0_12px_40px_rgba(15,23,42,0.06)] backdrop-blur-xl">
      <h3 className="mb-4 text-base font-semibold text-slate-900">Enrolled Modules</h3>
      <div className="space-y-3">
        {modules.map((module) => (
          <div key={module.id} className="flex items-center gap-4 rounded-2xl bg-slate-50 p-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl text-sm font-bold text-white" style={{ backgroundColor: module.color }}>
              {module.code.slice(0, 2)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-900">{module.name}</p>
              <p className="text-xs text-slate-500">{module.code} - {module.credits} credits</p>
            </div>
            <span className={`text-sm font-semibold ${module.grade >= 85 ? 'text-emerald-600' : module.grade >= 70 ? 'text-amber-600' : 'text-red-600'}`}>{module.grade}%</span>
          </div>
        ))}
      </div>
    </section>
  </div>
)

export const SettingsView = () => (
  <div className="max-w-4xl space-y-6">
    <div>
      <h2 className="text-2xl font-bold text-slate-900">Settings</h2>
      <p className="text-sm text-slate-500">Personal preferences and notification controls</p>
    </div>

    <section className="space-y-6 rounded-[1.5rem] border border-white/70 bg-white/85 p-6 shadow-[0_12px_40px_rgba(15,23,42,0.06)] backdrop-blur-xl">
      <div>
        <h3 className="mb-3 text-base font-semibold text-slate-900">Notifications</h3>
        <div className="space-y-3">
          {['Deadline reminders (24h before)', 'AI study suggestions', 'Weekly progress reports'].map((label, index) => (
            <label key={label} className="flex items-center gap-3 text-sm text-slate-700">
              <input type="checkbox" defaultChecked={index < 2} className="h-4 w-4 rounded border-slate-300 accent-indigo-600" />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-base font-semibold text-slate-900">Weekly Study Goal</h3>
        <input type="range" min="20" max="60" defaultValue="35" className="w-full accent-indigo-600" />
        <p className="mt-1 text-sm text-slate-500">Current: 35 hours/week</p>
      </div>

      <div>
        <h3 className="mb-3 text-base font-semibold text-slate-900">Theme</h3>
        <select className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 md:w-auto">
          <option>Light (Default)</option>
          <option>Dark Mode (Coming Soon)</option>
        </select>
      </div>
    </section>
  </div>
)