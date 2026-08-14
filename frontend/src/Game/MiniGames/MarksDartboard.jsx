import { useState } from "react";

// Marks Bullseye Dartboard: click a ring to "throw" — inner rings score
// higher. The chosen ring maps to a mark band, then the exact mark is
// fine-tuned before confirming.
const RINGS = [
  { r: 90, score: 20, label: "20" },
  { r: 70, score: 40, label: "40" },
  { r: 50, score: 60, label: "60" },
  { r: 30, score: 80, label: "80" },
  { r: 12, score: 95, label: "Bullseye" },
];

export default function MarksDartboard({ question, onComplete }) {
  const [thrown, setThrown] = useState(false);
  const [mark, setMark] = useState(60);

  function handleThrow(ring) {
    setThrown(true);
    setMark(ring.score);
  }

  return (
    <div className="flex flex-col gap-4 items-center">
      <div className="text-xs uppercase tracking-wide text-sky-300/80 self-start">
        Marks Bullseye Dartboard
      </div>
      <div className="text-sm text-slate-100 self-start">
        {question?.questionText ?? "Throw a dart to score the assignment mark."}
      </div>

      <svg viewBox="0 0 200 200" width={180} height={180} className="drop-shadow-lg">
        {RINGS.map((ring, i) => (
          <circle
            key={ring.label}
            cx={100}
            cy={100}
            r={ring.r}
            fill={i % 2 === 0 ? "#b23a3a" : "#e8e2d6"}
            stroke="#1c1c1c"
            strokeWidth={1}
            className="cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => handleThrow(ring)}
          />
        ))}
        <circle cx={100} cy={100} r={4} fill="#1c1c1c" />
        {thrown && <circle cx={100} cy={100} r={3} fill="#ffd166" stroke="#1c1c1c" strokeWidth={1} />}
      </svg>

      {thrown && (
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">Fine-tune:</span>
          <input
            type="number"
            min={0}
            max={100}
            value={mark}
            onChange={(e) => setMark(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
            className="w-20 rounded-lg bg-slate-800 border border-slate-600 px-2 py-1 text-slate-100 outline-none
                       focus:border-sky-400 text-center"
          />
          <span className="text-xs text-slate-400">%</span>
        </div>
      )}

      <button
        type="button"
        disabled={!thrown}
        onClick={() => onComplete(mark)}
        className="w-full rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-40 disabled:cursor-not-allowed
                   transition-colors text-slate-900 font-semibold py-2"
      >
        {thrown ? "Confirm Mark" : "Click the board to throw"}
      </button>
    </div>
  );
}
