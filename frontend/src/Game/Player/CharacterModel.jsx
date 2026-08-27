import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useFBX } from "@react-three/drei";
import * as THREE from "three";
import { useRunnerStore } from "../state/runnerStore";
import { useGameStore } from "../state/GameStateManager";

const MODEL_PATH = "/models/remy-running.fbx";
const MODEL_SCALE = 0.0105;

// Real GLB/FBX character with a baked running animation (Mixamo "Remy").
// The run cycle plays continuously; jump/slide/stumble are layered as
// group transforms in Player.jsx rather than extra clips.
export default function CharacterModel() {
  const fbx = useFBX(MODEL_PATH);
  const mixer = useMemo(() => new THREE.AnimationMixer(fbx), [fbx]);
  const actionRef = useRef(null);

  useEffect(() => {
    fbx.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    const clip = fbx.animations.reduce((a, b) => (b.tracks.length > a.tracks.length ? b : a));
    const action = mixer.clipAction(clip, fbx);
    action.reset().setLoop(THREE.LoopRepeat, Infinity).play();
    actionRef.current = action;

    return () => {
      mixer.stopAllAction();
      mixer.uncacheRoot(fbx);
    };
  }, [fbx, mixer]);

  useFrame((_, delta) => {
    if (useGameStore.getState().paused) return;
    const { isSliding, isJumping, isStumbling, speedScale } = useRunnerStore.getState();
    const rate = isStumbling ? 0.35 : isSliding ? 0.45 : isJumping ? 0.55 : 0.85 + speedScale * 0.35;
    mixer.update(delta * rate);
  });

  return (
    <group>
      {/* Mixamo faces +Z. The runner also travels +Z (camera sits at -Z
          looking ahead), so no extra yaw — Math.PI here made him moonwalk. */}
      <primitive object={fbx} scale={MODEL_SCALE} rotation={[0, 0, 0]} />
    </group>
  );
}

useFBX.preload(MODEL_PATH);
