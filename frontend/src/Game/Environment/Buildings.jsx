import { Text } from "@react-three/drei";

const ROAD_HALF_WIDTH = 3.6;

export default function BuildingLandmark({ building, map }) {
  const x = building.side * (ROAD_HALF_WIDTH + 6.4);
  const rotationY = building.side > 0 ? -Math.PI / 2 : Math.PI / 2;
  const glow = map?.windowEmissive ?? 0.08;
  const body = building.color;

  return (
    <group position={[x, 0, building.z]}>
      <mesh castShadow receiveShadow position={[0, 3.1, 0]}>
        <boxGeometry args={[7.2, 6.2, 8.4]} />
        <meshStandardMaterial color={body} roughness={0.72} />
      </mesh>
      <mesh position={[0, 6.35, 0]}>
        <boxGeometry args={[7.7, 0.28, 8.9]} />
        <meshStandardMaterial color="#2f3238" roughness={0.5} metalness={0.15} />
      </mesh>
      <mesh position={[0, 6.7, 0]}>
        <boxGeometry args={[5.2, 0.55, 6.2]} />
        <meshStandardMaterial color="#3d424a" />
      </mesh>
      <mesh position={[-building.side * 3.62, 1.15, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[1.7, 2.3, 0.12]} />
        <meshStandardMaterial color="#0a0c10" />
      </mesh>
      <mesh position={[-building.side * 3.15, 1.2, 0]}>
        <boxGeometry args={[0.85, 2.4, 1.55]} />
        <meshStandardMaterial color="#07080a" />
      </mesh>
      {[-1.6, 0, 1.6].map((z) =>
        [3.55, 4.85].map((y) => (
          <mesh
            key={`${z}-${y}`}
            position={[-building.side * 3.62, y, z]}
            rotation={[0, Math.PI / 2, 0]}
          >
            <boxGeometry args={[0.7, 0.85, 0.08]} />
            <meshStandardMaterial
              color="#87b8d8"
              emissive="#fde68a"
              emissiveIntensity={glow}
              roughness={0.25}
              metalness={0.2}
            />
          </mesh>
        ))
      )}
      <mesh receiveShadow position={[-building.side * 2.2, 0.12, 0]}>
        <boxGeometry args={[2.6, 0.24, 3.2]} />
        <meshStandardMaterial color={map?.curb || "#d2c8b8"} />
      </mesh>
      <group position={[-building.side * 3.68, 5.55, 0]} rotation={[0, rotationY, 0]}>
        <Text
          fontSize={0.4}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          maxWidth={6.2}
          outlineWidth={0.02}
          outlineColor="#000000"
        >
          {building.name}
        </Text>
      </group>
    </group>
  );
}
