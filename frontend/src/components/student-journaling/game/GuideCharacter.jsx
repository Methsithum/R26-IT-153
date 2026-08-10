import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';

export default function GuideCharacter({ visible = false, reacting = false }) {
  const groupRef = useRef(null);
  const glowRef = useRef(null);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.getElapsedTime();
    groupRef.current.position.y = visible ? 0.5 + Math.sin(t * 2) * 0.08 : -5;
    if (glowRef.current) {
      glowRef.current.material.emissiveIntensity = reacting ? 0.8 : 0.3 + Math.sin(t * 3) * 0.15;
    }
  });

  if (!visible) return null;

  return (
    <group ref={groupRef} position={[3, 0.5, -2]}>
      <mesh ref={glowRef}>
        <sphereGeometry args={[0.08, 8, 8]} />
        <meshStandardMaterial color="#c4b5fd" emissive="#a78bfa" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[0, 0.6, 0]}>
        <capsuleGeometry args={[0.35, 0.6, 4, 8]} />
        <meshStandardMaterial color="#8b5cf6" emissive="#6d28d9" emissiveIntensity={0.4} />
      </mesh>
      <mesh position={[0, 1.2, 0]}>
        <sphereGeometry args={[0.3, 12, 12]} />
        <meshStandardMaterial color="#fde68a" />
      </mesh>
      <mesh position={[-0.15, 1.25, 0.22]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshStandardMaterial color="#1e1b4b" />
      </mesh>
      <mesh position={[0.15, 1.25, 0.22]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshStandardMaterial color="#1e1b4b" />
      </mesh>
      <mesh position={[0.35, 0.7, 0]} rotation={[0, 0, -0.5]}>
        <boxGeometry args={[0.08, 0.4, 0.08]} />
        <meshStandardMaterial color="#c4b5fd" />
      </mesh>
      <mesh position={[-0.35, 0.7, 0]} rotation={[0, 0, 0.5]}>
        <boxGeometry args={[0.08, 0.4, 0.08]} />
        <meshStandardMaterial color="#c4b5fd" />
      </mesh>
      <pointLight color="#a78bfa" intensity={0.6} distance={4} position={[0, 1, 0.5]} />
    </group>
  );
}
