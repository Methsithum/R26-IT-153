import { motion } from "framer-motion";
import { Clock } from "lucide-react";
import { PRIORITY_COLORS } from "../../../utils/featureNameMap";
import { useAcademicStore } from "../../../store/useAcademicStore";
import EmptyState from "../Shared/EmptyState";

const TODAY_NAME = new Date().toLocaleDateString(undefined, { weekday: "long" });

export default function TodayTimeline({ schedule, tasksRegistry }) {
  const modules = useAcademicStore((s) => s.modules);
  const assignments = useAcademicStore((s) => s.assignments);
  const moduleName = (code) => modules.find((m) => m.code === code)?.name || code;
  const taskTitle = (taskId) => assignments.find((a) => a.taskId === taskId)?.title || null;
  const todaysItems = schedule?.[TODAY_NAME] || [];

  if (todaysItems.length === 0) {
    return (
      <div className="card p-5">
        <p className="font-display font-bold text-slate-800 dark:text-white mb-4">Today's Study Plan</p>
        <EmptyState icon={Clock} title="Nothing scheduled for today" subtitle="Generate a plan from Study Planner to see time-blocked sessions here." />
      </div>
    );
  }

  return (
    <div className="card p-5">
      <p className="font-display font-bold text-slate-800 dark:text-white mb-4">Today's Study Plan</p>
      <div className="space-y-3">
        {todaysItems.map((item, i) => {
          const meta = tasksRegistry?.[item.task_id];
          const priority = meta?.priority_label || "Medium";
          const colors = PRIORITY_COLORS[priority];
          const title = taskTitle(item.task_id);
          return (
            <motion.div
              key={`${item.task_id}-${i}`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
              className={`flex items-center gap-3 rounded-2xl p-3 ${colors.bg}`}
            >
              <div className={`w-1.5 self-stretch rounded-full ${colors.solid}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-700 dark:text-white truncate" title={title || moduleName(item.module)}>
                  {title || moduleName(item.module)}
                </p>
                <p className="text-xs text-slate-400 truncate">
                  {title ? `${moduleName(item.module)} · ` : ""}{item.time_slot} · {item.duration_minutes} min
                </p>
              </div>
              <span className={`text-[11px] font-bold ${colors.text}`}>{priority}</span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
