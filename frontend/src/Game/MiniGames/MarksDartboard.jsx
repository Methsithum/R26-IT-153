import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { play } from "../audio/sfx";

const RINGS = [
  { r: 90, fill: "#9b2c2c" },
  { r: 70, fill: "#f4efe4" },
  { r: 50, fill: "#9b2c2c" },
  { r: 30, fill: "#f4efe4" },
  { r: 14, fill: "#9b2c2c" },
];

const REST = { x: 100, y: 218 };
const CENTER = { x: 100, y: 100 };
const MAX_PULL = 62;
const BOARD_R = 90;

function subjectOf(question) {
  const exam = question?.context?.missingExams?.[0];
  if (exam?.subject) {
    const kind = String(exam.examType || exam.exam_type || "").replace(/^\w/, (c) => c.toUpperCase());
    return kind ? `${exam.subject} · ${kind}` : exam.subject;
  }
  return question?.subject || question?.context?.subject || "Today's subject";
}

function scoreFromPoint(x, y) {
  const d = Math.hypot(x - CENTER.x, y - CENTER.y);
  if (d > BOARD_R + 6) return 0;
  const t = Math.min(1, d / BOARD_R);
  return Math.max(0, Math.min(100, Math.round(100 * (1 - t) ** 1.12)));
}

function pointerInSvg(event, svg) {
  const rect = svg.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * 200,
    y: ((event.clientY - rect.top) / rect.height) * 240,
  };
}

function clampPull(dx, dy) {
  const len = Math.hypot(dx, dy);
  if (len <= MAX_PULL || len === 0) return { x: dx, y: dy, len };
  const scale = MAX_PULL / len;
  return { x: dx * scale, y: dy * scale, len: MAX_PULL };
}

function landingFromPull(pull) {
  const len = Math.hypot(pull.x, pull.y) || 1;
  const power = Math.min(1, len / MAX_PULL);
  const dirX = -pull.x / len;
  const dirY = -pull.y / len;
  const travel = 78 + power * 108;
  return {
    x: REST.x + dirX * travel,
    y: REST.y + dirY * travel,
    power,
  };
}

export default function MarksDartboard({ question, onComplete }) {
  const svgRef = useRef(null);
  const [dart, setDart] = useState(REST);
  const [pull, setPull] = useState(null);
  const [flying, setFlying] = useState(false);
  const [stuck, setStuck] = useState(false);
  const [mark, setMark] = useState(null);
  const dragRef = useRef(null);
  const subject = subjectOf(question);

  useEffect(() => {
    function onMove(event) {
      if (!dragRef.current || !svgRef.current) return;
      const point = pointerInSvg(event, svgRef.current);
      const next = clampPull(point.x - REST.x, point.y - REST.y);
      dragRef.current = next;
      setPull(next);
      setDart({ x: REST.x + next.x, y: REST.y + next.y });
    }
    function onUp() {
      if (!dragRef.current) return;
      const current = dragRef.current;
      dragRef.current = null;
      if ((current.len || 0) < 14) {
        setPull(null);
        setDart(REST);
        return;
      }
      const land = landingFromPull(current);
      setPull(null);
      setFlying(true);
      play("dart");
      setDart({ x: land.x, y: land.y });
      const nextMark = scoreFromPoint(land.x, land.y);
      setMark(nextMark);
      window.setTimeout(() => {
        setFlying(false);
        setStuck(true);
      }, 420);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  function onPointerDown(event) {
    if (stuck || flying) return;
    const svg = svgRef.current;
    if (!svg) return;
    svg.setPointerCapture?.(event.pointerId);
    const point = pointerInSvg(event, svg);
    const next = clampPull(point.x - REST.x, point.y - REST.y);
    dragRef.current = next;
    dragRef.current = next;
    setPull(next);
    setDart({ x: REST.x + next.x, y: REST.y + next.y });
  }

  function throwAgain() {
    setStuck(false);
    setFlying(false);
    setMark(null);
    setPull(null);
    setDart(REST);
    dragRef.current = null;
  }

  const aim = pull ? landingFromPull(pull) : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-800/70">Results board</div>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-stone-900">{subject}</h2>
        <p className="mt-2 max-w-xl text-sm text-stone-600">
          {question?.questionText ?? "Pull back, aim, and release. Where it sticks is the mark."}
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-8">
        <svg
          ref={svgRef}
          viewBox="0 0 200 240"
          width={260}
          height={312}
          className={`select-none touch-none ${stuck || flying ? "cursor-default" : "cursor-grab active:cursor-grabbing"}`}
          onPointerDown={onPointerDown}
        >
          {RINGS.map((ring) => (
            <circle
              key={ring.r}
              cx={CENTER.x}
              cy={CENTER.y}
              r={ring.r}
              fill={ring.fill}
              stroke="#5c3a1e"
              strokeWidth={1.2}
            />
          ))}
          <circle cx={CENTER.x} cy={CENTER.y} r={4} fill="#5c3a1e" />
          {aim && !stuck && (
            <circle cx={aim.x} cy={aim.y} r={5} fill="none" stroke="#f5d76e" strokeWidth="1.4" strokeDasharray="3 3" opacity="0.85" />
          )}
          {pull && (
            <line
              x1={REST.x}
              y1={REST.y}
              x2={REST.x + pull.x}
              y2={REST.y + pull.y}
              stroke="#b45309"
              strokeWidth="2.2"
              strokeDasharray="4 3"
            />
          )}
          <motion.g
            initial={false}
            animate={{ x: dart.x, y: dart.y }}
            transition={{ duration: flying ? 0.4 : 0, ease: flying ? [0.15, 0.85, 0.2, 1] : "linear" }}
          >
            <g transform="translate(-4,-4) rotate(-28)">
              <rect x="0" y="0" width="3" height="22" rx="1" fill="#d6d3d1" />
              <polygon points="1.5,-6 6,2 -3,2" fill="#9b2c2c" />
              <circle cx="1.5" cy="22" r="2.2" fill="#f5d76e" stroke="#5c3a1e" strokeWidth="0.8" />
            </g>
          </motion.g>
        </svg>

        <div className="mt-4 min-h-[28px] text-center text-sm text-stone-600">
          {stuck && mark != null ? (
            <span className="text-lg font-semibold text-stone-800">{mark}%</span>
          ) : flying ? (
            "In the air…"
          ) : pull ? (
            "Release to throw"
          ) : (
            "Drag the dart back, then let go"
          )}
        </div>

        <div className="mt-5 flex w-full max-w-md gap-3">
          <button
            type="button"
            disabled={!stuck}
            onClick={throwAgain}
            className="flex-1 rounded-2xl border border-stone-200 bg-stone-50 py-3.5 text-sm font-semibold text-stone-700 transition-colors hover:bg-stone-100 disabled:opacity-40"
          >
            Throw again
          </button>
          <button
            type="button"
            disabled={!stuck || mark == null}
            onClick={() => onComplete(mark)}
            className="flex-1 rounded-2xl bg-amber-800 py-3.5 text-sm font-semibold text-amber-50 transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {stuck ? `Save ${mark}%` : "Throw to set the mark"}
          </button>
        </div>
      </div>
    </div>
  );
}
