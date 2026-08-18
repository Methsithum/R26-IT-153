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

/** Low seat — jump over. */
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
      <mesh castShadow position={[-0.5, 0.18, 0.18]}>
        <boxGeometry args={[0.08, 0.36, 0.08]} />
        <meshStandardMaterial color="#6d4428" />
      </mesh>
      <mesh castShadow position={[0.5, 0.18, 0.18]}>
        <boxGeometry args={[0.08, 0.36, 0.08]} />
        <meshStandardMaterial color="#6d4428" />
      </mesh>
    </group>
  );
}

/** High tape between posts — slide under. */
export function Barrier({ position }) {
  return (
    <group position={position}>
      <mesh castShadow position={[-0.72, 0.85, 0]}>
        <cylinderGeometry args={[0.055, 0.06, 1.7, 8]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.4} roughness={0.45} />
      </mesh>
      <mesh castShadow position={[0.72, 0.85, 0]}>
        <cylinderGeometry args={[0.055, 0.06, 1.7, 8]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.4} roughness={0.45} />
      </mesh>
      <mesh castShadow position={[0, 1.58, 0]}>
        <boxGeometry args={[1.52, 0.14, 0.08]} />
        <meshStandardMaterial color="#e23b2f" emissive="#8a120c" emissiveIntensity={0.35} />
      </mesh>
      <mesh position={[0, 1.38, 0.02]}>
        <boxGeometry args={[1.52, 0.08, 0.04]} />
        <meshStandardMaterial color="#f4f1ea" />
      </mesh>
    </group>
  );
}

/** Thin campus sign — jump over. */
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

/** Tall crate wall — change lanes. Jump and slide will not clear it. */
export function Construction({ position }) {
  return (
    <group position={position}>
      <mesh castShadow position={[0, 0.85, 0]}>
        <boxGeometry args={[1.35, 1.7, 0.95]} />
        <meshStandardMaterial color="#c56a22" />
      </mesh>
      <mesh position={[0, 1.78, 0]}>
        <boxGeometry args={[1.42, 0.12, 1.02]} />
        <meshStandardMaterial color="#f0c14b" />
      </mesh>
      <mesh position={[0, 0.95, 0.5]}>
        <boxGeometry args={[0.7, 0.18, 0.04]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
    </group>
  );
}

export const CLEARANCE_BY_KIND = {
  bench: "jump",
  sign: "jump",
  barrier: "slide",
  construction: "block",
};
