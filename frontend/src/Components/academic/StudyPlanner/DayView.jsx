import { motion } from "framer-motion";
import { PRIORITY_COLORS } from "../../../utils/featureNameMap";
import { useAcademicStore } from "../../../store/useAcademicStore";
import EmptyState from "../Shared/EmptyState";
import { Coffee } from "lucide-react";

const TODAY_NAME = new Date().toLocaleDateString(undefined, { weekday: "long" });

export default function DayView({ schedule, tasksRegistry }) {
  const modules = useAcademicStore((s) => s.modules);
  const moduleName = (code) => modules.find((m) => m.code === code)?.name || code;
  const items = schedule?.[TODAY_NAME] || [];

  if (items.length === 0) {
    return <EmptyState icon={Coffee} title="Nothing scheduled for today" subtitle="Enjoy the free time, or add a study session manually." />;
  }

  return (
    <div className="card p-5">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4">{TODAY_NAME}</p>
      <div className="relative space-y-4 before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100 dark:before:bg-white/10">
        {items.map((item, i) => {
          const priority = tasksRegistry?.[item.task_id]?.priority_label || "Medium";
          const colors = PRIORITY_COLORS[priority];
          return (
            <motion.div
              key={`${item.task_id}-${i}`}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.07 }}
              className="relative pl-11"
            >
              <div className={`absolute left-0 top-0.5 w-10 h-10 rounded-2xl flex items-center justify-center ${colors.bg} ring-4 ring-white dark:ring-[#1a1530]`}>
                <span className={`w-2.5 h-2.5 rounded-full ${colors.dot}`} />
              </div>
              <div className={`rounded-2xl p-3.5 ${colors.bg}`}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-slate-700 dark:text-white truncate" title={moduleName(item.module)}>
                    {moduleName(item.module)}
                  </p>
                  <span className={`text-[11px] font-bold ${colors.text}`}>{priority}</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-300 mt-0.5">
                  {item.time_slot} · {item.duration_minutes} minutes
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
