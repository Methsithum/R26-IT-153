import { Physics } from "@react-three/rapier";
import { Sky } from "@react-three/drei";
import Player from "./Player/Player";
import CameraController from "./Camera/CameraController";
import CampusEnvironment from "./Environment/CampusEnvironment";
import QuestionSystem from "./Question/QuestionSystem";
import FinishLine from "./Environment/FinishLine";
import TransitionManager from "./Transition/TransitionManager";
import { PHASES, useGameStore } from "./state/GameStateManager";

export default function GameScene() {
  const phase = useGameStore((s) => s.phase);
  const physicsPaused = phase === PHASES.GAME_PAUSED || phase === PHASES.GAME_START;

  return (
    <>
      <Sky sunPosition={[80, 60, 50]} turbidity={4} rayleigh={1.2} />
      <hemisphereLight args={["#dceeff", "#4a5a3a", 0.65]} />
      <directionalLight
        castShadow
        position={[40, 60, -20]}
        intensity={1.4}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
      />

      <Physics paused={physicsPaused} gravity={[0, -28, 0]}>
        <Player />
        <CampusEnvironment />
      </Physics>

      <QuestionSystem />
      <FinishLine />
      <TransitionManager />
      <CameraController />
    </>
  );
}
