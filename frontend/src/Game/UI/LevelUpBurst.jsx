import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGameStore } from "../state/GameStateManager";

export default function LevelUpBurst() {
  const leveledUpTo = useGameStore((s) => s.leveledUpTo);

  useEffect(() => {
    if (!leveledUpTo) return undefined;
    const t = setTimeout(() => useGameStore.setState({ leveledUpTo: null }), 2600);
    return () => clearTimeout(t);
  }, [leveledUpTo]);

  return (
    <AnimatePresence>
      {leveledUpTo ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.86, y: 18 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: -10 }}
          className="pointer-events-none absolute left-1/2 top-[22%] z-30 w-[min(92vw,380px)] -translate-x-1/2"
        >
          <div className="overflow-hidden rounded-3xl border border-amber-300/50 bg-slate-950/80 px-6 py-5 text-center shadow-[0_20px_80px_rgba(251,191,36,0.35)] backdrop-blur-md">
            <div className="text-[11px] font-semibold uppercase tracking-[0.34em] text-amber-300">
              Campus rank up
            </div>
            <div className="mt-1 text-4xl font-black tracking-tight text-white">Level {leveledUpTo}</div>
            <div className="mt-1 text-sm text-slate-300">Your journal XP crossed a new rank.</div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
