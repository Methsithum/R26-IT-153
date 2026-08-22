import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { RigidBody, CapsuleCollider } from "@react-three/rapier";
import { useRunnerStore } from "../state/runnerStore";
import { PHASES, useGameStore } from "../state/GameStateManager";
import StudentCharacter from "./StudentCharacter";
import { tickSteps } from "../audio/sfx";
import {
  GROUND_Y,
  APPROACH_Z,
  INSIDE_SPAWN_Z,
  interiorAnchor,
  interiorWorld,
  missionLocalOffset,
} from "../Environment/BuildingInterior";
import { resolveInteriorWalk } from "../Environment/interiorColliders";

const JUMP_HEIGHT = 2.35;
const JUMP_DURATION = 0.7;
const SLIDE_DURATION = 0.62;
const SLIDE_Y = 0.12;
const LANE_SNAP = 12;
const WALK_SPEED = 3.35;
const INTERACT_RANGE = 2.4;

const CAMPUS_PHASES = new Set([
  PHASES.RUNNING,
  PHASES.QUESTION_APPROACHING,
  PHASES.ANSWER_SELECTION,
  PHASES.ANSWER_CONFIRMED,
  PHASES.CHECKING_DATA_REQUIREMENT,
  PHASES.RUNNING_RESUMED,
  PHASES.APPROACHING_FINISH,
]);

