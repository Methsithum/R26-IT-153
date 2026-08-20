import { useEffect, useMemo, useState } from "react";
import { play } from "../audio/sfx";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function daysInMonth(monthIndex, year) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function examLabel(exam) {
  const kind = String(exam.examType || exam.exam_type || "").replace(/^\w/, (c) => c.toUpperCase());
  return `${exam.subject} · ${kind || "Exam"}`;
}

export default function ExamCalendarSort({ question, onComplete }) {
  const missing = useMemo(
    () => question?.context?.missingExams || question?.missingExams || [],
    [question]
  );
  const today = new Date();
  const [monthIndex, setMonthIndex] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());
  const [activeId, setActiveId] = useState(missing[0]?.id || null);
  const [assigned, setAssigned] = useState({});

  useEffect(() => {
    if (!activeId && missing[0]?.id) setActiveId(missing[0].id);
  }, [missing, activeId]);

  const total = daysInMonth(monthIndex, year);
  const firstWeekday = new Date(year, monthIndex, 1).getDay();
  const allAssigned = missing.length > 0 && missing.every((exam) => assigned[exam.id]);
  const activeExam = missing.find((exam) => exam.id === activeId) || missing[0];

  function shiftMonth(delta) {
    const next = new Date(year, monthIndex + delta, 1);
    setYear(next.getFullYear());
    setMonthIndex(next.getMonth());
  }

  function stampDay(dayNumber) {
    if (!activeExam) return;
    const iso = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(dayNumber).padStart(2, "0")}`;
    play("stamp");
    const nextAssigned = { ...assigned, [activeExam.id]: iso };
    setAssigned(nextAssigned);
    const upcoming = missing.find((exam) => exam.id !== activeExam.id && !nextAssigned[exam.id]);
    if (upcoming) setActiveId(upcoming.id);
  }

  if (missing.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-stone-500">
        All exam dates for your subjects are already recorded.
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-800/70">
          Exam Hall
        </div>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-stone-900">Missing exam dates</h2>
        <p className="mt-2 max-w-2xl text-sm text-stone-600">
          {question?.context?.field === "exam-dates-check"
            ? "Stamp only the dates that have been released. This is a real calendar — no generated dates."
            : question?.questionText ?? "Stamp only the dates that are still missing. This is a real calendar — no generated dates."}
        </p>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 overflow-hidden lg:grid-cols-[minmax(220px,0.9fr)_1.4fr]">
        <div className="flex min-h-0 flex-col gap-2 overflow-y-auto">
          {missing.map((exam) => {
            const active = exam.id === activeExam?.id;
            const date = assigned[exam.id];
            return (
              <button
                key={exam.id}
                type="button"
                onClick={() => setActiveId(exam.id)}
                className={`rounded-2xl border px-4 py-3 text-left transition-colors ${
                  active
                    ? "border-amber-800 bg-amber-800 text-amber-50"
                    : "border-stone-200 bg-white text-stone-800 hover:bg-stone-50"
                }`}
              >
                <div className="text-sm font-semibold">{examLabel(exam)}</div>
                <div className={`mt-1 text-xs ${active ? "text-amber-100/80" : "text-stone-500"}`}>
                  {date || "Date missing — tap a day on the calendar"}
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex min-h-0 flex-col overflow-hidden rounded-3xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-3 flex shrink-0 items-center justify-between">
            <button type="button" onClick={() => shiftMonth(-1)} className="rounded-full px-3 py-1 text-stone-500 hover:bg-stone-100">
              ‹
            </button>
            <div className="text-lg font-semibold text-stone-800">
              {MONTHS[monthIndex]} {year}
            </div>
            <button type="button" onClick={() => shiftMonth(1)} className="rounded-full px-3 py-1 text-stone-500 hover:bg-stone-100">
              ›
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="grid grid-cols-7 gap-1 text-center sm:gap-1.5">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div key={d} className="pb-1 text-[11px] font-semibold uppercase tracking-wide text-stone-400">
                  {d}
                </div>
              ))}
              {Array.from({ length: firstWeekday }).map((_, i) => (
                <div key={`pad-${i}`} />
              ))}
              {Array.from({ length: total }).map((_, i) => {
                const d = i + 1;
                const iso = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                const selected = Object.values(assigned).includes(iso);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => stampDay(d)}
                    className={`h-9 rounded-xl text-sm transition-colors sm:h-10 ${
                      selected
                        ? "bg-amber-800 text-amber-50 font-bold"
                        : "text-stone-700 hover:bg-stone-100"
                    }`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        disabled={!allAssigned}
        onClick={() => onComplete(assigned)}
        className="mt-4 shrink-0 rounded-2xl bg-amber-800 py-3.5 text-sm font-semibold text-amber-50 transition-colors hover:bg-amber-700 disabled:opacity-40"
      >
        {allAssigned ? "Confirm exam dates" : "Stamp every missing paper first"}
      </button>
    </div>
  );
}
