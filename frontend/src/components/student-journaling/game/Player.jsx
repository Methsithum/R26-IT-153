import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { LANES, JUMP_FORCE, RUN_SPEED } from '../../../constants/gameMaps';
import RunnerCharacter, { RunnerShadow } from './RunnerCharacter';

const GROUND_Y = 1.05;
const GRAVITY = 28;

export default function Player({ laneIndex = 1, jumpTrigger = 0, isPaused, onPositionChange }) {
  const groupRef = useRef(null);
  const pos = useRef({ x: LANES[laneIndex], y: GROUND_Y, z: 0 });
  const vy = useRef(0);
  const grounded = useRef(true);
  const jumpQueued = useRef(false);
  const targetX = useRef(LANES[laneIndex]);
  const runPhase = useRef(0);
  const visualRef = useRef(null);
  const leftLeg = useRef(null);
  const rightLeg = useRef(null);
  const leftArm = useRef(null);
  const rightArm = useRef(null);
  const shadowRef = useRef(null);

  useEffect(() => {
    targetX.current = LANES[laneIndex];
  }, [laneIndex]);

  useEffect(() => {
    jumpQueued.current = true;
  }, [jumpTrigger]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    pos.current.x = THREE.MathUtils.lerp(pos.current.x, targetX.current, 18 * dt);

    if (!isPaused) {
      pos.current.z -= RUN_SPEED * dt;
      runPhase.current += dt * 14;
    }

    if (jumpQueued.current && grounded.current && !isPaused) {
      vy.current = JUMP_FORCE;
      grounded.current = false;
      jumpQueued.current = false;
    }

    if (!grounded.current) {
      vy.current -= GRAVITY * dt;
      pos.current.y += vy.current * dt;
      if (pos.current.y <= GROUND_Y) {
        pos.current.y = GROUND_Y;
        vy.current = 0;
        grounded.current = true;
      }
    } else {
      pos.current.y = GROUND_Y;
      vy.current = 0;
    }

    if (groupRef.current) {
      groupRef.current.position.set(pos.current.x, pos.current.y, pos.current.z);
    }

    if (shadowRef.current?.material) {
      const jumpScale = grounded.current ? 1 : 0.6;
      shadowRef.current.scale.setScalar(jumpScale);
      shadowRef.current.material.opacity = grounded.current ? 0.28 : 0.12;
    }

    if (visualRef.current) {
      const swing = grounded.current ? Math.sin(runPhase.current) * 0.65 : 0.35;
      if (leftLeg.current) leftLeg.current.rotation.x = swing;
      if (rightLeg.current) rightLeg.current.rotation.x = -swing;
      if (leftArm.current) leftArm.current.rotation.x = -swing * 0.85;
      if (rightArm.current) rightArm.current.rotation.x = swing * 0.85;
      visualRef.current.position.y = grounded.current ? Math.abs(Math.sin(runPhase.current * 2)) * 0.05 : 0;
      visualRef.current.rotation.x = isPaused ? 0 : -0.2;
    }

    onPositionChange?.({ x: pos.current.x, y: pos.current.y, z: pos.current.z });
  });

  return (
    <group ref={groupRef} position={[LANES[laneIndex], GROUND_Y, 0]}>
      <RunnerShadow ref={shadowRef} />
      <RunnerCharacter
        visualRef={visualRef}
        leftLeg={leftLeg}
        rightLeg={rightLeg}
        leftArm={leftArm}
        rightArm={rightArm}
      />
    </group>
  );
}

export { GROUND_Y };
