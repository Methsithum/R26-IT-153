import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Play, RotateCcw } from "lucide-react";
import { useGameStore } from "../state/GameStateManager";

export default function PauseOverlay() {
  const navigate = useNavigate();
  const paused = useGameStore((s) => s.paused);
  const restarting = useGameStore((s) => s.restarting);
  const restartError = useGameStore((s) => s.restartError);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const open = paused || restarting;

  async function handleRestart() {
    try {
      const left = await useGameStore.getState().restartRun();
      if (left === false) return;
      navigate("/journal/activities");
      useGameStore.setState({ restarting: false, paused: false });
    } catch {
      // restartError is shown on the overlay
    }
  }

  return (
    <AnimatePresence
      onExitComplete={() => setConfirmRestart(false)}
    >
      {open && (
        <motion.div
          key="pause-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="pointer-events-auto absolute inset-0 z-[80] flex items-center justify-center px-4"
        >
          <div className="absolute inset-0 bg-slate-950/72 backdrop-blur-md" />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at 50% 42%, rgba(251,191,36,0.16), transparent 52%), radial-gradient(ellipse at 50% 100%, rgba(15,23,42,0.9), transparent 42%)",
            }}
          />

          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 280, damping: 24 }}
            className="relative w-full max-w-[22rem] overflow-hidden rounded-[2rem] border border-amber-200/25 bg-gradient-to-b from-slate-900/95 via-[#1a140c]/95 to-slate-950/95 px-6 py-8 text-center shadow-[0_30px_80px_rgba(0,0,0,0.55)]"
          >
            <div className="mx-auto mb-5 flex items-end justify-center gap-2.5">
              {[0, 1].map((i) => (
                <motion.span
                  key={i}
                  className="h-11 w-3.5 rounded-full bg-gradient-to-b from-amber-200 to-amber-500 shadow-[0_0_18px_rgba(251,191,36,0.45)]"
                  animate={{ scaleY: [1, 0.72, 1], opacity: [1, 0.75, 1] }}
                  transition={{ duration: 1.15, repeat: Infinity, delay: i * 0.18, ease: "easeInOut" }}
                />
              ))}
            </div>

            <div className="text-[11px] font-semibold uppercase tracking-[0.38em] text-amber-300/80">
              Campus run
            </div>
            <h2 className="mt-1 text-4xl font-black tracking-tight text-white">Paused</h2>
            <p className="mt-2 text-sm text-slate-400">
              {confirmRestart
                ? "This run’s answers won’t be saved. You’ll go back to pick today’s activities."
                : "The campus is on hold. Pick up where you left off, or start the run over."}
            </p>

            <div className="mt-7 flex flex-col gap-3">
              {!confirmRestart ? (
                <>
                  <button
                    type="button"
                    disabled={restarting}
                    onClick={() => useGameStore.getState().resume()}
                    className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-300 px-5 text-base font-black tracking-wide text-slate-950 shadow-[0_10px_28px_rgba(251,191,36,0.28)] transition hover:from-amber-300 hover:to-amber-200 disabled:opacity-40"
                  >
                    <Play className="h-4 w-4 fill-current" />
                    Resume
                  </button>
                  <button
                    type="button"
                    disabled={restarting}
                    onClick={() => setConfirmRestart(true)}
                    className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-5 text-base font-bold text-slate-100 transition hover:border-amber-200/35 hover:bg-white/10 disabled:opacity-40"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Restart
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={restarting}
                    onClick={handleRestart}
                    className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-500 to-amber-500 px-5 text-base font-black tracking-wide text-white shadow-[0_10px_28px_rgba(244,63,94,0.25)] transition hover:from-rose-400 hover:to-amber-400 disabled:opacity-50"
                  >
                    <RotateCcw className={`h-4 w-4 ${restarting ? "animate-spin" : ""}`} />
                    {restarting ? "Restarting…" : "Restart run"}
                  </button>
                  <button
                    type="button"
                    disabled={restarting}
                    onClick={() => setConfirmRestart(false)}
                    className="flex min-h-[48px] items-center justify-center rounded-2xl border border-white/12 bg-white/5 px-5 text-sm font-semibold text-slate-300 transition hover:bg-white/10 disabled:opacity-40"
                  >
                    Go back
                  </button>
                </>
              )}
            </div>

            {restartError && (
              <p className="mt-4 text-xs leading-relaxed text-rose-300">{restartError}</p>
            )}

            <p className="mt-6 hidden text-[10px] uppercase tracking-[0.22em] text-slate-500 sm:block">
              Esc to resume
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
