import { useGameStore } from "../state/GameStateManager";

export default function DailyProgress() {
  const day = useGameStore((s) => s.day);
  const level = useGameStore((s) => s.level);
  const progress = useGameStore((s) => s.dailyProgress());
  const pct = Math.round(progress * 100);

  return (
    <div className="pointer-events-none rounded-2xl border border-amber-300/25 bg-slate-900/70 backdrop-blur-md px-4 py-3 shadow-xl min-w-[180px]">
      <div className="flex items-baseline justify-between">
        <span className="text-amber-300 font-bold tracking-widest text-sm">DAY {String(day).padStart(2, "0")}</span>
        <span className="text-slate-400 text-xs">Lv {level}</span>
      </div>
      <div className="mt-2 text-[10px] uppercase tracking-wide text-slate-400">Daily Progress</div>
      <div className="mt-1 h-2.5 w-full rounded-full bg-slate-700/70 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-1 text-right text-[11px] text-slate-300">{pct}%</div>
    </div>
  );
}
