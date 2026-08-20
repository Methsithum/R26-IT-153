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
    width: 34 + (hash % 4) * 7,
    height: 118 + (hash % 5) * 8,
  };
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
      <div className="mb-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-800/70">Exam hall</div>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-stone-900">Exam preparation</h2>
        <p className="mt-2 max-w-xl text-sm text-stone-600">
          {question?.questionText ?? "Pull the subjects you prepared, then stamp Mid, Final, or both."}
        </p>
      </div>

      {options.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-3xl border border-stone-200 bg-white text-sm text-stone-500">
          No registered subjects on this account.
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-amber-900/20 shadow-inner">
          <div
            className="relative min-h-0 flex-1 overflow-x-auto overflow-y-hidden px-5 pt-5"
            style={{ background: "linear-gradient(180deg, #4a2c14 0%, #6b3f22 55%, #5c3818 100%)" }}
          >
            <div className="mb-3 text-center text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-100/70">
              Pull every subject you prepared
            </div>
            <div className="flex h-[168px] items-end justify-center gap-[3px] px-2">
              <AnimatePresence initial={false}>
                {options.map((subject) => {
                  if (subjects.includes(subject)) return null;
                  const style = bookStyle(subject);
                  return (
                    <motion.button
                      layoutId={`exam-book-${subject}`}
                      key={subject}
                      type="button"
                      onClick={() => onToggleSubject(subject)}
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

          <div className="relative bg-[#c9a26a] px-5 py-4">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-950/55">
              Checkout desk
            </div>
            <div className="mb-4 flex min-h-[72px] flex-wrap items-end gap-3">
              <AnimatePresence initial={false}>
                {subjects.map((subject) => {
                  const style = bookStyle(subject);
                  return (
                    <motion.button
                      layoutId={`exam-book-${subject}`}
                      key={subject}
                      type="button"
                      onClick={() => onToggleSubject(subject)}
                      className="flex h-[72px] w-[64px] flex-col justify-end rounded-md border border-black/15 p-2 text-left shadow-lg"
                      style={{ background: style.color }}
                    >
                      <span className="line-clamp-3 text-[10px] font-semibold leading-tight text-amber-50">{subject}</span>
                    </motion.button>
                  );
                })}
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
                    className="relative rounded-sm border border-amber-900/20 bg-[#fff7ed] px-4 py-4 text-left shadow-md"
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
