import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useRunnerStore } from "../state/runnerStore";
import { useMapTextures } from "./envTextures";

const ROAD_WIDTH = 8.8;
const SPAN = 160;

export default function Road({ map }) {
  const groupRef = useRef();
  const { asphalt, sidewalk, grass } = useMapTextures(map);
  const rainy = map.id === "rainy-walk";
  const sports = map.id === "sports-field";
  const lake = map.id === "lakeside-path";
  const waterSide = lake ? map.waterSide || 1 : 0;

  useFrame(() => {
    const { posZ } = useRunnerStore.getState();
    if (groupRef.current) groupRef.current.position.z = posZ;
  });

  const sidewalkX = ROAD_WIDTH / 2 + 1.45;
  const grassX = ROAD_WIDTH / 2 + 10.2;
  const curbX = ROAD_WIDTH / 2 + 0.12;

  return (
    <group ref={groupRef}>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <planeGeometry args={[ROAD_WIDTH, SPAN]} />
        <meshStandardMaterial
          map={asphalt}
          roughness={rainy ? 0.18 : 0.78}
          metalness={rainy ? 0.42 : 0.08}
        />
      </mesh>

      {[-2.2, 0, 2.2].map((x) => (
        <group key={x}>
          {Array.from({ length: Math.floor(SPAN / 5) }).map((_, i) => (
            <mesh key={i} position={[x, 0.025, -SPAN / 2 + 1.2 + i * 5]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[x === 0 ? 0.16 : 0.1, 1.7]} />
              <meshStandardMaterial color={map.line} roughness={0.4} />
            </mesh>
          ))}
        </group>
      ))}

      {[-1, 1].map((side) => (
        <mesh key={`curb-${side}`} castShadow receiveShadow position={[side * curbX, 0.07, 0]}>
          <boxGeometry args={[0.22, 0.14, SPAN]} />
          <meshStandardMaterial color={map.curb} roughness={0.7} />
        </mesh>
      ))}

      {[-1, 1].map((side) => (
        <mesh
          key={`walk-${side}`}
          receiveShadow
          rotation={[-Math.PI / 2, 0, 0]}
          position={[side * sidewalkX, 0.03, 0]}
        >
          <planeGeometry args={[2.7, SPAN]} />
          <meshStandardMaterial
            map={sidewalk}
            roughness={rainy ? 0.2 : sports ? 0.62 : 0.86}
            metalness={rainy ? 0.28 : 0}
          />
        </mesh>
      ))}

      {sports &&
        [-1, 1].map((side) => (
          <mesh
            key={`lane-${side}`}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[side * sidewalkX, 0.035, 0]}
          >
            <planeGeometry args={[0.12, SPAN]} />
            <meshStandardMaterial color="#ffffff" roughness={0.45} />
          </mesh>
        ))}

      {[-1, 1].map((side) => {
        if (lake && side === waterSide) return null;
        return (
          <mesh
            key={`grass-${side}`}
            receiveShadow
            rotation={[-Math.PI / 2, 0, 0]}
            position={[side * grassX, 0, 0]}
          >
            <planeGeometry args={[16, SPAN]} />
            <meshStandardMaterial map={grass} roughness={0.95} />
          </mesh>
        );
      })}

      {map.water && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[waterSide * 18.2, -0.1, 0]}>
          <planeGeometry args={[16, SPAN]} />
          <meshStandardMaterial color={map.water} roughness={0.08} metalness={0.62} transparent opacity={0.92} />
        </mesh>
      )}
    </group>
  );
}
