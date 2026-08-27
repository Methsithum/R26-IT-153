import { Physics } from "@react-three/rapier";
import { Sky } from "@react-three/drei";
import Player from "./Player/Player";
import CameraController from "./Camera/CameraController";
import CampusEnvironment from "./Environment/CampusEnvironment";
import QuestionSystem from "./Question/QuestionSystem";
import FinishLine from "./Environment/FinishLine";
import TransitionManager from "./Transition/TransitionManager";
import { PHASES, useGameStore } from "./state/GameStateManager";
import { useActiveMap } from "./state/mapStore";

export default function GameScene() {
  const phase = useGameStore((s) => s.phase);
  const paused = useGameStore((s) => s.paused);
  const map = useActiveMap();
  const physicsPaused = paused || phase === PHASES.GAME_PAUSED || phase === PHASES.GAME_START;

  return (
    <>
      <color attach="background" args={[map.fog.color]} />
      <fog attach="fog" args={[map.fog.color, map.fog.near, map.fog.far]} />
      <Sky
        sunPosition={map.sky.sunPosition}
        turbidity={map.sky.turbidity}
        rayleigh={map.sky.rayleigh}
      />
      <hemisphereLight args={[map.lights.hemiSky, map.lights.hemiGround, map.lights.hemi]} />
      <directionalLight
        castShadow
        position={map.lights.sunPos}
        intensity={map.lights.sun}
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
