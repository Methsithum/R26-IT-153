import { useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PHASES, useGameStore } from "../state/GameStateManager";
import { useRunnerStore } from "../state/runnerStore";
import { getBuildingById } from "../data/buildings";
import { missionLabel } from "../Environment/BuildingInterior";

function WalkStick() {
  const origin = useRef(null);

  function setFromPoint(clientX, clientY, rect) {
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const radius = rect.width * 0.42;
    const dist = Math.hypot(dx, dy);
    const scale = dist > radius ? radius / dist : 1;
    const x = (dx * scale) / radius;
    const z = (dy * scale) / radius;
    useRunnerStore.getState().setExploreInput(x, z);
    const knob = origin.current?.querySelector("[data-knob]");
    if (knob) {
      knob.style.transform = `translate(${dx * scale * 0.45}px, ${dy * scale * 0.45}px)`;
    }
  }

  function reset() {
    useRunnerStore.getState().setExploreInput(0, 0);
    const knob = origin.current?.querySelector("[data-knob]");
    if (knob) knob.style.transform = "translate(0px, 0px)";
  }

  return (
    <div
      data-explore-stick
      ref={origin}
      className="pointer-events-auto absolute bottom-6 left-5 h-28 w-28 touch-none select-none rounded-full border border-white/35 bg-slate-950/45 shadow-lg backdrop-blur-md sm:bottom-8 sm:left-8"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        setFromPoint(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect());
      }}
      onPointerMove={(e) => {
        if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
        setFromPoint(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect());
      }}
      onPointerUp={reset}
      onPointerCancel={reset}
    >
      <div
        data-knob
        className="absolute left-1/2 top-1/2 h-11 w-11 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/50 bg-white/80 shadow-md transition-transform duration-75"
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-[9px] font-semibold uppercase tracking-[0.18em] text-white/70">
        Walk
      </div>
    </div>
  );
}

export default function InteriorExploreHUD() {
  const phase = useGameStore((s) => s.phase);
  const building = getBuildingById(useGameStore((s) => s.targetBuildingId));
  const type = useGameStore((s) => s.activeQuestion?.interactionType);
  const near = useRunnerStore((s) => s.nearMission);
  const entering = phase === PHASES.ENTERING_BUILDING || phase === PHASES.TRANSITION_TO_BUILDING;
  const exploring = phase === PHASES.SPECIAL_INTERACTION_READY;

  if (!entering && !exploring) return null;

  const label = missionLabel(type);

  return (
    <div className="pointer-events-none absolute inset-0 z-30 select-none">
      <div className="absolute left-1/2 top-5 w-[min(92vw,440px)] -translate-x-1/2">
        <div className="rounded-2xl border border-white/40 bg-white/75 px-5 py-3 text-center shadow-xl backdrop-blur-md">
          <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-800/70">
            {building?.name ?? "Campus building"}
          </div>
          <div className="mt-1 text-sm font-medium text-stone-700">
            {entering ? "Doors opening — walk inside" : `Walk to the glowing ${label.toLowerCase()}`}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {exploring && near && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8 }}
            className="absolute bottom-28 left-1/2 -translate-x-1/2 rounded-full border border-amber-200/80 bg-amber-400 px-6 py-2.5 text-sm font-black uppercase tracking-[0.22em] text-slate-950 shadow-lg"
          >
            Press E · Opening
          </motion.div>
        )}
      </AnimatePresence>

      {exploring && (
        <>
          <WalkStick />
          <div className="absolute bottom-6 right-5 rounded-xl border border-white/30 bg-slate-950/55 px-3 py-2 text-[11px] text-slate-100 backdrop-blur-md sm:right-8">
            Drag to look around · WASD or stick to walk
          </div>
        </>
      )}
    </div>
  );
}
