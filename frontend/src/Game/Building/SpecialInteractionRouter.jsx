import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PHASES, useGameStore } from "../state/GameStateManager";
import { getBuildingById } from "../data/buildings";

// Integration point for the (separately implemented) mini-games.
// The main game only needs to: activate this, wait for a result shaped
// like { completed: true, value }, then hand it back to the state machine.
// Nothing here is the real mini-game — it's a stand-in so the full
// building -> interaction -> return loop can be exercised end to end.
export default function SpecialInteractionRouter() {
  const phase = useGameStore((s) => s.phase);
  const activeQuestion = useGameStore((s) => s.activeQuestion);
  const targetBuildingId = useGameStore((s) => s.targetBuildingId);
  const [value, setValue] = useState("");

  const active = phase === PHASES.SPECIAL_INTERACTION_ACTIVE;
  const completed = phase === PHASES.SPECIAL_INTERACTION_COMPLETED;
  if (!active && !completed) return null;

  const building = getBuildingById(targetBuildingId);
  const interactionType = activeQuestion?.interactionType ?? "academic";

  function handleSubmit(e) {
    e.preventDefault();
    const fallback = interactionType === "marks" ? 0 : new Date().toISOString().slice(0, 10);
    useGameStore.getState().completeSpecialInteraction({
      completed: true,
      value: value || fallback,
    });
  }

  return (
    <AnimatePresence>
      <motion.div
        key="interaction-panel"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        className="pointer-events-auto absolute left-1/2 bottom-10 -translate-x-1/2 w-[min(92vw,420px)]
                   rounded-2xl border border-sky-300/30 bg-slate-900/85 backdrop-blur-md p-5 shadow-2xl"
      >
        {completed ? (
          <div className="text-center text-emerald-300 font-semibold py-4">
            Saved to your journal ✓
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="text-xs uppercase tracking-wide text-sky-300/80">
              {building?.name ?? "Campus Building"} · {interactionType} interaction
            </div>
            <div className="text-sm text-slate-100">{activeQuestion?.questionText}</div>
            <input
              autoFocus
              type={interactionType === "marks" ? "number" : "date"}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="rounded-lg bg-slate-800 border border-slate-600 px-3 py-2 text-slate-100 outline-none
                         focus:border-sky-400"
              placeholder={interactionType === "marks" ? "Enter mark" : "Select date"}
            />
            <button
              type="submit"
              className="rounded-lg bg-sky-500 hover:bg-sky-400 transition-colors text-slate-900
                         font-semibold py-2"
            >
              Confirm
            </button>
            <div className="text-[10px] text-slate-400 text-center">
              Mini-game integration point — full interaction UI arrives separately.
            </div>
          </form>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
