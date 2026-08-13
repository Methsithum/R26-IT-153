import { RigidBody } from "@react-three/rapier";
import { LANES } from "../state/runnerStore";
import { useGameStore } from "../state/GameStateManager";
import { Bench, Barrier, CampusSign, Construction } from "./props";

const OBSTACLE_COMPONENTS = {
  bench: Bench,
  barrier: Barrier,
  sign: CampusSign,
  construction: Construction,
};

function handleHit() {
  // Light, non-punishing feedback — small score dip, no game-over.
  const store = useGameStore.getState();
  useGameStore.setState({ score: Math.max(0, store.score - 20) });
}

export default function Obstacle({ obstacle }) {
  const Comp = OBSTACLE_COMPONENTS[obstacle.kind] ?? Barrier;
  const x = LANES[obstacle.lane];

  return (
    <RigidBody type="fixed" colliders="cuboid" sensor onIntersectionEnter={handleHit}>
      <Comp position={[x, 0, obstacle.z]} />
    </RigidBody>
  );
}
