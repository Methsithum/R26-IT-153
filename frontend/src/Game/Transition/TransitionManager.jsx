import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { PHASES, useGameStore } from "../state/GameStateManager";
import { getBuildingById } from "../data/buildings";
import { interiorAnchor } from "../Environment/BuildingInterior";
import BuildingInterior from "../Environment/BuildingInterior";

const TO_BUILDING_DURATION = 1.8;
const ENTER_DURATION = 1.35;
const RETURN_DURATION = 1.6;

// Runs the scripted camera cinematic for entering/exiting a building, and
// advances the state machine forward through the transition phases.
// The 3D counterpart of this is intentionally simple/fast — a few seconds
// of camera movement, never a loading screen.
export default function TransitionManager() {
  const { camera } = useThree();
  const phase = useGameStore((s) => s.phase);
  const targetBuildingId = useGameStore((s) => s.targetBuildingId);
  const transitionEntryZ = useGameStore((s) => s.transitionEntryZ);

  const elapsed = useRef(0);
  const firedRef = useRef(false);
  const fromPos = useRef(new THREE.Vector3());

  useEffect(() => {
    elapsed.current = 0;
    firedRef.current = false;
    fromPos.current.copy(camera.position);
  }, [phase, camera]);

  const building = getBuildingById(targetBuildingId);
  const [ix, iy, iz] = interiorAnchor(transitionEntryZ);
  const side = building?.laneSide === "left" ? -1 : 1;

  useFrame((_, delta) => {
    elapsed.current += delta;

    if (phase === PHASES.TRANSITION_TO_BUILDING) {
      const t = Math.min(1, elapsed.current / TO_BUILDING_DURATION);
      const ease = 1 - Math.pow(1 - t, 3);
      const entrancePos = new THREE.Vector3(ix + side * -6.5, 3.6, iz + 5.2);
      camera.position.lerpVectors(fromPos.current, entrancePos, ease);
      camera.lookAt(ix, 1.8, iz - 1);
      if (t >= 1 && !firedRef.current) {
        firedRef.current = true;
        useGameStore.getState().buildingTransitionComplete();
      }
    }

    if (phase === PHASES.ENTERING_BUILDING) {
      const t = Math.min(1, elapsed.current / ENTER_DURATION);
      const ease = 1 - Math.pow(1 - t, 3);
      const start = new THREE.Vector3(ix + side * -6.5, 3.6, iz + 5.2);
      const inside = new THREE.Vector3(ix, 2.35, iz + 3.4);
      camera.position.lerpVectors(start, inside, ease);
      camera.lookAt(ix, 1.55, iz - 2.8);
      if (t >= 1 && !firedRef.current) {
        firedRef.current = true;
        useGameStore.getState().buildingEntered();
        setTimeout(() => useGameStore.getState().startSpecialInteraction(), 900);
      }
    }

    if (
      [
        PHASES.SPECIAL_INTERACTION_READY,
        PHASES.SPECIAL_INTERACTION_ACTIVE,
        PHASES.SPECIAL_INTERACTION_COMPLETED,
      ].includes(phase)
    ) {
      camera.position.set(ix, 2.35, iz + 3.4);
      camera.lookAt(ix, 1.55, iz - 2.8);
    }

    if (phase === PHASES.RETURNING_TO_CAMPUS) {
      const t = Math.min(1, elapsed.current / RETURN_DURATION);
      const ease = 1 - Math.pow(1 - t, 3);
      const inside = new THREE.Vector3(ix, 2.35, iz + 3.4);
      const back = new THREE.Vector3(0, 4.6, transitionEntryZ - 7.5);
      camera.position.lerpVectors(inside, back, ease);
      camera.lookAt(0, 1.6, transitionEntryZ + 8);
      if (t >= 1 && !firedRef.current) {
        firedRef.current = true;
        useGameStore.getState().returnTransitionComplete();
      }
    }
  });

  const showInterior = [
    PHASES.TRANSITION_TO_BUILDING,
    PHASES.ENTERING_BUILDING,
    PHASES.SPECIAL_INTERACTION_READY,
    PHASES.SPECIAL_INTERACTION_ACTIVE,
    PHASES.SPECIAL_INTERACTION_COMPLETED,
    PHASES.RETURNING_TO_CAMPUS,
  ].includes(phase);

  if (!showInterior) return null;
  return <BuildingInterior entryZ={transitionEntryZ} building={building} />;
}
