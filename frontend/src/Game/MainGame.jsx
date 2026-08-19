import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import GameScene from "./GameScene";
import GameHUD from "./UI/GameHUD";
import StartScreen from "./UI/StartScreen";
import DailyCompletionScreen from "./UI/DailyCompletionScreen";
import SpecialInteractionRouter from "./Building/SpecialInteractionRouter";
import InteriorExploreHUD from "./UI/InteriorExploreHUD";
import usePlayerControls from "./Player/usePlayerControls";
import { PHASES, useGameStore } from "./state/GameStateManager";

export default function MainGame() {
  const phase = useGameStore((s) => s.phase);
  usePlayerControls({
    run:
      phase === PHASES.RUNNING ||
      phase === PHASES.QUESTION_APPROACHING ||
      phase === PHASES.ANSWER_SELECTION ||
      phase === PHASES.ANSWER_CONFIRMED ||
      phase === PHASES.CHECKING_DATA_REQUIREMENT ||
      phase === PHASES.RUNNING_RESUMED,
    explore: phase === PHASES.SPECIAL_INTERACTION_READY,
  });

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

      {!insideBuilding && <GameHUD />}
      <InteriorExploreHUD />
      <SpecialInteractionRouter />

      {phase === PHASES.GAME_START && <StartScreen />}
      {phase === PHASES.DAILY_COMPLETION && <DailyCompletionScreen />}
    </div>
  );
}
