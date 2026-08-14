import { useMemo, useState } from "react";
import { useGameStore } from "../state/GameStateManager";
import { pendingExams } from "../data/exams";

function formatDate(d) {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function candidateDates(seedOffset) {
  const today = new Date();
  return Array.from({ length: 3 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() + seedOffset + i * 7 + 3);
    return d;
  });
}

// Exam Date Calendar Sort: drag/click each exam's date card into the
// "confirmed" box. Resolves every still-pending exam in one interaction.
export default function ExamCalendarSort({ onComplete }) {
  const exams = useGameStore((s) => s.exams);
  const pending = useMemo(() => pendingExams(exams), [exams]);
  const [assigned, setAssigned] = useState({});

  const allAssigned = pending.length > 0 && pending.every((e) => assigned[e.id]);

  function confirm() {
    const value = {};
    for (const exam of pending) {
      if (assigned[exam.id]) value[exam.id] = assigned[exam.id];
    }
    onComplete(value);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="text-xs uppercase tracking-wide text-sky-300/80">Exam Date Calendar Sort</div>
      <div className="text-sm text-slate-100">Drag the exams to their dates.</div>

      <div className="flex flex-col gap-3 max-h-64 overflow-y-auto pr-1">
        {pending.map((exam, i) => (
          <div key={exam.id} className="rounded-lg border border-slate-700 bg-slate-800/60 p-2">
            <div className="text-xs font-semibold text-slate-200 mb-2">{exam.subject}</div>
            <div className="flex gap-2 flex-wrap">
              {candidateDates(i * 5).map((d) => {
                const iso = d.toISOString().slice(0, 10);
                const selected = assigned[exam.id] === iso;
                return (
                  <button
                    key={iso}
                    type="button"
                    onClick={() => setAssigned((a) => ({ ...a, [exam.id]: iso }))}
                    className={`rounded-md px-2 py-1 text-[11px] transition-colors ${
                      selected
                        ? "bg-amber-400 text-slate-900 font-bold"
                        : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                    }`}
                  >
                    {formatDate(d)}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-dashed border-emerald-400/40 bg-emerald-500/5 p-2 text-center text-[11px] text-emerald-300">
        Confirmed box:{" "}
        {pending
          .filter((e) => assigned[e.id])
          .map((e) => `${e.subject}: ${assigned[e.id]}`)
          .join(" · ") || "empty"}
      </div>

      <button
        type="button"
        disabled={!allAssigned}
        onClick={confirm}
        className="rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-40 disabled:cursor-not-allowed
                   transition-colors text-slate-900 font-semibold py-2"
      >
        Confirm All Dates
      </button>
    </div>
  );
}
