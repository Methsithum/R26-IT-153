import { useState } from "react";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// Deadline Abacus: slide two beads — one for the day (1-31), one for the
// month (Jan-Dec) — to set the deadline.
export default function DeadlineAbacus({ question, onComplete }) {
  const today = new Date();
  const [day, setDay] = useState(today.getDate());
  const [month, setMonth] = useState(today.getMonth());
  const year = today.getFullYear();

  function confirm() {
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    onComplete(iso);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="text-xs uppercase tracking-wide text-sky-300/80">Deadline Abacus</div>
      <div className="text-sm text-slate-100">{question?.questionText ?? "Slide the beads to set the deadline."}</div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-slate-400">
          <span>Day</span>
          <span className="text-amber-300 font-bold text-sm">{day}</span>
        </div>
        <div className="relative h-6 rounded-full bg-gradient-to-r from-amber-900/60 to-amber-700/40 border border-amber-600/30">
          <input
            type="range"
            min={1}
            max={31}
            value={day}
            onChange={(e) => setDay(Number(e.target.value))}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-amber-400 border-2 border-amber-200 shadow pointer-events-none transition-all"
            style={{ left: `calc(${((day - 1) / 30) * 100}% - ${((day - 1) / 30) * 20}px)` }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-slate-400">
          <span>Month</span>
          <span className="text-sky-300 font-bold text-sm">{MONTHS[month]}</span>
        </div>
        <div className="relative h-6 rounded-full bg-gradient-to-r from-sky-900/60 to-sky-700/40 border border-sky-600/30">
          <input
            type="range"
            min={0}
            max={11}
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-sky-400 border-2 border-sky-200 shadow pointer-events-none transition-all"
            style={{ left: `calc(${(month / 11) * 100}% - ${(month / 11) * 20}px)` }}
          />
        </div>
      </div>

      <div className="text-center text-sm text-slate-300">
        Confirmed date: <span className="font-semibold text-amber-300">{MONTHS[month]} {day}</span>
      </div>

      <button
        type="button"
        onClick={confirm}
        className="rounded-lg bg-sky-500 hover:bg-sky-400 transition-colors text-slate-900 font-semibold py-2"
      >
        Confirm Date
      </button>
    </div>
  );
}
