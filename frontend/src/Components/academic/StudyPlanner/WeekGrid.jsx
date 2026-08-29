import { useMemo } from "react";
import { motion } from "framer-motion";
import { BookOpen, CalendarX, Coffee, GraduationCap } from "lucide-react";
import { PRIORITY_COLORS } from "../../../utils/featureNameMap";
import { WEEKDAYS } from "../../../utils/dateHelpers";
import { useAcademicStore } from "../../../store/useAcademicStore";
import {
  buildStudySessionsByDay,
  startMinutes,
  MODULE_COLOR_HEX,
  EXAM_PREP_ACCENT_HEX,
  resolveSessionDisplay,
} from "../../../utils/studySessionBuilder";
import EmptyState from "../Shared/EmptyState";

// Real Date-driven, not hardcoded - re-evaluates to whichever weekday it
// actually is when this module loads (module-load-time, not per-render, so
// a tab left open across midnight won't move the highlight until reload -
// acceptable for a planner view, same tradeoff every other "today" marker
// in this app makes).
const TODAY_NAME = new Date().toLocaleDateString(undefined, { weekday: "long" });

const PRIORITY_ORDER = ["High", "Medium", "Low"];

function formatMinutes(mins) {
  if (!mins || mins <= 0) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

function totalFreeSlotMinutes(day, weeklyFreeSlots) {
  return (weeklyFreeSlots || []).filter((s) => s.day === day).reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
}

function timelineUsedMinutes(timeline) {
  return timeline.reduce((sum, e) => sum + (e.durationMinutes ?? e.duration_minutes ?? 0), 0);
}

export default function WeekGrid({ schedule, tasksRegistry, overloadWarning }) {
  const modules = useAcademicStore((s) => s.modules);
  const weeklyFreeSlots = useAcademicStore((s) => s.weeklyFreeSlots);
  const assignments = useAcademicStore((s) => s.assignments);
  const moduleName = (code) => modules.find((m) => m.code === code)?.name || code;

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

          const scheduledMinutes = timelineUsedMinutes(timeline);
          const freeMinutes = Math.max(0, totalFreeSlotMinutes(day, weeklyFreeSlots) - scheduledMinutes);
          const freeLabel = formatMinutes(freeMinutes);

          // Breakdown counts only real ML-scheduled tasks (`items`) - the
          // suggested self-study blocks (`studySessions`) aren't tied to a
          // specific task, so they don't have a priority_label to count.
          const priorityCounts = items.reduce((acc, item) => {
            const p = tasksRegistry?.[item.task_id]?.priority_label || "Medium";
            acc[p] = (acc[p] || 0) + 1;
            return acc;
          }, {});

          return (
            <div
              key={day}
              className={`card p-3 min-h-70 flex flex-col ${isToday ? "ring-2 ring-brand-400 bg-brand-50/60 dark:bg-brand-500/10" : ""}`}
            >
              <div className="flex items-center gap-1.5 mb-2 shrink-0">
                <p className={`text-xs font-bold uppercase tracking-wide ${isToday ? "text-brand-600" : "text-slate-400"}`}>
                  {day.slice(0, 3)}
                </p>
                {isToday && <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />}
              </div>

              {timeline.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center px-1 py-4">
                  <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-500/15 flex items-center justify-center mb-2">
                    <Coffee size={16} className="text-brand-400" />
                  </div>
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-300">Nothing scheduled</p>
                  <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">
                    Good day for a break, or tackle something ahead of time.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 flex-1">
                  {timeline.map((entry, i) => {
                    const isStudySession = entry.timeSlot != null;
                    const delay = di * 0.03 + i * 0.04;
                    if (isStudySession) {
                      const s = entry;
                      return (
                        <motion.div
                          key={s.taskId}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay }}
                          className="rounded-xl px-2.5 py-2 border border-dashed hover:-translate-y-0.5 hover:shadow-playful transition-all"
                          style={{ borderColor: MODULE_COLOR_HEX[s.color] || "#7c3aed", backgroundColor: `${MODULE_COLOR_HEX[s.color] || "#7c3aed"}14` }}
                        >
                          <div className="flex items-center gap-1">
                            <BookOpen size={11} style={{ color: MODULE_COLOR_HEX[s.color] || "#7c3aed" }} />
                            <p className="text-[11px] font-bold" style={{ color: MODULE_COLOR_HEX[s.color] || "#7c3aed" }}>
                              {s.timeSlot}
                            </p>
                          </div>
                          <p
                            className="text-xs font-semibold text-slate-700 dark:text-white leading-snug wrap-break-word"
                            title={s.assignmentTitle || s.moduleName}
                          >
                            {s.assignmentTitle || s.moduleName}
                          </p>
                          <p className="text-[10px] text-slate-400 leading-snug wrap-break-word">
                            {s.assignmentTitle ? `${s.moduleName} · ` : ""}Study session · {s.durationMinutes} min
                          </p>
                        </motion.div>
                      );
                    }
                    const item = entry;
                    const priority = tasksRegistry?.[item.task_id]?.priority_label || "Medium";
                    const colors = PRIORITY_COLORS[priority];
                    const display = resolveSessionDisplay(item, { tasksRegistry, assignments, moduleName });
                    return (
                      <motion.div
                        key={`${item.task_id}-${i}`}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay }}
                        className={`rounded-xl px-2.5 py-2 ${colors.bg} hover:-translate-y-0.5 hover:shadow-playful transition-all ${
                          display.isExamPrep ? "border-2" : ""
                        }`}
                        style={display.isExamPrep ? { borderColor: EXAM_PREP_ACCENT_HEX } : undefined}
                      >
                        <div className="flex items-center gap-1.5">
                          {display.isExamPrep ? (
                            <GraduationCap size={11} style={{ color: EXAM_PREP_ACCENT_HEX }} title="Exam prep" />
                          ) : (
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${colors.dot}`} title={`${priority} priority`} />
                          )}
                          <p className={`text-[11px] font-bold ${colors.text}`}>{item.time_slot}</p>
                        </div>
                        <p
                          className="text-xs font-semibold text-slate-700 dark:text-white leading-snug wrap-break-word"
                          title={display.title}
                        >
                          {display.title}
                        </p>
                        <p className="text-[10px] text-slate-400 leading-snug wrap-break-word">
                          {display.subtitle ? `${display.subtitle} · ` : ""}{item.duration_minutes} min
                        </p>
                      </motion.div>
                    );
                  })}
                </div>
              )}

              {/* Free-time indicator - deliberately low-emphasis (dashed,
                  no fill) so it never competes visually with real scheduled
                  sessions above it. Omitted entirely once a day's free
                  capacity is used up, rather than showing "0 free". */}
              {freeLabel && (
                <div className="mt-2 shrink-0 rounded-lg border border-dashed border-slate-200 dark:border-white/10 px-2 py-1.5 text-center">
                  <p className="text-[10px] font-medium text-slate-400">{freeLabel} free</p>
                </div>
              )}

              {/* Daily summary footer */}
              <div className="mt-2 pt-2 border-t border-black/5 dark:border-white/10 shrink-0 space-y-1">
                <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-300">
                  {formatMinutes(scheduledMinutes) || "0m"} scheduled
                </p>
                {items.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {PRIORITY_ORDER.filter((p) => priorityCounts[p]).map((p) => (
                      <span key={p} className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-400" title={`${priorityCounts[p]} ${p} priority`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_COLORS[p].dot}`} />
                        {priorityCounts[p]}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
