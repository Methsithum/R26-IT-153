import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Float, RoundedBox, Sphere, Torus, Ring } from '@react-three/drei';
import * as THREE from 'three';

const glow = (color, intensity = 0.45) => (
  <meshStandardMaterial color={color} emissive={color} emissiveIntensity={intensity} roughness={0.35} metalness={0.15} />
);

function BookModel({ color }) {
  return (
    <group>
      <RoundedBox args={[0.38, 0.48, 0.1]} radius={0.02} position={[0, 0, 0]}>
        {glow(color, 0.35)}
      </RoundedBox>
      <RoundedBox args={[0.34, 0.44, 0.06]} radius={0.01} position={[0.02, 0, 0.02]}>
        <meshStandardMaterial color="#fef9c3" roughness={0.9} />
      </RoundedBox>
      <RoundedBox args={[0.06, 0.48, 0.12]} radius={0.01} position={[-0.18, 0, 0]}>
        <meshStandardMaterial color="#166534" roughness={0.8} />
      </RoundedBox>
      <mesh position={[0.08, -0.1, 0.06]}>
        <boxGeometry args={[0.04, 0.2, 0.02]} />
        <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.2} />
      </mesh>
    </group>
  );
}

function ScrollModel({ color }) {
  return (
    <group rotation={[0, 0, Math.PI / 2]}>
      <mesh>
        <cylinderGeometry args={[0.12, 0.12, 0.55, 12]} />
        <meshStandardMaterial color="#fef3c7" roughness={0.85} />
      </mesh>
      <Torus args={[0.12, 0.04, 8, 16]} rotation={[Math.PI / 2, 0, 0]} position={[0, 0.28, 0]}>
        {glow(color, 0.4)}
      </Torus>
      <Torus args={[0.12, 0.04, 8, 16]} rotation={[Math.PI / 2, 0, 0]} position={[0, -0.28, 0]}>
        {glow(color, 0.4)}
      </Torus>
      <Sphere args={[0.08, 8, 8]} position={[0, 0, 0.14]}>
        {glow('#dc2626', 0.5)}
      </Sphere>
    </group>
  );
}

function StarModel({ color }) {
  return (
    <group>
      <mesh>
        <octahedronGeometry args={[0.32, 0]} />
        {glow(color, 0.85)}
      </mesh>
      <Ring args={[0.38, 0.48, 16]} rotation={[Math.PI / 2, 0, 0]}>
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.55} transparent opacity={0.65} side={THREE.DoubleSide} />
      </Ring>
    </group>
  );
}

function ChipModel({ color }) {
  return (
    <group>
      <RoundedBox args={[0.42, 0.08, 0.42]} radius={0.02}>
        <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.2} />
      </RoundedBox>
      <RoundedBox args={[0.28, 0.1, 0.28]} radius={0.01} position={[0, 0.04, 0]}>
        {glow(color, 0.65)}
      </RoundedBox>
      {[[-0.15, 0.15], [0.15, 0.15], [-0.15, -0.15], [0.15, -0.15]].map(([x, z], i) => (
        <mesh key={i} position={[x, -0.06, z]}>
          <boxGeometry args={[0.04, 0.04, 0.04]} />
          <meshStandardMaterial color="#94a3b8" metalness={1} />
        </mesh>
      ))}
    </group>
  );
}

function TokenModel({ color }) {
  return (
    <group rotation={[Math.PI / 2, 0, 0]}>
      <mesh>
        <cylinderGeometry args={[0.28, 0.28, 0.08, 20]} />
        {glow(color, 0.5)}
      </mesh>
      <Torus args={[0.28, 0.03, 8, 24]} rotation={[Math.PI / 2, 0, 0]}>
        <meshStandardMaterial color="#fcd34d" metalness={0.9} roughness={0.1} emissive="#fcd34d" emissiveIntensity={0.25} />
      </Torus>
      <RoundedBox args={[0.12, 0.12, 0.04]} radius={0.01} position={[0, 0.05, 0]}>
        <meshStandardMaterial color="#fef08a" emissive="#fef08a" emissiveIntensity={0.15} />
      </RoundedBox>
    </group>
  );
}

function GemModel({ color }) {
  return (
    <group>
      <mesh>
        <icosahedronGeometry args={[0.28, 0]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.55} metalness={0.4} roughness={0.1} transparent opacity={0.92} />
      </mesh>
      <mesh scale={0.55}>
        <icosahedronGeometry args={[0.28, 0]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.35} />
      </mesh>
    </group>
  );
}

function NoteModel({ color }) {
  return (
    <group rotation={[0, 0.3, 0]}>
      <RoundedBox args={[0.32, 0.4, 0.04]} radius={0.02}>
        <meshStandardMaterial color="#fffbeb" roughness={0.9} />
      </RoundedBox>
      {[0.1, 0, -0.1].map((y, i) => (
        <mesh key={i} position={[0, y, 0.03]}>
          <boxGeometry args={[0.22, 0.03, 0.01]} />
          {glow(color, 0.25)}
        </mesh>
      ))}
    </group>
  );
}

const MODELS = {
  book: BookModel,
  note: NoteModel,
  knowledge_star: StarModel,
  scroll: ScrollModel,
  project_chip: ChipModel,
  career_token: TokenModel,
  activity_gem: GemModel,
};

const COLORS = {
  book: '#22c55e',
  note: '#fbbf24',
  knowledge_star: '#fde047',
  scroll: '#f97316',
  project_chip: '#38bdf8',
  career_token: '#818cf8',
  activity_gem: '#f472b6',
};

export default function CollectibleMesh({ type = 'book' }) {
  const Model = MODELS[type] || BookModel;
  const color = COLORS[type] || '#a78bfa';
  const spinRef = useRef(null);

  useFrame((_, delta) => {
    if (spinRef.current) {
      spinRef.current.rotation.y += delta * 2.2;
    }
  });

  return (
    <Float speed={2.2} rotationIntensity={0.15} floatIntensity={0.35}>
      <group ref={spinRef}>
        <Model color={color} />
      </group>
    </Float>
  );
}

export { COLORS as COLLECTIBLE_COLORS };
