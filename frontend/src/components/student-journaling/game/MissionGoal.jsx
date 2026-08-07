import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, RoundedBox } from '@react-three/drei';

/** Mission finish arch — visible at the end of the run path. */
export default function MissionGoal({ z = -160, accent = '#4ade80', visible = true }) {
  const ref = useRef(null);

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.y = Math.sin(clock.elapsedTime * 0.5) * 0.05;
    }
  });

  if (!visible) return null;

  return (
    <group ref={ref} position={[0, 0, z]}>
      <mesh position={[-2.6, 2.2, 0]}>
        <boxGeometry args={[0.35, 4.4, 0.4]} />
        <meshStandardMaterial color="#64748b" metalness={0.3} roughness={0.6} />
      </mesh>
      <mesh position={[2.6, 2.2, 0]}>
        <boxGeometry args={[0.35, 4.4, 0.4]} />
        <meshStandardMaterial color="#64748b" metalness={0.3} roughness={0.6} />
      </mesh>
      <RoundedBox args={[5.6, 0.35, 0.5]} radius={0.06} position={[0, 4.3, 0]}>
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.55} metalness={0.4} />
      </RoundedBox>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <ringGeometry args={[1.5, 2.2, 32]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.4} transparent opacity={0.6} />
      </mesh>
      <Html position={[0, 5.2, 0]} center distanceFactor={18} transform style={{ pointerEvents: 'none' }}>
        <div
          className="px-4 py-1.5 rounded-full text-xs font-bold text-white uppercase tracking-widest shadow-lg"
          style={{ background: `linear-gradient(90deg, ${accent}, #8b5cf6)` }}
        >
          🏁 Mission Goal
        </div>
      </Html>
    </group>
  );
}