export default function Player() {
  const bodyRef = useRef();
  const groupRef = useRef();
  const shadowRef = useRef();
  const gaitPhase = useRef(0);
  const jumpElapsed = useRef(0);
  const slideElapsed = useRef(0);
  const poseRef = useRef("idle");

  const speed = useGameStore((s) => s.speed);
  const phase = useGameStore((s) => s.phase);
  const exhausted = useGameStore((s) => s.exhausted);
  const isSliding = useRunnerStore((s) => s.isSliding);
  const transitionEntryZ = useGameStore((s) => s.transitionEntryZ);
  const activeQuestion = useGameStore((s) => s.activeQuestion);
  const targetBuildingId = useGameStore((s) => s.targetBuildingId);

  const exploring = phase === PHASES.SPECIAL_INTERACTION_READY;
  const entering = phase === PHASES.ENTERING_BUILDING;
  const atDoor = phase === PHASES.TRANSITION_TO_BUILDING;
  const inRoom =
    exploring ||
    entering ||
    atDoor ||
    phase === PHASES.SPECIAL_INTERACTION_ACTIVE ||
    phase === PHASES.SPECIAL_INTERACTION_COMPLETED;

  const campusRun = useMemo(() => CAMPUS_PHASES.has(phase), [phase]);

  useFrame((_, delta) => {
    const store = useRunnerStore.getState();
    const dt = Math.min(delta, 0.05);
    const now = performance.now();

    if (store.isStumbling && now >= store.stumbleUntil) {
      store.endStumble();
    }
    if (store.shake > 0.01) {
      store.setShake(store.shake * Math.exp(-dt * 7));
    } else if (store.shake !== 0) {
      store.setShake(0);
    }

    const cruise = exhausted ? 0.58 : Math.min(1.38, 1 + store.distance * 0.0007);
    if (!store.isStumbling && campusRun) {
      const nextScale = store.speedScale + (cruise - store.speedScale) * Math.min(1, dt * 1.6);
      if (Math.abs(nextScale - store.speedScale) > 0.02) {
        store.setSpeedScale(nextScale);
      }
    }

    let nextX = store.posX;
    let nextY = GROUND_Y;
    let nextZ = store.posZ;
    let moving = 0;
    let pose = "idle";

    if (atDoor) {
      const snap = store.campusSnapshot;
      nextX = snap?.posX ?? store.posX;
      nextY = GROUND_Y;
      nextZ = snap?.posZ ?? store.posZ;
      store.setFacingYaw(0);
      pose = "idle";
      gaitPhase.current += dt * 2.2;
    } else if (entering) {
      const t = Math.min(1, store.enterProgress);
      const ease = 1 - Math.pow(1 - t, 3);
      const localZ = APPROACH_Z + (INSIDE_SPAWN_Z - APPROACH_Z) * ease;
      const [wx, wy, wz] = interiorWorld(transitionEntryZ, 0, localZ);
      nextX = wx;
      nextY = wy;
      nextZ = wz;
      store.setFacingYaw(Math.PI);
      pose = t > 0.02 ? "walk" : "idle";
      gaitPhase.current += dt * (t > 0.02 ? 8 : 2.2);
    } else if (exploring) {
      const ix = store.exploreInputX;
      const iz = store.exploreInputZ;
      const len = Math.hypot(ix, iz);
      const yaw = store.lookYaw;
      const fwdX = -Math.sin(yaw);
      const fwdZ = -Math.cos(yaw);
      const rightX = Math.cos(yaw);
      const rightZ = -Math.sin(yaw);
      const [ax, , az] = interiorAnchor(transitionEntryZ);
      if (len > 0.01) {
        const nx = (rightX * ix + fwdX * -iz) / len;
        const nz = (rightZ * ix + fwdZ * -iz) / len;
        const nlen = Math.hypot(nx, nz) || 1;
        const vx = nx / nlen;
        const vz = nz / nlen;
        const wantedX = store.posX + vx * WALK_SPEED * dt;
        const wantedZ = store.posZ + vz * WALK_SPEED * dt;
        [nextX, nextZ] = resolveInteriorWalk(
          ax,
          az,
          store.posX,
          store.posZ,
          wantedX,
          wantedZ,
          targetBuildingId
        );
        store.setFacingYaw(Math.atan2(vx, vz));
        pose = "walk";
        gaitPhase.current += dt * 8.5;
      } else {
        [nextX, nextZ] = resolveInteriorWalk(
          ax,
          az,
          store.posX,
          store.posZ,
          store.posX,
          store.posZ,
          targetBuildingId
        );
        const face = yaw + Math.PI;
        if (Math.abs(store.facingYaw - face) > 0.03) store.setFacingYaw(face);
        pose = "idle";
        gaitPhase.current += dt * 2.2;
      }

      const [mx, , mz] = missionLocalOffset(activeQuestion, targetBuildingId);
      const [wx, , wz] = interiorWorld(transitionEntryZ, mx, mz);
      const dist = Math.hypot(nextX - wx, nextZ - wz);
      const near = dist < INTERACT_RANGE;
      if (near !== store.nearMission) store.setNearMission(near);
    } else if (phase === PHASES.SPECIAL_INTERACTION_ACTIVE || phase === PHASES.SPECIAL_INTERACTION_COMPLETED) {
      pose = "idle";
      gaitPhase.current += dt * 2.2;
    } else if (campusRun) {
      if (now < store.hitStopUntil) {
        pose = store.isStumbling ? "stumble" : "run";
      } else {
        moving = store.speedScale * speed;
        nextZ = store.posZ + moving * dt;
        if (store.isStumbling) {
          const stumbleT = Math.min(1, (now - store.stumbleStartedAt) / 220);
          nextZ -= (1 - stumbleT) * 5.5 * dt;
        }
        store.setDistance(store.distance + Math.max(0, moving) * dt);
        nextX = store.posX + (store.targetX - store.posX) * Math.min(1, dt * LANE_SNAP);

        if (store.isJumping) {
          jumpElapsed.current += dt;
          const t = Math.min(1, jumpElapsed.current / JUMP_DURATION);
          nextY = GROUND_Y + Math.sin(t * Math.PI) * JUMP_HEIGHT;
          pose = "jump";
          if (t >= 1) {
            jumpElapsed.current = 0;
            store.endJump();
            store.pulseShake(0.22);
          }
        } else {
          jumpElapsed.current = 0;
        }

        if (store.isSliding && !store.isJumping) {
          slideElapsed.current += dt;
          nextY = SLIDE_Y;
          pose = "slide";
          if (slideElapsed.current >= SLIDE_DURATION) {
            slideElapsed.current = 0;
            store.endSlide();
          }
        } else if (!store.isSliding) {
          slideElapsed.current = 0;
        }

        if (!store.isJumping && !store.isSliding) {
          pose = store.isStumbling ? "stumble" : "run";
        }
        gaitPhase.current += dt * (pose === "run" ? 8 + moving * 0.45 : 6);
        store.setFacingYaw(0);
      }
    } else if (phase === PHASES.DAY_CELEBRATION) {
      moving = Math.max(3.2, store.speedScale * speed * 0.34);
      nextZ = store.posZ + moving * dt;
      nextX = store.posX + (store.targetX - store.posX) * Math.min(1, dt * LANE_SNAP);
      const hop = Math.abs(Math.sin(gaitPhase.current * 0.7));
      nextY = GROUND_Y + hop * 0.28;
      pose = "cheer";
      gaitPhase.current += dt * 7.2;
      store.setFacingYaw(0);
      store.setDistance(store.distance + moving * dt);
    }

    poseRef.current = pose;
    if (pose === "run") tickSteps(gaitPhase.current, "run");
    else if (pose === "walk") tickSteps(gaitPhase.current, "walk");
    else tickSteps(gaitPhase.current, "off");
    store.setPosition(nextX, nextY, nextZ);

    if (groupRef.current) {
      const laneLean = campusRun ? (store.targetX - store.posX) * -0.1 : 0;
      let rotX = 0;
      let rotZ = laneLean;
      let posZOff = 0;

      if (pose === "slide") {
        rotX = 1.12;
        posZOff = 0.55;
      } else if (pose === "jump") {
        rotX = -0.28;
      } else if (pose === "stumble") {
        const wobble = Math.sin(((now - store.stumbleStartedAt) / 70) * Math.PI);
        rotX = 0.22;
        rotZ = laneLean + wobble * 0.28;
      } else if (pose === "cheer") {
        rotX = -0.16;
        rotZ = Math.sin(gaitPhase.current * 0.7) * 0.06;
      }

      groupRef.current.rotation.x = rotX;
      groupRef.current.rotation.y = inRoom || exploring || entering || atDoor ? store.facingYaw : laneLean * 0.35;
      groupRef.current.rotation.z = rotZ;
      groupRef.current.position.z = posZOff;

      const blinking = campusRun && now < store.invincibleUntil;
      groupRef.current.visible = blinking ? Math.floor(now / 70) % 2 === 0 : true;
    }

    if (shadowRef.current) {
      const jumpLift = Math.max(0, nextY - GROUND_Y);
      const scale = Math.max(0.35, 1 - jumpLift * 0.18);
      shadowRef.current.position.set(nextX, 0.03, nextZ);
      shadowRef.current.scale.set(scale, scale, 1);
      shadowRef.current.material.opacity = pose === "jump" ? 0.16 : 0.34;
    }

    if (bodyRef.current) {
      bodyRef.current.setNextKinematicTranslation({ x: nextX, y: nextY, z: nextZ });
    }
  });

  return (
    <>
      <mesh ref={shadowRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <circleGeometry args={[0.55, 20]} />
        <meshBasicMaterial color="#0b1220" transparent opacity={0.34} depthWrite={false} />
      </mesh>
      <RigidBody
        ref={bodyRef}
        type="kinematicPosition"
        colliders={false}
        position={[0, GROUND_Y, 0]}
      >
        <CapsuleCollider
          key={isSliding ? "slide" : "stand"}
          args={isSliding ? [0.16, 0.26] : [0.42, 0.28]}
          position={isSliding ? [0, 0.38, 0.28] : [0, 0.88, 0]}
        />
        <group ref={groupRef}>
          <StudentCharacter gaitPhase={gaitPhase} poseRef={poseRef} />
        </group>
      </RigidBody>
    </>
  );
}
