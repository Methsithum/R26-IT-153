import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { LANES, useRunnerStore } from "../state/runnerStore";
import { PHASES, useGameStore } from "../state/GameStateManager";

const COLLECT_DEPTH = 0.7;

const RUN_PHASES = new Set([
  PHASES.RUNNING,
  PHASES.QUESTION_APPROACHING,
  PHASES.ANSWER_SELECTION,
  PHASES.ANSWER_CONFIRMED,
  PHASES.CHECKING_DATA_REQUIREMENT,
  PHASES.RUNNING_RESUMED,
  PHASES.APPROACHING_FINISH,
]);

function CoffeeMug() {
  return (
    <group>
      <mesh castShadow position={[0, 0, 0]}>
        <cylinderGeometry args={[0.16, 0.18, 0.28, 12]} />
        <meshStandardMaterial color="#f3efe6" roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 0.04, 12]} />
        <meshStandardMaterial color="#5b3218" />
      </mesh>
      <mesh position={[0.2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.09, 0.03, 8, 12, Math.PI]} />
        <meshStandardMaterial color="#f3efe6" />
      </mesh>
    </group>
  );
}

function Notes() {
  return (
    <group>
      <mesh castShadow rotation={[-0.2, 0.3, 0.1]}>
        <boxGeometry args={[0.28, 0.04, 0.36]} />
        <meshStandardMaterial color="#f7e7a8" />
      </mesh>
      <mesh position={[0.02, 0.05, -0.02]} rotation={[-0.05, -0.15, 0.05]}>
        <boxGeometry args={[0.26, 0.03, 0.34]} />
        <meshStandardMaterial color="#fffaf0" />
      </mesh>
    </group>
  );
}

export default function Pickup({ pickup }) {
  const group = useRef();
  const x = LANES[pickup.lane];

  useFrame((state) => {
    if (group.current) {
      group.current.position.y = 0.85 + Math.sin(state.clock.elapsedTime * 3 + pickup.z) * 0.12;
      group.current.rotation.y += 0.03;
    }

    const phase = useGameStore.getState().phase;
    if (useGameStore.getState().paused || !RUN_PHASES.has(phase)) return;

    const runner = useRunnerStore.getState();
    if (runner.isResolved(pickup.id)) {
      if (group.current) group.current.visible = false;
      return;
    }

    const dz = pickup.z - runner.posZ;
    if (runner.laneIndex === pickup.lane && Math.abs(dz) < COLLECT_DEPTH && runner.posY < 1.6) {
      runner.markResolved(pickup.id);
      useGameStore.getState().collectPickup();
      if (group.current) group.current.visible = false;
    }
  });

  return (
    <group ref={group} position={[x, 0.85, pickup.z]}>
      <pointLight color="#ffe08a" intensity={0.7} distance={4} />
      {pickup.kind === "notes" ? <Notes /> : <CoffeeMug />}
    </group>
  );
}
