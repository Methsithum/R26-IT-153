import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';

export default function Monster({ mapDef, defeated = false, visible = false }) {
  const ref = useRef(null);

  useFrame(({ clock }) => {
    if (!ref.current || defeated || !visible) return;
    const t = clock.getElapsedTime();
    ref.current.rotation.y = Math.sin(t) * 0.3;
    ref.current.position.y = 1 + Math.sin(t * 2) * 0.2;
    ref.current.scale.setScalar(1 + Math.sin(t * 3) * 0.05);
  });

  if (!visible) return null;

  const color = defeated ? '#64748b' : (mapDef?.accentColor || '#ef4444');

  return (
    <group ref={ref} position={[0, 1, -8]}>
      <mesh>
        <dodecahedronGeometry args={[defeated ? 0.5 : 1.2, 0]} />
        <meshStandardMaterial
          color={color}
          emissive={defeated ? '#334155' : color}
          emissiveIntensity={defeated ? 0.1 : 0.5}
          transparent={defeated}
          opacity={defeated ? 0.3 : 1}
        />
      </mesh>
      {!defeated && (
        <>
          <mesh position={[-0.4, 0.3, 0.8]}>
            <sphereGeometry args={[0.15, 8, 8]} />
            <meshStandardMaterial color="#fef08a" emissive="#facc15" emissiveIntensity={0.8} />
          </mesh>
          <mesh position={[0.4, 0.3, 0.8]}>
            <sphereGeometry args={[0.15, 8, 8]} />
            <meshStandardMaterial color="#fef08a" emissive="#facc15" emissiveIntensity={0.8} />
          </mesh>
        </>
      )}
    </group>
  );
}
