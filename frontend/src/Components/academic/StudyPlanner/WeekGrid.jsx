import { useMemo } from "react";
import { motion } from "framer-motion";
import { BookOpen, CalendarX } from "lucide-react";
import { PRIORITY_COLORS } from "../../../utils/featureNameMap";
import { WEEKDAYS } from "../../../utils/dateHelpers";
import { useAcademicStore } from "../../../store/useAcademicStore";
import { buildStudySessionsByDay, startMinutes, MODULE_COLOR_HEX } from "../../../utils/studySessionBuilder";
import EmptyState from "../Shared/EmptyState";

const TODAY_NAME = new Date().toLocaleDateString(undefined, { weekday: "long" });

export default function WeekGrid({ schedule, tasksRegistry, overloadWarning }) {
  const modules = useAcademicStore((s) => s.modules);
  const weeklyFreeSlots = useAcademicStore((s) => s.weeklyFreeSlots);
  const assignments = useAcademicStore((s) => s.assignments);
  const moduleName = (code) => modules.find((m) => m.code === code)?.name || code;
  const taskTitle = (taskId) => assignments.find((a) => a.taskId === taskId)?.title || null;

  const studySessionsByDay = useMemo(
    () => buildStudySessionsByDay(modules, weeklyFreeSlots, assignments, schedule || {}),
    [modules, weeklyFreeSlots, assignments, schedule]
  );

  const hasAny = WEEKDAYS.some((d) => (schedule?.[d] || []).length > 0 || (studySessionsByDay[d] || []).length > 0);

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
          const studySessions = studySessionsByDay[day] || [];
          const timeline = [...items, ...studySessions].sort(
            (a, b) => startMinutes(a.time_slot || a.timeSlot) - startMinutes(b.time_slot || b.timeSlot)
          );
          const isToday = day === TODAY_NAME;
          return (
            <div
              key={day}
              className={`card p-3 min-h-[160px] ${isToday ? "ring-2 ring-brand-400 bg-brand-50/60 dark:bg-brand-500/10" : ""}`}
            >
              <div className="flex items-center gap-1.5 mb-2">
                <p className={`text-xs font-bold uppercase tracking-wide ${isToday ? "text-brand-600" : "text-slate-400"}`}>
                  {day.slice(0, 3)}
                </p>
                {isToday && <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />}
              </div>
              <div className="space-y-2">
                {timeline.length === 0 && <p className="text-xs text-slate-300 dark:text-slate-600 italic">Free</p>}
                {timeline.map((entry, i) => {
                  const isStudySession = entry.timeSlot != null;
                  const delay = di * 0.03 + i * 0.04;
                  if (isStudySession) {
                    const s = entry;
                    return (
                      <motion.div
                        key={s.taskId}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay }}
                        className="rounded-xl px-2.5 py-2 border border-dashed"
                        style={{ borderColor: MODULE_COLOR_HEX[s.color] || "#7c3aed", backgroundColor: `${MODULE_COLOR_HEX[s.color] || "#7c3aed"}14` }}
                      >
                        <div className="flex items-center gap-1">
                          <BookOpen size={11} style={{ color: MODULE_COLOR_HEX[s.color] || "#7c3aed" }} />
                          <p className="text-[11px] font-bold" style={{ color: MODULE_COLOR_HEX[s.color] || "#7c3aed" }}>
                            {s.timeSlot}
                          </p>
                        </div>
                        <p
                          className="text-xs font-semibold text-slate-700 dark:text-white truncate"
                          title={s.assignmentTitle || s.moduleName}
                        >
                          {s.assignmentTitle || s.moduleName}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate">
                          {s.assignmentTitle ? `${s.moduleName} · ` : ""}Study session · {s.durationMinutes} min
                        </p>
                      </motion.div>
                    );
                  }
                  const item = entry;
                  const priority = tasksRegistry?.[item.task_id]?.priority_label || "Medium";
                  const colors = PRIORITY_COLORS[priority];
                  const title = taskTitle(item.task_id);
                  return (
                    <motion.div
                      key={`${item.task_id}-${i}`}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay }}
                      className={`rounded-xl px-2.5 py-2 ${colors.bg}`}
                    >
                      <p className={`text-[11px] font-bold ${colors.text}`}>{item.time_slot}</p>
                      <p className="text-xs font-semibold text-slate-700 dark:text-white truncate" title={title || moduleName(item.module)}>
                        {title || moduleName(item.module)}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate">
                        {title ? `${moduleName(item.module)} · ` : ""}{item.duration_minutes} min
                      </p>
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
