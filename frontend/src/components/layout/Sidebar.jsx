import { navItems } from '../../data/dashboardData.js'

const Sidebar = ({ activeTab, setActiveTab, sidebarOpen, setSidebarOpen, studentData, pendingTasks, highPriorityPending }) => {
  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex h-full w-72 flex-col border-r border-white/60 bg-white/85 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
    >
      <div className="flex items-center gap-3 border-b border-slate-200/70 px-6 py-5">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-cyan-500 text-lg font-bold text-white shadow-lg shadow-indigo-200/60">
          SU
        </div>
        <div>
          <p className="text-sm font-semibold tracking-wide text-slate-900">Smart Uni Guide</p>
          <p className="text-xs text-slate-500">Academic management hub</p>
        </div>
      </div>

      <nav className="flex-1 space-y-2 overflow-y-auto px-4 py-5">
        {navItems.map((item) => {
          const isActive = activeTab === item.id
          const badgeValue = item.badge === 'count' ? pendingTasks : null

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setActiveTab(item.id)
                setSidebarOpen(false)
              }}
              className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium transition-all ${isActive ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-100' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
            >
              <span className={`h-2.5 w-2.5 rounded-full ${isActive ? 'bg-indigo-500' : 'bg-slate-300'}`} />
              <span>{item.label}</span>
              {badgeValue ? (
                <span className="ml-auto rounded-full bg-rose-500 px-2.5 py-0.5 text-xs font-semibold text-white">
                  {badgeValue}
                </span>
              ) : null}
            </button>
          )
        })}
      </nav>

      <div className="border-t border-slate-200/70 p-4">
        <div className="flex items-center gap-3 rounded-2xl border border-white/70 bg-gradient-to-r from-slate-50 to-indigo-50 p-4 shadow-sm">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-sm font-bold text-white">
            {studentData.name.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900">{studentData.name}</p>
            <p className="text-xs text-slate-500">GPA {studentData.gpa}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Live</span>
            <span className="text-[11px] text-slate-500">{highPriorityPending} urgent</span>
          </div>
        </div>
      </div>
    </aside>
  )
}

export default Sidebar