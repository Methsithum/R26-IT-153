import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGameStore } from "../state/GameStateManager";

export default function ControlHints() {
  const show = useGameStore((s) => s.showControlHints);

  useEffect(() => {
    const t = setTimeout(() => useGameStore.getState().dismissControlHints(), 9000);
    return () => clearTimeout(t);
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className="pointer-events-none rounded-xl border border-slate-300/15 bg-slate-900/60 backdrop-blur-md px-3 py-2 flex gap-4 text-[11px] text-slate-200"
        >
          <span>&larr; &rarr; Move</span>
          <span>SPACE Jump</span>
          <span>&darr; Slide</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
