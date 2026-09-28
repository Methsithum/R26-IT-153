import { AnimatePresence, motion as Motion } from "framer-motion";
import { PHASES, useGameStore } from "../state/GameStateManager";
import { LANE_NAMES } from "../state/runnerStore";
import { getBuildingById } from "../data/buildings";

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
    <div className="game-question-slot">
      <AnimatePresence>
        {visible && (
          <Motion.div
            key={question.id}
            initial={{ opacity: 0, y: -16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            className="game-question-card"
          >
            <p className="text-[10px] uppercase tracking-[0.28em] text-amber-300 mb-1 font-semibold text-center">
              {answers.length ? "Read, then run the matching lane" : "Next campus activity"}
            </p>
            <p className="text-sm sm:text-base font-bold text-white leading-snug text-center break-words">
              {question.questionText}
            </p>
            {!answers.length && <p className="mt-1 text-center text-xs text-amber-100">Keep running — answer this at {getBuildingById(question.targetLocation)?.name || "the next campus station"}.</p>}
            {answers.length > 0 && (
              <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {answers.slice(0, 4).map((answer, i) => (
                  <div
                    key={`${answer}-${i}`}
                    className="rounded-lg border px-2 py-1.5 text-center break-words"
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
                    <div className="text-xs sm:text-sm font-semibold text-white leading-snug">
                      {answer}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
