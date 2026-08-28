import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { play } from "../audio/sfx";

function subjectOf(question) {
  const exam = question?.context?.missingExams?.[0];
  if (exam?.subject) {
    const kind = String(exam.examType || exam.exam_type || "").replace(/^\w/, (c) => c.toUpperCase());
    return kind ? `${exam.subject} · ${kind}` : exam.subject;
  }
  return question?.subject || question?.context?.subject || "Today's subject";
}

function clampMark(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export default function GradeSlider({ question, onComplete }) {
  const [value, setValue] = useState(75);
  const trackRef = useRef(null);
  const dragging = useRef(false);
  const subject = subjectOf(question);

  function setFromClientX(clientX) {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const next = clampMark(((clientX - rect.left) / rect.width) * 100);
    setValue(next);
  }

  function onPointerDown(event) {
    dragging.current = true;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    play("click");
    setFromClientX(event.clientX);
  }

  function onPointerMove(event) {
    if (!dragging.current) return;
    setFromClientX(event.clientX);
  }

  function onPointerUp() {
    dragging.current = false;
  }

  function nudge(delta) {
    play("click");
    setValue((current) => clampMark(current + delta));
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-800/70">Grade board</div>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-stone-900">{subject}</h2>
        <p className="mt-2 max-w-xl text-sm text-stone-600">
          {question?.questionText ?? "Slide the brass bead to the mark you received."}
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-amber-900/25 shadow-[0_18px_40px_rgba(40,20,8,0.28)]">
        <div
          className="relative flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-8"
          style={{
            background:
              "radial-gradient(circle at 50% 20%, rgba(255,255,255,0.08), transparent 46%), linear-gradient(180deg, #1f3d2a 0%, #15261c 100%)",
            boxShadow: "inset 0 0 40px rgba(0,0,0,0.35)",
          }}
        >
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-100/45">Chalk mark</div>
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={() => nudge(-1)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-100/20 text-lg text-emerald-50/80 hover:bg-white/5"
            >
              −
            </button>
            <div className="text-center">
              <div className="font-serif text-7xl tabular-nums text-emerald-50 drop-shadow-[0_2px_0_rgba(0,0,0,0.35)]">
                {value}
              </div>
              <div className="mt-1 text-[11px] uppercase tracking-[0.28em] text-emerald-100/50">percent</div>
            </div>
            <button
              type="button"
              onClick={() => nudge(1)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-100/20 text-lg text-emerald-50/80 hover:bg-white/5"
            >
              +
            </button>
          </div>
        </div>

        <div
          className="shrink-0 px-5 py-6 sm:px-8"
          style={{ background: "linear-gradient(180deg, #5a3418 0%, #3f2412 100%)" }}
        >
          <div className="mb-4 flex justify-between text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-100/50">
            <span>0</span>
            <span>25</span>
            <span>50</span>
            <span>75</span>
            <span>100</span>
          </div>
          <div
            ref={trackRef}
            className="relative h-12 cursor-grab touch-none active:cursor-grabbing"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <div
              className="absolute inset-x-1 top-1/2 h-2 -translate-y-1/2 rounded-full"
              style={{
                background: "linear-gradient(180deg, #f3e2b8, #b08d57 45%, #e8d5a3)",
                boxShadow: "0 2px 0 rgba(0,0,0,0.35)",
              }}
            />
            <motion.div
              className="absolute top-1/2 h-11 w-11 -translate-x-1/2 -translate-y-1/2 rounded-full border border-black/30"
              style={{
                left: `${value}%`,
                background: "radial-gradient(circle at 32% 28%, #fde68a, #d97706 58%, #92400e)",
                boxShadow: "0 0 0 2px #fde68a, 0 6px 14px rgba(0,0,0,0.4)",
              }}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => onComplete(value)}
          className="bg-amber-800 py-3.5 text-sm font-semibold text-amber-50 transition-colors hover:bg-amber-700"
        >
          Save {value}% for {subject}
        </button>
      </div>
    </div>
  );
}
