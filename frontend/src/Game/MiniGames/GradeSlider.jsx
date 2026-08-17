import { useState } from "react";

function subjectOf(question) {
  const exam = question?.context?.missingExams?.[0];
  if (exam?.subject) {
    const kind = String(exam.examType || exam.exam_type || "").replace(/^\w/, (c) => c.toUpperCase());
    return kind ? `${exam.subject} · ${kind}` : exam.subject;
  }
  return question?.subject || question?.context?.subject || "Today's subject";
}

export default function GradeSlider({ question, onComplete }) {
  const [value, setValue] = useState(75);
  const subject = subjectOf(question);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-6">
        <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-800/70">
          Marks desk
        </div>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-stone-900">{subject}</h2>
        <p className="mt-2 max-w-xl text-sm text-stone-600">
          {question?.questionText ?? "Log the mark you received for this subject."}
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-10">
        <div className="relative mb-8 flex h-48 w-48 items-center justify-center rounded-full border-[10px] border-amber-800/15">
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: `conic-gradient(#92400e ${value * 3.6}deg, #f5f5f4 0deg)`,
              mask: "radial-gradient(farthest-side, transparent calc(100% - 10px), #000 calc(100% - 10px))",
              WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 10px), #000 calc(100% - 10px))",
            }}
          />
          <div className="text-center">
            <div className="text-5xl font-semibold tabular-nums text-stone-900">{value}</div>
            <div className="text-xs uppercase tracking-[0.2em] text-stone-400">percent</div>
          </div>
        </div>

        <input
          type="range"
          min={0}
          max={100}
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          className="w-full max-w-md accent-amber-800"
        />

        <input
          type="number"
          min={0}
          max={100}
          value={value}
          onChange={(e) => setValue(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
          className="mt-4 w-28 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-center text-lg font-semibold text-stone-800 outline-none focus:border-amber-700/40"
        />

        <button
          type="button"
          onClick={() => onComplete(value)}
          className="mt-8 w-full max-w-md rounded-2xl bg-amber-800 py-3.5 text-sm font-semibold text-amber-50 transition-colors hover:bg-amber-700"
        >
          Save {subject} mark
        </button>
      </div>
    </div>
  );
}
