import { Canvas } from "@react-three/fiber";
import { Suspense, useEffect } from "react";
import GameScene from "./GameScene";
import GameHUD from "./UI/GameHUD";
import StartScreen from "./UI/StartScreen";
import DailyCompletionScreen from "./UI/DailyCompletionScreen";
import CelebrationOverlay from "./UI/CelebrationOverlay";
import SpecialInteractionRouter from "./Building/SpecialInteractionRouter";
import InteriorExploreHUD from "./UI/InteriorExploreHUD";
import PauseButton from "./UI/PauseButton";
import PauseOverlay from "./UI/PauseOverlay";
import usePlayerControls from "./Player/usePlayerControls";
import useGameAudio from "./audio/useGameAudio";
import { PHASES, useGameStore } from "./state/GameStateManager";

export default function MainGame() {
  const phase = useGameStore((s) => s.phase);
  const paused = useGameStore((s) => s.paused);
  useGameAudio();
  usePlayerControls({
    run:
      !paused &&
      (phase === PHASES.RUNNING ||
        phase === PHASES.QUESTION_APPROACHING ||
        phase === PHASES.ANSWER_SELECTION ||
        phase === PHASES.ANSWER_CONFIRMED ||
        phase === PHASES.CHECKING_DATA_REQUIREMENT ||
        phase === PHASES.RUNNING_RESUMED ||
        phase === PHASES.APPROACHING_FINISH),
    explore: !paused && phase === PHASES.SPECIAL_INTERACTION_READY,
  });

  useEffect(() => {
    function onKeyDown(e) {
      if (e.code !== "Escape" && e.key !== "Escape") return;
      if (e.repeat) return;
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || e.target?.isContentEditable) return;
      e.preventDefault();
      useGameStore.getState().togglePause();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const insideBuilding =
    phase === PHASES.TRANSITION_TO_BUILDING ||
    phase === PHASES.ENTERING_BUILDING ||
    phase === PHASES.SPECIAL_INTERACTION_READY ||
    phase === PHASES.SPECIAL_INTERACTION_ACTIVE ||
    phase === PHASES.SPECIAL_INTERACTION_COMPLETED ||
    phase === PHASES.RETURNING_TO_CAMPUS;

  return (
    <div className="relative w-full h-screen bg-slate-950 overflow-hidden">
      <Canvas shadows camera={{ fov: 55, near: 0.1, far: 300 }}>
        <Suspense fallback={null}>
          <GameScene />
        </Suspense>
      </Canvas>

      {!insideBuilding && phase !== PHASES.DAY_CELEBRATION && phase !== PHASES.DAILY_COMPLETION && (
        <GameHUD />
      )}
      <InteriorExploreHUD />
      <SpecialInteractionRouter />
      <PauseButton />
      <PauseOverlay />

      {phase === PHASES.GAME_START && <StartScreen />}
      <CelebrationOverlay />
      {phase === PHASES.DAILY_COMPLETION && <DailyCompletionScreen />}
    </div>
  );
}
