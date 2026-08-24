import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Pencil, X, HelpCircle, GraduationCap } from "lucide-react";
import { PRIORITY_COLORS } from "../../../utils/featureNameMap";
import { toLocalDateStr } from "../../../utils/dateHelpers";
import { useAcademicStore } from "../../../store/useAcademicStore";
import { useWeeklySchedule } from "../../../hooks/useAcademicData";

// Real data: each cell is built from the student's actual assignments
// (real deadlineDate, real module) with the priority the backend's
// /predict-priority model already assigned via the current /schedule call
// (schedule.tasks[taskId].priority_label) — the same source Tasks.jsx uses,
// so priority is consistent across the whole app. Assignments with no
// prediction yet (e.g. completed/missed tasks not sent to /schedule) get
// `isPredicted: false` and a "Medium" placeholder that must never be styled
// like a real result — a fallback default and a real ML prediction should
// never look the same (PROJECT CONTEXT.md's honesty-about-confidence rule).
export default function MonthGrid() {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [selectedDate, setSelectedDate] = useState(null);

  const assignments = useAcademicStore((s) => s.assignments);
  const exams = useAcademicStore((s) => s.exams);
  const updateAssignmentDeadline = useAcademicStore((s) => s.updateAssignmentDeadline);
  const updateExamDate = useAcademicStore((s) => s.updateExamDate);
  const { schedule } = useWeeklySchedule();

  const sessionsByDate = useMemo(() => {
    const map = {};
    assignments.forEach((a) => {
      const predicted = schedule?.tasks?.[a.taskId]?.priority_label;
      map[a.deadlineDate] = map[a.deadlineDate] || [];
      map[a.deadlineDate].push({
        kind: "assignment",
        id: a.taskId,
        date: a.deadlineDate,
        title: a.title,
        moduleName: a.moduleName,
        status: a.status,
        priority: predicted || "Medium",
        isPredicted: !!predicted,
        estimatedHoursNeeded: a.estimatedHoursNeeded,
      });
    });
    // Exams are important dates too, but never get an ML priority — they're
    // kept as their own entry kind so they're never dishonestly forced into
    // the High/Medium/Low priority system, and always visually stand out.
    exams.forEach((e) => {
      map[e.date] = map[e.date] || [];
      map[e.date].push({
        kind: "exam",
        id: e.id,
        date: e.date,
        title: e.type,
        moduleName: e.moduleName,
        examType: e.type,
      });
    });
    return map;
  }, [assignments, exams, schedule]);

  const firstDay = new Date(cursor.year, cursor.month, 1);
  const startWeekday = (firstDay.getDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
  const cells = [...Array(startWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  const monthLabel = firstDay.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  function shiftMonth(delta) {
    setCursor((c) => {
      const d = new Date(c.year, c.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
    setSelectedDate(null);
  }

  const selectedSessions = selectedDate ? sessionsByDate[selectedDate] || [] : [];
  const PRIORITY_RANK = { High: 3, Medium: 2, Low: 1 };

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="font-display font-bold text-slate-800 dark:text-white">{monthLabel}</p>
        <div className="flex items-center gap-1">
          <button onClick={() => shiftMonth(-1)} className="w-8 h-8 rounded-full hover:bg-brand-50 dark:hover:bg-white/10 flex items-center justify-center">
            <ChevronLeft size={16} />
          </button>
          <button onClick={() => shiftMonth(1)} className="w-8 h-8 rounded-full hover:bg-brand-50 dark:hover:bg-white/10 flex items-center justify-center">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4 text-[11px] font-medium text-slate-500 dark:text-slate-400">
        {["High", "Medium", "Low"].map((p) => (
          <span key={p} className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${PRIORITY_COLORS[p].dot}`} />
            {p}
          </span>
        ))}
        <span className="flex items-center gap-1" title="This task hasn't been through /predict-priority yet — add it to your weekly plan to get a real ML priority.">
          <span className="w-2 h-2 rounded-full border border-dashed border-slate-400" />
          Not yet predicted
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-accent-blue" />
          Exam
        </span>
      </div>

      <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-semibold text-slate-400 mb-1.5">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((day, i) => {
          if (day == null) return <div key={i} />;
          const dateStr = toLocalDateStr(new Date(cursor.year, cursor.month, day));
          const daySessions = sessionsByDate[dateStr] || [];
          const isToday = dateStr === toLocalDateStr(new Date());
          const isSelected = dateStr === selectedDate;
          const hasExam = daySessions.some((s) => s.kind === "exam");
          const dominantEntry = daySessions
            .filter((s) => s.kind === "assignment")
            .reduce((acc, s) => (!acc || PRIORITY_RANK[s.priority] > PRIORITY_RANK[acc.priority] ? s : acc), null);
          const dominant = dominantEntry?.priority;
          const dominantIsPredicted = !!dominantEntry?.isPredicted;
          // Exams surface first — they're the most important date on a day
          // that has both a task deadline and an exam.
          const ordered = [...daySessions].sort((a, b) => (a.kind === "exam" ? -1 : 0) - (b.kind === "exam" ? -1 : 0));
          const visibleSessions = ordered.slice(0, 2);
          const overflowCount = ordered.length - visibleSessions.length;
          return (
            <button
              key={i}
              onClick={() => setSelectedDate((d) => (d === dateStr ? null : dateStr))}
              className={`min-h-[86px] rounded-xl p-1.5 border text-left transition-colors flex flex-col ${
                isSelected
                  ? "border-brand-500 bg-brand-100 dark:bg-brand-500/20"
                  : isToday
                  ? "border-brand-400 bg-brand-50 dark:bg-brand-500/10"
                  : hasExam
                  ? "border-accent-blue bg-accent-blue/10 hover:brightness-95 dark:hover:brightness-125"
                  : dominant && dominantIsPredicted
                  ? `border-transparent ${PRIORITY_COLORS[dominant].bg} hover:brightness-95 dark:hover:brightness-125`
                  : dominant
                  ? `border-dashed opacity-60 ${PRIORITY_COLORS[dominant].bg} hover:opacity-80`
                  : "border-black/5 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5"
              }`}
            >
              <p className={`text-[11px] font-semibold ${isToday ? "text-brand-600" : "text-slate-400"}`}>{day}</p>
              <div className="flex flex-col gap-0.5 mt-1 min-w-0">
                {visibleSessions.map((s, si) =>
                  s.kind === "exam" ? (
                    <span
                      key={si}
                      title={`${s.examType} · ${s.moduleName}`}
                      className="flex items-center gap-1 rounded-md px-1 py-0.5 text-[9px] leading-tight font-semibold truncate text-white bg-accent-blue"
                    >
                      <GraduationCap size={9} className="shrink-0" />
                      {s.moduleName?.split(" ")[0] || s.examType}
                    </span>
                  ) : (
                    <span
                      key={si}
                      title={
                        s.isPredicted
                          ? `${s.title} · ${s.priority} priority`
                          : `${s.title} · Priority not yet predicted — add this task to your weekly plan to get an ML-based priority.`
                      }
                      className={`flex items-center gap-1 rounded-md px-1 py-0.5 text-[9px] leading-tight font-semibold truncate ${
                        s.status === "completed"
                          ? "text-white bg-low-500"
                          : s.isPredicted
                          ? `text-white ${PRIORITY_COLORS[s.priority].solid}`
                          : `${PRIORITY_COLORS[s.priority].text} bg-transparent border border-dashed border-current opacity-70`
                      }`}
                    >
                      {!s.isPredicted && s.status !== "completed" && <HelpCircle size={9} className="shrink-0" />}
                      {s.moduleName?.split(" ")[0] || s.title}
                    </span>
                  )
                )}
                {overflowCount > 0 && (
                  <span className="text-[9px] font-semibold text-slate-400">+{overflowCount} more</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <AnimatePresence>
        {selectedDate && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-4 pt-4 border-t border-black/5 dark:border-white/10">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {new Date(`${selectedDate}T00:00:00`).toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
                <button
                  onClick={() => setSelectedDate(null)}
                  className="w-6 h-6 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 flex items-center justify-center text-slate-400"
                >
                  <X size={14} />
                </button>
              </div>

              {selectedSessions.length === 0 ? (
                <p className="text-sm text-slate-400">No assignments or exams on this day.</p>
              ) : (
                <div className="space-y-2">
                  {selectedSessions.map((session) =>
                    session.kind === "exam" ? (
                      <div key={session.id} className="rounded-xl border border-accent-blue/30 bg-accent-blue/5 p-2.5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <GraduationCap size={14} className="text-accent-blue shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{session.examType}</p>
                              <p className="text-xs text-slate-400 truncate">{session.moduleName}</p>
                            </div>
                          </div>
                          <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-accent-blue/15 text-accent-blue">
                            Exam
                          </span>
                          <label className="flex items-center gap-1.5 text-xs text-slate-400 shrink-0">
                            <Pencil size={12} />
                            <input
                              type="date"
                              value={session.date}
                              onChange={(e) => {
                                if (e.target.value) updateExamDate(session.id, e.target.value);
                              }}
                              className="rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-1.5 py-1 text-xs text-slate-600 dark:text-slate-300"
                            />
                          </label>
                        </div>
                      </div>
                    ) : (
                      <div key={session.id} className="rounded-xl border border-black/5 dark:border-white/5 p-2.5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            {session.isPredicted ? (
                              <span className={`w-2 h-2 rounded-full shrink-0 ${PRIORITY_COLORS[session.priority].dot}`} />
                            ) : (
                              <HelpCircle size={12} className="text-slate-400 shrink-0" />
                            )}
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{session.title}</p>
                              <p className="text-xs text-slate-400 truncate">
                                {session.moduleName} · {session.estimatedHoursNeeded}h needed
                              </p>
                            </div>
                          </div>
                          {session.isPredicted ? (
                            <span
                              className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${PRIORITY_COLORS[session.priority].bg} ${PRIORITY_COLORS[session.priority].text}`}
                            >
                              {session.priority}
                            </span>
                          ) : (
                            <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border border-dashed border-slate-300 dark:border-slate-600 text-slate-400">
                              Not yet predicted
                            </span>
                          )}
                          <label className="flex items-center gap-1.5 text-xs text-slate-400 shrink-0">
                            <Pencil size={12} />
                            <input
                              type="date"
                              value={session.date}
                              onChange={(e) => {
                                if (e.target.value) updateAssignmentDeadline(session.id, e.target.value);
                              }}
                              className="rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-1.5 py-1 text-xs text-slate-600 dark:text-slate-300"
                            />
                          </label>
                        </div>
                        {!session.isPredicted && (
                          <p className="text-[11px] text-slate-400 mt-1.5 pl-[18px]">
                            Priority not yet predicted — add this task to your weekly plan (Study Planner → Week) to
                            get an ML-based priority.
                          </p>
                        )}
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
