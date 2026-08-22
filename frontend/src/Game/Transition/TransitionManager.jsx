import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { PHASES, useGameStore } from "../state/GameStateManager";
import { useRunnerStore } from "../state/runnerStore";
import { getBuildingById } from "../data/buildings";
import {
  interiorAnchor,
  interiorWorld,
  APPROACH_Z,
  DOOR_LOCAL_Z,
  GROUND_Y,
  CAM_INNER,
} from "../Environment/BuildingInterior";
import { nearbyDoor } from "../Environment/landmark";
import BuildingInterior from "../Environment/BuildingInterior";

const TO_BUILDING_DURATION = 1.05;
const ENTER_DURATION = 2.7;
const DOOR_OPEN_PORTION = 0.26;
const RETURN_DURATION = 1.4;
const RETURN_CUT = 0.4;
const FOLLOW_DIST = 3.35;
const UP = new THREE.Vector3(0, 1, 0);
const LOOK_M = new THREE.Matrix4();

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function setLook(camera, look, quat) {
  LOOK_M.lookAt(camera.position, look, UP);
  quat.setFromRotationMatrix(LOOK_M);
  camera.quaternion.copy(quat);
}

function followCameraTarget(runner, ix, iz, dist = FOLLOW_DIST, clamp = true) {
  const yaw = runner.lookYaw;
  const pitch = runner.lookPitch;
  const cp = Math.cos(pitch);
  const ox0 = Math.sin(yaw) * dist * cp;
  const oz0 = Math.cos(yaw) * dist * cp;
  const oy = Math.min(3.4, runner.posY + dist * Math.sin(pitch) + 1.05);
  const behind = new THREE.Vector3(
    runner.posX + ox0,
    Math.max(1.15, oy),
    runner.posZ + oz0
  );
  if (!clamp) return behind;

  const minX = ix + CAM_INNER.minX;
  const maxX = ix + CAM_INNER.maxX;
  const minZ = iz + CAM_INNER.minZ;
  const maxZ = iz + CAM_INNER.maxZ;

  let scale = 1;
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

function interiorDoorCam(ix, iz) {
  return new THREE.Vector3(ix, 1.62, iz + APPROACH_Z + 1.85);
}

function interiorDoorLook(ix, iz) {
  return new THREE.Vector3(ix, 1.36, iz + DOOR_LOCAL_Z);
}

function roadEyeCam(posX, posZ) {
  return new THREE.Vector3(posX * 0.45, 1.58, posZ - 2.55);
}

function roadEyeLook(posX, posZ) {
  return new THREE.Vector3(posX, 1.42, posZ + 5.2);
}

export default function TransitionManager() {
  const { camera } = useThree();
  const phase = useGameStore((s) => s.phase);
  const targetBuildingId = useGameStore((s) => s.targetBuildingId);
  const transitionEntryZ = useGameStore((s) => s.transitionEntryZ);
  const activeQuestion = useGameStore((s) => s.activeQuestion);

  const elapsed = useRef(0);
  const firedRef = useRef(false);
  const lastPhase = useRef(phase);
  const fromPos = useRef(new THREE.Vector3());
  const fromLook = useRef(new THREE.Vector3());
  const camPos = useRef(new THREE.Vector3());
  const camLook = useRef(new THREE.Vector3());
  const lookQuat = useRef(new THREE.Quaternion());
  const restoredRef = useRef(false);

  const building = getBuildingById(targetBuildingId);
  const [ix, , iz] = interiorAnchor(transitionEntryZ);

  useFrame((_, delta) => {
    if (lastPhase.current !== phase) {
      lastPhase.current = phase;
      elapsed.current = 0;
      firedRef.current = false;
      fromPos.current.copy(camera.position);
      camPos.current.copy(camera.position);

      if (phase === PHASES.TRANSITION_TO_BUILDING) {
        const runner = useRunnerStore.getState();
        runner.setDoorOpen(0);
        runner.setEnterProgress(0);
        runner.setVisitFade(0);
        runner.setExploreInput(0, 0);
        runner.setNearMission(false);
        runner.setLookLocked(false);
        fromLook.current.set(runner.posX, runner.posY + 1.6, runner.posZ + 8);
        camLook.current.copy(fromLook.current);
      } else if (phase === PHASES.ENTERING_BUILDING) {
        const runner = useRunnerStore.getState();
        const [wx, wy, wz] = interiorWorld(transitionEntryZ, 0, APPROACH_Z);
        runner.setPosition(wx, wy, wz);
        runner.setFacingYaw(Math.PI);
        runner.setEnterProgress(0);
        runner.setDoorOpen(0);
        runner.setLook(0, 0.28);
        runner.setVisitFade(1);
        const entrance = interiorDoorCam(ix, iz);
        const look = interiorDoorLook(ix, iz);
        fromPos.current.copy(entrance);
        camPos.current.copy(entrance);
        fromLook.current.copy(look);
        camLook.current.copy(look);
        camera.position.copy(entrance);
        setLook(camera, look, lookQuat.current);
      } else if (phase === PHASES.RETURNING_TO_CAMPUS) {
        const runner = useRunnerStore.getState();
        restoredRef.current = false;
        fromLook.current.set(runner.posX, runner.posY + 1.15, runner.posZ);
        camLook.current.copy(fromLook.current);
      }
    }

    elapsed.current += delta;
    const dt = Math.min(delta, 0.05);
    const runner = useRunnerStore.getState();

    if (phase === PHASES.TRANSITION_TO_BUILDING) {
      const t = Math.min(1, elapsed.current / TO_BUILDING_DURATION);
      const u = easeInOutCubic(t);
      const door = nearbyDoor(targetBuildingId, runner.posZ);
      const eye = roadEyeCam(runner.posX, runner.posZ);
      const look = roadEyeLook(runner.posX, runner.posZ);
      if (door.close) {
        look.x += (door.doorX - look.x) * 0.28;
        look.z += (door.doorZ - look.z) * 0.18;
        eye.x += (door.doorX - eye.x) * 0.12;
      }

      camera.position.lerpVectors(fromPos.current, eye, u);
      camLook.current.lerpVectors(fromLook.current, look, u);
      setLook(camera, camLook.current, lookQuat.current);
      camera.fov += (50 - camera.fov) * Math.min(1, dt * 5);
      camera.updateProjectionMatrix();
      runner.setVisitFade(easeOutCubic(Math.max(0, (t - 0.42) / 0.58)));
      runner.setEnterProgress(t);

      if (t >= 1 && !firedRef.current) {
        firedRef.current = true;
        useGameStore.getState().buildingTransitionComplete();
      }
    }

    if (phase === PHASES.ENTERING_BUILDING) {
      const t = Math.min(1, elapsed.current / ENTER_DURATION);
      runner.setVisitFade(Math.max(0, 1 - t / 0.22));
      runner.setDoorOpen(Math.min(1, t / DOOR_OPEN_PORTION));
      const walkT = t <= DOOR_OPEN_PORTION ? 0 : (t - DOOR_OPEN_PORTION) / (1 - DOOR_OPEN_PORTION);
      runner.setEnterProgress(walkT);

      const behind = followCameraTarget(runner, ix, iz, 3.45, false);
      camPos.current.lerp(behind, Math.min(1, dt * 4.2));
      camLook.current.lerp(
        new THREE.Vector3(runner.posX, runner.posY + 1.2, runner.posZ - 1.4),
        Math.min(1, dt * 5)
      );
      camera.position.copy(camPos.current);
      setLook(camera, camLook.current, lookQuat.current);
      camera.fov += (50 - camera.fov) * Math.min(1, dt * 4);
      camera.updateProjectionMatrix();

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
      const target = followCameraTarget(runner, ix, iz, FOLLOW_DIST, true);
      camPos.current.lerp(target, Math.min(1, dt * 14));
      camLook.current.lerp(
        new THREE.Vector3(runner.posX, runner.posY + 1.15, runner.posZ),
        Math.min(1, dt * 16)
      );
      camera.position.copy(camPos.current);
      setLook(camera, camLook.current, lookQuat.current);
      camera.fov += (50 - camera.fov) * Math.min(1, dt * 6);
      camera.updateProjectionMatrix();
    }

    if (phase === PHASES.RETURNING_TO_CAMPUS) {
      const t = Math.min(1, elapsed.current / RETURN_DURATION);
      runner.setDoorOpen(Math.max(0, 1 - t * 1.6));

      if (t < RETURN_CUT) {
        runner.setVisitFade(easeInOutCubic(t / RETURN_CUT));
        const outCam = interiorDoorCam(ix, iz);
        const outLook = new THREE.Vector3(ix, 1.4, iz + APPROACH_Z + 1.2);
        const u = easeInOutCubic(t / RETURN_CUT);
        camera.position.lerpVectors(fromPos.current, outCam, u);
        camLook.current.lerpVectors(fromLook.current, outLook, u);
        setLook(camera, camLook.current, lookQuat.current);
      } else {
        if (!restoredRef.current) {
          restoredRef.current = true;
          runner.restoreCampus();
          const after = useRunnerStore.getState();
          const eye = roadEyeCam(after.posX, after.posZ);
          const look = roadEyeLook(after.posX, after.posZ);
          fromPos.current.copy(eye);
          fromLook.current.copy(look);
          camPos.current.copy(eye);
          camLook.current.copy(look);
          camera.position.copy(eye);
          setLook(camera, look, lookQuat.current);
          after.setVisitFade(1);
        }

        const after = useRunnerStore.getState();
        const back = new THREE.Vector3(after.posX * 0.6, GROUND_Y + 4.6, after.posZ - 7.5);
        const backLook = new THREE.Vector3(after.posX, GROUND_Y + 1.6, after.posZ + 8);
        const u = easeInOutCubic((t - RETURN_CUT) / (1 - RETURN_CUT));
        camera.position.lerpVectors(fromPos.current, back, u);
        camLook.current.lerpVectors(fromLook.current, backLook, u);
        setLook(camera, camLook.current, lookQuat.current);
        after.setVisitFade(Math.max(0, 1 - u * 1.35));
        camera.fov += (55 - camera.fov) * Math.min(1, dt * 5);
        camera.updateProjectionMatrix();
      }

      if (t >= 1 && !firedRef.current) {
        firedRef.current = true;
        useRunnerStore.getState().setVisitFade(0);
        useGameStore.getState().returnTransitionComplete();
      }
    }
  });

  const showInterior = [
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
      question={activeQuestion}
      exploring={phase === PHASES.SPECIAL_INTERACTION_READY}
      saved={phase === PHASES.SPECIAL_INTERACTION_COMPLETED}
    />
  );
}
