import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import { useRunnerStore } from "../state/runnerStore";

const INTERIOR_X = -55;
export const GROUND_Y = 0.95;
export const ROOM_BOUNDS = { minX: -6.2, maxX: 6.2, minZ: -4.8, maxZ: 5.5 };
export const DOOR_LOCAL_Z = 7.35;
export const INSIDE_SPAWN_Z = 3.55;

export function interiorAnchor(entryZ) {
  return [INTERIOR_X, 0, entryZ];
}

export function interiorWorld(entryZ, localX, localZ) {
  const [ix, , iz] = interiorAnchor(entryZ);
  return [ix + localX, GROUND_Y, iz + localZ];
}

export function missionLocalOffset(buildingId) {
  if (buildingId === "lecture-hall") return [0, 0, 0.5];
  if (buildingId === "exam-hall") return [0, 0, -1.1];
  if (buildingId === "library") return [0, 0, -2.6];
  return [0, 0, -2.8];
}

export function missionLabel(interactionType) {
  if (interactionType === "date" || interactionType === "examDate") return "Calendar";
  if (interactionType === "marks") return "Marks desk";
  if (interactionType === "subjectPick") return "Subject board";
  if (interactionType === "examSetup") return "Exam desk";
  if (interactionType === "markTarget") return "Records desk";
  return "Front desk";
}

function Wood({ args, position, color = "#8b5a32", rotation }) {
  return (
    <mesh castShadow receiveShadow position={position} rotation={rotation}>
      <boxGeometry args={args} />
      <meshStandardMaterial color={color} roughness={0.72} />
    </mesh>
  );
}

function WindowPane({ position }) {
  return (
    <group position={position}>
      <mesh position={[0, 0, -0.04]}>
        <boxGeometry args={[2.55, 2.75, 0.12]} />
        <meshStandardMaterial color="#efe6d4" roughness={0.8} />
      </mesh>
      <mesh>
        <planeGeometry args={[2.2, 2.4]} />
        <meshStandardMaterial color="#c5def0" emissive="#8ec4e8" emissiveIntensity={0.45} roughness={0.2} />
      </mesh>
      <mesh position={[0, 0, 0.02]}>
        <boxGeometry args={[0.06, 2.4, 0.04]} />
        <meshStandardMaterial color="#f4ece0" />
      </mesh>
      <mesh position={[0, 0, 0.02]} rotation={[0, 0, Math.PI / 2]}>
        <boxGeometry args={[0.06, 2.2, 0.04]} />
        <meshStandardMaterial color="#f4ece0" />
      </mesh>
    </group>
  );
}

function Bookshelf({ position }) {
  const books = [
    ["#b45309", 0.18],
    ["#1e3a5f", 0.16],
    ["#7f1d1d", 0.2],
    ["#365314", 0.14],
    ["#92400e", 0.18],
    ["#44403c", 0.15],
  ];
  return (
    <group position={position}>
      <Wood args={[1.6, 3.2, 0.45]} position={[0, 1.6, 0]} color="#6f4424" />
      {[-1.1, -0.15, 0.8].map((y) => (
        <Wood key={y} args={[1.5, 0.08, 0.42]} position={[0, 1.6 + y, 0.02]} color="#8a5a32" />
      ))}
      {books.map(([color, w], i) => (
        <mesh key={i} position={[-0.55 + i * 0.22, 1.95, 0.12]}>
          <boxGeometry args={[w, 0.42, 0.18]} />
          <meshStandardMaterial color={color} roughness={0.65} />
        </mesh>
      ))}
    </group>
  );
}

function Desk({ position, width = 2.6 }) {
  return (
    <group position={position}>
      <Wood args={[width, 0.12, 1.15]} position={[0, 0.82, 0]} color="#9a6a3a" />
      <Wood args={[0.12, 0.82, 1.05]} position={[-width / 2 + 0.12, 0.41, 0]} />
      <Wood args={[0.12, 0.82, 1.05]} position={[width / 2 - 0.12, 0.41, 0]} />
    </group>
  );
}

function RoomLights() {
  return (
    <>
      <pointLight position={[0, 5.2, 0]} intensity={18} distance={18} color="#fff4dc" />
      <pointLight position={[-3.2, 4.6, -2]} intensity={8} distance={12} color="#ffe9c4" />
      {[-3.4, 0, 3.4].map((lx) => (
        <mesh key={lx} position={[lx, 5.55, -1]}>
          <sphereGeometry args={[0.16, 10, 10]} />
          <meshStandardMaterial color="#fff6d8" emissive="#ffe7a8" emissiveIntensity={1.2} />
        </mesh>
      ))}
    </>
  );
}

