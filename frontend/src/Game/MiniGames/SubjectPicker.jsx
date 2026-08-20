import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGameStore } from "../state/GameStateManager";
import { play } from "../audio/sfx";

const SPINE_COLORS = [
  "#b45309",
  "#1e3a5f",
  "#7f1d1d",
  "#365314",
  "#6d28d9",
  "#9a3412",
  "#0f766e",
  "#9f1239",
  "#854d0e",
  "#1e40af",
];

function hashName(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return Math.abs(hash);
}

function bookStyle(name) {
  const hash = hashName(name);
  return {
    color: SPINE_COLORS[hash % SPINE_COLORS.length],
    width: 34 + (hash % 4) * 7,
    height: 132 + (hash % 5) * 10,
  };
}

function toggle(list, value) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function LibraryShelf({ options, picked, onToggle, onComplete }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-amber-900/20 shadow-inner">
      <div
        className="relative min-h-0 flex-1 overflow-x-auto overflow-y-hidden px-5 pt-6"
        style={{
          background: "linear-gradient(180deg, #4a2c14 0%, #6b3f22 55%, #5c3818 100%)",
        }}
      >
        <div className="mb-3 text-center text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-100/70">
          Pull every book you worked on
        </div>
        <div className="flex h-[190px] items-end justify-center gap-[3px] px-2">
          <AnimatePresence initial={false}>
            {options.map((subject) => {
              if (picked.includes(subject)) return null;
              const style = bookStyle(subject);
              return (
                <motion.button
                  layoutId={`book-${subject}`}
                  key={subject}
                  type="button"
                  onClick={() => onToggle(subject)}
                  initial={{ y: 12, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ opacity: 0 }}
                  whileHover={{ y: -8 }}
                  whileTap={{ y: 2 }}
                  className="flex shrink-0 items-center justify-center rounded-sm border border-black/20 px-1 pb-1 pt-3 text-left shadow-md"
                  style={{
                    width: style.width,
                    height: style.height,
                    background: style.color,
                    writingMode: "vertical-rl",
                    textOrientation: "mixed",
                  }}
                >
                  <span className="max-h-full overflow-hidden text-ellipsis text-[11px] font-semibold tracking-wide text-amber-50">
                    {subject}
                  </span>
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>
        <div className="h-3 rounded-t-sm bg-[#c4a574] shadow-[0_-6px_12px_rgba(0,0,0,0.25)]" />
        <div className="h-2 bg-[#8a5a32]" />
      </div>

      <div className="relative min-h-[148px] bg-[#c9a26a] px-5 py-4">
        <div
          className="pointer-events-none absolute inset-x-8 top-0 h-8 opacity-30"
          style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.25), transparent)" }}
        />
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-950/55">
          Checkout desk
        </div>
        <div className="flex min-h-[88px] flex-wrap items-end gap-3">
          <AnimatePresence initial={false}>
            {picked.map((subject) => {
              const style = bookStyle(subject);
              return (
                <motion.button
                  layoutId={`book-${subject}`}
                  key={subject}
                  type="button"
                  onClick={() => onToggle(subject)}
                  className="flex h-[88px] w-[72px] flex-col justify-end rounded-md border border-black/15 p-2 text-left shadow-lg"
                  style={{ background: style.color }}
                >
                  <span className="line-clamp-3 text-[10px] font-semibold leading-tight text-amber-50">{subject}</span>
                </motion.button>
              );
            })}
          </AnimatePresence>
          {picked.length === 0 && (
            <p className="self-center text-sm text-amber-950/50">The desk is empty — pull a book from the shelf.</p>
          )}
        </div>
      </div>

      <button
        type="button"
        disabled={picked.length === 0}
        onClick={() => onComplete(picked)}
        className="rounded-none bg-amber-900 py-3.5 text-sm font-semibold text-amber-50 transition-colors hover:bg-amber-800 disabled:opacity-40"
      >
        {picked.length ? `Check out ${picked.join(", ")}` : "Pull at least one book"}
      </button>
    </div>
  );
}

function LectureTickets({ options, picked, onToggle, onComplete }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-stone-200 shadow-inner">
      <div
        className="relative min-h-0 flex-1 overflow-auto p-5"
        style={{
          backgroundColor: "#c4a574",
          backgroundImage:
            "radial-gradient(rgba(90,50,20,0.18) 1px, transparent 1px), radial-gradient(rgba(90,50,20,0.1) 1px, transparent 1px)",
          backgroundSize: "10px 10px, 18px 18px",
          backgroundPosition: "0 0, 4px 8px",
        }}
      >
        <div className="mb-4 text-center text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-950/55">
          Stamp the lectures you attended
        </div>
        <div className="flex flex-wrap justify-center gap-4">
          <AnimatePresence initial={false}>
            {options.map((subject, index) => {
              if (picked.includes(subject)) return null;
              const tilt = ((hashName(subject) % 9) - 4) * 2.2;
              return (
                <motion.button
                  layoutId={`ticket-${subject}`}
                  key={subject}
                  type="button"
                  onClick={() => onToggle(subject)}
                  initial={{ scale: 0.92, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1, rotate: tilt }}
                  whileHover={{ y: -6, rotate: 0 }}
                  whileTap={{ scale: 0.97 }}
                  className="relative w-[148px] rounded-sm border border-amber-900/15 bg-[#fff7ed] px-3 py-4 text-left shadow-md"
                >
                  <span className="absolute left-3 top-2 h-2 w-2 rounded-full bg-red-800/80 shadow" />
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-800/60">Lecture</div>
                  <div className="mt-2 text-sm font-semibold leading-snug text-stone-800">{subject}</div>
                  <div className="mt-3 border-t border-dashed border-amber-900/20 pt-2 text-[10px] uppercase tracking-[0.16em] text-stone-400">
                    Seat {String.fromCharCode(65 + (index % 8))}{index + 1}
                  </div>
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      <div className="border-t border-amber-900/10 bg-[#f4efe4] px-5 py-4">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-500">Attendance tray</div>
        <div className="flex min-h-[84px] flex-wrap items-center gap-3 rounded-2xl border border-dashed border-amber-900/20 bg-white/70 p-3">
          <AnimatePresence initial={false}>
            {picked.map((subject) => (
              <motion.button
                layoutId={`ticket-${subject}`}
                key={subject}
                type="button"
                onClick={() => onToggle(subject)}
                className="relative w-[140px] rounded-sm border border-amber-900/20 bg-[#fff7ed] px-3 py-3 text-left shadow-sm"
              >
                <span className="absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded-full border-2 border-red-800/80 text-[9px] font-black uppercase tracking-wider text-red-800/80 -rotate-12">
                  In
                </span>
                <div className="pr-8 text-sm font-semibold text-stone-800">{subject}</div>
              </motion.button>
            ))}
          </AnimatePresence>
          {picked.length === 0 && (
            <p className="text-sm text-stone-400">Stamp a ticket and it drops into the tray.</p>
          )}
        </div>
      </div>

      <button
        type="button"
        disabled={picked.length === 0}
        onClick={() => onComplete(picked)}
        className="bg-amber-800 py-3.5 text-sm font-semibold text-amber-50 transition-colors hover:bg-amber-700 disabled:opacity-40"
      >
        {picked.length ? `Take attendance · ${picked.join(", ")}` : "Stamp at least one lecture"}
      </button>
    </div>
  );
}

export default function SubjectPicker({ question, onComplete }) {
  const registered = useGameStore((s) => s.subjects);
  const options = question?.context?.subjectOptions?.length ? question.context.subjectOptions : registered;
  const [picked, setPicked] = useState([]);
  const isLecture = question?.context?.field === "lectureSubjects";

  const title = isLecture ? "Today's lectures" : "Assignment subjects";
  const eyebrow = isLecture ? "Lecture desk" : "Library shelf";

  function onToggle(subject) {
    play(isLecture ? "stamp" : "book");
    setPicked((current) => toggle(current, subject));
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-800/70">{eyebrow}</div>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-stone-900">{title}</h2>
        <p className="mt-2 max-w-xl text-sm text-stone-600">
          {question?.questionText ??
            (isLecture ? "Stamp the lectures you attended today." : "Pull the books you worked on today.")}
        </p>
      </div>

      {options.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-3xl border border-stone-200 bg-white text-sm text-stone-500">
          No registered subjects on this account.
        </div>
      ) : isLecture ? (
        <LectureTickets options={options} picked={picked} onToggle={onToggle} onComplete={onComplete} />
      ) : (
        <LibraryShelf options={options} picked={picked} onToggle={onToggle} onComplete={onComplete} />
      )}
    </div>
  );
}
