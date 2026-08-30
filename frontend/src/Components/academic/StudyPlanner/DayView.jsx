import { useMemo } from "react";
import { motion } from "framer-motion";
import { BookOpen, Coffee, GraduationCap } from "lucide-react";
import { PRIORITY_COLORS } from "../../../utils/featureNameMap";
import { useAcademicStore } from "../../../store/useAcademicStore";
import {
  buildStudySessionsByDay,
  startMinutes,
  MODULE_COLOR_HEX,
  EXAM_PREP_ACCENT_HEX,
  resolveSessionDisplay,
} from "../../../utils/studySessionBuilder";
import EmptyState from "../Shared/EmptyState";

const TODAY_NAME = new Date().toLocaleDateString(undefined, { weekday: "long" });

export default function DayView({ schedule, tasksRegistry }) {
  const modules = useAcademicStore((s) => s.modules);
  const weeklyFreeSlots = useAcademicStore((s) => s.weeklyFreeSlots);
  const assignments = useAcademicStore((s) => s.assignments);
  const exams = useAcademicStore((s) => s.exams);
  const moduleName = (code) => modules.find((m) => m.code === code)?.name || code;

  const studySessionsByDay = useMemo(
    () => buildStudySessionsByDay(modules, weeklyFreeSlots, assignments, schedule || {}),
    [modules, weeklyFreeSlots, assignments, schedule]
  );

  const items = schedule?.[TODAY_NAME] || [];
  const studySessions = studySessionsByDay[TODAY_NAME] || [];
  const timeline = [...items, ...studySessions].sort(
    (a, b) => startMinutes(a.time_slot || a.timeSlot) - startMinutes(b.time_slot || b.timeSlot)
  );

  if (timeline.length === 0) {
    return <EmptyState icon={Coffee} title="Nothing scheduled for today" subtitle="Enjoy the free time, or add a study session manually." />;
  }

  return (
    <div className="card p-5">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4">{TODAY_NAME}</p>
      <div className="relative space-y-4 before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100 dark:before:bg-white/10">
        {timeline.map((entry, i) => {
          const isStudySession = entry.timeSlot != null;

          if (isStudySession) {
            const s = entry;
            const hex = MODULE_COLOR_HEX[s.color] || "#7c3aed";
            return (
              <motion.div
                key={s.taskId}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.07 }}
                className="relative pl-11"
              >
                <div
                  className="absolute left-0 top-0.5 w-10 h-10 rounded-2xl flex items-center justify-center ring-4 ring-white dark:ring-[#1a1530] border border-dashed"
                  style={{ borderColor: hex, backgroundColor: `${hex}14` }}
                >
                  <BookOpen size={16} style={{ color: hex }} />
                </div>
                <div className="rounded-2xl p-3.5 border border-dashed" style={{ borderColor: hex, backgroundColor: `${hex}14` }}>
                  <div className="flex items-center justify-between">
                    <p
                      className="text-sm font-bold text-slate-700 dark:text-white truncate"
                      title={s.assignmentTitle || s.moduleName}
                    >
                      {s.assignmentTitle || s.moduleName}
                    </p>
                    <span className="text-[11px] font-bold" style={{ color: hex }}>
                      Study
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-300 mt-0.5 truncate">
                    {s.assignmentTitle ? `${s.moduleName} · ` : ""}{s.timeSlot} · {s.durationMinutes} minutes
                  </p>
                </div>
              </motion.div>
            );
          }

          const item = entry;
          const priority = tasksRegistry?.[item.task_id]?.priority_label || "Medium";
          const colors = PRIORITY_COLORS[priority];
          const display = resolveSessionDisplay(item, { tasksRegistry, assignments, moduleName, exams });
          return (
            <motion.div
              key={`${item.task_id}-${i}`}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.07 }}
              className="relative pl-11"
            >
              <div
                className={`absolute left-0 top-0.5 w-10 h-10 rounded-2xl flex items-center justify-center ${colors.bg} ring-4 ring-white dark:ring-[#1a1530] ${
                  display.isExamPrep ? "border-2" : ""
                }`}
                style={display.isExamPrep ? { borderColor: EXAM_PREP_ACCENT_HEX } : undefined}
              >
                {display.isExamPrep ? (
                  <GraduationCap size={16} style={{ color: EXAM_PREP_ACCENT_HEX }} />
                ) : (
                  <span className={`w-2.5 h-2.5 rounded-full ${colors.dot}`} />
                )}
              </div>
              <div
                className={`rounded-2xl p-3.5 ${colors.bg} ${display.isExamPrep ? "border-2" : ""}`}
                style={display.isExamPrep ? { borderColor: EXAM_PREP_ACCENT_HEX } : undefined}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-slate-700 dark:text-white truncate" title={display.title}>
                    {display.title}
                  </p>
                  <span className={`text-[11px] font-bold ${colors.text}`}>{priority}</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-300 mt-0.5 truncate">
                  {display.subtitle ? `${display.subtitle} · ` : ""}{item.time_slot} · {item.duration_minutes} minutes
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