function LibrarySet() {
  return (
    <>
      <Bookshelf position={[-5.4, 0, -4.6]} />
      <Bookshelf position={[-3.6, 0, -4.6]} />
      <Bookshelf position={[3.6, 0, -4.6]} />
      <Bookshelf position={[5.4, 0, -4.6]} />
      <Desk position={[0, 0, -2.6]} width={3.2} />
    </>
  );
}

function LectureSet() {
  return (
    <>
      <mesh position={[0, 2.55, -5.72]}>
        <planeGeometry args={[5.4, 2.3]} />
        <meshStandardMaterial color="#f7f4ec" roughness={0.35} />
      </mesh>
      <mesh position={[0, 2.55, -5.78]}>
        <boxGeometry args={[5.7, 2.55, 0.08]} />
        <meshStandardMaterial color="#d6cbb6" />
      </mesh>
      <Desk position={[-2.1, 0, -1.6]} width={2.1} />
      <Desk position={[2.1, 0, -1.6]} width={2.1} />
      <Desk position={[0, 0, 0.5]} width={2.4} />
    </>
  );
}

function FacultySet() {
  return (
    <>
      <Desk position={[0, 0, -2.8]} width={3} />
      <Wood args={[1.4, 1.6, 0.4]} position={[4.8, 0.8, -4.4]} color="#7a4e28" />
      <mesh position={[-4.7, 1.15, -4.5]}>
        <cylinderGeometry args={[0.22, 0.28, 0.5, 10]} />
        <meshStandardMaterial color="#3f6212" />
      </mesh>
      <mesh position={[-4.7, 1.55, -4.5]}>
        <sphereGeometry args={[0.38, 10, 10]} />
        <meshStandardMaterial color="#4d7c0f" />
      </mesh>
    </>
  );
}

function ExamSet() {
  return (
    <>
      <Desk position={[-2.3, 0, -2.4]} width={1.8} />
      <Desk position={[2.3, 0, -2.4]} width={1.8} />
      <Desk position={[-2.3, 0, 0.2]} width={1.8} />
      <Desk position={[2.3, 0, 0.2]} width={1.8} />
      <Desk position={[0, 0, -1.1]} width={2.2} />
    </>
  );
}

function DoubleDoors() {
  const doorOpen = useRunnerStore((s) => s.doorOpen);
  const angle = doorOpen * 1.45;

  return (
    <group position={[0, 0, 6.08]}>
      <group position={[-1.06, 0, 0]} rotation={[0, -angle, 0]}>
        <mesh castShadow position={[0.52, 1.28, 0]}>
          <boxGeometry args={[1.04, 2.55, 0.09]} />
          <meshStandardMaterial color="#6d3f22" roughness={0.55} />
        </mesh>
        <mesh position={[0.9, 1.28, 0.05]}>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshStandardMaterial color="#d4b483" metalness={0.7} roughness={0.25} />
        </mesh>
      </group>
      <group position={[1.06, 0, 0]} rotation={[0, angle, 0]}>
        <mesh castShadow position={[-0.52, 1.28, 0]}>
          <boxGeometry args={[1.04, 2.55, 0.09]} />
          <meshStandardMaterial color="#6d3f22" roughness={0.55} />
        </mesh>
        <mesh position={[-0.9, 1.28, 0.05]}>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshStandardMaterial color="#d4b483" metalness={0.7} roughness={0.25} />
        </mesh>
      </group>
    </group>
  );
}

function EntranceFacade({ name }) {
  return (
    <group>
      <mesh position={[-4.6, 3, 6.1]}>
        <boxGeometry args={[7, 6.1, 0.3]} />
        <meshStandardMaterial color="#efe6d6" roughness={0.85} />
      </mesh>
      <mesh position={[4.6, 3, 6.1]}>
        <boxGeometry args={[7, 6.1, 0.3]} />
        <meshStandardMaterial color="#efe6d6" roughness={0.85} />
      </mesh>
      <mesh position={[0, 4.62, 6.12]}>
        <boxGeometry args={[2.3, 1.15, 0.34]} />
        <meshStandardMaterial color="#e8dcc8" />
      </mesh>
      <mesh position={[-1.45, 1.55, 6.28]}>
        <cylinderGeometry args={[0.16, 0.18, 3.1, 10]} />
        <meshStandardMaterial color="#d8c4a4" />
      </mesh>
      <mesh position={[1.45, 1.55, 6.28]}>
        <cylinderGeometry args={[0.16, 0.18, 3.1, 10]} />
        <meshStandardMaterial color="#d8c4a4" />
      </mesh>
      <mesh position={[0, 0.12, 6.95]} receiveShadow>
        <boxGeometry args={[3.2, 0.24, 1.6]} />
        <meshStandardMaterial color="#b9a888" />
      </mesh>
      <mesh position={[0, 5.15, 6.32]}>
        <boxGeometry args={[3.4, 0.22, 0.7]} />
        <meshStandardMaterial color="#c9a26a" />
      </mesh>
      <pointLight position={[0, 3.2, 8.2]} intensity={12} distance={14} color="#fff1d6" />
      <Text position={[0, 5.15, 6.7]} fontSize={0.2} color="#5c4324" anchorX="center" anchorY="middle" maxWidth={3.2}>
        {name}
      </Text>
    </group>
  );
}

