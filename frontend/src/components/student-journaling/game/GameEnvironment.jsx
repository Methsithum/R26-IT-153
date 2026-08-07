import { useMemo } from 'react';
import { Stars } from '@react-three/drei';

function ForestDecor({ accentColor }) {
  const trees = useMemo(() => {
    const items = [];
    for (let i = 0; i < 50; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      items.push({
        x: side * (4.5 + Math.random() * 2.5),
        z: -i * 7 - Math.random() * 4,
        scale: 0.7 + Math.random() * 0.6,
      });
    }
    return items;
  }, []);

  return (
    <group>
      {trees.map((t, i) => (
        <group key={i} position={[t.x, 0, t.z]} scale={t.scale}>
          <mesh position={[0, 0.6, 0]}>
            <cylinderGeometry args={[0.15, 0.2, 1.2, 5]} />
            <meshStandardMaterial color="#78350f" />
          </mesh>
          <mesh position={[0, 1.5, 0]}>
            <coneGeometry args={[0.8, 1.5, 6]} />
            <meshStandardMaterial color={accentColor} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function DungeonDecor() {
  const pillars = useMemo(() => {
    const items = [];
    for (let i = 0; i < 20; i++) {
      items.push({ x: (i % 2 === 0 ? -4 : 4), z: -i * 12 });
    }
    return items;
  }, []);

  return (
    <group>
      {pillars.map((p, i) => (
        <group key={i} position={[p.x, 0, p.z]}>
          <mesh position={[0, 1.5, 0]}>
            <cylinderGeometry args={[0.4, 0.5, 3, 8]} />
            <meshStandardMaterial color="#475569" emissive="#f59e0b" emissiveIntensity={0.12} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function LabDecor({ accentColor }) {
  const panels = useMemo(() => {
    const items = [];
    for (let i = 0; i < 15; i++) {
      items.push({ x: (Math.random() > 0.5 ? -5 : 5), z: -i * 10 });
    }
    return items;
  }, []);

  return (
    <group>
      {panels.map((p, i) => (
        <group key={i} position={[p.x, 0, p.z]}>
          <mesh position={[0, 0.8, 0]}>
            <boxGeometry args={[1.5, 1.6, 0.3]} />
            <meshStandardMaterial color="#1e293b" emissive={accentColor} emissiveIntensity={0.15} />
          </mesh>
          <mesh position={[0, 1.2, 0.2]}>
            <boxGeometry args={[1, 0.6, 0.05]} />
            <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={0.5} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function CityDecor() {
  const buildings = useMemo(() => {
    const items = [];
    for (let i = 0; i < 25; i++) {
      items.push({
        x: (Math.random() - 0.5) * 25,
        z: -i * 9,
        h: 2 + Math.random() * 4,
        w: 1 + Math.random() * 2,
      });
    }
    return items;
  }, []);

  return (
    <group>
      {buildings.map((b, i) => (
        <mesh key={i} position={[b.x, b.h / 2, b.z]}>
          <boxGeometry args={[b.w, b.h, b.w]} />
          <meshStandardMaterial color="#334155" emissive="#1e40af" emissiveIntensity={0.1} />
        </mesh>
      ))}
    </group>
  );
}

function ArenaDecor({ accentColor }) {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, -100]}>
        <planeGeometry args={[40, 400]} />
        <meshStandardMaterial color="#15803d" />
      </mesh>
      {[-8, 8].map((x) => (
        <mesh key={x} position={[x, 1, -50]} rotation={[0, 0, 0]}>
          <boxGeometry args={[0.3, 2, 100]} />
          <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={0.2} />
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
      {envType === 'dungeon' && <DungeonDecor />}
      {envType === 'lab' && <LabDecor accentColor={accentColor} />}
      {envType === 'city' && <CityDecor />}
      {envType === 'arena' && <ArenaDecor accentColor={accentColor} />}

      <Stars radius={80} depth={40} count={800} factor={3} saturation={0.5} fade speed={0.5} />
    </group>
  );
}

export function GameLighting({ mapDef }) {
  const accent = mapDef?.accentColor || '#6366f1';
  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight
        castShadow
        position={[8, 16, 6]}
        intensity={1.4}
        color="#fff7ed"
        shadow-mapSize={[1024, 1024]}
      />
      <directionalLight position={[-4, 8, -8]} intensity={0.35} color={accent} />
      <hemisphereLight args={['#bae6fd', mapDef?.groundColor || '#1e293b', 0.55]} />
    </>
  );
}
