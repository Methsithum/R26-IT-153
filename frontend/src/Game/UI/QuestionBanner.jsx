import { AnimatePresence, motion } from "framer-motion";
import { PHASES, useGameStore } from "../state/GameStateManager";
import { LANE_NAMES } from "../state/runnerStore";

const VISIBLE_PHASES = [
  PHASES.QUESTION_APPROACHING,
  PHASES.ANSWER_SELECTION,
];

const LANE_COLORS = ["#fbbf24", "#38bdf8", "#a78bfa", "#34d399"];

export default function QuestionBanner() {
  const phase = useGameStore((s) => s.phase);
  const question = useGameStore((s) => s.activeQuestion);
  const visible = Boolean(question) && VISIBLE_PHASES.includes(phase);
  const answers = question?.answers || [];

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 w-[min(860px,calc(100%-8rem))] pointer-events-none">
      <AnimatePresence>
        {visible && (
          <motion.div
            key={question.id}
            initial={{ opacity: 0, y: -16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            className="rounded-2xl border-2 border-amber-300/70 bg-slate-950/92 backdrop-blur-md px-5 py-4 shadow-[0_0_28px_rgba(251,191,36,0.28)]"
          >
            <p className="text-[10px] uppercase tracking-[0.28em] text-amber-300 mb-1 font-semibold text-center">
              {answers.length ? "Read, then run the matching lane" : "Question"}
            </p>
            <p className="text-lg sm:text-xl font-bold text-white leading-snug text-center">
              {question.questionText}
            </p>
            {answers.length > 0 && (
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                {answers.slice(0, 4).map((answer, i) => (
                  <div
                    key={`${answer}-${i}`}
                    className="rounded-xl border px-2.5 py-2 text-center"
                    style={{
                      borderColor: `${LANE_COLORS[i]}99`,
                      background: `${LANE_COLORS[i]}18`,
                    }}
                  >
                    <div
                      className="text-[10px] font-semibold uppercase tracking-wide mb-1"
                      style={{ color: LANE_COLORS[i] }}
                    >
                      Lane {i + 1} · {LANE_NAMES[i]}
                    </div>
                    <div className="text-sm sm:text-[15px] font-semibold text-white leading-snug">
                      {answer}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
