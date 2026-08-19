import { useState } from "react";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function subjectOf(question) {
  return question?.subject || question?.context?.subject || "Today's subject";
}

export default function DeadlineAbacus({ question, onComplete }) {
  const today = new Date();
  const [day, setDay] = useState(today.getDate());
  const [month, setMonth] = useState(today.getMonth());
  const year = today.getFullYear();
  const subject = subjectOf(question);

  function confirm() {
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    onComplete(iso);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-6">
        <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-800/70">
          Deadline desk
        </div>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-stone-900">{subject}</h2>
        <p className="mt-2 max-w-xl text-sm text-stone-600">
          {question?.questionText ?? "Slide the beads to set the deadline."}
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col justify-center rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-10">
        <div className="mb-8">
          <div className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
            <span>Day</span>
            <span className="text-amber-800">{day}</span>
          </div>
          <input
            type="range"
            min={1}
            max={31}
            value={day}
            onChange={(e) => setDay(Number(e.target.value))}
            className="w-full accent-amber-800"
          />
        </div>

        <div className="mb-8">
          <div className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
            <span>Month</span>
            <span className="text-amber-800">{MONTHS[month]}</span>
          </div>
          <input
            type="range"
            min={0}
            max={11}
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="w-full accent-amber-800"
          />
        </div>

        <div className="mb-8 text-center text-sm text-stone-600">
          Confirmed date:{" "}
          <span className="font-semibold text-stone-900">
            {MONTHS[month]} {day}, {year}
          </span>
        </div>

        <button
          type="button"
          onClick={confirm}
          className="w-full rounded-2xl bg-amber-800 py-3.5 text-sm font-semibold text-amber-50 transition-colors hover:bg-amber-700"
        >
          Stamp deadline
        </button>
      </div>
    </div>
  );
}
