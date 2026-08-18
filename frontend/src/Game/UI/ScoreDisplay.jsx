import { useRunnerStore } from "../state/runnerStore";
import { useGameStore } from "../state/GameStateManager";

function StatCard({ label, value, accent }) {
  return (
    <div className="pointer-events-none rounded-xl border border-sky-300/20 bg-slate-900/70 backdrop-blur-md px-3 py-2 min-w-[92px] text-right">
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`text-lg font-bold leading-tight ${accent || "text-slate-50"}`}>{value}</div>
    </div>
  );
}

export default function ScoreDisplay() {
  const xp = useGameStore((s) => s.xp);
  const score = useGameStore((s) => s.score);
  const speed = useGameStore((s) => s.speed);
  const speedScale = useRunnerStore((s) => s.speedScale);
  const shown = speed * speedScale;

  return (
    <div className="flex gap-2">
      <StatCard label="XP" value={xp.toLocaleString()} accent="text-emerald-200" />
      <StatCard label="Score" value={score.toLocaleString()} accent="text-amber-100" />
      <StatCard label="Speed" value={`${shown.toFixed(0)} m/s`} />
    </div>
  );
}
