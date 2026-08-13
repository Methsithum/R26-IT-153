import { Text } from "@react-three/drei";
import { LANES } from "../state/runnerStore";

// A single lane-based answer gate the player runs through to answer.
export default function AnswerLane({ label, laneIndex, z, active }) {
  const x = LANES[laneIndex];
  return (
    <group position={[x, 0, z]}>
      {/* gate posts */}
      <mesh position={[-0.9, 1.1, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 2.2, 8]} />
        <meshStandardMaterial color={active ? "#7ec2ff" : "#3a5a8f"} />
      </mesh>
      <mesh position={[0.9, 1.1, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 2.2, 8]} />
        <meshStandardMaterial color={active ? "#7ec2ff" : "#3a5a8f"} />
      </mesh>
      {/* translucent panel */}
      <mesh position={[0, 1.3, 0]}>
        <planeGeometry args={[1.8, 1.4]} />
        <meshStandardMaterial
          color={active ? "#2f9e63" : "#1c3f8f"}
          transparent
          opacity={0.4}
          side={2}
        />
      </mesh>
      <Text
        position={[0, 1.3, -0.03]}
        rotation={[0, Math.PI, 0]}
        fontSize={0.3}
        maxWidth={1.7}
        textAlign="center"
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
      >
        {label}
      </Text>
      {/* ground marker */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <circleGeometry args={[0.9, 24]} />
        <meshStandardMaterial color={active ? "#2f9e63" : "#294a7a"} transparent opacity={0.5} />
      </mesh>
    </group>
  );
}
