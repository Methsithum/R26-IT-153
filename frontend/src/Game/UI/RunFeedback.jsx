import { useEffect, useState } from "react";
import { AnimatePresence, motion as Motion } from "framer-motion";
import { PHASES, useGameStore, XP_RULES } from "../state/GameStateManager";

export default function RunFeedback() {
  const phase = useGameStore((s) => s.phase);
  const day = useGameStore((s) => s.day);
  const answer = useGameStore((s) => s.pendingAnswer);
  const [intro, setIntro] = useState(phase === PHASES.RUNNING);
  useEffect(() => {
    const timer = setTimeout(() => setIntro(false), 2200);
    return () => clearTimeout(timer);
  }, []);
  return (
    <div className="pointer-events-none absolute inset-0 z-20" aria-live="polite">
      <AnimatePresence>
        {intro && <Motion.div key="intro" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="absolute inset-x-0 top-[40%] text-center"><span className="rounded-2xl border border-amber-200/40 bg-slate-950/85 px-6 py-4 text-lg font-black tracking-[.2em] text-amber-200">DAY {String(day).padStart(2, "0")} · CAMPUS RUN</span></Motion.div>}
        {phase === PHASES.ANSWER_CONFIRMED && <Motion.div key="answer" initial={{ opacity: 0, scale: .7, y: 40 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, x: 130, y: -150, scale: .3 }} className="absolute left-1/2 top-[38%] -translate-x-1/2 rounded-2xl border border-emerald-200/50 bg-slate-950/90 px-6 py-4 text-center shadow-xl"><div className="text-emerald-300 font-black">✓ Check-in recorded</div><div className="mt-1 text-sm text-white">{String(answer ?? "")}</div><div className="mt-2 text-xs font-bold text-amber-200">+{XP_RULES.ANSWER} XP</div></Motion.div>}
      </AnimatePresence>
    </div>
  );
}
