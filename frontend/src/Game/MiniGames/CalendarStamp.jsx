import { useState } from "react";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function daysInMonth(monthIndex, year) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function subjectOf(question) {
  return question?.subject || question?.context?.subject || "Today's subject";
}

export default function CalendarStamp({ question, onComplete }) {
  const today = new Date();
  const [monthIndex, setMonthIndex] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());
  const [day, setDay] = useState(null);
  const [stamped, setStamped] = useState(false);
  const subject = subjectOf(question);

  const total = daysInMonth(monthIndex, year);
  const firstWeekday = new Date(year, monthIndex, 1).getDay();

  function shiftMonth(delta) {
    const next = new Date(year, monthIndex + delta, 1);
    setYear(next.getFullYear());
    setMonthIndex(next.getMonth());
    setDay(null);
  }

  function pickDay(d) {
    if (stamped) return;
    if (day === d) {
      confirm(d);
      return;
    }
    setDay(d);
  }

  function confirm(selectedDay = day) {
    if (!selectedDay || stamped) return;
    setDay(selectedDay);
    setStamped(true);
    const iso = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(selectedDay).padStart(2, "0")}`;
    setTimeout(() => onComplete(iso), 280);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-6">
        <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-800/70">
          Calendar Stamp
        </div>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-stone-900">{subject}</h2>
        <p className="mt-2 max-w-xl text-sm text-stone-600">
          {question?.context?.field === "deadline-check"
            ? `Stamp the deadline for ${subject} on the real calendar.`
            : question?.questionText ?? "Stamp the assignment deadline on the real calendar."}
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="mb-4 flex shrink-0 items-center justify-between">
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
          <div className="mx-auto grid max-w-md grid-cols-7 gap-1.5 text-center">
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
            const selected = d === day;
            const isToday =
              d === today.getDate() && monthIndex === today.getMonth() && year === today.getFullYear();
            return (
              <button
                key={d}
                type="button"
                onClick={() => pickDay(d)}
                className={`h-10 rounded-2xl text-sm transition-colors sm:h-11 ${
                  selected
                    ? "bg-amber-800 text-amber-50 font-bold shadow-sm"
                    : isToday
                      ? "bg-amber-50 text-amber-900 font-semibold"
                      : "text-stone-700 hover:bg-stone-100"
                }`}
              >
                {d}
              </button>
            );
          })}
          </div>
        </div>

        <button
          type="button"
          disabled={!day || stamped}
          onClick={() => confirm()}
          className="mt-4 shrink-0 rounded-2xl bg-amber-800 py-3.5 text-sm font-semibold text-amber-50 transition-colors hover:bg-amber-700 disabled:opacity-40"
        >
          {stamped ? "Stamped ✓" : day ? `Confirm stamp · ${MONTHS[monthIndex]} ${day}` : "Pick a date, then confirm"}
        </button>
      </div>
    </div>
  );
}
