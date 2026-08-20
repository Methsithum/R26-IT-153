import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PHASES, useGameStore } from "../state/GameStateManager";
import { useRunnerStore } from "../state/runnerStore";

export default function FinishAheadBanner() {
  const phase = useGameStore((s) => s.phase);
  const metersRef = useRef(null);
  const visible = phase === PHASES.APPROACHING_FINISH;

  useEffect(() => {
    if (!visible) return;
    let raf = 0;
    function tick() {
      const { posZ } = useRunnerStore.getState();
      const { finishLineZ } = useGameStore.getState();
      if (metersRef.current && finishLineZ != null) {
        metersRef.current.textContent = `${Math.max(0, Math.round(finishLineZ - posZ))} m`;
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [visible]);

  return (
    <div className="absolute top-[5.75rem] left-1/2 z-20 -translate-x-1/2 pointer-events-none">
      <AnimatePresence>
        {visible && (
          <motion.p
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            ref={metersRef}
            className="rounded-full border border-white/25 bg-slate-950/55 px-3 py-1 text-xs font-semibold tabular-nums tracking-wide text-amber-50/90 shadow-sm backdrop-blur-sm"
          >
            — m
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
