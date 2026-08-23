import { motion } from "framer-motion";
import { PRIORITY_COLORS } from "../../../utils/featureNameMap";
import { WEEKDAYS } from "../../../utils/dateHelpers";
import { useAcademicStore } from "../../../store/useAcademicStore";
import EmptyState from "../Shared/EmptyState";
import { CalendarX } from "lucide-react";

export default function WeekGrid({ schedule, tasksRegistry, overloadWarning }) {
  const modules = useAcademicStore((s) => s.modules);
  const moduleName = (code) => modules.find((m) => m.code === code)?.name || code;
  const hasAny = WEEKDAYS.some((d) => (schedule?.[d] || []).length > 0);

  if (!hasAny) {
    return <EmptyState icon={CalendarX} title="No sessions scheduled yet" subtitle="Generate a plan to fill your week with time-blocked study sessions." />;
  }

  return (
    <div className="space-y-5">
      {overloadWarning?.length > 0 && (
        <div className="card p-4 border-l-4 border-high-500 bg-high-50/60 dark:bg-high-500/10">
          <p className="text-sm font-semibold text-high-600 mb-1">A few tasks need more room than your free time allows</p>
          <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-0.5">
            {overloadWarning.map((w) => (
              <li key={w.task_id}>
                {moduleName(w.module)} — short by {w.hours_short}h before {w.deadline_date}. Consider freeing up
                extra time or adjusting scope.
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        {WEEKDAYS.map((day, di) => {
          const items = schedule?.[day] || [];
          return (
            <div key={day} className="card p-3 min-h-[160px]">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">{day.slice(0, 3)}</p>
              <div className="space-y-2">
                {items.length === 0 && <p className="text-xs text-slate-300 dark:text-slate-600 italic">Free</p>}
                {items.map((item, i) => {
                  const priority = tasksRegistry?.[item.task_id]?.priority_label || "Medium";
                  const colors = PRIORITY_COLORS[priority];
                  return (
                    <motion.div
                      key={`${item.task_id}-${i}`}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: di * 0.03 + i * 0.04 }}
                      className={`rounded-xl px-2.5 py-2 ${colors.bg}`}
                    >
                      <p className={`text-[11px] font-bold ${colors.text}`}>{item.time_slot}</p>
                      <p className="text-xs font-semibold text-slate-700 dark:text-white truncate" title={moduleName(item.module)}>
                        {moduleName(item.module)}
                      </p>
                      <p className="text-[10px] text-slate-400">{item.duration_minutes} min</p>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
