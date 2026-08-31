import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, CalendarX, Coffee, GraduationCap, ChevronLeft, ChevronRight, CheckCircle2, Clock, History } from "lucide-react";
import { PRIORITY_COLORS } from "../../../utils/featureNameMap";
import { WEEKDAYS, getWeekStart, addDays, toLocalDateStr, formatWeekRangeLabel } from "../../../utils/dateHelpers";
import { useAcademicStore } from "../../../store/useAcademicStore";
import { useMultiWeekSchedule } from "../../../hooks/useAcademicData";
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

/** One real session card - a suggested self-study block or a real scheduled task. Shared by the current week and any other in-range week (Part: multi-week integration), so this rendering is written once. */
function SessionCard({ entry, di, i, tasksRegistry, assignments, moduleName, exams }) {
  const isStudySession = entry.timeSlot != null;
  const delay = di * 0.02 + i * 0.03;

  if (isStudySession) {
    const s = entry;
    return (
      <motion.div
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
        <p className="text-xs font-semibold text-slate-700 dark:text-white leading-snug wrap-break-word" title={s.assignmentTitle || s.moduleName}>
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
  const display = resolveSessionDisplay(item, { tasksRegistry, assignments, moduleName, exams });
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className={`rounded-xl px-2.5 py-2 ${colors.bg} hover:-translate-y-0.5 hover:shadow-playful transition-all ${display.isExamPrep ? "border-2" : ""}`}
      style={display.isExamPrep ? { borderColor: EXAM_PREP_ACCENT_HEX } : undefined}
    >
      <div className="flex items-center gap-1.5">
        {display.isExamPrep ? (
          <GraduationCap size={11} style={{ color: EXAM_PREP_ACCENT_HEX }} title={display.isLabPrep ? "Lab prep" : "Exam prep"} />
        ) : (
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${colors.dot}`} title={`${priority} priority`} />
        )}
        <p className={`text-[11px] font-bold ${colors.text}`}>{item.time_slot}</p>
      </div>
      <p className="text-xs font-semibold text-slate-700 dark:text-white leading-snug wrap-break-word" title={display.title}>
        {display.title}
      </p>
      <p className="text-[10px] text-slate-400 leading-snug wrap-break-word">
        {display.subtitle ? `${display.subtitle} · ` : ""}{item.duration_minutes} min
      </p>
    </motion.div>
  );
}

function BandedTimeline({ timeline, di, tasksRegistry, assignments, moduleName, exams }) {
  const bandedGroups = TIME_OF_DAY_BAND_ORDER.map((band) => ({
    band,
    entries: timeline.filter((entry) => getTimeOfDayBand(startTimeOf(entry)) === band),
  })).filter((g) => g.entries.length > 0);

  return (
    <div className="space-y-3 flex-1">
      {bandedGroups.map(({ band, entries }) => (
        <div key={band}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 shrink-0">{band}</span>
            <span className="flex-1 h-px bg-slate-100 dark:bg-white/10" />
          </div>
          <div className="space-y-2">
            {entries.map((entry, i) => (
              <SessionCard
                key={entry.taskId || `${entry.task_id}-${i}`}
                entry={entry}
                di={di}
                i={i}
                tasksRegistry={tasksRegistry}
                assignments={assignments}
                moduleName={moduleName}
                exams={exams}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function WeekGrid({ schedule, tasksRegistry, overloadWarning }) {
  const modules = useAcademicStore((s) => s.modules);
  const weeklyFreeSlots = useAcademicStore((s) => s.weeklyFreeSlots);
  const assignments = useAcademicStore((s) => s.assignments);
  const exams = useAcademicStore((s) => s.exams);
  // Frozen per-date snapshots (Section 8e) - once a past date is captured
  // here, it is the SOLE source of truth for that date's content below,
  // regardless of what the live schedule/multiWeekSchedule now says for it.
  const historicalScheduleByDate = useAcademicStore((s) => s.historicalScheduleByDate);
  const moduleName = (code) => modules.find((m) => m.code === code)?.name || code;

  // Real, ISO-date-keyed sessions spanning several weeks ahead (PROJECT
  // CONTEXT.md Section 8d) - fetched once, sliced per viewed week below,
  // instead of a fresh backend call every time the student navigates.
  const { multiWeekSchedule, loading: multiWeekLoading } = useMultiWeekSchedule();

  // --- Part 2: week navigation --------------------------------------------
  // weekOffset counts real weeks away from the actual current week (0 = this
  // week, +1 = next week, -1 = last week). The CURRENT week keeps using the
  // single-week `schedule` prop (from useWeeklySchedule/StudyPlanner.jsx) -
  // it's the one still wired to /reschedule for live "mark complete"/"missed
  // task" adjustments. Every OTHER week is sliced from multiWeekSchedule,
  // which covers real, backend-time-blocked sessions up to its generated
  // range (up to 12 weeks - schedule_engine.py's MAX_WEEKS_AHEAD); a week
  // beyond that range still honestly says so rather than showing nothing.
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

  const rangeStart = multiWeekSchedule?.range_start;
  const rangeEnd = multiWeekSchedule?.range_end;

  // Overload warnings relevant to the currently-viewed non-current week
  // (its own tasks registry doesn't map 1:1 onto the current week's props).
  const viewedWeekOverload = !isCurrentWeek && multiWeekSchedule
    ? multiWeekSchedule.overload_warning.filter((w) => w.deadline_date >= toLocalDateStr(weekDates[0]) && w.deadline_date <= toLocalDateStr(weekDates[6]))
    : [];

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

      {!isCurrentWeek && viewedWeekOverload.length > 0 && (
        <div className="card p-4 border-l-4 border-high-500 bg-high-50/60 dark:bg-high-500/10">
          <p className="text-sm font-semibold text-high-600 mb-1">A few tasks need more room than your free time allows</p>
          <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-0.5">
            {viewedWeekOverload.map((w) => (
              <li key={w.task_id}>
                {moduleName(w.module)} — short by {w.hours_short}h before {w.deadline_date}. Consider freeing up
                extra time or adjusting scope.
              </li>
            ))}
          </ul>
        </div>
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

            const withinGeneratedRange = !isCurrentWeek && rangeStart && dateStr >= rangeStart && dateStr <= rangeEnd;

            // Past dates NEVER read from the live schedule/multiWeekSchedule,
            // no matter what those currently say - once a date is past, its
            // content is frozen (Section 8e) the moment it's captured by
            // freezePastDates() (useAcademicStore), and a later regeneration
            // must not be able to change what already happened. A past date
            // with no frozen record at all (captured before this mechanism
            // existed, or a gap while the app was closed) honestly says so
            // below rather than showing a misleading empty "Nothing scheduled".
            const historicalRecord = isPast ? historicalScheduleByDate?.[dateStr] : null;
            const hasHistoricalRecord = isPast && !!historicalRecord;

            // Which task/session data source this day pulls from (today/future only):
            //  - current week: the live, /reschedule-integrated single-week `schedule` prop (weekday-keyed).
            //  - other weeks within the generated range: multiWeekSchedule (real ISO-date-keyed).
            //  - other weeks outside the range: none - honest fallback below.
            //
            // IMPORTANT for the current week: `schedule` (and studySessionsByDay)
            // are keyed by weekday NAME, but StudyScheduler resolves those names
            // relative to ITS OWN anchor (today), not this calendar-Monday-
            // aligned display - "Monday" means "the next Monday from today",
            // which is a DIFFERENT calendar date than this column's `dayDate`
            // whenever today isn't itself Monday. The static `day` from the
            // WEEKDAYS iteration must NOT be used to look up real content here
            // - only `dayDate`'s OWN real weekday name correctly identifies
            // which backend bucket this specific date actually landed in.
            const realDayName = dayDate.toLocaleDateString(undefined, { weekday: "long" });
            const items = isPast
              ? historicalRecord?.sessions || []
              : isCurrentWeek
              ? schedule?.[realDayName] || []
              : withinGeneratedRange
              ? multiWeekSchedule.schedule[dateStr] || []
              : [];
            const studySessions = isCurrentWeek && !isPast ? studySessionsByDay[realDayName] || [] : []; // suggested self-study blocks are current-week-only (tied to weeklyFreeSlots' day-name pattern), and never part of a frozen historical record
            const activeTasksRegistry = isPast
              ? historicalRecord?.tasksRegistry || {}
              : isCurrentWeek
              ? tasksRegistry
              : multiWeekSchedule?.tasks;

            const timeline = [...items, ...studySessions].sort(
              (a, b) => startMinutes(a.time_slot || a.timeSlot) - startMinutes(b.time_slot || b.timeSlot)
            );

            const scheduledMinutes = timelineUsedMinutes(timeline);
            const freeMinutes = isCurrentWeek ? Math.max(0, totalFreeSlotMinutes(day, weeklyFreeSlots) - scheduledMinutes) : 0;
            const freeLabel = isCurrentWeek ? formatMinutes(freeMinutes) : null;

            const priorityCounts = items.reduce((acc, item) => {
              const p = activeTasksRegistry?.[item.task_id]?.priority_label || "Medium";
              acc[p] = (acc[p] || 0) + 1;
              return acc;
            }, {});

            let emptyState = null;
            if (isPast) {
              if (!hasHistoricalRecord) {
                emptyState = {
                  icon: History,
                  title: "Historical data not available",
                  subtitle: "This day passed before permanent history tracking began, so its original plan can't be shown.",
                };
              } else if (timeline.length === 0) {
                emptyState = { title: "Nothing scheduled", subtitle: "This day was genuinely free." };
              }
            } else if (isCurrentWeek && timeline.length === 0) {
              emptyState = { title: "Nothing scheduled", subtitle: "Good day for a break, or tackle something ahead of time." };
            } else if (!isCurrentWeek) {
              if (!multiWeekSchedule && multiWeekLoading) {
                emptyState = { icon: Clock, title: "Loading…", subtitle: "Fetching this week's real plan." };
              } else if (!withinGeneratedRange) {
                emptyState = {
                  icon: Clock,
                  title: "Too far ahead",
                  subtitle: "This week is beyond the planner's generated range (up to 12 weeks) — check back closer to it.",
                };
              } else if (timeline.length === 0) {
                emptyState = { title: "Nothing scheduled", subtitle: "No study time or deadlines land on this real day." };
              }
            }

            return (
              <div
                key={day}
                className={`card p-3 min-h-70 flex flex-col ${isToday ? "ring-2 ring-sky-500 bg-sky-200! dark:bg-sky-500/35!" : ""}`}
              >
                <div className="flex items-center justify-between gap-1.5 mb-2 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <p className={`text-xs font-bold uppercase tracking-wide ${isToday ? "text-sky-700 dark:text-sky-300" : "text-slate-400"}`}>
                      {day.slice(0, 3)} {dayDate.getDate()}
                    </p>
                    {isToday && <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />}
                  </div>
                  {/* Part 3: "Day complete" indicator, distinct from the
                      today ring/dot above - only for genuinely past days. */}
                  {isPast && (
                    <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-slate-400" title="Day complete">
                      <CheckCircle2 size={11} /> Done
                    </span>
                  )}
                </div>

                {/* Part 3: mute everything below the header for a fully-past
                    day - lower opacity + desaturation on the existing
                    priority/module colors, never a redesign of the cards
                    themselves. Today is never muted, only real past days. */}
                <div className={`flex-1 flex flex-col min-h-0 ${isPast ? "opacity-55 saturate-[.45]" : ""}`}>
                  {emptyState ? (
                    <EmptyDay {...emptyState} />
                  ) : (
                    <BandedTimeline
                      timeline={timeline}
                      di={di}
                      tasksRegistry={activeTasksRegistry}
                      assignments={assignments}
                      moduleName={moduleName}
                      exams={exams}
                    />
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

function EmptyDay({ icon: Icon = Coffee, title = "Nothing scheduled", subtitle = "Good day for a break, or tackle something ahead of time." }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-1 py-4">
      <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-500/15 flex items-center justify-center mb-2">
        <Icon size={16} className="text-brand-400" />
      </div>
      <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-300">{title}</p>
      <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">{subtitle}</p>
    </div>
  );
}
