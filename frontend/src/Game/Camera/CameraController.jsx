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
    const dt = Math.min(delta, 0.05);

    const jumpLift = isJumping ? Math.max(0, posY) * 0.18 : 0;
    const targetPos = new THREE.Vector3(
      posX * 0.6,
      posY + FOLLOW_OFFSET.y - jumpLift * 0.4,
      posZ + FOLLOW_OFFSET.z
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

    const wantFov = BASE_FOV + (isStumbling ? 4 : 0) + shake * 3;
    camera.fov += (wantFov - camera.fov) * Math.min(1, dt * 8);
    camera.updateProjectionMatrix();
  });

  return null;
}
