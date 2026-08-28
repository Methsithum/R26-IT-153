const TABS = ["All", "Pending", "Completed", "Overdue"];

export default function TaskFilters({ tab, onTab, moduleFilter, onModuleFilter, priorityFilter, onPriorityFilter, modules }) {
  return (
    <div className="space-y-3">
      <div className="flex gap-1.5 overflow-x-auto scrollbar-thin pb-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => onTab(t)}
            className={`shrink-0 px-4 py-1.5 text-sm font-semibold rounded-full transition-colors ${
              tab === t ? "bg-brand-500 text-white shadow-playful" : "bg-white dark:bg-white/5 text-slate-500 dark:text-slate-300 border border-black/5 dark:border-white/10"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          value={moduleFilter}
          onChange={(e) => onModuleFilter(e.target.value)}
          className="text-sm rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-1.5"
        >
          <option value="all">All Modules</option>
          {modules.map((m) => (
            <option key={m.code} value={m.code}>{m.name}</option>
          ))}
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => onPriorityFilter(e.target.value)}
          className="text-sm rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-1.5"
        >
          <option value="all">All Priorities</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
      </div>
    </div>
  );
}
