import { useState } from "react";

// Subject Balance Scale: slide the weight to balance the scale at the mark
// you received — the beam tilts live as feedback.
export default function SubjectBalanceScale({ question, onComplete }) {
  const [value, setValue] = useState(50);
  const tilt = (value - 50) / 50; // -1..1
  const beamAngle = tilt * 10; // degrees

  return (
    <div className="flex flex-col gap-4 items-center">
      <div className="text-xs uppercase tracking-wide text-sky-300/80 self-start">
        Subject Balance Scale
      </div>
      <div className="text-sm text-slate-100 self-start">
        {question?.questionText ?? "Balance the scale to the mark you received."}
      </div>

      <svg viewBox="0 0 200 120" width={200} height={120}>
        {/* stand */}
        <rect x={96} y={50} width={8} height={50} fill="#c9a26a" />
        <polygon points="70,100 130,100 138,110 62,110" fill="#8f7350" />
        {/* beam */}
        <g transform={`rotate(${beamAngle} 100 50)`}>
          <rect x={20} y={47} width={160} height={5} fill="#c9a26a" />
          <line x1={40} y1={50} x2={40} y2={72} stroke="#8f7350" strokeWidth={2} />
          <line x1={160} y1={50} x2={160} y2={72} stroke="#8f7350" strokeWidth={2} />
          <rect x={26} y={72} width={28} height={16} rx={2} fill="#7a5636" />
          <rect x={146} y={72} width={28} height={16} rx={2} fill="#2f9e63" />
        </g>
        <circle cx={100} cy={50} r={4} fill="#4a3520" />
      </svg>

      <div className="flex items-center gap-4 w-full">
        <input
          type="range"
          min={0}
          max={100}
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          className="flex-1 accent-emerald-400"
        />
        <div className="w-16 rounded-lg bg-slate-800 border border-slate-600 px-2 py-1 text-center">
          <span className="text-lg font-bold text-emerald-300">{value}</span>
          <span className="text-xs text-slate-400">%</span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onComplete(value)}
        className="w-full rounded-lg bg-sky-500 hover:bg-sky-400 transition-colors text-slate-900 font-semibold py-2"
      >
        Confirm Mark
      </button>
    </div>
  );
}
