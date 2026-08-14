import { useState } from "react";

// Numerical Input Mini-Game: drag/enter a 0-100% mark for the assignment.
export default function GradeSlider({ question, onComplete }) {
  const [value, setValue] = useState(75);

  return (
    <div className="flex flex-col gap-4">
      <div className="text-xs uppercase tracking-wide text-sky-300/80">The Grade Slider</div>
      <div className="text-sm text-slate-100">{question?.questionText ?? "Enter the mark you received."}</div>

      <div className="flex items-center gap-4">
        <input
          type="range"
          min={0}
          max={100}
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          className="flex-1 accent-amber-400"
        />
        <div className="w-16 rounded-lg bg-slate-800 border border-slate-600 px-2 py-1 text-center">
          <span className="text-lg font-bold text-amber-300">{value}</span>
          <span className="text-xs text-slate-400">%</span>
        </div>
      </div>

      <input
        type="number"
        min={0}
        max={100}
        value={value}
        onChange={(e) => setValue(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
        className="rounded-lg bg-slate-800 border border-slate-600 px-3 py-2 text-slate-100 outline-none
                   focus:border-sky-400 text-center"
      />

      <button
        type="button"
        onClick={() => onComplete(value)}
        className="rounded-lg bg-sky-500 hover:bg-sky-400 transition-colors text-slate-900 font-semibold py-2"
      >
        Confirm Mark
      </button>
    </div>
  );
}
