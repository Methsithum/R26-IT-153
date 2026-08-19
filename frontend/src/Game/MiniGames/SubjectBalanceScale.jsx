import { useState } from "react";

function subjectOf(question) {
  const exam = question?.context?.missingExams?.[0];
  if (exam?.subject) {
    const kind = String(exam.examType || exam.exam_type || "").replace(/^\w/, (c) => c.toUpperCase());
    return kind ? `${exam.subject} · ${kind}` : exam.subject;
  }
  return question?.subject || question?.context?.subject || "Today's subject";
}

export default function SubjectBalanceScale({ question, onComplete }) {
  const [value, setValue] = useState(50);
  const tilt = (value - 50) / 50;
  const beamAngle = tilt * 10;
  const subject = subjectOf(question);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-6">
        <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-800/70">
          Performance desk
        </div>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-stone-900">{subject}</h2>
        <p className="mt-2 max-w-xl text-sm text-stone-600">
          {question?.questionText ?? "Balance the scale to the mark you received."}
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-10">
        <svg viewBox="0 0 200 120" width={240} height={144}>
          <rect x={96} y={50} width={8} height={50} fill="#c9a26a" />
          <polygon points="70,100 130,100 138,110 62,110" fill="#8f7350" />
          <g transform={`rotate(${beamAngle} 100 50)`}>
            <rect x={20} y={47} width={160} height={5} fill="#c9a26a" />
            <line x1={40} y1={50} x2={40} y2={72} stroke="#8f7350" strokeWidth={2} />
            <line x1={160} y1={50} x2={160} y2={72} stroke="#8f7350" strokeWidth={2} />
            <rect x={26} y={72} width={28} height={16} rx={2} fill="#7a5636" />
            <rect x={146} y={72} width={28} height={16} rx={2} fill="#4d7c0f" />
          </g>
          <circle cx={100} cy={50} r={4} fill="#4a3520" />
        </svg>

        <div className="mt-6 flex w-full max-w-md items-center gap-4">
          <input
            type="range"
            min={0}
            max={100}
            value={value}
            onChange={(e) => setValue(Number(e.target.value))}
            className="flex-1 accent-amber-800"
          />
          <div className="w-20 rounded-xl border border-stone-200 bg-stone-50 px-2 py-2 text-center">
            <span className="text-lg font-semibold text-stone-900">{value}</span>
            <span className="text-xs text-stone-400">%</span>
          </div>
        </div>

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
