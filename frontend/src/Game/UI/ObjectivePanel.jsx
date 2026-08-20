import { motion, AnimatePresence } from "framer-motion";
import { PHASES, useGameStore } from "../state/GameStateManager";

export default function ObjectivePanel() {
  const objectiveText = useGameStore((s) => s.objectiveText);
  const phase = useGameStore((s) => s.phase);
  const finish = phase === PHASES.APPROACHING_FINISH || phase === PHASES.DAY_CELEBRATION;

  return (
    <div
      className={`pointer-events-none max-w-[220px] rounded-2xl border px-4 py-3 shadow-xl backdrop-blur-md ${
        finish
          ? "border-amber-300/55 bg-slate-900/80 shadow-[0_0_24px_rgba(245,215,110,0.22)]"
          : "border-emerald-300/25 bg-slate-900/70"
      }`}
    >
      <div className={`mb-1 text-[10px] uppercase tracking-wide ${finish ? "text-amber-300" : "text-emerald-300/80"}`}>
        Objective
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={objectiveText}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6 }}
          transition={{ duration: 0.25 }}
          className="text-sm text-slate-100 font-medium leading-snug"
        >
          {objectiveText}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
