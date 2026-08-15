import { Text } from "@react-three/drei";

const ROAD_HALF_WIDTH = 3.6;

// Landmark buildings lining the road. These are purely environmental — the
// actual "enter building" flow for special interactions is a scripted
// cinematic (see TransitionManager), not physical contact with these props.
export default function BuildingLandmark({ building }) {
  const x = building.side * (ROAD_HALF_WIDTH + 6);
  // Nameplates sit on the road-facing wall. Drei Text faces +Z by default;
  // yaw so it looks toward the avenue (negative X on the left bank, positive
  // X on the right) instead of showing the mirrored back of the glyphs.
  const rotationY = building.side > 0 ? -Math.PI / 2 : Math.PI / 2;

  return (
    <group position={[x, 0, building.z]}>
      <mesh castShadow receiveShadow position={[0, 3, 0]}>
        <boxGeometry args={[7, 6, 8]} />
        <meshStandardMaterial color={building.color} />
      </mesh>
      {/* roof trim */}
      <mesh position={[0, 6.15, 0]}>
        <boxGeometry args={[7.4, 0.3, 8.4]} />
        <meshStandardMaterial color="#3a3a3a" />
      </mesh>
      {/* entrance, on the road-facing wall */}
      <mesh position={[-building.side * 3.55, 1.1, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[1.6, 2.2, 0.1]} />
        <meshStandardMaterial color="#20242c" />
      </mesh>
      {/* name plate, on the road-facing wall */}
      <group position={[-building.side * 3.6, 4.4, 0]} rotation={[0, rotationY, 0]}>
        <Text
          fontSize={0.42}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          maxWidth={6}
          outlineWidth={0.02}
          outlineColor="#000000"
        >
          {building.name}
        </Text>
      </group>
    </group>
  );
}
