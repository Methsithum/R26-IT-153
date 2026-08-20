import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useGameStore } from "../state/GameStateManager";
import DiscardTodayButton from "../../Pages/Journal/DiscardTodayButton";
import { getBuildingById } from "../data/buildings";

function rankFor(score) {
  if (score >= 2000) return { title: "Campus Ace", blurb: "A sharp, full campus day.", color: "text-amber-300" };
  if (score >= 1200) return { title: "Solid Day", blurb: "You kept the journal moving.", color: "text-emerald-300" };
  if (score >= 600) return { title: "Kept Pace", blurb: "Records landed. Tomorrow builds on this.", color: "text-sky-300" };
  return { title: "Made It In", blurb: "The day is logged. Rest, then run again.", color: "text-stone-200" };
}

function CountUp({ value }) {
  return <span className="tabular-nums">{Number(value || 0).toLocaleString()}</span>;
}

export default function DailyCompletionScreen() {
  const navigate = useNavigate();
  const day = useGameStore((s) => s.day);
  const xp = useGameStore((s) => s.xp);
  const score = useGameStore((s) => s.score);
  const level = useGameStore((s) => s.level);
  const journalDay = useGameStore((s) => s.journalDay);
  const rank = rankFor(score);
  const places = [
    ...new Set(
      (journalDay.interactionsCompleted || [])
        .map((item) => getBuildingById(item.targetLocation)?.shortName || item.targetLocation)
        .filter(Boolean)
    ),
  ];
  const xpIntoLevel = xp % 500;
  const pct = Math.min(100, Math.round((xpIntoLevel / 500) * 100));

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 22, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="w-full max-w-md px-8 py-10 rounded-3xl border border-emerald-300/25 bg-slate-900/90 shadow-2xl text-center"
      >
        <div className="text-emerald-300 text-xs uppercase tracking-[0.3em] mb-2">Day closed</div>
        <h1 className="text-3xl font-bold text-slate-50">Day {day} Complete</h1>
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.12, type: "spring", stiffness: 240 }}
          className={`mt-3 text-lg font-black tracking-[0.18em] uppercase ${rank.color}`}
        >
          {rank.title}
        </motion.div>
        <p className="mt-1 text-sm text-slate-400">{rank.blurb}</p>

        <div className="mt-6 grid grid-cols-3 gap-3">
          {[
            ["Score", score, "text-sky-300"],
            ["XP", xp, "text-amber-300"],
            ["Level", level, "text-emerald-300"],
          ].map(([label, value, color], i) => (
            <motion.div
              key={label}
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.16 + i * 0.06 }}
              className="rounded-2xl border border-white/10 bg-slate-950/50 px-2 py-3"
            >
              <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{label}</div>
              <div className={`mt-1 text-lg font-bold ${color}`}>
                <CountUp value={value} />
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-5 text-left">
          <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-slate-500">
            <span>Next level</span>
            <span>{xpIntoLevel} / 500</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-700/70">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ delay: 0.3, duration: 0.7, ease: "easeOut" }}
              className="h-full rounded-full bg-gradient-to-r from-amber-400 to-emerald-400"
            />
          </div>
        </div>

        <p className="mt-5 text-sm text-slate-400">
          {journalDay.responses.length} check-ins
          {journalDay.interactionsCompleted.length > 0 &&
            ` · ${journalDay.interactionsCompleted.length} record${journalDay.interactionsCompleted.length > 1 ? "s" : ""} stamped`}
        </p>

        {places.length > 0 && (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {places.map((place) => (
              <span
                key={place}
                className="rounded-full border border-amber-300/30 bg-amber-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-200"
              >
                {place}
              </span>
            ))}
          </div>
        )}

        <button
          onClick={() => {
            useGameStore.getState().startNextDay();
            navigate("/");
          }}
          className="mt-7 rounded-xl bg-emerald-400 hover:bg-emerald-300 transition-colors text-slate-900 font-semibold px-6 py-3"
        >
          Return to Journal
        </button>
        <DiscardTodayButton className="mt-4" />
      </motion.div>
    </div>
  );
}
