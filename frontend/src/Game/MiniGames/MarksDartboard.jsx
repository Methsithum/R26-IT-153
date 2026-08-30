import { useEffect, useId, useRef, useState } from "react";
import { motion } from "framer-motion";
import { play } from "../audio/sfx";
import { blotterStyle, PaperSlip } from "./woodDesk";

const REST = { x: 100, y: 218 };
const CENTER = { x: 100, y: 100 };
const MAX_PULL = 62;
const BOARD_R = 90;

const WOOD_RINGS = [
  { r: 90, fill: "wd-outer" },
  { r: 70, fill: "wd-oak" },
  { r: 50, fill: "wd-honey" },
  { r: 30, fill: "wd-walnut" },
  { r: 14, fill: "wd-heart" },
];

const RING_LABELS = [
  { r: 80, mark: 20 },
  { r: 60, mark: 40 },
  { r: 40, mark: 60 },
  { r: 22, mark: 80 },
];

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

function WoodDefs({ uid }) {
  return (
    <defs>
      <radialGradient id={`${uid}-wd-outer`} cx="38%" cy="32%" r="72%">
        <stop offset="0%" stopColor="#7a4d28" />
        <stop offset="55%" stopColor="#5c3a1e" />
        <stop offset="100%" stopColor="#3d2414" />
      </radialGradient>
      <radialGradient id={`${uid}-wd-oak`} cx="40%" cy="30%" r="70%">
        <stop offset="0%" stopColor="#c9a36a" />
        <stop offset="50%" stopColor="#a67c4e" />
        <stop offset="100%" stopColor="#7a4d28" />
      </radialGradient>
      <radialGradient id={`${uid}-wd-honey`} cx="42%" cy="28%" r="68%">
        <stop offset="0%" stopColor="#e8d5a3" />
        <stop offset="48%" stopColor="#c4a574" />
        <stop offset="100%" stopColor="#8b5a2b" />
      </radialGradient>
      <radialGradient id={`${uid}-wd-walnut`} cx="40%" cy="30%" r="70%">
        <stop offset="0%" stopColor="#8b5a2b" />
        <stop offset="60%" stopColor="#5c3a1e" />
        <stop offset="100%" stopColor="#3f2412" />
      </radialGradient>
      <radialGradient id={`${uid}-wd-heart`} cx="40%" cy="32%" r="70%">
        <stop offset="0%" stopColor="#6b4226" />
        <stop offset="100%" stopColor="#2c1810" />
      </radialGradient>
      <radialGradient id={`${uid}-wd-rim`} cx="35%" cy="28%" r="75%">
        <stop offset="0%" stopColor="#5a3418" />
        <stop offset="100%" stopColor="#1f120c" />
      </radialGradient>
      <linearGradient id={`${uid}-brass`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#f3e2b8" />
        <stop offset="45%" stopColor="#d4af6a" />
        <stop offset="100%" stopColor="#8a6a32" />
      </linearGradient>
      <pattern id={`${uid}-grain`} width="8" height="8" patternUnits="userSpaceOnUse">
        <path d="M0 4h8" stroke="#3d2414" strokeOpacity="0.12" strokeWidth="0.6" />
        <path d="M1 1h6" stroke="#fff7ed" strokeOpacity="0.06" strokeWidth="0.4" />
      </pattern>
    </defs>
  );
}

export default function MarksDartboard({ question, onComplete }) {
  const svgRef = useRef(null);
  const uid = useId().replace(/:/g, "");
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
      setMark(scoreFromPoint(land.x, land.y));
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
    setPull(next);
    setDart({ x: REST.x + next.x, y: REST.y + next.y });
  }

  function throwAgain() {
    play("click");
    setStuck(false);
    setFlying(false);
    setMark(null);
    setPull(null);
    setDart(REST);
    dragRef.current = null;
  }

  const aim = pull ? landingFromPull(pull) : null;
  const liveMark = stuck && mark != null ? mark : aim ? scoreFromPoint(aim.x, aim.y) : null;
  const slipBody =
    flying ? "In the air…"
    : liveMark != null ? `${liveMark}%`
    : "Pull back until the mark is right";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-800/70">Results board</div>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-stone-900">{subject}</h2>
        <p className="mt-2 max-w-xl text-sm text-stone-600">
          {question?.questionText ?? "Aim until the mark is right, then release to throw."}
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-amber-900/25 shadow-[0_18px_40px_rgba(40,20,8,0.28)]">
        <div
          className="relative flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-5 sm:px-6"
          style={blotterStyle}
        >
          <div
            className="pointer-events-none absolute inset-x-8 top-4 h-8 rounded-full opacity-40"
            style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(255,247,237,0.45), transparent 70%)" }}
          />

          <svg
            ref={svgRef}
            viewBox="0 0 200 240"
            className={`h-[min(58vh,340px)] w-auto max-w-full select-none touch-none drop-shadow-[0_16px_24px_rgba(40,20,8,0.45)] ${
              stuck || flying ? "cursor-default" : "cursor-grab active:cursor-grabbing"
            }`}
            onPointerDown={onPointerDown}
          >
            <WoodDefs uid={uid} />

            <ellipse cx="100" cy="228" rx="38" ry="6" fill="#2c1810" opacity="0.28" />

            <circle cx={CENTER.x} cy={CENTER.y} r={98} fill={`url(#${uid}-wd-rim)`} />
            <circle
              cx={CENTER.x}
              cy={CENTER.y}
              r={96}
              fill="none"
              stroke={`url(#${uid}-brass)`}
              strokeWidth="2.4"
            />

            {WOOD_RINGS.map((ring) => (
              <circle
                key={ring.r}
                cx={CENTER.x}
                cy={CENTER.y}
                r={ring.r}
                fill={`url(#${uid}-${ring.fill})`}
                stroke={`url(#${uid}-brass)`}
                strokeWidth={0.85}
                strokeOpacity="0.55"
              />
            ))}
            <circle cx={CENTER.x} cy={CENTER.y} r={BOARD_R} fill={`url(#${uid}-grain)`} />
            <circle cx={CENTER.x} cy={CENTER.y} r={5.5} fill={`url(#${uid}-brass)`} />
            <circle cx={CENTER.x} cy={CENTER.y} r={2.2} fill="#2c1810" />

            {RING_LABELS.map((item) => (
              <text
                key={item.mark}
                x={CENTER.x}
                y={CENTER.y - item.r + 3}
                textAnchor="middle"
                fill="#fff7ed"
                fillOpacity="0.42"
                fontSize="8"
                fontWeight="700"
                letterSpacing="0.06em"
              >
                {item.mark}
              </text>
            ))}
            <text
              x={CENTER.x}
              y={CENTER.y + 3.2}
              textAnchor="middle"
              fill="#f3e2b8"
              fillOpacity="0.7"
              fontSize="7"
              fontWeight="700"
            >
              100
            </text>

            {aim && !stuck && (
              <g>
                <circle cx={aim.x} cy={aim.y} r={8} fill="#f5d76e" fillOpacity="0.12" />
                <circle
                  cx={aim.x}
                  cy={aim.y}
                  r={5}
                  fill="none"
                  stroke="#f5d76e"
                  strokeWidth="1.5"
                  strokeDasharray="3 2.5"
                />
              </g>
            )}
            {pull && (
              <line
                x1={REST.x}
                y1={REST.y}
                x2={REST.x + pull.x}
                y2={REST.y + pull.y}
                stroke="#f3e2b8"
                strokeWidth="2"
                strokeDasharray="4 3"
                opacity="0.7"
              />
            )}

            <motion.g
              initial={false}
              animate={{ x: dart.x, y: dart.y }}
              transition={{ duration: flying ? 0.4 : 0, ease: flying ? [0.15, 0.85, 0.2, 1] : "linear" }}
            >
              <g transform="translate(-4,-4) rotate(-28)">
                <rect x="0.4" y="0" width="2.4" height="22" rx="1" fill="#8b5a2b" />
                <rect x="0.7" y="1" width="0.7" height="20" rx="0.4" fill="#e8d5a3" opacity="0.35" />
                <polygon points="1.5,-7 6.2,2.2 -3.2,2.2" fill="#7a1f1f" />
                <polygon points="1.5,-5 4.4,1.4 -1.4,1.4" fill="#c45c4a" />
                <circle cx="1.5" cy="22" r="2.3" fill={`url(#${uid}-brass)`} stroke="#5c3a1e" strokeWidth="0.6" />
              </g>
            </motion.g>
          </svg>
        </div>

        <div className="flex items-stretch gap-3 bg-[#2c1810] px-4 py-4 sm:px-6">
          <PaperSlip
            kicker={stuck ? "Thrown mark" : pull ? "Aiming" : "Mark slip"}
            title={subject}
            body={slipBody}
            stamped={stuck}
            stampText={`${mark ?? ""}%`}
          />
          <div className="flex w-[108px] shrink-0 flex-col gap-2">
            <button
              type="button"
              disabled={!stuck}
              onClick={throwAgain}
              className="rounded-2xl border border-amber-100/15 bg-black/25 px-2 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-100/80 transition hover:bg-black/40 disabled:opacity-35"
            >
              Throw again
            </button>
            <motion.button
              type="button"
              disabled={!stuck || mark == null}
              onClick={() => onComplete(mark)}
              whileHover={stuck ? { y: -2 } : undefined}
              whileTap={stuck ? { y: 6, scale: 0.97 } : undefined}
              className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-amber-200/20 bg-gradient-to-b from-amber-700 to-amber-950 px-2 py-2 text-amber-50 shadow-lg disabled:opacity-40"
            >
              <span className="mb-1 h-2.5 w-9 rounded-full bg-stone-300/80 shadow-inner" />
              <span className="h-7 w-12 rounded-md bg-red-900/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]" />
              <span className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.14em]">
                {stuck ? `Save ${mark}%` : "Throw"}
              </span>
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
}
