import { AnimatePresence, motion } from "framer-motion";
import { PHASES, useGameStore } from "../state/GameStateManager";

const VISIBLE_PHASES = [
  PHASES.QUESTION_APPROACHING,
  PHASES.ANSWER_SELECTION,
];

export default function QuestionBanner() {
  const phase = useGameStore((s) => s.phase);
  const question = useGameStore((s) => s.activeQuestion);
  const visible = Boolean(question) && VISIBLE_PHASES.includes(phase);

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 w-[min(720px,calc(100%-16rem))] pointer-events-none">
      <AnimatePresence>
        {visible && (
          <motion.div
            key={question.id}
            initial={{ opacity: 0, y: -16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            className="rounded-2xl border-2 border-amber-300/70 bg-slate-950/90 backdrop-blur-md px-6 py-3.5 shadow-[0_0_28px_rgba(251,191,36,0.28)] text-center"
          >
            <p className="text-[10px] uppercase tracking-[0.28em] text-amber-300 mb-1 font-semibold">
              {question.answers?.length ? "Choose a lane" : "Question"}
            </p>
            <p className="text-base sm:text-lg font-bold text-white leading-snug">
              {question.questionText}
            </p>
            {question.answers?.length > 0 && (
              <p className="text-[11px] text-slate-300 mt-1.5">
                Run through the lane that matches your answer
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
