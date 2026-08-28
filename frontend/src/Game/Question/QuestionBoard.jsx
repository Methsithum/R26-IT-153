import { Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";

// Floating holographic-style board carrying the question text.
export default function QuestionBoard({ text, z }) {
  const ref = useRef();
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.position.y = 3.4 + Math.sin(clock.elapsedTime * 1.4) * 0.08;
    }
  });

  return (
    <group ref={ref} position={[0, 3.4, z]}>
      <mesh>
        <planeGeometry args={[6.4, 1.8]} />
        <meshStandardMaterial
          color="#0d1b3d"
          emissive="#1c3f8f"
          emissiveIntensity={0.5}
          transparent
          opacity={0.85}
        />
      </mesh>
      <mesh position={[0, 0, -0.01]}>
        <planeGeometry args={[6.7, 2.05]} />
        <meshStandardMaterial color="#7ec2ff" transparent opacity={0.35} />
      </mesh>
      <Text
        position={[0, 0, -0.05]}
        rotation={[0, Math.PI, 0]}
        fontSize={0.42}
        maxWidth={5.6}
        textAlign="center"
        color="#eaf4ff"
        anchorX="center"
        anchorY="middle"
      >
        {text}
      </Text>
    </group>
  );
}
