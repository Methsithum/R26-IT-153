import { Pause } from "lucide-react";
import { isPausablePhase, useGameStore } from "../state/GameStateManager";

export default function PauseButton() {
  const phase = useGameStore((s) => s.phase);
  const paused = useGameStore((s) => s.paused);
  const restarting = useGameStore((s) => s.restarting);
  const visible = isPausablePhase(phase) && !paused && !restarting;
  if (!visible) return null;

  return (
    <button
      type="button"
      aria-label="Pause"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        useGameStore.getState().pause();
      }}
      className="pointer-events-auto absolute top-3 left-3 z-[70] flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-200/35 bg-slate-950/70 text-amber-100 shadow-[0_8px_28px_rgba(0,0,0,0.45)] backdrop-blur-md transition hover:border-amber-200/70 hover:bg-slate-900/80 hover:text-white active:scale-95 sm:top-4 sm:left-4"
    >
      <Pause className="h-5 w-5" strokeWidth={2.6} />
    </button>
  );
}
