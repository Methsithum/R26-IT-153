import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { LANES, useRunnerStore } from "../state/runnerStore";
import { PHASES, useGameStore } from "../state/GameStateManager";
import { Bench, Barrier, CampusSign, Construction, CLEARANCE_BY_KIND } from "./props";

const OBSTACLE_COMPONENTS = {
  bench: Bench,
  barrier: Barrier,
  sign: CampusSign,
  construction: Construction,
};

const HIT_DEPTH = 0.72;

function isCleared(obstacle, runner) {
  const clearance = obstacle.clearance || CLEARANCE_BY_KIND[obstacle.kind] || "block";
  if (clearance === "jump") return runner.isJumping;
  if (clearance === "slide") return runner.isSliding;
  return false;
}

const RUN_PHASES = new Set([
  PHASES.RUNNING,
  PHASES.QUESTION_APPROACHING,
  PHASES.ANSWER_SELECTION,
  PHASES.ANSWER_CONFIRMED,
  PHASES.CHECKING_DATA_REQUIREMENT,
  PHASES.RUNNING_RESUMED,
]);

const TELEGRAPH = {
  jump: "#34d399",
  slide: "#fbbf24",
  block: "#f43f5e",
};

export default function Obstacle({ obstacle }) {
  const Comp = OBSTACLE_COMPONENTS[obstacle.kind] ?? Barrier;
  const x = LANES[obstacle.lane];
  const overlapping = useRef(false);
  const clearance = obstacle.clearance || CLEARANCE_BY_KIND[obstacle.kind] || "block";

  useFrame(() => {
    const phase = useGameStore.getState().phase;
    if (!RUN_PHASES.has(phase)) return;

    const runner = useRunnerStore.getState();
    if (runner.isResolved(obstacle.id)) return;

    const dz = obstacle.z - runner.posZ;
    const sameLane = runner.laneIndex === obstacle.lane;
    const inHit = sameLane && Math.abs(dz) < HIT_DEPTH;

    if (inHit) {
      overlapping.current = true;
      if (!isCleared(obstacle, runner)) {
        runner.markResolved(obstacle.id);
        useGameStore.getState().takeHit();
      }
      return;
    }

    if (overlapping.current && runner.posZ > obstacle.z + HIT_DEPTH) {
      overlapping.current = false;
      runner.markResolved(obstacle.id);
      useGameStore.getState().registerNearMiss();
    } else if (!overlapping.current && runner.posZ > obstacle.z + HIT_DEPTH) {
      runner.markResolved(obstacle.id);
    }
  });

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.04, obstacle.z]}>
        <ringGeometry args={[0.52, 0.78, 24]} />
        <meshBasicMaterial
          color={TELEGRAPH[clearance] || TELEGRAPH.block}
          transparent
          opacity={0.55}
          depthWrite={false}
        />
      </mesh>
      <Comp position={[x, 0, obstacle.z]} />
    </group>
  );
}
