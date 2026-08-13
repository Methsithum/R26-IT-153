import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useRunnerStore } from "../state/runnerStore";
import { PHASES, useGameStore } from "../state/GameStateManager";

const FOLLOW_OFFSET = new THREE.Vector3(0, 4.6, -7.5);
const LOOK_OFFSET = new THREE.Vector3(0, 1.6, 8);

export default function CameraController() {
  const { camera } = useThree();
  const currentPos = useRef(new THREE.Vector3(0, 4.6, -7.5));
  const currentLook = useRef(new THREE.Vector3());
  const phase = useGameStore((s) => s.phase);

  useFrame((_, delta) => {
    // During building transitions/interiors, a dedicated cinematic
    // handles the camera — see TransitionManager / BuildingInterior.
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

    const { posX, posY, posZ } = useRunnerStore.getState();
    const dt = Math.min(delta, 0.05);

    const targetPos = new THREE.Vector3(
      posX * 0.6,
      posY + FOLLOW_OFFSET.y,
      posZ + FOLLOW_OFFSET.z
    );
    const targetLook = new THREE.Vector3(posX, posY + LOOK_OFFSET.y, posZ + LOOK_OFFSET.z);

    currentPos.current.lerp(targetPos, Math.min(1, dt * 4));
    currentLook.current.lerp(targetLook, Math.min(1, dt * 6));

    camera.position.copy(currentPos.current);
    camera.lookAt(currentLook.current);
  });

  return null;
}
