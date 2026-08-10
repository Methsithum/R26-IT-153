import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { LANES, JUMP_FORCE, RUN_SPEED } from '../../../constants/gameMaps';
import GltfRunner, { RunnerShadow } from './GltfRunner';

const GROUND_Y = 1.05;
const GRAVITY = 28;

export default function Player({
  laneIndexRef,
  jumpQueuedRef,
  haltMovement = false,
  onPositionChange,
}) {
  const groupRef = useRef(null);
  const startLane = laneIndexRef?.current ?? 1;
  const pos = useRef({ x: LANES[startLane], y: GROUND_Y, z: 0 });
  const vy = useRef(0);
  const grounded = useRef(true);
  const targetX = useRef(LANES[startLane]);
  const visualRef = useRef(null);
  const shadowRef = useRef(null);
  const isJumpingRef = useRef(false);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const laneIndex = laneIndexRef?.current ?? 1;
    targetX.current = LANES[laneIndex];
    pos.current.x = THREE.MathUtils.lerp(pos.current.x, targetX.current, 18 * dt);

    if (!haltMovement) {
      pos.current.z -= RUN_SPEED * dt;
    }

    if (jumpQueuedRef?.current && grounded.current && !haltMovement) {
      vy.current = JUMP_FORCE;
      grounded.current = false;
      jumpQueuedRef.current = false;
    }

    if (!grounded.current) {
      vy.current -= GRAVITY * dt;
      pos.current.y += vy.current * dt;
      isJumpingRef.current = true;
      if (pos.current.y <= GROUND_Y) {
        pos.current.y = GROUND_Y;
        vy.current = 0;
        grounded.current = true;
        isJumpingRef.current = false;
      }
    } else {
      pos.current.y = GROUND_Y;
      vy.current = 0;
      isJumpingRef.current = false;
    }

    if (groupRef.current) {
      groupRef.current.position.set(pos.current.x, pos.current.y, pos.current.z);
    }

    if (shadowRef.current?.material) {
      const jumpScale = grounded.current ? 1 : 0.6;
      shadowRef.current.scale.setScalar(jumpScale);
      shadowRef.current.material.opacity = grounded.current ? 0.28 : 0.12;
    }

    onPositionChange?.({ x: pos.current.x, y: pos.current.y, z: pos.current.z });
  });

  return (
    <group ref={groupRef} position={[LANES[startLane], GROUND_Y, 0]}>
      <RunnerShadow ref={shadowRef} />
      <GltfRunner
        visualRef={visualRef}
        haltMovement={haltMovement}
        isJumpingRef={isJumpingRef}
      />
    </group>
  );
}

export { GROUND_Y };
