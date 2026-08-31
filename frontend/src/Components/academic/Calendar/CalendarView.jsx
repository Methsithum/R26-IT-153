import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useAcademicStore } from "../../../store/useAcademicStore";
import { toLocalDateStr } from "../../../utils/dateHelpers";

const EVENT_STYLES = {
  assignment: { label: "Assignment", color: "bg-brand-500" },
  exam: { label: "Exam", color: "bg-high-500" },
  completed: { label: "Completed", color: "bg-low-500" },
};

export default function CalendarView() {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const assignments = useAcademicStore((s) => s.assignments);
  const exams = useAcademicStore((s) => s.exams);

  const eventsByDate = useMemo(() => {
    const map = {};
    const push = (date, type) => {
      map[date] = map[date] || [];
      map[date].push(type);
    };
    assignments.forEach((a) => push(a.deadlineDate, a.status === "completed" ? "completed" : "assignment"));
    exams.forEach((e) => push(e.date, "exam"));
    return map;
  }, [assignments, exams]);

  const firstDay = new Date(cursor.year, cursor.month, 1);
  const startWeekday = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
  const cells = [...Array(startWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const monthLabel = firstDay.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  function shiftMonth(delta) {
    setCursor((c) => {
      const d = new Date(c.year, c.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

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

      <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-semibold text-slate-400 mb-1.5">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d}>{d}</div>)}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((day, i) => {
          if (day == null) return <div key={i} />;
          const dateStr = toLocalDateStr(new Date(cursor.year, cursor.month, day));
          const events = eventsByDate[dateStr] || [];
          const isToday = dateStr === toLocalDateStr(new Date());
          return (
            <div key={i} className={`min-h-16 rounded-xl p-1.5 border ${isToday ? "border-brand-400 bg-brand-50 dark:bg-brand-500/10" : "border-black/5 dark:border-white/5"}`}>
              <p className={`text-[11px] font-semibold ${isToday ? "text-brand-600" : "text-slate-400"}`}>{day}</p>
              <div className="flex flex-wrap gap-0.5 mt-1">
                {events.slice(0, 4).map((type, ei) => (
                  <span key={ei} className={`w-1.5 h-1.5 rounded-full ${EVENT_STYLES[type].color}`} title={EVENT_STYLES[type].label} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-black/5 dark:border-white/10">
        {Object.entries(EVENT_STYLES).map(([key, meta]) => (
          <span key={key} className="inline-flex items-center gap-1.5 text-[11px] text-slate-400">
            <span className={`w-2 h-2 rounded-full ${meta.color}`} /> {meta.label}
          </span>
        ))}
      </div>
    </div>
  );
}
