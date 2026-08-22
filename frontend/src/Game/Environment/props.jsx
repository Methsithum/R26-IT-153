// Small reusable primitive props used to dress the campus.

export function Tree({ position, map, scale = 1 }) {
  const canopy = map?.treeCanopy || "#3f7a3f";
  const trunk = map?.treeTrunk || "#6b4a2b";
  return (
    <group position={position} scale={scale}>
      <mesh castShadow position={[0, 0.7, 0]}>
        <cylinderGeometry args={[0.16, 0.22, 1.4, 8]} />
        <meshStandardMaterial color={trunk} roughness={0.9} />
      </mesh>
      <mesh castShadow position={[0, 1.85, 0]}>
        <sphereGeometry args={[0.85, 10, 8]} />
        <meshStandardMaterial color={canopy} roughness={0.85} />
      </mesh>
      <mesh castShadow position={[0.38, 1.55, 0.12]}>
        <sphereGeometry args={[0.55, 8, 8]} />
        <meshStandardMaterial color={canopy} roughness={0.88} />
      </mesh>
      <mesh castShadow position={[-0.32, 1.62, -0.18]}>
        <sphereGeometry args={[0.48, 8, 8]} />
        <meshStandardMaterial color={canopy} roughness={0.88} />
      </mesh>
    </group>
  );
}

export function LampPost({ position, map }) {
  const glow = Math.max(0.25, map?.lampEmissive ?? 0.6);
  return (
    <group position={position}>
      <mesh castShadow position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.16, 0.18, 0.12, 10]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.4} roughness={0.4} />
      </mesh>
      <mesh castShadow position={[0, 1.35, 0]}>
        <cylinderGeometry args={[0.055, 0.07, 2.5, 8]} />
        <meshStandardMaterial color="#3a3a3a" metalness={0.55} roughness={0.35} />
      </mesh>
      <mesh position={[0, 2.62, 0.18]} rotation={[0.35, 0, 0]}>
        <boxGeometry args={[0.08, 0.08, 0.5]} />
        <meshStandardMaterial color="#2f2f2f" metalness={0.5} />
      </mesh>
      <mesh position={[0, 2.48, 0.42]}>
        <sphereGeometry args={[0.16, 12, 12]} />
        <meshStandardMaterial color="#ffe9a8" emissive="#ffd27a" emissiveIntensity={glow} />
      </mesh>
      {glow > 0.75 && (
        <pointLight position={[0, 2.45, 0.4]} intensity={glow * 1.05} distance={glow > 1.5 ? 9 : 7} color="#ffd27a" />
      )}
    </group>
  );
}

export function Hedge({ position, map, length = 8 }) {
  return (
    <group position={position}>
      <mesh castShadow receiveShadow position={[0, 0.42, 0]}>
        <boxGeometry args={[0.55, 0.84, length]} />
        <meshStandardMaterial color={map?.hedge || "#2f5e2c"} roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.9, 0]}>
        <boxGeometry args={[0.62, 0.18, length * 0.98]} />
        <meshStandardMaterial color={map?.treeCanopy || "#3d7a3a"} roughness={0.95} />
      </mesh>
    </group>
  );
}

export function Bush({ position, map, scale = 1 }) {
  return (
    <group position={position} scale={scale}>
      <mesh castShadow position={[0, 0.32, 0]}>
        <sphereGeometry args={[0.42, 8, 8]} />
        <meshStandardMaterial color={map?.hedge || "#2f5e2c"} roughness={0.95} />
      </mesh>
      <mesh castShadow position={[0.22, 0.28, 0.1]}>
        <sphereGeometry args={[0.28, 8, 8]} />
        <meshStandardMaterial color={map?.treeCanopy || "#3d7a3a"} roughness={0.95} />
      </mesh>
    </group>
  );
}

