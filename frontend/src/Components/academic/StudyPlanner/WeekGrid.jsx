import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, CalendarX, Coffee, GraduationCap, ChevronLeft, ChevronRight, CheckCircle2 } from "lucide-react";
import { PRIORITY_COLORS } from "../../../utils/featureNameMap";
import { WEEKDAYS, getWeekStart, addDays, toLocalDateStr, formatWeekRangeLabel } from "../../../utils/dateHelpers";
import { useAcademicStore } from "../../../store/useAcademicStore";
import {
  buildStudySessionsByDay,
  startMinutes,
  MODULE_COLOR_HEX,
  EXAM_PREP_ACCENT_HEX,
  resolveSessionDisplay,
  getTimeOfDayBand,
  TIME_OF_DAY_BAND_ORDER,
} from "../../../utils/studySessionBuilder";
import EmptyState from "../Shared/EmptyState";

const PRIORITY_ORDER = ["High", "Medium", "Low"];
const TODAY_DATE_STR = toLocalDateStr(new Date());
const CURRENT_WEEK_START = getWeekStart(new Date());

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

function startTimeOf(entry) {
  return (entry.time_slot || entry.timeSlot || "0:0").split("-")[0];
}

export default function WeekGrid({ schedule, tasksRegistry, overloadWarning }) {
  const modules = useAcademicStore((s) => s.modules);
  const weeklyFreeSlots = useAcademicStore((s) => s.weeklyFreeSlots);
  const assignments = useAcademicStore((s) => s.assignments);
  const exams = useAcademicStore((s) => s.exams);
  const moduleName = (code) => modules.find((m) => m.code === code)?.name || code;

  // --- Part 2: week navigation --------------------------------------------
  // weekOffset counts real weeks away from the actual current week (0 = this
  // week, +1 = next week, -1 = last week). The backend has no way to
  // generate a time-blocked schedule for anything but "today" (StudyScheduler
  // always anchors to date.today() server-side - no anchor_date param exists
  // on /schedule), so only weekOffset===0 can show the real, algorithmically
  // time-blocked plan. Other weeks are honestly derived from real assignment/
  // exam DATES already in the store instead of a fabricated time-blocked view.
  const [weekOffset, setWeekOffset] = useState(0);
  const [direction, setDirection] = useState(0); // -1 = navigated back, +1 = forward, drives the slide direction

  const viewedWeekStart = useMemo(() => addDays(CURRENT_WEEK_START, weekOffset * 7), [weekOffset]);
  const weekDates = useMemo(() => WEEKDAYS.map((_, i) => addDays(viewedWeekStart, i)), [viewedWeekStart]);
  const isCurrentWeek = weekOffset === 0;

  function goToWeek(delta) {
    setDirection(delta > 0 ? 1 : -1);
    setWeekOffset((w) => w + delta);
  }
  function goToday() {
    setDirection(weekOffset > 0 ? -1 : 1);
    setWeekOffset(0);
  }

  const studySessionsByDay = useMemo(
    () => buildStudySessionsByDay(modules, weeklyFreeSlots, assignments, schedule || {}),
    [modules, weeklyFreeSlots, assignments, schedule]
  );

  // Only meaningful for the current week - other weeks never have a
  // backend-generated schedule to be "empty" or not.
  const currentWeekHasAny = WEEKDAYS.some((d) => (schedule?.[d] || []).length > 0 || (studySessionsByDay[d] || []).length > 0);

  if (isCurrentWeek && !currentWeekHasAny) {
    return <EmptyState icon={CalendarX} title="No sessions scheduled yet" subtitle="Generate a plan to fill your week with time-blocked study sessions." />;
  }

  return (
    <div className="space-y-5">
      {/* --- Week navigation header --- */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => goToWeek(-1)}
            aria-label="Previous week"
            className="w-8 h-8 rounded-full hover:bg-brand-50 dark:hover:bg-white/10 flex items-center justify-center text-slate-500 dark:text-slate-300"
          >
            <ChevronLeft size={16} />
          </button>
          <p className="font-display font-bold text-slate-800 dark:text-white text-sm sm:text-base min-w-35 text-center">
            {isCurrentWeek ? "This Week" : `Week of ${formatWeekRangeLabel(viewedWeekStart)}`}
          </p>
          <button
            onClick={() => goToWeek(1)}
            aria-label="Next week"
            className="w-8 h-8 rounded-full hover:bg-brand-50 dark:hover:bg-white/10 flex items-center justify-center text-slate-500 dark:text-slate-300"
          >
            <ChevronRight size={16} />
          </button>
        </div>
        {!isCurrentWeek && (
          <button
            onClick={goToday}
            className="text-xs font-semibold text-brand-600 bg-brand-50 dark:bg-brand-500/15 hover:bg-brand-100 dark:hover:bg-brand-500/25 rounded-full px-3 py-1.5 transition-colors"
          >
            Today
          </button>
        )}
      </div>

      {isCurrentWeek && overloadWarning?.length > 0 && (
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

      {!isCurrentWeek && (
        <p className="text-xs text-slate-400 -mt-2">
          Showing tasks and exams due this week by their real dates — the time-blocked plan below is only generated for the current week.
        </p>
      )}

      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={weekOffset}
          custom={direction}
          initial={{ opacity: 0, x: direction * 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -direction * 24 }}
          transition={{ duration: 0.22 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3"
        >
          {WEEKDAYS.map((day, di) => {
            const dayDate = weekDates[di];
            const dateStr = toLocalDateStr(dayDate);
            const isToday = dateStr === TODAY_DATE_STR;
            const isPast = dateStr < TODAY_DATE_STR;

            const items = isCurrentWeek ? schedule?.[day] || [] : [];
            const studySessions = isCurrentWeek ? studySessionsByDay[day] || [] : [];
            const timeline = [...items, ...studySessions].sort(
              (a, b) => startMinutes(a.time_slot || a.timeSlot) - startMinutes(b.time_slot || b.timeSlot)
            );

            // Non-current weeks: honestly derived from real assignment/exam
            // dates already in the store (Part 2) - not a fabricated
            // time-blocked schedule, since only the current week has one.
            const dueAssignments = !isCurrentWeek ? assignments.filter((a) => a.deadlineDate === dateStr) : [];
            const dueExams = !isCurrentWeek ? exams.filter((e) => e.date === dateStr) : [];
            const hasDerivedContent = dueAssignments.length > 0 || dueExams.length > 0;

            const scheduledMinutes = timelineUsedMinutes(timeline);
            const freeMinutes = isCurrentWeek ? Math.max(0, totalFreeSlotMinutes(day, weeklyFreeSlots) - scheduledMinutes) : 0;
            const freeLabel = isCurrentWeek ? formatMinutes(freeMinutes) : null;

            const priorityCounts = items.reduce((acc, item) => {
              const p = tasksRegistry?.[item.task_id]?.priority_label || "Medium";
              acc[p] = (acc[p] || 0) + 1;
              return acc;
            }, {});

            // Part 1: group the current week's real, time-slotted sessions
            // into time-of-day bands. Non-current-week "due" entries have no
            // real time, so banding doesn't apply to them.
            const bandedGroups = TIME_OF_DAY_BAND_ORDER.map((band) => ({
              band,
              entries: timeline.filter((entry) => getTimeOfDayBand(startTimeOf(entry)) === band),
            })).filter((g) => g.entries.length > 0);

            return (
              <div
                key={day}
                className={`card p-3 min-h-70 flex flex-col ${isToday ? "ring-2 ring-brand-400 bg-brand-50/60 dark:bg-brand-500/10" : ""}`}
              >
                <div className="flex items-center justify-between gap-1.5 mb-2 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <p className={`text-xs font-bold uppercase tracking-wide ${isToday ? "text-brand-600" : "text-slate-400"}`}>
                      {day.slice(0, 3)} {dayDate.getDate()}
                    </p>
                    {isToday && <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />}
                  </div>
                  {/* Part 3: "Day complete" indicator, distinct from the
                      today ring/dot above - only for genuinely past days. */}
                  {isPast && (
                    <span
                      className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-slate-400"
                      title="Day complete"
                    >
                      <CheckCircle2 size={11} /> Done
                    </span>
                  )}
                </div>

                {/* Part 3: mute everything below the header for a fully-past
                    day - lower opacity + desaturation on the existing
                    priority/module colors, never a redesign of the cards
                    themselves. Today is never muted, only real past days. */}
                <div className={`flex-1 flex flex-col min-h-0 ${isPast ? "opacity-55 saturate-[.45]" : ""}`}>
                  {isCurrentWeek && timeline.length === 0 && (
                    <EmptyDay />
                  )}
                  {!isCurrentWeek && !hasDerivedContent && (
                    <EmptyDay
                      title="No schedule data"
                      subtitle="Nothing due this day, based on real deadlines — this week hasn't been time-blocked by the planner."
                    />
                  )}

                  {isCurrentWeek && timeline.length > 0 && (
                    <div className="space-y-3 flex-1">
                      {bandedGroups.map(({ band, entries }) => (
                        <div key={band}>
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 shrink-0">{band}</span>
                            <span className="flex-1 h-px bg-slate-100 dark:bg-white/10" />
                          </div>
                          <div className="space-y-2">
                            {entries.map((entry, i) => {
                              const isStudySession = entry.timeSlot != null;
                              const delay = di * 0.02 + i * 0.03;
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
                        </div>
                      ))}
                    </div>
                  )}

                  {!isCurrentWeek && hasDerivedContent && (
                    <div className="space-y-2 flex-1">
                      {dueExams.map((e) => (
                        <div
                          key={e.id}
                          className="rounded-xl px-2.5 py-2 border-2 bg-white dark:bg-white/5"
                          style={{ borderColor: EXAM_PREP_ACCENT_HEX }}
                        >
                          <div className="flex items-center gap-1.5">
                            <GraduationCap size={11} style={{ color: EXAM_PREP_ACCENT_HEX }} />
                            <p className="text-[10px] font-bold" style={{ color: EXAM_PREP_ACCENT_HEX }}>Exam</p>
                          </div>
                          <p className="text-xs font-semibold text-slate-700 dark:text-white leading-snug wrap-break-word">
                            {e.type} — {e.moduleName}
                          </p>
                        </div>
                      ))}
                      {dueAssignments.map((a) => (
                        <div key={a.taskId} className="rounded-xl px-2.5 py-2 bg-slate-50 dark:bg-white/5 border border-black/5 dark:border-white/10">
                          <p className="text-xs font-semibold text-slate-700 dark:text-white leading-snug wrap-break-word">{a.title}</p>
                          <p className="text-[10px] text-slate-400 leading-snug wrap-break-word">{a.moduleName} · due this day</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Free-time indicator - only meaningful for the current
                    (actually time-blocked) week. */}
                {freeLabel && (
                  <div className={`mt-2 shrink-0 rounded-lg border border-dashed border-slate-200 dark:border-white/10 px-2 py-1.5 text-center ${isPast ? "opacity-55" : ""}`}>
                    <p className="text-[10px] font-medium text-slate-400">{freeLabel} free</p>
                  </div>
                )}

                {isCurrentWeek && (
                  <div className={`mt-2 pt-2 border-t border-black/5 dark:border-white/10 shrink-0 space-y-1 ${isPast ? "opacity-55" : ""}`}>
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
                )}
              </div>
            );
          })}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function EmptyDay({ title = "Nothing scheduled", subtitle = "Good day for a break, or tackle something ahead of time." }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-1 py-4">
      <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-500/15 flex items-center justify-center mb-2">
        <Coffee size={16} className="text-brand-400" />
      </div>
      <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-300">{title}</p>
      <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">{subtitle}</p>
    </div>
  );
}
