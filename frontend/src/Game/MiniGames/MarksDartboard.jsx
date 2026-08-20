import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { play } from "../audio/sfx";

const RINGS = [
  { r: 90, score: 20, label: "20" },
  { r: 70, score: 40, label: "40" },
  { r: 50, score: 60, label: "60" },
  { r: 30, score: 80, label: "80" },
  { r: 12, score: 95, label: "Bullseye" },
];

function subjectOf(question) {
  const exam = question?.context?.missingExams?.[0];
  if (exam?.subject) {
    const kind = String(exam.examType || exam.exam_type || "").replace(/^\w/, (c) => c.toUpperCase());
    return kind ? `${exam.subject} · ${kind}` : exam.subject;
  }
  return question?.subject || question?.context?.subject || "Today's subject";
}

function ringAt(x, y) {
  const d = Math.hypot(x - 100, y - 100);
  return [...RINGS].reverse().find((ring) => d <= ring.r) || RINGS[0];
}

export default function MarksDartboard({ question, onComplete }) {
  const [thrown, setThrown] = useState(false);
  const [flying, setFlying] = useState(false);
  const [mark, setMark] = useState(60);
  const [dart, setDart] = useState({ x: 100, y: 188 });
  const subject = subjectOf(question);

  function handleThrow(event) {
    if (thrown || flying) return;
    const svg = event.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 200;
    const y = ((event.clientY - rect.top) / rect.height) * 200;
    const ring = ringAt(x, y);
    setFlying(true);
    play("dart");
    setDart({ x, y });
    setMark(ring.score);
    setTimeout(() => {
      setThrown(true);
      setFlying(false);
    }, 280);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-6">
        <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-800/70">
          Results board
        </div>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-stone-900">{subject}</h2>
        <p className="mt-2 max-w-xl text-sm text-stone-600">
          {question?.questionText ?? "Throw a dart, then fine-tune the mark."}
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-10">
        <svg viewBox="0 0 200 200" width={220} height={220} className="drop-shadow-md cursor-crosshair" onClick={handleThrow}>
          {RINGS.map((ring, i) => (
            <circle
              key={ring.label}
              cx={100}
              cy={100}
              r={ring.r}
              fill={i % 2 === 0 ? "#9b2c2c" : "#f4efe4"}
              stroke="#5c3a1e"
              strokeWidth={1.2}
            />
          ))}
          <circle cx={100} cy={100} r={4} fill="#5c3a1e" />
          <motion.g
            initial={false}
            animate={{ x: dart.x, y: dart.y }}
            transition={{ duration: flying ? 0.26 : 0, ease: "easeIn" }}
          >
            {(thrown || flying) && (
              <g transform="translate(-4,-4) rotate(-28)">
                <rect x="0" y="0" width="3" height="22" rx="1" fill="#d6d3d1" />
                <polygon points="1.5,-6 6,2 -3,2" fill="#9b2c2c" />
                <circle cx="1.5" cy="22" r="2.2" fill="#f5d76e" stroke="#5c3a1e" strokeWidth="0.8" />
              </g>
            )}
          </motion.g>
        </svg>

        <AnimatePresence>
          {thrown && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 flex items-center gap-3"
            >
              <span className="text-xs uppercase tracking-[0.16em] text-stone-400">Fine-tune</span>
              <input
                type="number"
                min={0}
                max={100}
                value={mark}
                onChange={(e) => setMark(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                className="w-24 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-center text-lg font-semibold text-stone-800 outline-none focus:border-amber-700/40"
              />
              <span className="text-sm text-stone-500">%</span>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          type="button"
          disabled={!thrown}
          onClick={() => onComplete(mark)}
          className="mt-8 w-full max-w-md rounded-2xl bg-amber-800 py-3.5 text-sm font-semibold text-amber-50 transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {thrown ? `Save ${subject} mark` : "Click the board to throw"}
        </button>
      </div>
    </div>
  );
}
