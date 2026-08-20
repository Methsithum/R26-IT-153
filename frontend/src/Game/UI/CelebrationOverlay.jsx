import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PHASES, useGameStore } from "../state/GameStateManager";

const COLORS = ["#fbbf24", "#34d399", "#38bdf8", "#f43f5e", "#f5d76e", "#a78bfa", "#fb7185", "#fde68a"];

function Confetti() {
  const bits = useMemo(
    () =>
      Array.from({ length: 52 }, (_, i) => ({
        id: i,
        left: `${((i * 19) % 100)}%`,
        delay: (i % 12) * 0.06,
        duration: 1.7 + (i % 6) * 0.22,
        color: COLORS[i % COLORS.length],
        rotate: (i * 41) % 360,
        size: 8 + (i % 5) * 3,
        drift: (i % 2 === 0 ? 1 : -1) * (18 + (i % 7) * 8),
      })),
    []
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {bits.map((bit) => (
        <motion.span
          key={bit.id}
          initial={{ y: -36, x: 0, opacity: 1, rotate: bit.rotate, scale: 0.8 }}
          animate={{
            y: "112vh",
            x: bit.drift,
            opacity: [1, 1, 0],
            rotate: bit.rotate + 280,
            scale: 1,
          }}
          transition={{ duration: bit.duration, delay: bit.delay, ease: "easeIn" }}
          className="absolute top-0 rounded-[2px] shadow-sm"
          style={{
            left: bit.left,
            width: bit.size,
            height: bit.size * 0.52,
            background: bit.color,
          }}
        />
      ))}
    </div>
  );
}

export default function CelebrationOverlay() {
  const phase = useGameStore((s) => s.phase);
  const day = useGameStore((s) => s.day);
  const visible = phase === PHASES.DAY_CELEBRATION;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="pointer-events-none absolute inset-0 z-40"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.55, 0.15, 0] }}
            transition={{ duration: 0.7, times: [0, 0.35, 1] }}
            className="absolute inset-0 bg-amber-100/40"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at 50% 18%, rgba(253, 224, 71, 0.38), transparent 44%), linear-gradient(to top, rgba(15,23,42,0.45), transparent 58%)",
            }}
          />
          <Confetti />

          <div className="absolute left-1/2 top-[20%] w-[min(92vw,540px)] -translate-x-1/2 text-center">
            <motion.div
              initial={{ scale: 0.72, y: 28, opacity: 0, rotate: -2 }}
              animate={{ scale: 1, y: 0, opacity: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 230, damping: 16 }}
              className="overflow-hidden rounded-[28px] border border-amber-200/60 bg-slate-950/60 px-8 py-8 shadow-[0_20px_80px_rgba(245,215,110,0.28)] backdrop-blur-md"
            >
              <div className="mx-auto mb-4 flex h-2 w-40 overflow-hidden rounded-full">
                {Array.from({ length: 10 }).map((_, i) => (
                  <span
                    key={i}
                    className="h-full flex-1"
                    style={{ background: i % 2 === 0 ? "#f8fafc" : "#111827" }}
                  />
                ))}
              </div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.34em] text-amber-300">
                Tape broken
              </div>
              <h2 className="mt-2 text-4xl font-black tracking-tight text-white sm:text-5xl">
                That’s the day.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-200">
                You ran the campus. Day {day} is in the journal.
              </p>
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.35, duration: 0.45 }}
                className="mx-auto mt-5 h-px w-40 origin-center bg-gradient-to-r from-transparent via-amber-300 to-transparent"
              />
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
