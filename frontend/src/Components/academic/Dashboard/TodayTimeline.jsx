import { motion } from "framer-motion";
import { Clock, GraduationCap } from "lucide-react";
import { PRIORITY_COLORS } from "../../../utils/featureNameMap";
import { useAcademicStore } from "../../../store/useAcademicStore";
import { EXAM_PREP_ACCENT_HEX, resolveSessionDisplay } from "../../../utils/studySessionBuilder";
import EmptyState from "../Shared/EmptyState";

const TODAY_NAME = new Date().toLocaleDateString(undefined, { weekday: "long" });

export default function TodayTimeline({ schedule, tasksRegistry }) {
  const modules = useAcademicStore((s) => s.modules);
  const assignments = useAcademicStore((s) => s.assignments);
  const moduleName = (code) => modules.find((m) => m.code === code)?.name || code;
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
          const display = resolveSessionDisplay(item, { tasksRegistry, assignments, moduleName });
          return (
            <motion.div
              key={`${item.task_id}-${i}`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
              className={`flex items-center gap-3 rounded-2xl p-3 ${colors.bg} ${display.isExamPrep ? "border-2" : ""}`}
              style={display.isExamPrep ? { borderColor: EXAM_PREP_ACCENT_HEX } : undefined}
            >
              <div
                className={`w-1.5 self-stretch rounded-full ${display.isExamPrep ? "" : colors.solid}`}
                style={display.isExamPrep ? { backgroundColor: EXAM_PREP_ACCENT_HEX } : undefined}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  {display.isExamPrep && <GraduationCap size={12} style={{ color: EXAM_PREP_ACCENT_HEX }} className="shrink-0" />}
                  <p className="text-sm font-semibold text-slate-700 dark:text-white truncate" title={display.title}>
                    {display.title}
                  </p>
                </div>
                <p className="text-xs text-slate-400 truncate">
                  {display.subtitle ? `${display.subtitle} · ` : ""}{item.time_slot} · {item.duration_minutes} min
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
