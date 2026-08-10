import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { LANES } from '../../../constants/gameMaps';
import CollectibleMesh, { COLLECTIBLE_COLORS } from './CollectibleMesh';

export default function Collectible({ type = 'book', position, onCollect, playerPosRef }) {
  const collected = useRef(false);
  const groupRef = useRef(null);
  const color = COLLECTIBLE_COLORS[type] || '#a78bfa';

  useFrame(() => {
    if (collected.current) return;

    const p = playerPosRef?.current;
    if (!p) return;

    const dx = Math.abs(p.x - position[0]);
    const dz = Math.abs(p.z - position[2]);
    const dy = Math.abs(p.y - position[1]);

    if (dx < 1.2 && dz < 1.6 && dy < 2.2) {
      collected.current = true;
      if (groupRef.current) groupRef.current.visible = false;
      onCollect?.(type, color);
    }
  });

  return (
    <group ref={groupRef} position={position} scale={1.15}>
      <CollectibleMesh type={type} />
    </group>
  );
}

export function generateCollectibles(mapDef, count = 36) {
  const types = mapDef?.collectibles || ['book'];
  const items = [];

  for (let i = 0; i < count; i++) {
    const zDist = 6 + i * 4.5;
    const lane = LANES[i % LANES.length];
    const type = types[i % types.length];
    const y = type === 'knowledge_star' ? 1.35 : 0.75;
    items.push({ id: `c-${i}`, type, position: [lane, y, -zDist] });
  }
  return items;
}
