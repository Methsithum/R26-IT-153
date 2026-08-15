import { useRef, useMemo, Suspense } from "react";
import { useFrame } from "@react-three/fiber";
import { RigidBody, CapsuleCollider } from "@react-three/rapier";
import { useRunnerStore } from "../state/runnerStore";
import { PHASES, useGameStore } from "../state/GameStateManager";
import CharacterModel from "./CharacterModel";

const JUMP_HEIGHT = 2.6;
const JUMP_DURATION = 0.62;
const SLIDE_DURATION = 0.55;
const GROUND_Y = 0.95;

/**
 * Capsule fallback shown while the Mixamo Remy FBX parses.
 * CharacterModel (remy-running.fbx) is the live runner once loaded.
 */
function CharacterMesh({ runPhase, crouch }) {
  const leftArm = useRef();
  const rightArm = useRef();
  const leftLeg = useRef();
  const rightLeg = useRef();

  useFrame(() => {
    const swing = Math.sin(runPhase.current) * 0.9;
    if (leftArm.current) leftArm.current.rotation.x = -swing;
    if (rightArm.current) rightArm.current.rotation.x = swing;
    if (leftLeg.current) leftLeg.current.rotation.x = swing;
    if (rightLeg.current) rightLeg.current.rotation.x = -swing;
  });

  return (
    <group scale={[1, crouch ? 0.55 : 1, 1]} position={[0, crouch ? -0.35 : 0, 0]}>
      {/* torso */}
      <mesh castShadow position={[0, 1.05, 0]}>
        <capsuleGeometry args={[0.28, 0.55, 4, 8]} />
        <meshStandardMaterial color="#2f5fb3" />
      </mesh>
      {/* head */}
      <mesh castShadow position={[0, 1.68, 0]}>
        <sphereGeometry args={[0.24, 16, 16]} />
        <meshStandardMaterial color="#e8b48a" />
      </mesh>
      {/* backpack */}
      <mesh position={[0, 1.1, -0.28]}>
        <boxGeometry args={[0.32, 0.4, 0.18]} />
        <meshStandardMaterial color="#5a3d2b" />
      </mesh>
      {/* arms */}
      <group ref={leftArm} position={[-0.38, 1.25, 0]}>
        <mesh castShadow position={[0, -0.32, 0]}>
          <capsuleGeometry args={[0.08, 0.5, 4, 8]} />
          <meshStandardMaterial color="#e8b48a" />
        </mesh>
      </group>
      <group ref={rightArm} position={[0.38, 1.25, 0]}>
        <mesh castShadow position={[0, -0.32, 0]}>
          <capsuleGeometry args={[0.08, 0.5, 4, 8]} />
          <meshStandardMaterial color="#e8b48a" />
        </mesh>
      </group>
      {/* legs */}
      <group ref={leftLeg} position={[-0.15, 0.68, 0]}>
        <mesh castShadow position={[0, -0.35, 0]}>
          <capsuleGeometry args={[0.11, 0.55, 4, 8]} />
          <meshStandardMaterial color="#22314f" />
        </mesh>
      </group>
      <group ref={rightLeg} position={[0.15, 0.68, 0]}>
        <mesh castShadow position={[0, -0.35, 0]}>
          <capsuleGeometry args={[0.11, 0.55, 4, 8]} />
          <meshStandardMaterial color="#22314f" />
        </mesh>
      </group>
    </group>
  );
}

export default function Player() {
  const bodyRef = useRef();
  const groupRef = useRef();
  const runPhase = useRef(0);
  const jumpElapsed = useRef(0);
  const slideElapsed = useRef(0);

  const speed = useGameStore((s) => s.speed);
  const phase = useGameStore((s) => s.phase);

  const isFrozen = useMemo(
    () =>
      [
        PHASES.GAME_START,
        PHASES.TRANSITION_TO_BUILDING,
        PHASES.ENTERING_BUILDING,
        PHASES.SPECIAL_INTERACTION_READY,
        PHASES.SPECIAL_INTERACTION_ACTIVE,
        PHASES.SPECIAL_INTERACTION_COMPLETED,
        PHASES.RETURNING_TO_CAMPUS,
        PHASES.DAILY_COMPLETION,
        PHASES.GAME_PAUSED,
      ].includes(phase),
    [phase]
  );

  useFrame((_, delta) => {
    const store = useRunnerStore.getState();
    const dt = Math.min(delta, 0.05);

    // forward auto-run
    if (!isFrozen) {
      const nextZ = store.posZ + speed * dt;
      store.setDistance(store.distance + speed * dt);
      runPhase.current += dt * (8 + speed * 0.4);

      // lane lerp
      const nextX = store.posX + (store.targetX - store.posX) * Math.min(1, dt * 10);

      // jump arc
      let nextY = GROUND_Y;
      if (store.isJumping) {
        jumpElapsed.current += dt;
        const t = Math.min(1, jumpElapsed.current / JUMP_DURATION);
        const arc = Math.sin(t * Math.PI);
        nextY = GROUND_Y + arc * JUMP_HEIGHT;
        if (t >= 1) {
          jumpElapsed.current = 0;
          store.endJump();
        }
      } else {
        jumpElapsed.current = 0;
      }

      if (store.isSliding) {
        slideElapsed.current += dt;
        if (slideElapsed.current >= SLIDE_DURATION) {
          slideElapsed.current = 0;
          store.endSlide();
        }
      } else {
        slideElapsed.current = 0;
      }

      store.setPosition(nextX, nextY, nextZ);

      if (groupRef.current) {
        groupRef.current.rotation.y = (store.targetX - store.posX) * -0.08;
      }
      if (bodyRef.current) {
        bodyRef.current.setNextKinematicTranslation({ x: nextX, y: nextY, z: nextZ });
      }
    }
  });

  const isSliding = useRunnerStore((s) => s.isSliding);

  return (
    <RigidBody
      ref={bodyRef}
      type="kinematicPosition"
      colliders={false}
      position={[0, GROUND_Y, 0]}
    >
      <CapsuleCollider args={[0.45, 0.32]} />
      <group ref={groupRef}>
        <Suspense fallback={<CharacterMesh runPhase={runPhase} crouch={isSliding} />}>
          <CharacterModel crouch={isSliding} />
        </Suspense>
      </group>
    </RigidBody>
  );
}
