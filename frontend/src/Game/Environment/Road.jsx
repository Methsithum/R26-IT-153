import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useRunnerStore } from "../state/runnerStore";

const ROAD_WIDTH = 7.2;
const SPAN = 140; // total length of the following ground strip

export default function Road() {
  const groupRef = useRef();

  useFrame(() => {
    const { posZ } = useRunnerStore.getState();
    if (groupRef.current) {
      groupRef.current.position.z = posZ;
    }
  });

  return (
    <group ref={groupRef}>
      {/* road surface */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[ROAD_WIDTH, SPAN]} />
        <meshStandardMaterial color="#4a4d52" />
      </mesh>

      {/* lane dividers */}
      {[-1.1, 1.1].map((x) => (
        <group key={x}>
          {Array.from({ length: Math.floor(SPAN / 4) }).map((_, i) => (
            <mesh
              key={i}
              position={[x, 0.02, -SPAN / 2 + i * 4]}
              rotation={[-Math.PI / 2, 0, 0]}
            >
              <planeGeometry args={[0.1, 1.6]} />
              <meshStandardMaterial color="#e6e6e6" />
            </mesh>
          ))}
        </group>
      ))}

      {/* sidewalks */}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          receiveShadow
          rotation={[-Math.PI / 2, 0, 0]}
          position={[side * (ROAD_WIDTH / 2 + 1.4), 0.01, 0]}
        >
          <planeGeometry args={[2.6, SPAN]} />
          <meshStandardMaterial color="#b7ada0" />
        </mesh>
      ))}

      {/* grass beyond sidewalks */}
      {[-1, 1].map((side) => (
        <mesh
          key={`grass-${side}`}
          receiveShadow
          rotation={[-Math.PI / 2, 0, 0]}
          position={[side * (ROAD_WIDTH / 2 + 9), 0, 0]}
        >
          <planeGeometry args={[14, SPAN]} />
          <meshStandardMaterial color="#5a8a4a" />
        </mesh>
      ))}
    </group>
  );
}
