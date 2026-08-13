import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useFBX } from "@react-three/drei";
import * as THREE from "three";

const MODEL_PATH = "/models/remy-running.fbx";
const MODEL_SCALE = 0.0105;

// Real GLB/FBX character with a baked running animation (Mixamo "Remy").
// The run cycle plays continuously; jump/slide are layered on top as
// simple transform changes on the wrapping group (see Player.jsx) rather
// than separate clips, since only one animation ships with this asset.
export default function CharacterModel({ crouch }) {
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

    // Mixamo FBX exports sometimes include an empty "Take 001" stack
    // alongside the real "mixamo.com" motion clip — prefer whichever
    // clip actually has the most keyframe tracks.
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
    mixer.update(delta);
  });

  return (
    <group scale={[1, crouch ? 0.6 : 1, 1]} position={[0, crouch ? -0.9 : 0, 0]}>
      <primitive object={fbx} scale={MODEL_SCALE} rotation={[0, Math.PI, 0]} />
    </group>
  );
}

useFBX.preload(MODEL_PATH);
