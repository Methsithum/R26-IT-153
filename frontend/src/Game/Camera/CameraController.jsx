import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useRunnerStore } from "../state/runnerStore";
import { PHASES, useGameStore } from "../state/GameStateManager";

const FOLLOW_OFFSET = new THREE.Vector3(0, 4.6, -7.5);
const LOOK_OFFSET = new THREE.Vector3(0, 1.6, 8);
const BASE_FOV = 55;

export default function CameraController() {
  const { camera } = useThree();
  const currentPos = useRef(new THREE.Vector3(0, 4.6, -7.5));
  const currentLook = useRef(new THREE.Vector3());
  const phase = useGameStore((s) => s.phase);
  const lastPhase = useRef(phase);

  useFrame((_, delta) => {
    if (lastPhase.current !== phase) {
      lastPhase.current = phase;
      currentPos.current.copy(camera.position);
      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      currentLook.current.copy(camera.position).addScaledVector(fwd, 8);
    }

    if (
      [
        PHASES.TRANSITION_TO_BUILDING,
        PHASES.ENTERING_BUILDING,
        PHASES.SPECIAL_INTERACTION_READY,
        PHASES.SPECIAL_INTERACTION_ACTIVE,
        PHASES.SPECIAL_INTERACTION_COMPLETED,
        PHASES.RETURNING_TO_CAMPUS,
      ].includes(phase)
    ) {
      return;
    }

    const { posX, posY, posZ, shake, isJumping, isStumbling } = useRunnerStore.getState();
    const combo = useGameStore.getState().combo;
    const dt = Math.min(delta, 0.05);
    const celebrating = phase === PHASES.DAY_CELEBRATION;
    const approaching = phase === PHASES.APPROACHING_FINISH;

    const jumpLift = isJumping ? Math.max(0, posY) * 0.18 : 0;
    const targetPos = new THREE.Vector3(
      posX * 0.6,
      posY + FOLLOW_OFFSET.y - jumpLift * 0.4 + (celebrating ? 0.55 : approaching ? 0.2 : 0),
      posZ + FOLLOW_OFFSET.z - (celebrating ? 0.8 : 0)
    );
    const targetLook = new THREE.Vector3(posX, posY + LOOK_OFFSET.y, posZ + LOOK_OFFSET.z);

    currentPos.current.lerp(targetPos, Math.min(1, dt * 4.4));
    currentLook.current.lerp(targetLook, Math.min(1, dt * 6.2));

    if (shake > 0.02) {
      currentPos.current.x += (Math.random() - 0.5) * shake * 0.55;
      currentPos.current.y += (Math.random() - 0.5) * shake * 0.32;
    }

    camera.position.copy(currentPos.current);
    camera.lookAt(currentLook.current);

    const rush = combo >= 5 ? 5 : combo >= 3 ? 2 : 0;
    const wantFov = BASE_FOV + (isStumbling ? 4 : 0) + shake * 3 + rush + (celebrating ? 7 : approaching ? 2.5 : 0);
    camera.fov += (wantFov - camera.fov) * Math.min(1, dt * 8);
    camera.updateProjectionMatrix();
  });

  return null;
}
