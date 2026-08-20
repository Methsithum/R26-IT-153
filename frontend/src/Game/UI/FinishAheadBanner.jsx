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
    <div className="absolute top-20 left-1/2 z-20 w-[min(520px,calc(100%-8rem))] -translate-x-1/2 pointer-events-none">
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 0, y: -18, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.32, ease: "easeOut" }}
            className="rounded-2xl border-2 border-amber-300/80 bg-slate-950/92 px-5 py-3.5 text-center shadow-[0_0_34px_rgba(251,191,36,0.35)] backdrop-blur-md"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-amber-300">
              Finish line ahead
            </p>
            <p className="mt-1 text-lg font-black tracking-tight text-white">
              Break the tape
            </p>
            <p ref={metersRef} className="mt-0.5 text-sm font-semibold tabular-nums text-amber-100/90">
              — m
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
