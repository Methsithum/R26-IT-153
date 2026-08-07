import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';

const JUMP_CLEAR_Y = {
  rock: 1.5,
  tree: 2.0,
  deadline: 1.65,
  stress: 1.45,
};

export default function Obstacle({ position, type = 'rock', onHit, playerPosRef }) {
  const hit = useRef(false);
  const groupRef = useRef(null);

  useFrame(() => {
    if (hit.current) return;
    const p = playerPosRef?.current;
    if (!p) return;

    const dx = Math.abs(p.x - position[0]);
    const dz = Math.abs(p.z - position[2]);

    if (dx < 1.0 && dz < 1.2) {
      const clearY = JUMP_CLEAR_Y[type] ?? 1.5;
      if (p.y > clearY) return;
      hit.current = true;
      onHit?.(type);
    }
  });

  const color = type === 'tree' ? '#166534' : type === 'deadline' ? '#dc2626' : type === 'stress' ? '#7c3aed' : '#64748b';

  return (
    <group ref={groupRef} position={position}>
      {type === 'tree' ? (
        <group>
          <mesh castShadow position={[0, 0.5, 0]}>
            <cylinderGeometry args={[0.2, 0.3, 1, 6]} />
            <meshStandardMaterial color="#78350f" />
          </mesh>
          <mesh castShadow position={[0, 1.4, 0]}>
            <coneGeometry args={[0.7, 1.2, 6]} />
            <meshStandardMaterial color={color} />
          </mesh>
        </group>
      ) : type === 'stress' ? (
        <mesh castShadow>
          <sphereGeometry args={[0.5, 8, 8]} />
          <meshStandardMaterial color={color} transparent opacity={0.65} emissive={color} emissiveIntensity={0.35} />
        </mesh>
      ) : type === 'deadline' ? (
        <mesh castShadow position={[0, 0.5, 0]}>
          <boxGeometry args={[2.2, 1, 0.35]} />
          <meshStandardMaterial color={color} emissive="#991b1b" emissiveIntensity={0.25} />
        </mesh>
      ) : (
        <mesh castShadow>
          <dodecahedronGeometry args={[0.42, 0]} />
          <meshStandardMaterial color={color} roughness={0.75} />
        </mesh>
      )}
    </group>
  );
}

export function generateObstacles(count = 10) {
  const types = ['rock', 'tree', 'deadline', 'stress'];
  const lanes = [-2, 0, 2];
  const items = [];

  for (let i = 0; i < count; i++) {
    const zDist = 18 + i * 14;
    const lane = lanes[(i + 1) % 3];
    const type = types[i % types.length];
    items.push({ id: `o-${i}`, type, position: [lane, 0, -zDist] });
  }
  return items;
}
