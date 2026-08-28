import { Text } from "@react-three/drei";
import { LANES } from "../state/runnerStore";

const LANE_COLORS = ["#fbbf24", "#38bdf8", "#a78bfa", "#34d399"];

export default function AnswerLane({ label, laneIndex, z, active }) {
  const x = LANES[laneIndex];
  const color = LANE_COLORS[laneIndex];

  return (
    <group position={[x, 0, z]}>
      <mesh position={[-1.05, 1.35, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 2.7, 8]} />
        <meshStandardMaterial color={active ? color : "#3a5a8f"} />
      </mesh>
      <mesh position={[1.05, 1.35, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 2.7, 8]} />
        <meshStandardMaterial color={active ? color : "#3a5a8f"} />
      </mesh>
      <mesh position={[0, 1.55, 0]}>
        <planeGeometry args={[2.15, 1.85]} />
        <meshStandardMaterial
          color={active ? "#10233f" : "#0d1b3d"}
          transparent
          opacity={0.88}
          side={2}
        />
      </mesh>
      <mesh position={[0, 1.55, 0.02]}>
        <planeGeometry args={[2.28, 1.98]} />
        <meshStandardMaterial color={color} transparent opacity={active ? 0.45 : 0.28} side={2} />
      </mesh>
      <Text
        position={[0, 2.22, -0.04]}
        rotation={[0, Math.PI, 0]}
        fontSize={0.28}
        color={color}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.012}
        outlineColor="#071018"
      >
        {`${laneIndex + 1}`}
      </Text>
      <Text
        position={[0, 1.42, -0.04]}
        rotation={[0, Math.PI, 0]}
        fontSize={0.26}
        maxWidth={1.95}
        lineHeight={1.15}
        textAlign="center"
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.014}
        outlineColor="#071018"
      >
        {label}
      </Text>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <circleGeometry args={[0.95, 24]} />
        <meshStandardMaterial color={color} transparent opacity={0.45} />
      </mesh>
    </group>
  );
}
