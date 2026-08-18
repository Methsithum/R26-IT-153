import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { PHASES, useGameStore } from "../state/GameStateManager";
import { useRunnerStore } from "../state/runnerStore";
import { getBuildingById } from "../data/buildings";
import {
  interiorAnchor,
  interiorWorld,
  DOOR_LOCAL_Z,
  ENTER_START_Z,
  GROUND_Y,
  CAM_INNER,
} from "../Environment/BuildingInterior";
import BuildingInterior from "../Environment/BuildingInterior";

const TO_BUILDING_DURATION = 1.7;
const ENTER_DURATION = 2.05;
const RETURN_DURATION = 1.6;
const FOLLOW_DIST = 3.35;

function followCameraTarget(runner, ix, iz, dist = FOLLOW_DIST) {
  const yaw = runner.lookYaw;
  const pitch = runner.lookPitch;
  const cp = Math.cos(pitch);
  let scale = 1;
  const ox0 = Math.sin(yaw) * dist * cp;
  const oz0 = Math.cos(yaw) * dist * cp;
  const oy = Math.min(3.4, runner.posY + dist * Math.sin(pitch) + 1.05);

  const minX = ix + CAM_INNER.minX;
  const maxX = ix + CAM_INNER.maxX;
  const minZ = iz + CAM_INNER.minZ;
  const maxZ = iz + CAM_INNER.maxZ;

  for (let i = 0; i < 10; i++) {
    const x = runner.posX + ox0 * scale;
    const z = runner.posZ + oz0 * scale;
    if (x >= minX && x <= maxX && z >= minZ && z <= maxZ) {
      return new THREE.Vector3(x, Math.max(1.15, oy), z);
    }
    scale *= 0.78;
  }
  return new THREE.Vector3(
    Math.min(maxX, Math.max(minX, runner.posX + ox0 * scale)),
    Math.max(1.15, oy),
    Math.min(maxZ, Math.max(minZ, runner.posZ + oz0 * scale))
  );
}

export default function TransitionManager() {
  const { camera } = useThree();
  const phase = useGameStore((s) => s.phase);
  const targetBuildingId = useGameStore((s) => s.targetBuildingId);
  const transitionEntryZ = useGameStore((s) => s.transitionEntryZ);
  const interactionType = useGameStore((s) => s.activeQuestion?.interactionType);

  const elapsed = useRef(0);
  const firedRef = useRef(false);
  const lastPhase = useRef(phase);
  const fromPos = useRef(new THREE.Vector3());
  const camPos = useRef(new THREE.Vector3());
  const camLook = useRef(new THREE.Vector3());

  const building = getBuildingById(targetBuildingId);
  const [ix, , iz] = interiorAnchor(transitionEntryZ);

  useFrame((_, delta) => {
    if (lastPhase.current !== phase) {
      lastPhase.current = phase;
      elapsed.current = 0;
      firedRef.current = false;
      fromPos.current.copy(camera.position);
      camPos.current.copy(camera.position);
      camLook.current.set(ix, 1.15, iz + ENTER_START_Z);

      if (phase === PHASES.TRANSITION_TO_BUILDING) {
        const runner = useRunnerStore.getState();
        const [wx, wy, wz] = interiorWorld(transitionEntryZ, 0, DOOR_LOCAL_Z);
        runner.setPosition(wx, wy, wz);
        runner.setFacingYaw(Math.PI);
        runner.setDoorOpen(0);
        runner.setEnterProgress(0);
        runner.setExploreInput(0, 0);
        runner.setNearMission(false);
        runner.setLook(0, 0.32);
        runner.setLookLocked(false);
      }

      if (phase === PHASES.RETURNING_TO_CAMPUS) {
        useRunnerStore.getState().restoreCampus();
      }
    }

    elapsed.current += delta;
    const dt = Math.min(delta, 0.05);
    const runner = useRunnerStore.getState();

    if (phase === PHASES.TRANSITION_TO_BUILDING) {
      const t = Math.min(1, elapsed.current / TO_BUILDING_DURATION);
      const ease = 1 - Math.pow(1 - t, 3);
      const entrance = new THREE.Vector3(ix, 2.4, iz + DOOR_LOCAL_Z + 3.6);
      camera.position.lerpVectors(fromPos.current, entrance, ease);
      camera.lookAt(ix, 1.3, iz + ENTER_START_Z);
      if (t >= 1 && !firedRef.current) {
        firedRef.current = true;
        useGameStore.getState().buildingTransitionComplete();
      }
    }

    if (phase === PHASES.ENTERING_BUILDING) {
      const t = Math.min(1, elapsed.current / ENTER_DURATION);
      runner.setEnterProgress(t);
      runner.setDoorOpen(Math.min(1, t / 0.28));

      const behind = followCameraTarget(runner, ix, iz, 3.2);
      camPos.current.lerp(behind, Math.min(1, dt * 5.5));
      camLook.current.lerp(
        new THREE.Vector3(runner.posX, runner.posY + 1.15, runner.posZ),
        Math.min(1, dt * 6)
      );
      camera.position.copy(camPos.current);
      camera.lookAt(camLook.current);

      if (t >= 1 && !firedRef.current) {
        firedRef.current = true;
        useGameStore.getState().buildingEntered();
      }
    }

    if (
      phase === PHASES.SPECIAL_INTERACTION_READY ||
      phase === PHASES.SPECIAL_INTERACTION_ACTIVE ||
      phase === PHASES.SPECIAL_INTERACTION_COMPLETED
    ) {
      const target = followCameraTarget(runner, ix, iz);
      camPos.current.lerp(target, Math.min(1, dt * 14));
      camLook.current.lerp(
        new THREE.Vector3(runner.posX, runner.posY + 1.15, runner.posZ),
        Math.min(1, dt * 16)
      );
      camera.position.copy(camPos.current);
      camera.lookAt(camLook.current);
      camera.fov += (50 - camera.fov) * Math.min(1, dt * 6);
      camera.updateProjectionMatrix();
    }

    if (phase === PHASES.RETURNING_TO_CAMPUS) {
      const t = Math.min(1, elapsed.current / RETURN_DURATION);
      const ease = 1 - Math.pow(1 - t, 3);
      const back = new THREE.Vector3(runner.posX * 0.6, GROUND_Y + 4.6, runner.posZ - 7.5);
      camera.position.lerpVectors(fromPos.current, back, ease);
      camera.lookAt(runner.posX, GROUND_Y + 1.6, runner.posZ + 8);
      runner.setDoorOpen(Math.max(0, 1 - t * 1.4));
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
  return (
    <BuildingInterior
      entryZ={transitionEntryZ}
      building={building}
      interactionType={interactionType}
      exploring={phase === PHASES.SPECIAL_INTERACTION_READY}
    />
  );
}
