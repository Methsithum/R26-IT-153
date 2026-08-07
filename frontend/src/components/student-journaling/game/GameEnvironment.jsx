import { useMemo } from 'react';
import { Stars } from '@react-three/drei';

function ForestDecor({ accentColor }) {
  const trees = useMemo(() => {
    const items = [];
    for (let i = 0; i < 55; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      items.push({
        x: side * (5 + Math.random() * 3),
        z: -i * 6.5 - Math.random() * 3,
        scale: 0.8 + Math.random() * 0.7,
        layers: 2 + Math.floor(Math.random() * 2),
      });
    }
    return items;
  }, []);

  const rocks = useMemo(() => {
    const items = [];
    for (let i = 0; i < 30; i++) {
      items.push({
        x: (Math.random() > 0.5 ? -1 : 1) * (5.5 + Math.random() * 2),
        z: -i * 11 - Math.random() * 5,
        s: 0.3 + Math.random() * 0.5,
      });
    }
    return items;
  }, []);

  return (
    <group>
      {rocks.map((r, i) => (
        <mesh key={`r-${i}`} position={[r.x, r.s * 0.4, r.z]}>
          <dodecahedronGeometry args={[r.s, 0]} />
          <meshStandardMaterial color="#475569" roughness={0.95} />
        </mesh>
      ))}
      {trees.map((t, i) => (
        <group key={i} position={[t.x, 0, t.z]} scale={t.scale}>
          <mesh position={[0, 0.7, 0]}>
            <cylinderGeometry args={[0.12, 0.22, 1.4, 6]} />
            <meshStandardMaterial color="#78350f" roughness={0.9} />
          </mesh>
          {Array.from({ length: t.layers }).map((_, li) => (
            <mesh key={li} position={[0, 1.4 + li * 0.55, 0]}>
              <coneGeometry args={[0.75 - li * 0.12, 1.1, 7]} />
              <meshStandardMaterial
                color={li === 0 ? accentColor : '#166534'}
                emissive={accentColor}
                emissiveIntensity={0.08}
              />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function DungeonDecor({ accentColor }) {
  const pillars = useMemo(() => {
    const items = [];
    for (let i = 0; i < 22; i++) {
      items.push({ x: (i % 2 === 0 ? -5 : 5), z: -i * 11 });
    }
    return items;
  }, []);

  return (
    <group>
      {pillars.map((p, i) => (
        <group key={i} position={[p.x, 0, p.z]}>
          <mesh position={[0, 1.5, 0]}>
            <cylinderGeometry args={[0.45, 0.55, 3.2, 8]} />
            <meshStandardMaterial color="#475569" emissive={accentColor} emissiveIntensity={0.1} roughness={0.8} />
          </mesh>
          <mesh position={[0, 3.2, 0]}>
            <boxGeometry args={[1.1, 0.25, 1.1]} />
            <meshStandardMaterial color="#64748b" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function LabDecor({ accentColor }) {
  const panels = useMemo(() => {
    const items = [];
    for (let i = 0; i < 18; i++) {
      items.push({ x: (i % 2 === 0 ? -5.5 : 5.5), z: -i * 9 });
    }
    return items;
  }, []);

  return (
    <group>
      {panels.map((p, i) => (
        <group key={i} position={[p.x, 0, p.z]}>
          <mesh position={[0, 0.9, 0]}>
            <boxGeometry args={[1.6, 1.8, 0.35]} />
            <meshStandardMaterial color="#1e293b" emissive={accentColor} emissiveIntensity={0.2} />
          </mesh>
          <mesh position={[0, 1.35, 0.22]}>
            <boxGeometry args={[1.1, 0.7, 0.06]} />
            <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={0.55} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function CityDecor({ accentColor }) {
  const buildings = useMemo(() => {
    const items = [];
    for (let i = 0; i < 28; i++) {
      items.push({
        x: (i % 2 === 0 ? -1 : 1) * (6 + Math.random() * 4),
        z: -i * 8,
        h: 2.5 + Math.random() * 5,
        w: 1.2 + Math.random() * 2,
      });
    }
    return items;
  }, []);

  return (
    <group>
      {buildings.map((b, i) => (
        <group key={i} position={[b.x, b.h / 2, b.z]}>
          <mesh>
            <boxGeometry args={[b.w, b.h, b.w]} />
            <meshStandardMaterial color="#334155" emissive="#1e40af" emissiveIntensity={0.12} />
          </mesh>
          {Array.from({ length: Math.floor(b.h) }).map((_, wi) => (
            <mesh key={wi} position={[0, -b.h / 2 + 0.5 + wi * 0.9, b.w / 2 + 0.01]}>
              <planeGeometry args={[b.w * 0.6, 0.5]} />
              <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={0.35} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function ArenaDecor({ accentColor }) {
  return (
    <group>
      {[-9, 9].map((x) => (
        <mesh key={x} position={[x, 1.2, -80]}>
          <boxGeometry args={[0.4, 2.4, 160]} />
          <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={0.25} />
        </mesh>
      ))}
      {Array.from({ length: 8 }).map((_, i) => (
        <mesh key={i} position={[0, 3 + i * 0.1, -20 - i * 18]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[4, 0.05, 8, 32]} />
          <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={0.3} transparent opacity={0.4} />
        </mesh>
      ))}
    </group>
  );
}

export default function GameEnvironment({ mapDef }) {
  const envType = mapDef?.envType || 'forest';
  const accentColor = mapDef?.accentColor || '#4ade80';

  return (
    <group>
      {envType === 'forest' && <ForestDecor accentColor={accentColor} />}
      {envType === 'dungeon' && <DungeonDecor accentColor={accentColor} />}
      {envType === 'lab' && <LabDecor accentColor={accentColor} />}
      {envType === 'city' && <CityDecor accentColor={accentColor} />}
      {envType === 'arena' && <ArenaDecor accentColor={accentColor} />}

      <Stars radius={90} depth={50} count={1000} factor={3.5} saturation={0.6} fade speed={0.4} />
    </group>
  );
}

export function GameLighting({ mapDef }) {
  const accent = mapDef?.accentColor || '#6366f1';
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight
        castShadow
        position={[10, 18, 8]}
        intensity={1.5}
        color="#fff7ed"
        shadow-mapSize={[1024, 1024]}
      />
      <directionalLight position={[-6, 10, -10]} intensity={0.4} color={accent} />
      <hemisphereLight args={['#bae6fd', mapDef?.groundColor || '#1e293b', 0.6]} />
    </>
  );
}