function FloorGuide({ toZ }) {
  const marks = [4.2, 2.6, 1.1, -0.3];
  return (
    <group>
      {marks
        .filter((z) => z > toZ + 0.8)
        .map((z) => (
          <mesh key={z} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, z]}>
            <ringGeometry args={[0.12, 0.22, 3]} />
            <meshBasicMaterial color="#f5d76e" transparent opacity={0.55} />
          </mesh>
        ))}
    </group>
  );
}

function MissionBeacon({ position, label, active }) {
  const glow = useRef();
  const ring = useRef();
  const near = useRunnerStore((s) => s.nearMission);

  useFrame((state) => {
    const pulse = 0.55 + Math.sin(state.clock.elapsedTime * 3.2) * 0.35;
    if (glow.current) {
      glow.current.material.emissiveIntensity = near ? 1.4 : pulse;
      glow.current.position.y = 1.35 + Math.sin(state.clock.elapsedTime * 2.4) * 0.08;
    }
    if (ring.current) {
      ring.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 2.8) * 0.08);
    }
  });

  if (!active) return null;

  return (
    <group position={position}>
      <pointLight color="#ffe08a" intensity={near ? 3.2 : 1.6} distance={7} />
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <ringGeometry args={[0.7, 1.05, 28]} />
        <meshBasicMaterial color="#f5d76e" transparent opacity={0.7} depthWrite={false} />
      </mesh>
      <mesh ref={glow} position={[0, 1.35, 0]}>
        <octahedronGeometry args={[0.18, 0]} />
        <meshStandardMaterial color="#fff3c4" emissive="#f5d76e" emissiveIntensity={0.9} />
      </mesh>
      <mesh position={[0, 0.95, 0.15]}>
        <boxGeometry args={[0.42, 0.08, 0.32]} />
        <meshStandardMaterial color="#f4efe4" emissive="#f5d76e" emissiveIntensity={0.25} />
      </mesh>
      <Text position={[0, 1.85, 0]} fontSize={0.18} color="#fff6d5" anchorX="center" outlineWidth={0.012} outlineColor="#5c4324">
        {label}
      </Text>
    </group>
  );
}

export default function BuildingInterior({ entryZ, building, interactionType, exploring }) {
  const [x, , z] = interiorAnchor(entryZ);
  const name = building?.name ?? "Campus Building";
  const id = building?.id || "";
  const furniture =
    id === "library" ? (
      <LibrarySet />
    ) : id === "lecture-hall" ? (
      <LectureSet />
    ) : id === "exam-hall" ? (
      <ExamSet />
    ) : (
      <FacultySet />
    );
  const [mx, , mz] = missionLocalOffset(id);

  return (
    <group position={[x, 0, z]}>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[16, 16]} />
        <meshStandardMaterial color="#cbb79a" roughness={0.9} />
      </mesh>
      <mesh position={[0, 5.85, 0]}>
        <boxGeometry args={[16, 0.18, 16]} />
        <meshStandardMaterial color="#f3eee4" />
      </mesh>
      <mesh position={[0, 3, -6.1]}>
        <boxGeometry args={[16, 6.1, 0.28]} />
        <meshStandardMaterial color="#f2eadc" roughness={0.85} />
      </mesh>
      <mesh position={[-7.85, 3, 0]}>
        <boxGeometry args={[0.28, 6.1, 16]} />
        <meshStandardMaterial color="#efe6d6" />
      </mesh>
      <mesh position={[7.85, 3, 0]}>
        <boxGeometry args={[0.28, 6.1, 16]} />
        <meshStandardMaterial color="#efe6d6" />
      </mesh>

      <WindowPane position={[-4.4, 3.15, -5.9]} />
      <WindowPane position={[4.4, 3.15, -5.9]} />

      <EntranceFacade name={name} />
      <DoubleDoors />

      <mesh position={[0, 0.72, -5.55]}>
        <boxGeometry args={[2.1, 0.08, 0.7]} />
        <meshStandardMaterial color="#d4b483" metalness={0.25} roughness={0.4} />
      </mesh>
      <Text position={[0, 0.9, -5.2]} fontSize={0.22} color="#6b4f2e" anchorX="center" anchorY="middle" maxWidth={4}>
        {name}
      </Text>

      {furniture}
      <FloorGuide toZ={mz} />
      <MissionBeacon position={[mx, 0, mz]} label={missionLabel(interactionType)} active={exploring} />
      <RoomLights />
    </group>
  );
}
