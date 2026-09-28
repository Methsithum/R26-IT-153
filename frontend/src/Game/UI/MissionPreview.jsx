import StudentPortrait from "./StudentPortrait";
import { useActiveMap } from "../state/mapStore";
import { useGameStore } from "../state/GameStateManager";

export default function MissionPreview() {
  const map = useActiveMap();
  const name = useGameStore((s) => s.playerName);
  const level = useGameStore((s) => s.level);
  return (
    <div className="mb-6 grid overflow-hidden rounded-3xl border border-amber-200/25 bg-slate-900 text-white sm:grid-cols-[.8fr_1.2fr]">
      <div className="relative flex items-center justify-center bg-gradient-to-b from-violet-900/60 to-slate-950 px-4 pt-3">
        <StudentPortrait animated className="h-40 sm:h-52" />
        <div className="absolute bottom-3 left-3 rounded-xl border border-white/20 bg-slate-950/85 px-3 py-2 text-xs"><b>{name || "Campus explorer"}</b><span className="ml-2 text-amber-300">LV {level}</span></div>
      </div>
      <div className="p-5 text-left">
        <div className="text-[10px] font-bold uppercase tracking-[.25em] text-amber-300">Mission lobby / Campus adventure</div>
        <h2 className="mt-2 text-xl font-black">{map.icon} {map.name}</h2>
        <p className="mt-1 text-xs text-slate-300">{map.tagline}</p>
        <svg viewBox="0 0 300 70" className="my-3 h-16 w-full" aria-label="Illustrated campus route" role="img">
          <path d="M10 60Q70 15 140 45T290 18" fill="none" stroke="#a78bfa" strokeWidth="4" strokeDasharray="5 5" />
          {[45, 145, 245].map((x, i) => <g key={x} transform={`translate(${x} ${i === 1 ? 5 : 0})`}><path d="M-22 23L0 10l22 13Z" fill="#f5d76e" /><rect x="-18" y="24" width="36" height="26" rx="3" fill="#64748b" /><path d="M-10 30v14M0 30v14M10 30v14" stroke="#e2e8f0" strokeWidth="4" /></g>)}
        </svg>
        <p className="text-[11px] text-slate-300">Explore campus · Record your day · Grow your journal</p>
      </div>
    </div>
  );
}
