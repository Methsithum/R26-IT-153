import { forwardRef, Suspense, useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';

const MODEL_URL = 'https://threejs.org/examples/models/gltf/Soldier.glb';

function RunnerModel({ visualRef, haltMovement, isJumpingRef }) {
  const group = useRef();
  const { scene, animations } = useGLTF(MODEL_URL);
  const { actions, names } = useAnimations(animations, group);
  const currentAction = useRef(null);

  useEffect(() => {
    const run = actions.Run || actions.Walk || actions[names[0]];
    const idle = actions.Idle || actions.TPose || actions[names[0]];
    const target = haltMovement ? idle : run;
    if (!target) return undefined;

    if (currentAction.current && currentAction.current !== target) {
      currentAction.current.fadeOut(0.15);
    }
    target.reset().fadeIn(0.15).play();
    currentAction.current = target;

    return () => target.fadeOut(0.15);
  }, [actions, names, haltMovement]);

  useFrame(() => {
    if (group.current && !haltMovement) {
      const jumping = isJumpingRef?.current;
      group.current.position.y = jumping ? 0.15 : Math.abs(Math.sin(Date.now() * 0.012)) * 0.04;
    }
  });

  return (
    <group ref={visualRef} position={[0, -1.02, 0]} rotation={[0, Math.PI, 0]} scale={0.55}>
      <group ref={group}>
        <primitive object={scene} />
      </group>
    </group>
  );
}

/** GLTF runner with run/idle animations (Three.js Soldier model). */
export default function GltfRunner({ visualRef, haltMovement, isJumpingRef }) {
  return (
    <Suspense fallback={null}>
      <RunnerModel visualRef={visualRef} haltMovement={haltMovement} isJumpingRef={isJumpingRef} />
    </Suspense>
  );
}

useGLTF.preload(MODEL_URL);

export const RunnerShadow = forwardRef(function RunnerShadow(_props, ref) {
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
      <circleGeometry args={[0.45, 16]} />
      <meshBasicMaterial color="#000000" transparent opacity={0.25} />
    </mesh>
  );
});
