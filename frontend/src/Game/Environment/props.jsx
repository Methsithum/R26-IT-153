// Small reusable primitive props used to dress the campus.

export function Tree({ position }) {
  return (
    <group position={position}>
      <mesh castShadow position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.15, 0.2, 1.2, 6]} />
        <meshStandardMaterial color="#6b4a2b" />
      </mesh>
      <mesh castShadow position={[0, 1.7, 0]}>
        <coneGeometry args={[0.9, 1.8, 8]} />
        <meshStandardMaterial color="#3f7a3f" />
      </mesh>
    </group>
  );
}

export function LampPost({ position }) {
  return (
    <group position={position}>
      <mesh castShadow position={[0, 1.2, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 2.4, 6]} />
        <meshStandardMaterial color="#333" />
      </mesh>
      <mesh position={[0, 2.45, 0]}>
        <sphereGeometry args={[0.14, 8, 8]} />
        <meshStandardMaterial color="#ffe9a8" emissive="#ffe9a8" emissiveIntensity={0.6} />
      </mesh>
    </group>
  );
}

export function Bench({ position }) {
  return (
    <group position={position}>
      <mesh castShadow position={[0, 0.35, 0]}>
        <boxGeometry args={[1.2, 0.08, 0.5]} />
        <meshStandardMaterial color="#8a5a35" />
      </mesh>
      <mesh castShadow position={[0, 0.65, -0.22]}>
        <boxGeometry args={[1.2, 0.5, 0.08]} />
        <meshStandardMaterial color="#8a5a35" />
      </mesh>
    </group>
  );
}

export function Barrier({ position }) {
  return (
    <mesh castShadow position={[position[0], 0.5, position[2]]}>
      <boxGeometry args={[1.4, 1, 0.25]} />
      <meshStandardMaterial color="#e0a83c" />
    </mesh>
  );
}

export function CampusSign({ position }) {
  return (
    <group position={position}>
      <mesh castShadow position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 1.2, 6]} />
        <meshStandardMaterial color="#444" />
      </mesh>
      <mesh castShadow position={[0, 1.35, 0]}>
        <boxGeometry args={[0.9, 0.5, 0.06]} />
        <meshStandardMaterial color="#1d4f8c" />
      </mesh>
    </group>
  );
}

export function Construction({ position }) {
  return (
    <group position={position}>
      <mesh castShadow position={[0, 0.4, 0]}>
        <boxGeometry args={[1, 0.8, 0.8]} />
        <meshStandardMaterial color="#d97a2b" />
      </mesh>
      <mesh position={[0, 0.9, 0]}>
        <coneGeometry args={[0.5, 0.3, 4]} />
        <meshStandardMaterial color="#ffcc33" />
      </mesh>
    </group>
  );
}
