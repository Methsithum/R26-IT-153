import { useGameStore } from "../state/GameStateManager";
import { useRunnerStore } from "../state/runnerStore";
import { XP_PER_LEVEL, xpIntoLevel } from "../data/progression";

function StatCard({ label, value, accent, extra }) {
  return (
    <div className="pointer-events-none rounded-xl border border-sky-300/20 bg-slate-900/70 backdrop-blur-md px-3 py-2 min-w-[92px] text-right">
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`text-lg font-bold leading-tight ${accent || "text-slate-50"}`}>{value}</div>
      {extra}
    </div>
  );
}

export default function ScoreDisplay() {
  const xp = useGameStore((s) => s.xp);
  const level = useGameStore((s) => s.level);
  const score = useGameStore((s) => s.score);
  const speed = useGameStore((s) => s.speed);
  const speedScale = useRunnerStore((s) => s.speedScale);
  const shown = speed * speedScale;
  const into = xpIntoLevel(xp);

  return (
    <div className="flex gap-2">
      <StatCard
        label={`Lv ${level} XP`}
        value={xp.toLocaleString()}
        accent="text-emerald-200"
        extra={
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-slate-700/80">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 to-emerald-400"
              style={{ width: `${(into / XP_PER_LEVEL) * 100}%` }}
            />
          </div>
        }
      />
      <StatCard label="Score" value={score.toLocaleString()} accent="text-amber-100" />
      <StatCard label="Speed" value={`${shown.toFixed(0)} m/s`} />
    </div>
  );
}