export function Fence({ position, map }) {
  const rail = map?.curb || "#d2c8b8";
  return (
    <group position={position}>
      {[-1.6, -0.55, 0.55, 1.6].map((z) => (
        <mesh key={z} castShadow position={[0, 0.55, z]}>
          <boxGeometry args={[0.08, 1.1, 0.08]} />
          <meshStandardMaterial color="#6b6258" roughness={0.7} />
        </mesh>
      ))}
      <mesh position={[0, 0.42, 0]}>
        <boxGeometry args={[0.06, 0.08, 3.4]} />
        <meshStandardMaterial color={rail} />
      </mesh>
      <mesh position={[0, 0.82, 0]}>
        <boxGeometry args={[0.06, 0.08, 3.4]} />
        <meshStandardMaterial color={rail} />
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

export function PlanterBox({ position, map }) {
  const hedge = map?.hedge || "#2f5e2c";
  const canopy = map?.treeCanopy || "#3d7a3a";
  return (
    <group position={position}>
      <mesh castShadow receiveShadow position={[0, 0.22, 0]}>
        <boxGeometry args={[0.95, 0.44, 0.7]} />
        <meshStandardMaterial color="#8a6a48" roughness={0.82} />
      </mesh>
      <mesh castShadow position={[0, 0.58, 0]}>
        <sphereGeometry args={[0.36, 8, 8]} />
        <meshStandardMaterial color={hedge} roughness={0.95} />
      </mesh>
      <mesh position={[0.16, 0.52, 0.08]}>
        <sphereGeometry args={[0.22, 8, 8]} />
        <meshStandardMaterial color={canopy} roughness={0.95} />
      </mesh>
    </group>
  );
}

export function Puddle({ position, scale = 1 }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[position[0], 0.045, position[2]]} scale={scale}>
      <circleGeometry args={[0.55, 12]} />
      <meshStandardMaterial color="#6a8896" roughness={0.08} metalness={0.55} transparent opacity={0.72} />
    </mesh>
  );
}

export function Colonnade({ position, map }) {
  const stone = map?.curb || "#8f97a0";
  return (
    <group position={position}>
      <mesh castShadow position={[0, 1.45, 0]}>
        <cylinderGeometry args={[0.16, 0.2, 2.9, 8]} />
        <meshStandardMaterial color={stone} roughness={0.7} />
      </mesh>
      <mesh position={[0, 2.98, 0.15]}>
        <boxGeometry args={[0.7, 0.14, 1.15]} />
        <meshStandardMaterial color={map?.sidewalk || "#9aa3ab"} roughness={0.55} />
      </mesh>
    </group>
  );
}

export function Reed({ position, map, scale = 1 }) {
  const green = map?.treeCanopy || "#3d6e48";
  return (
    <group position={position} scale={scale}>
      {[0, 0.12, -0.1, 0.08].map((x, i) => (
        <mesh key={i} position={[x, 0.55 + (i % 3) * 0.12, (i - 1) * 0.08]} rotation={[0.08, 0, 0.04 * (i - 1)]}>
          <cylinderGeometry args={[0.025, 0.04, 1.15 + i * 0.1, 5]} />
          <meshStandardMaterial color={i % 2 ? green : map?.hedge || "#2f5a38"} roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

export function Bleacher({ position, map, side = 1 }) {
  const wood = "#c4a574";
  const steel = "#6b6258";
  const face = side > 0 ? 0 : Math.PI;
  return (
    <group position={position} rotation={[0, face, 0]}>
      {[0, 1, 2].map((row) => (
        <mesh key={row} castShadow receiveShadow position={[0.15 + row * 0.42, 0.28 + row * 0.38, 0]}>
          <boxGeometry args={[0.7, 0.14, 3.6]} />
          <meshStandardMaterial color={wood} roughness={0.75} />
        </mesh>
      ))}
      <mesh position={[0.95, 0.7, 1.7]}>
        <boxGeometry args={[0.1, 1.4, 0.1]} />
        <meshStandardMaterial color={steel} />
      </mesh>
      <mesh position={[0.95, 0.7, -1.7]}>
        <boxGeometry args={[0.1, 1.4, 0.1]} />
        <meshStandardMaterial color={steel} />
      </mesh>
    </group>
  );
}

export function GoalPost({ position, map }) {
  const white = map?.line || "#f4f1e6";
  return (
    <group position={position}>
      <mesh castShadow position={[-1.15, 1.15, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 2.3, 8]} />
        <meshStandardMaterial color={white} metalness={0.3} roughness={0.4} />
      </mesh>
      <mesh castShadow position={[1.15, 1.15, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 2.3, 8]} />
        <meshStandardMaterial color={white} metalness={0.3} roughness={0.4} />
      </mesh>
      <mesh position={[0, 2.28, 0]}>
        <boxGeometry args={[2.4, 0.08, 0.08]} />
        <meshStandardMaterial color={white} />
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
