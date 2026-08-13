import { motion, AnimatePresence } from "framer-motion";
import { useGameStore } from "../state/GameStateManager";

export default function ObjectivePanel() {
  const objectiveText = useGameStore((s) => s.objectiveText);

  return (
    <div className="pointer-events-none rounded-2xl border border-emerald-300/25 bg-slate-900/70 backdrop-blur-md px-4 py-3 shadow-xl max-w-[220px]">
      <div className="text-[10px] uppercase tracking-wide text-emerald-300/80 mb-1">Objective</div>
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
