import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useGameStore } from "../state/GameStateManager";

export default function StartScreen() {
  const navigate = useNavigate();
  const day = useGameStore((s) => s.day);
  const missedDates = useGameStore((s) => s.missedDates);
  const catchingUp = (missedDates || []).length > 0;

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center px-8 py-10 rounded-3xl border border-amber-300/25 bg-slate-900/85 shadow-2xl max-w-md"
      >
        <div className="text-amber-300 text-xs uppercase tracking-[0.3em] mb-2">Student Journal</div>
        <h1 className="text-3xl font-bold text-slate-50 mb-1">University Campus Run</h1>
        <p className="text-slate-400 text-sm mb-6">
          {catchingUp
            ? `Day ${day} is a catch-up — log what you did that day, then today's run still waits.`
            : `Day ${day} — run, answer today's check-ins, and keep your journal up to date.`}
        </p>
        <button
          onClick={() => navigate("/journal/activities")}
          className="rounded-xl bg-amber-400 hover:bg-amber-300 transition-colors text-slate-900 font-semibold px-6 py-3"
        >
          {catchingUp ? "Catch up this day" : "Start Today's Run"}
        </button>
        <div className="mt-6 flex justify-center gap-6 text-[11px] text-slate-400">
          <span>&larr; &rarr; Move</span>
          <span>SPACE Jump</span>
          <span>&darr; Slide</span>
        </div>
      </motion.div>
    </div>
  );
}
