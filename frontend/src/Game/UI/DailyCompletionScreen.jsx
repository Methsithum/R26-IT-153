import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useGameStore } from "../state/GameStateManager";

export default function DailyCompletionScreen() {
  const navigate = useNavigate();
  const day = useGameStore((s) => s.day);
  const xp = useGameStore((s) => s.xp);
  const score = useGameStore((s) => s.score);
  const journalDay = useGameStore((s) => s.journalDay);

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center px-8 py-10 rounded-3xl border border-emerald-300/25 bg-slate-900/85 shadow-2xl max-w-md"
      >
        <div className="text-emerald-300 text-xs uppercase tracking-[0.3em] mb-2">Journal Saved</div>
        <h1 className="text-3xl font-bold text-slate-50 mb-1">Day {day} Complete</h1>
        <p className="text-slate-400 text-sm mb-6">
          {journalDay.responses.length} check-ins answered
          {journalDay.interactionsCompleted.length > 0 &&
            ` · ${journalDay.interactionsCompleted.length} record${journalDay.interactionsCompleted.length > 1 ? "s" : ""} updated`}
        </p>
        <div className="flex justify-center gap-6 mb-6">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-slate-400">XP</div>
            <div className="text-xl font-bold text-amber-300">{xp.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-slate-400">Score</div>
            <div className="text-xl font-bold text-sky-300">{score.toLocaleString()}</div>
          </div>
        </div>
        <button
          onClick={() => {
            useGameStore.getState().startNextDay();
            navigate("/");
          }}
          className="rounded-xl bg-emerald-400 hover:bg-emerald-300 transition-colors text-slate-900 font-semibold px-6 py-3"
        >
          Return to Journal
        </button>
      </motion.div>
    </div>
  );
}
