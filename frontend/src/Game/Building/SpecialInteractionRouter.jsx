import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PHASES, useGameStore } from "../state/GameStateManager";
import { getBuildingById } from "../data/buildings";
import { pickVariantIndex } from "../MiniGames/variant";
import CalendarStamp from "../MiniGames/CalendarStamp";
import DeadlineAbacus from "../MiniGames/DeadlineAbacus";
import GradeSlider from "../MiniGames/GradeSlider";
import MarksDartboard from "../MiniGames/MarksDartboard";
import SubjectBalanceScale from "../MiniGames/SubjectBalanceScale";
import ExamCalendarSort from "../MiniGames/ExamCalendarSort";

// Renders the mini-game "skin" for the active special interaction as a
// literal JSX tag per branch (never a component reference computed at
// render time — React components must stay static across renders). A
// stable id (assignment/exam id) is hashed to an index so the same record
// always reopens the same mini-game, while different records naturally
// spread across every skin.
function MiniGameSlot({ activeQuestion, onComplete }) {
  const { interactionType, context } = activeQuestion ?? {};
  const props = { question: activeQuestion, onComplete };

  if (interactionType === "date") {
    const idx = pickVariantIndex(context?.assignmentId ?? "deadline", 2);
    return idx === 0 ? <CalendarStamp {...props} /> : <DeadlineAbacus {...props} />;
  }
  if (interactionType === "marks") {
    const idx = pickVariantIndex(context?.assignmentId ?? "marks", 3);
    if (idx === 0) return <GradeSlider {...props} />;
    if (idx === 1) return <MarksDartboard {...props} />;
    return <SubjectBalanceScale {...props} />;
  }
  if (interactionType === "examDate") {
    return <ExamCalendarSort {...props} />;
  }
  return <GenericInteraction {...props} />;
}

// Generic fallback used only for interaction types with no dedicated
// mini-game yet.
function GenericInteraction({ question, onComplete }) {
  const [value, setValue] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onComplete(value || new Date().toISOString().slice(0, 10));
      }}
      className="flex flex-col gap-3"
    >
      <div className="text-sm text-slate-100">{question?.questionText}</div>
      <input
        autoFocus
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="rounded-lg bg-slate-800 border border-slate-600 px-3 py-2 text-slate-100 outline-none
                   focus:border-sky-400"
        placeholder="Enter a value"
      />
      <button
        type="submit"
        className="rounded-lg bg-sky-500 hover:bg-sky-400 transition-colors text-slate-900 font-semibold py-2"
      >
        Confirm
      </button>
    </form>
  );
}

export default function SpecialInteractionRouter() {
  const phase = useGameStore((s) => s.phase);
  const activeQuestion = useGameStore((s) => s.activeQuestion);
  const targetBuildingId = useGameStore((s) => s.targetBuildingId);

  const active = phase === PHASES.SPECIAL_INTERACTION_ACTIVE;
  const completed = phase === PHASES.SPECIAL_INTERACTION_COMPLETED;
  if (!active && !completed) return null;

  const building = getBuildingById(targetBuildingId);
  const interactionType = activeQuestion?.interactionType ?? "academic";

  function handleComplete(value) {
    useGameStore.getState().completeSpecialInteraction({ completed: true, value });
  }

  return (
    <AnimatePresence>
      <motion.div
        key="interaction-panel"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        className="pointer-events-auto absolute left-1/2 bottom-10 -translate-x-1/2 w-[min(92vw,440px)]
                   rounded-2xl border border-sky-300/30 bg-slate-900/85 backdrop-blur-md p-5 shadow-2xl"
      >
        {completed ? (
          <div className="text-center text-emerald-300 font-semibold py-4">
            Saved to your journal ✓
          </div>
        ) : (
          <>
            <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-2">
              {building?.name ?? "Campus Building"} · {interactionType} interaction
            </div>
            <MiniGameSlot activeQuestion={activeQuestion} onComplete={handleComplete} />
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
