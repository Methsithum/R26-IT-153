import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGameStore } from "../state/GameStateManager";
import { play } from "../audio/sfx";

const SPINE_COLORS = ["#b45309", "#1e3a5f", "#7f1d1d", "#365314", "#6d28d9", "#9a3412", "#0f766e", "#9f1239"];
const KINDS = [
  { id: "mid", label: "Mid", hint: "Mid-semester paper" },
  { id: "final", label: "Final", hint: "End-semester paper" },
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
    tilt: ((hash % 7) - 3) * 1.4,
  };
}

function ShelfBook({ subject, layoutId, onClick, size = "shelf" }) {
  const style = bookStyle(subject);
  const shelf = size === "shelf";
  return (
    <motion.button
      layoutId={layoutId}
      type="button"
      title={subject}
      onClick={onClick}
      initial={{ y: 12, opacity: 0 }}
      animate={{ y: 0, opacity: 1, rotate: shelf ? style.tilt : 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ y: shelf ? -8 : -4, rotate: 0, scale: 1.03 }}
      whileTap={{ y: 2, scale: 0.98 }}
      className={`relative z-10 shrink-0 overflow-hidden rounded-sm border border-black/25 text-left shadow-lg ${
        shelf ? "h-[136px] w-[118px]" : "h-[88px] w-[124px]"
      }`}
      style={{ background: style.color }}
    >
      <span className="absolute inset-y-0 left-0 w-[8px] bg-black/25" />
      <span className="absolute inset-x-0 top-0 h-1.5 bg-[#f5d76e]" />
      <span
        className={`relative z-10 block px-3 pl-4 font-semibold leading-snug text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)] ${
          shelf ? "mt-4 line-clamp-4 text-[13px]" : "mt-3 line-clamp-3 text-[12px]"
        }`}
      >
        {subject}
      </span>
    </motion.button>
  );
}

function toggle(list, value) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export default function ExamSetup({ question, onComplete }) {
  const registered = useGameStore((s) => s.subjects);
  const options = question?.context?.subjectOptions?.length ? question.context.subjectOptions : registered;
  const [subjects, setSubjects] = useState([]);
  const [kinds, setKinds] = useState([]);

  function onToggleSubject(subject) {
    play("book");
    setSubjects((current) => toggle(current, subject));
  }

  function onToggleKind(kind) {
    play("stamp");
    setKinds((current) => toggle(current, kind));
  }

  const ready = subjects.length > 0 && kinds.length > 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-3 shrink-0">
        <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-800/70">Exam hall</div>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">Exam preparation</h2>
        <p className="mt-1 max-w-xl text-sm text-stone-600">
          {question?.questionText ?? "Pull the subjects you prepared, then stamp Mid, Final, or both."}
        </p>
      </div>

      {options.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-3xl border border-stone-200 bg-white text-sm text-stone-500">
          No registered subjects on this account.
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-3xl border border-amber-900/20 shadow-inner">
          <div
            className="relative shrink-0 px-5 pb-0 pt-4"
            style={{ background: "linear-gradient(180deg, #4a2c14 0%, #6b3f22 55%, #5c3818 100%)" }}
          >
            <div className="mb-3 text-center text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-100/70">
              Pull every subject you prepared
            </div>
            <div className="flex h-[148px] items-end justify-center gap-3 overflow-x-auto px-1">
              <AnimatePresence initial={false}>
                {options.map((subject) =>
                  subjects.includes(subject) ? null : (
                    <ShelfBook
                      key={subject}
                      subject={subject}
                      layoutId={`exam-book-${subject}`}
                      onClick={() => onToggleSubject(subject)}
                    />
                  )
                )}
              </AnimatePresence>
            </div>
            <div className="h-3 rounded-t-sm bg-[#c4a574] shadow-[0_-6px_12px_rgba(0,0,0,0.25)]" />
            <div className="h-2 bg-[#8a5a32]" />
          </div>

          <div className="relative z-0 shrink-0 bg-[#c9a26a] px-5 py-3">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-950/55">
              Checkout desk
            </div>
            <div className="mb-3 flex min-h-[52px] flex-wrap items-end gap-3">
              <AnimatePresence initial={false}>
                {subjects.map((subject) => (
                  <ShelfBook
                    key={subject}
                    subject={subject}
                    layoutId={`exam-book-${subject}`}
                    size="desk"
                    onClick={() => onToggleSubject(subject)}
                  />
                ))}
              </AnimatePresence>
              {subjects.length === 0 && (
                <p className="self-center text-sm text-amber-950/50">The desk is empty — pull a book from the shelf.</p>
              )}
            </div>

            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-950/55">
              Stamp the paper
            </div>
            <div className="grid grid-cols-2 gap-3">
              {KINDS.map((kind, index) => {
                const active = kinds.includes(kind.id);
                const tilt = index === 0 ? -3 : 3;
                return (
                  <motion.button
                    key={kind.id}
                    type="button"
                    onClick={() => onToggleKind(kind.id)}
                    whileHover={{ y: -4, rotate: 0 }}
                    whileTap={{ scale: 0.97 }}
                    animate={{ rotate: active ? 0 : tilt }}
                    className="relative rounded-sm border border-amber-900/20 bg-[#fff7ed] px-4 py-3 text-left shadow-md"
                  >
                    <span className="absolute left-3 top-2 h-2 w-2 rounded-full bg-red-800/80 shadow" />
                    {active && (
                      <span className="absolute right-3 top-3 flex h-12 w-12 items-center justify-center rounded-full border-2 border-red-800/80 text-[10px] font-black uppercase tracking-wider text-red-800/80 -rotate-12">
                        In
                      </span>
                    )}
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-800/60">Paper</div>
                    <div className="mt-1 text-xl font-semibold text-stone-800">{kind.label}</div>
                    <div className="mt-1 text-xs text-stone-500">{kind.hint}</div>
                  </motion.button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            disabled={!ready}
            onClick={() => onComplete({ subjects, exam_kinds: kinds })}
            className="rounded-none bg-amber-900 py-3.5 text-sm font-semibold text-amber-50 transition-colors hover:bg-amber-800 disabled:opacity-40"
          >
            {ready
              ? `Confirm ${subjects.join(", ")} · ${kinds.map((k) => k[0].toUpperCase() + k.slice(1)).join(" / ")}`
              : "Pull subject(s) and stamp Mid / Final"}
          </button>
        </div>
      )}
    </div>
  );
}
