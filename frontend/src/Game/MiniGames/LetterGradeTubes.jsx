import { useId, useState } from "react";
import { motion } from "framer-motion";
import { play } from "../audio/sfx";
import { blotterStyle, PaperSlip, StampPress } from "./woodDesk";
import { LETTER_GRADES } from "../data/letterGrades";

const FILL_CAP = 4;
const TOP_ROW = LETTER_GRADES.slice(0, 6);
const BOTTOM_ROW = LETTER_GRADES.slice(6);

function subjectOf(question) {
  const exam = question?.context?.missingExams?.[0];
  if (exam?.subject) {
    const kind = String(exam.examType || exam.exam_type || "final").replace(/^\w/, (c) =>
      c.toUpperCase()
    );
    return `${exam.subject} · ${kind}`;
  }
  return question?.subject || question?.context?.subject || "Final exam";
}

function GradeVial({ grade, filled, selected, onFill, uid }) {
  const gid = `${uid}-${grade.id.replace("+", "p").replace("-", "m")}`;
  const beads = Array.from({ length: FILL_CAP }, (_, index) => index < filled);
  const full = filled >= FILL_CAP;

  return (
    <motion.button
      type="button"
      onClick={onFill}
      whileHover={{ y: -6 }}
      whileTap={{ scale: 0.96 }}
      animate={{ y: selected ? -8 : 0, scale: full ? 1.04 : 1 }}
      className="relative flex w-[52px] flex-col items-center sm:w-[58px]"
    >
      <svg viewBox="0 0 48 132" className="h-[132px] w-auto drop-shadow-[0_10px_12px_rgba(40,20,8,0.28)]">
        <defs>
          <linearGradient id={`${gid}-glass`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={grade.glass} stopOpacity="0.55" />
            <stop offset="35%" stopColor="#fffaf0" stopOpacity="0.35" />
            <stop offset="100%" stopColor={grade.glass} stopOpacity="0.7" />
          </linearGradient>
          <linearGradient id={`${gid}-cork`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c9a36a" />
            <stop offset="100%" stopColor="#7a4d28" />
          </linearGradient>
          <radialGradient id={`${gid}-bead`} cx="38%" cy="32%" r="68%">
            <stop offset="0%" stopColor="#fff3d6" />
            <stop offset="45%" stopColor={grade.bead} />
            <stop offset="100%" stopColor="#3d2414" />
          </radialGradient>
        </defs>

        <ellipse cx="24" cy="126" rx="16" ry="3.2" fill="#2c1810" opacity="0.22" />
        <rect x="16" y="4" width="16" height="10" rx="3" fill={`url(#${gid}-cork)`} />
        <rect x="18" y="2" width="12" height="5" rx="2" fill="#e8d5a3" opacity="0.45" />

        <path
          d="M14 16 C14 16 12 22 12 28 L12 108 C12 118 36 118 36 108 L36 28 C36 22 34 16 34 16 Z"
          fill={`url(#${gid}-glass)`}
          stroke={selected || full ? "#d4a017" : "#5c3a1e"}
          strokeWidth={selected || full ? 1.8 : 1.15}
        />
        <path
          d="M16 22 C16 22 15 26 15 30 L15 100"
          fill="none"
          stroke="#fffaf0"
          strokeWidth="2.2"
          opacity="0.35"
        />

        {beads.map((on, index) => {
          const cy = 100 - index * 16;
          return (
            <motion.circle
              key={`${grade.id}-${index}`}
              cx="24"
              cy={cy}
              r="7.2"
              fill={`url(#${gid}-bead)`}
              stroke="#5c3a1e"
              strokeWidth="0.6"
              initial={false}
              animate={{ opacity: on ? 1 : 0, scale: on ? 1 : 0.4 }}
              transition={{ type: "spring", stiffness: 420, damping: 22 }}
            />
          );
        })}
      </svg>

      <span
        className={`mt-1 min-w-[42px] rounded-full border px-1.5 py-0.5 text-center text-[10px] font-black tracking-wide ${
          grade.fail
            ? "border-red-800/40 bg-red-900/15 text-red-900"
            : "border-amber-900/20 bg-[#fff7ed] text-amber-950"
        }`}
      >
        {grade.id}
      </span>
      {grade.fail && (
        <span className="mt-0.5 text-[8px] font-bold uppercase tracking-[0.16em] text-red-800/70">Fail</span>
      )}
    </motion.button>
  );
}

function WoodRack({ children }) {
  return (
    <div className="relative mx-auto w-full max-w-xl px-2 pb-5 pt-2">
      <div
        className="pointer-events-none absolute inset-x-6 bottom-3 h-4 rounded-full"
        style={{
          background: "linear-gradient(180deg, #a67c4e 0%, #7a4d28 48%, #3d2414 100%)",
          boxShadow: "0 8px 14px rgba(44,24,16,0.35), inset 0 1px 0 rgba(255,247,237,0.25)",
        }}
      />
      <div className="relative flex flex-wrap items-end justify-center gap-x-2 gap-y-4 sm:gap-x-3">
        {children}
      </div>
    </div>
  );
}

export default function LetterGradeTubes({ question, onComplete }) {
  const uid = useId().replace(/:/g, "");
  const subject = subjectOf(question);
  const [picked, setPicked] = useState(null);
  const [filled, setFilled] = useState(0);
  const [stamping, setStamping] = useState(false);
  const ready = Boolean(picked) && filled >= FILL_CAP;
  const meta = LETTER_GRADES.find((grade) => grade.id === picked);

  function fillVial(gradeId) {
    if (stamping) return;
    play("click");
    if (picked === gradeId) {
      setFilled((count) => Math.min(FILL_CAP, count + 1));
      return;
    }
    setPicked(gradeId);
    setFilled(1);
  }

  function emptyVial() {
    if (stamping) return;
    play("click");
    setPicked(null);
    setFilled(0);
  }

  function confirm() {
    if (!ready || stamping) return;
    setStamping(true);
    play("stamp");
    window.setTimeout(() => onComplete(picked), 720);
  }

  const slipBody = !picked
    ? "Tap a vial, then fill it"
    : filled >= FILL_CAP
      ? `${picked}${meta?.fail ? "  ·  fail" : ""}`
      : `${picked}  ·  ${filled}/${FILL_CAP}`;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-800/70">
          Results lab
        </div>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-stone-900">{subject}</h2>
        <p className="mt-2 max-w-xl text-sm text-stone-600">
          {question?.questionText ?? "Fill the vial for the letter grade you received."}
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-amber-900/20 shadow-inner">
        <div className="min-h-0 flex-1 overflow-auto px-3 py-4 sm:px-5" style={blotterStyle}>
          <div className="mb-3 text-center text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-950/55">
            Fill one vial to the cork
          </div>
          <WoodRack>
            {TOP_ROW.map((grade) => (
              <GradeVial
                key={grade.id}
                grade={grade}
                uid={uid}
                filled={picked === grade.id ? filled : 0}
                selected={picked === grade.id}
                onFill={() => fillVial(grade.id)}
              />
            ))}
          </WoodRack>
          <WoodRack>
            {BOTTOM_ROW.map((grade) => (
              <GradeVial
                key={grade.id}
                grade={grade}
                uid={uid}
                filled={picked === grade.id ? filled : 0}
                selected={picked === grade.id}
                onFill={() => fillVial(grade.id)}
              />
            ))}
          </WoodRack>
        </div>

        <div className="flex items-stretch gap-3 bg-[#2c1810] px-4 py-4 sm:px-6">
          <PaperSlip
            kicker="Grade slip"
            title={subject}
            body={slipBody}
            stamped={stamping}
            stampText={picked || "Set"}
          />
          <div className="flex w-[108px] shrink-0 flex-col gap-2">
            <button
              type="button"
              disabled={!picked || stamping}
              onClick={emptyVial}
              className="rounded-2xl border border-amber-100/15 bg-black/25 px-2 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-100/80 transition hover:bg-black/40 disabled:opacity-35"
            >
              Empty vial
            </button>
            <StampPress
              disabled={!ready}
              stamping={stamping}
              idleLabel="Log"
              doneLabel="Logged"
              onClick={confirm}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
