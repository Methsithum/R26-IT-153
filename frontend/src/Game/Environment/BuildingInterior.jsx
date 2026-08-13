import { Text } from "@react-three/drei";

const INTERIOR_X = -55;

export function interiorAnchor(entryZ) {
  return [INTERIOR_X, 0, entryZ];
}

// A small, simple interior — enough to establish "you are inside the
// building." The real mini-game is layered on top as a DOM/UI panel by
// SpecialInteractionRouter; this is just the backdrop.
export default function BuildingInterior({ entryZ, buildingName }) {
  const [x, y, z] = interiorAnchor(entryZ);
  return (
    <group position={[x, y, z]}>
      {/* floor */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[14, 14]} />
        <meshStandardMaterial color="#d8d2c4" />
      </mesh>
      {/* back wall */}
      <mesh position={[0, 3, -6]}>
        <boxGeometry args={[14, 6, 0.3]} />
        <meshStandardMaterial color="#efe9db" />
      </mesh>
      {/* side walls */}
      <mesh position={[-7, 3, 0]}>
        <boxGeometry args={[0.3, 6, 14]} />
        <meshStandardMaterial color="#efe9db" />
      </mesh>
      <mesh position={[7, 3, 0]}>
        <boxGeometry args={[0.3, 6, 14]} />
        <meshStandardMaterial color="#efe9db" />
      </mesh>
      {/* academic board */}
      <mesh position={[0, 3, -5.8]}>
        <boxGeometry args={[4, 2.4, 0.05]} />
        <meshStandardMaterial color="#1d4f2b" />
      </mesh>
      <Text position={[0, 3, -5.75]} fontSize={0.34} color="#fff" anchorX="center" anchorY="middle" maxWidth={3.6}>
        {buildingName}
      </Text>
      {/* desk */}
      <mesh castShadow position={[0, 0.5, -3.4]}>
        <boxGeometry args={[2.4, 0.9, 1]} />
        <meshStandardMaterial color="#7a5636" />
      </mesh>
      {/* pendant lights */}
      {[-3, 0, 3].map((lx) => (
        <mesh key={lx} position={[lx, 5.6, 0]}>
          <sphereGeometry args={[0.2, 8, 8]} />
          <meshStandardMaterial color="#fff3c4" emissive="#fff3c4" emissiveIntensity={0.7} />
        </mesh>
      ))}
    </group>
  );
}
