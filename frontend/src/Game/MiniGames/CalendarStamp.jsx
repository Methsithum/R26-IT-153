import { useState } from "react";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function daysInMonth(monthIndex, year) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

// Calendar Stamp: pick a day on a real calendar grid for the current
// month, then "stamp" it to confirm.
export default function CalendarStamp({ question, onComplete }) {
  const today = new Date();
  const [monthIndex, setMonthIndex] = useState(today.getMonth());
  const [year] = useState(today.getFullYear());
  const [day, setDay] = useState(null);
  const [stamped, setStamped] = useState(false);

  const total = daysInMonth(monthIndex, year);
  const firstWeekday = new Date(year, monthIndex, 1).getDay();

  function confirm() {
    if (!day) return;
    setStamped(true);
    const iso = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    setTimeout(() => onComplete(iso), 350);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="text-xs uppercase tracking-wide text-sky-300/80">Calendar Stamp</div>
      <div className="text-sm text-slate-100">{question?.questionText ?? "Stamp the deadline date."}</div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setMonthIndex((m) => (m + 11) % 12)}
          className="text-slate-400 hover:text-slate-100 px-2"
        >
          ‹
        </button>
        <div className="text-sm font-semibold text-amber-300">
          {MONTHS[monthIndex]} {year}
        </div>
        <button
          type="button"
          onClick={() => setMonthIndex((m) => (m + 1) % 12)}
          className="text-slate-400 hover:text-slate-100 px-2"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={`${d}-${i}`} className="text-[10px] text-slate-500">{d}</div>
        ))}
        {Array.from({ length: firstWeekday }).map((_, i) => (
          <div key={`pad-${i}`} />
        ))}
        {Array.from({ length: total }).map((_, i) => {
          const d = i + 1;
          const selected = d === day;
          return (
            <button
              key={d}
              type="button"
              onClick={() => setDay(d)}
              className={`rounded-md py-1 text-xs transition-colors ${
                selected
                  ? "bg-amber-400 text-slate-900 font-bold"
                  : "bg-slate-800 text-slate-200 hover:bg-slate-700"
              }`}
            >
              {d}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        disabled={!day}
        onClick={confirm}
        className="rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-40 disabled:cursor-not-allowed
                   transition-colors text-slate-900 font-semibold py-2"
      >
        {stamped ? "Stamped ✓" : "Stamp Date"}
      </button>
    </div>
  );
}
